#!/bin/bash
#
# analyze_project.sh - AI 기반 프로젝트 분석 및 문서 자동 생성
#
# 사용법:
#   ./analyze_project.sh <프로젝트_경로...> [모드] [옵션]
#
# 모드:
#   full  - 전체 분석 (기본값)
#   diff  - 변경된 파일만 분석
#   scan  - 구조 스캔만 (문서 생성 안함)
#   cost  - 비용 견적만 표시
#
# 옵션:
#   --with-db           - DB 스키마 분석 포함 (Node.js 필요)
#   --db-config <file>  - DB 분석용 설정 파일 (.ai-analyzer.json)
#
# 예시:
#   ./analyze_project.sh /path/to/project
#   ./analyze_project.sh /path/to/project1 /path/to/project2 scan
#   ./analyze_project.sh /path/to/project full --db-config .ai-analyzer.json
#

set -euo pipefail  # Bash strict mode

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AIIGNORE_FILE=".aiignore"
DEFAULT_EXTENSIONS="java,js,ts,tsx,py,go,rs,kt,scala,rb,php,cs,cpp,c,h"
COST_PER_1K_TOKENS=0.003  # Claude Sonnet 기준 (입력)
OUTPUT_COST_PER_1K_TOKENS=0.015  # Claude Sonnet 기준 (출력)

# 함수: 사용법 출력
usage() {
    echo "사용법: $0 <프로젝트_경로...> [모드] [옵션]"
    echo ""
    echo "모드:"
    echo "  full  - 전체 분석 (기본값)"
    echo "  diff  - 변경된 파일만 분석"
    echo "  scan  - 구조 스캔만 (문서 생성 안함)"
    echo "  cost  - 비용 견적만 표시"
    echo ""
    echo "옵션:"
    echo "  --with-db           - DB 스키마 분석 포함 (Node.js 필요)"
    echo "  --db-config <file>  - DB 분석용 설정 파일 (.ai-analyzer.json)"
    echo ""
    echo "예시:"
    echo "  $0 /path/to/project"
    echo "  $0 /path/to/project1 /path/to/project2 full"
    exit 1
}

# 함수: 로그 출력
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 함수: .aiignore 파일 로드
load_aiignore() {
    local project_path="$1"
    local ignore_file="$project_path/$AIIGNORE_FILE"

    IGNORE_PATTERNS=()

    # 기본 제외 패턴
    IGNORE_PATTERNS+=(
        "node_modules"
        ".git"
        "dist"
        "build"
        "target"
        ".gradle"
        "__pycache__"
        ".venv"
        "venv"
        "*.min.js"
        "*.map"
        "*.lock"
        "package-lock.json"
        "yarn.lock"
    )

    # .aiignore 파일이 있으면 추가 로드
    if [ -f "$ignore_file" ]; then
        log_info ".aiignore 파일 발견: $ignore_file"
        while IFS= read -r line || [ -n "$line" ]; do
            # 주석과 빈 줄 건너뛰기
            [[ "$line" =~ ^#.*$ ]] && continue
            [[ -z "${line// }" ]] && continue
            IGNORE_PATTERNS+=("$line")
        done < "$ignore_file"
    fi
}

# 함수: find 제외 옵션 생성
build_find_excludes() {
    local excludes=""
    for pattern in "${IGNORE_PATTERNS[@]}"; do
        # 디렉토리 패턴
        if [[ "$pattern" == */ ]]; then
            excludes="$excludes -path '*/${pattern%/}' -prune -o"
        elif [[ "$pattern" != *"*"* ]]; then
            excludes="$excludes -path '*/$pattern' -prune -o -path '*/$pattern/*' -prune -o"
        fi
    done
    echo "$excludes"
}

# 함수: 프로젝트 타입 감지
detect_project_type() {
    local project_path="$1"

    PROJECT_TYPE="unknown"

    if [ -f "$project_path/build.gradle" ] || [ -f "$project_path/build.gradle.kts" ]; then
        PROJECT_TYPE="gradle"
    elif [ -f "$project_path/pom.xml" ]; then
        PROJECT_TYPE="maven"
    elif [ -f "$project_path/package.json" ]; then
        PROJECT_TYPE="nodejs"
    elif [ -f "$project_path/requirements.txt" ] || [ -f "$project_path/pyproject.toml" ]; then
        PROJECT_TYPE="python"
    elif [ -f "$project_path/Cargo.toml" ]; then
        PROJECT_TYPE="rust"
    elif [ -f "$project_path/go.mod" ]; then
        PROJECT_TYPE="go"
    fi

    echo "$PROJECT_TYPE"
}

# 함수: 소스 파일 목록 수집
collect_source_files() {
    local project_path="$1"
    local mode="$2"

    local files=()

    if [ "$mode" = "diff" ]; then
        # Git diff 모드
        if [ -d "$project_path/.git" ]; then
            cd "$project_path"
            mapfile -t files < <(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only HEAD 2>/dev/null || echo "")
            cd - > /dev/null
        else
            log_warn "Git 저장소가 아닙니다. full 모드로 전환합니다."
            mode="full"
        fi
    fi

    if [ "$mode" = "full" ] || [ ${#files[@]} -eq 0 ]; then
        # 전체 스캔 모드
        local excludes=$(build_find_excludes)
        local ext_pattern=""

        IFS=',' read -ra EXTS <<< "$DEFAULT_EXTENSIONS"
        for ext in "${EXTS[@]}"; do
            if [ -z "$ext_pattern" ]; then
                ext_pattern="-name '*.$ext'"
            else
                ext_pattern="$ext_pattern -o -name '*.$ext'"
            fi
        done

        # find 명령 실행
        eval "find '$project_path' $excludes -type f \( $ext_pattern \) -print 2>/dev/null" | sort
    else
        printf '%s\n' "${files[@]}"
    fi
}

# 함수: 파일 크기 및 토큰 계산
calculate_tokens() {
    local project_path="$1"
    local mode="$2"

    local total_bytes=0
    local file_count=0

    while IFS= read -r file; do
        if [ -f "$project_path/$file" ] || [ -f "$file" ]; then
            local filepath="$file"
            [ ! -f "$file" ] && filepath="$project_path/$file"
            local size=$(wc -c < "$filepath" 2>/dev/null || echo 0)
            total_bytes=$((total_bytes + size))
            file_count=$((file_count + 1))
        fi
    done < <(collect_source_files "$project_path" "$mode")

    # 토큰 추정 (약 4 바이트 = 1 토큰)
    local estimated_tokens=$((total_bytes / 4))

    echo "$file_count $total_bytes $estimated_tokens"
}

# 함수: 비용 견적 출력
show_cost_estimate() {
    local project_path="$1"
    local mode="$2"

    log_info "비용 견적 계산 중 ($project_path)..."

    read -r file_count total_bytes estimated_tokens <<< $(calculate_tokens "$project_path" "$mode")

    # 비용 계산 (입력 토큰 + 예상 출력 토큰)
    local input_cost=$(awk "BEGIN {printf \"%.4f\", $estimated_tokens * $COST_PER_1K_TOKENS / 1000}")
    local output_tokens=$((estimated_tokens / 10))  # 출력은 입력의 약 10%로 가정
    local output_cost=$(awk "BEGIN {printf \"%.4f\", $output_tokens * $OUTPUT_COST_PER_1K_TOKENS / 1000}")
    local total_cost=$(awk "BEGIN {printf \"%.4f\", $input_cost + $output_cost}")

    echo "  - 파일: $file_count 개"
    echo "  - 크기: $(numfmt --to=iec $total_bytes 2>/dev/null || echo "${total_bytes} bytes")"
    echo "  - 예상 비용: \$$total_cost"

    # 전역 변수에 누적
    TOTAL_ESTIMATED_COST=$(awk "BEGIN {printf \"%.4f\", $TOTAL_ESTIMATED_COST + $total_cost}")
}

# 함수: Gradle 의존성 추출
extract_gradle_dependencies() {
    local build_file="$1"
    if [ -f "$build_file" ]; then
        echo "  주요 의존성:"
        grep -E "implementation|api|compile" "$build_file" 2>/dev/null | \
            grep -oE "'[^']+'" | tr -d "'" | head -15 | while read -r dep; do
            echo "    - $dep"
        done
    fi
}

# 함수: Maven 의존성 추출
extract_maven_dependencies() {
    local pom_file="$1"
    if [ -f "$pom_file" ]; then
        echo "  주요 의존성:"
        grep -A2 "<dependency>" "$pom_file" 2>/dev/null | \
            grep -E "<groupId>|<artifactId>" | \
            sed 's/.*<groupId>\(.*\)<\/groupId>.*/\1/' | \
            sed 's/.*<artifactId>\(.*\)<\/artifactId>.*/:\1/' | \
            tr -d '\n' | sed 's/::/\n/g' | head -15 | while read -r dep; do
            [ -n "$dep" ] && echo "    - $dep"
        done
    fi
}

# 함수: package.json 의존성 추출
extract_npm_dependencies() {
    local pkg_file="$1"
    if [ -f "$pkg_file" ]; then
        echo "  dependencies:"
        # JSON에서 패키지명만 추출 (버전 제외)
        sed -n '/"dependencies"/,/}/p' "$pkg_file" 2>/dev/null | \
            grep -E '^\s+"[a-zA-Z@][^"]*":' | head -10 | \
            sed 's/.*"\([^"]*\)":.*/    - \1/'
        echo "  devDependencies:"
        sed -n '/"devDependencies"/,/}/p' "$pkg_file" 2>/dev/null | \
            grep -E '^\s+"[a-zA-Z@][^"]*":' | head -5 | \
            sed 's/.*"\([^"]*\)":.*/    - \1/'
    fi
}

# 함수: Python 의존성 추출
extract_python_dependencies() {
    local project_path="$1"

    # requirements.txt
    if [ -f "$project_path/requirements.txt" ]; then
        echo "  requirements.txt:"
        grep -v "^#" "$project_path/requirements.txt" 2>/dev/null | \
            grep -v "^$" | head -15 | while read -r dep; do
            echo "    - $dep"
        done
    fi

    # pyproject.toml
    if [ -f "$project_path/pyproject.toml" ]; then
        echo "  pyproject.toml dependencies:"
        grep -A30 "\[project\]" "$project_path/pyproject.toml" 2>/dev/null | \
            grep -E '^\s+"' | head -10 | \
            sed 's/.*"\([^"]*\)".*/    - \1/'
    fi
}

# 함수: Node.js 모노레포 감지 및 분석
analyze_nodejs_monorepo() {
    local project_path="$1"

    echo ""
    echo "모노레포 구조:"

    # 일반적인 모노레포 디렉토리
    for subdir in "client" "server" "frontend" "backend" "packages" "apps"; do
        if [ -d "$project_path/$subdir" ]; then
            if [ -f "$project_path/$subdir/package.json" ]; then
                local name=$(grep '"name"' "$project_path/$subdir/package.json" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)".*/\1/' | tail -1)
                echo "  - $subdir/ (package: $name)"
            else
                echo "  - $subdir/"
            fi
        fi
    done
}

# 함수: Node.js API 라우트 스캔
scan_nodejs_routes() {
    local project_path="$1"

    echo ""
    echo "API 라우트 (Express/Fastify):"

    # Express 라우터 패턴
    find "$project_path" -type f \( -name "*.js" -o -name "*.ts" \) \
        ! -path "*/node_modules/*" 2>/dev/null | \
        xargs grep -h -E "(app|router)\.(get|post|put|delete|patch)\s*\(" 2>/dev/null | \
        grep -oE "(get|post|put|delete|patch)\s*\(['\"][^'\"]*['\"]" | \
        sed "s/.*['\"]\\([^'\"]*\\)['\"].*/  - \\1/" | sort -u | head -15
}

# 함수: Python 컴포넌트 분류
classify_python_components() {
    local project_path="$1"

    echo ""
    echo "Python 컴포넌트:"

    # Flask/FastAPI 라우트
    local routes=$(find "$project_path" -type f -name "*.py" \
        ! -path "*/.venv/*" ! -path "*/venv/*" 2>/dev/null | \
        xargs grep -l "@app.route\|@router\|@app.get\|@app.post" 2>/dev/null | wc -l)
    echo "  - API Routes: $routes 개"

    # Models
    local models=$(find "$project_path" -type f -name "*model*.py" \
        ! -path "*/.venv/*" 2>/dev/null | wc -l)
    echo "  - Models: $models 개"

    # Tests
    local tests=$(find "$project_path" -type f -name "test_*.py" \
        ! -path "*/.venv/*" 2>/dev/null | wc -l)
    echo "  - Tests: $tests 개"
}

# 함수: 컴포넌트 분류 (Controller/Service/Repository)
classify_components() {
    local project_path="$1"

    echo ""
    echo "컴포넌트 분류:"

    # Controller 찾기
    local controllers=$(find "$project_path" -type f -name "*Controller*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | wc -l)
    local ctrl_files=$(find "$project_path" -type f -name "*Ctrl*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | wc -l)
    echo "  - Controllers: $((controllers + ctrl_files)) 개"

    # Service 찾기
    local services=$(find "$project_path" -type f -name "*Service*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | wc -l)
    local svc_files=$(find "$project_path" -type f -name "*Svc*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | wc -l)
    echo "  - Services: $((services + svc_files)) 개"

    # Repository 찾기
    local repos=$(find "$project_path" -type f \( -name "*Repository*.java" -o -name "*Repo*.java" -o -name "*Dao*.java" \) \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | wc -l)
    echo "  - Repositories/DAOs: $repos 개"

    # Entity/Model 찾기
    local entities=$(find "$project_path" -type f \( -name "*Entity*.java" -o -name "*Model*.java" -o -name "*Dto*.java" -o -name "*VO*.java" \) \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | wc -l)
    echo "  - Entities/DTOs: $entities 개"

    # Config 찾기
    local configs=$(find "$project_path" -type f -name "*Config*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | wc -l)
    echo "  - Configs: $configs 개"
}

# 함수: 설정 파일 분석
analyze_config_files() {
    local project_path="$1"

    echo ""
    echo "설정 파일 분석:"

    # application.yml 분석
    local app_yml="$project_path/src/main/resources/application.yml"
    [ ! -f "$app_yml" ] && app_yml="$project_path/application.yml"

    if [ -f "$app_yml" ]; then
        echo "  application.yml:"
        # 포트
        local port=$(grep -E "^\s*port:" "$app_yml" 2>/dev/null | head -1 | awk '{print $2}')
        [ -n "$port" ] && echo "    - server.port: $port"
        # context-path
        local ctx=$(grep -E "context-path:" "$app_yml" 2>/dev/null | head -1 | awk '{print $2}')
        [ -n "$ctx" ] && echo "    - context-path: $ctx"
        # DB 종류 추정
        if grep -q "mysql" "$app_yml" 2>/dev/null; then
            echo "    - database: MySQL"
        elif grep -q "postgresql\|postgres" "$app_yml" 2>/dev/null; then
            echo "    - database: PostgreSQL"
        elif grep -q "oracle" "$app_yml" 2>/dev/null; then
            echo "    - database: Oracle"
        elif grep -q "h2" "$app_yml" 2>/dev/null; then
            echo "    - database: H2"
        fi
        # 프로파일
        local profiles=$(grep -E "profiles:" "$app_yml" 2>/dev/null | head -1)
        [ -n "$profiles" ] && echo "    - $profiles"
    fi

    # application.properties 분석
    local app_props="$project_path/src/main/resources/application.properties"
    [ ! -f "$app_props" ] && app_props="$project_path/application.properties"

    if [ -f "$app_props" ]; then
        echo "  application.properties:"
        grep -E "^server\.|^spring\.datasource\." "$app_props" 2>/dev/null | head -5 | while read -r line; do
            echo "    - $line"
        done
    fi
}

# 함수: API 엔드포인트 스캔
scan_api_endpoints() {
    local project_path="$1"

    echo ""
    echo "API 엔드포인트 (샘플):"

    # @RequestMapping, @GetMapping 등에서 추출
    # sed로 따옴표 안의 경로 추출
    find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -h -E "@(Request|Get|Post|Put|Delete|Patch)Mapping" 2>/dev/null | \
        sed -n 's/.*@[A-Za-z]*Mapping[^"]*"\([^"]*\)".*/\1/p' | \
        sort -u | head -15 | while read -r endpoint; do
        [ -n "$endpoint" ] && echo "  - $endpoint"
    done
}

# 함수: 엔티티 및 테이블 분석
analyze_entities() {
    local project_path="$1"

    echo ""
    echo "엔티티/테이블 분석:"

    # @Entity 클래스와 @Table 추출
    echo "  주요 테이블:"
    find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -l "@Entity" 2>/dev/null | head -30 | while read -r file; do
        # 테이블명 추출
        local table=$(grep -E "@Table.*name\s*=" "$file" 2>/dev/null | \
            sed -n 's/.*name\s*=\s*"\([^"]*\)".*/\1/p' | head -1)
        # 클래스명 추출
        local class=$(grep -E "public class" "$file" 2>/dev/null | \
            sed -n 's/.*class \([A-Za-z0-9_]*\).*/\1/p' | head -1)
        if [ -n "$table" ]; then
            echo "    - $table ($class)"
        elif [ -n "$class" ]; then
            echo "    - $class"
        fi
    done | head -20

    # 연관관계 분석
    echo ""
    echo "  연관관계:"
    # @OneToMany
    local one_to_many=$(find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -h "@OneToMany" 2>/dev/null | wc -l)
    # @ManyToOne
    local many_to_one=$(find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -h "@ManyToOne" 2>/dev/null | wc -l)
    # @ManyToMany
    local many_to_many=$(find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -h "@ManyToMany" 2>/dev/null | wc -l)
    # @OneToOne
    local one_to_one=$(find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -h "@OneToOne" 2>/dev/null | wc -l)

    echo "    - @OneToMany: $one_to_many 개"
    echo "    - @ManyToOne: $many_to_one 개"
    echo "    - @ManyToMany: $many_to_many 개"
    echo "    - @OneToOne: $one_to_one 개"

    # 연관관계 샘플 (어떤 엔티티가 어떤 엔티티를 참조하는지)
    echo ""
    echo "  연관관계 샘플:"
    find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -B5 -A1 "@ManyToOne\|@OneToMany" 2>/dev/null | \
        grep -E "class |private.*;" | \
        sed 's/.*class \([A-Za-z]*\).*/[\1]/' | \
        sed 's/.*private \([A-Za-z<>]*\) \([a-zA-Z]*\);/  -> \1/' | \
        tr '\n' ' ' | sed 's/\[/\n[/g' | grep "->" | head -10
}

# 함수: 공통코드 분석
analyze_common_codes() {
    local project_path="$1"

    echo ""
    echo "공통코드 분석:"

    # 공통코드 관련 파일 찾기 (일반적인 패턴)
    local code_files=$(find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -l "CommonCode\|CodeGroup\|CG[0-9]\|CODE_" 2>/dev/null | wc -l)
    echo "  공통코드 관련 파일: $code_files 개"

    # Enum 패턴 찾기
    echo ""
    echo "  Enum 클래스:"
    find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -l "public enum" 2>/dev/null | while read -r file; do
        local enum_name=$(grep "public enum" "$file" 2>/dev/null | \
            sed -n 's/.*enum \([A-Za-z0-9_]*\).*/\1/p' | head -1)
        [ -n "$enum_name" ] && echo "    - $enum_name"
    done | head -15

    # 코드 그룹 패턴 찾기 (CG로 시작하는 상수 등)
    echo ""
    echo "  코드 그룹 (샘플):"
    find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -ohE 'CG[0-9]{3,4}|CODE_[A-Z_]+' 2>/dev/null | \
        sort -u | head -15 | while read -r code; do
        echo "    - $code"
    done
}

# 함수: DB 스키마 힌트 추출
analyze_db_schema_hints() {
    local project_path="$1"

    echo ""
    echo "DB 스키마 힌트:"

    # @Column 에서 컬럼 정보 추출
    echo "  주요 컬럼 (샘플):"
    find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -h "@Column" 2>/dev/null | \
        sed -n 's/.*name\s*=\s*"\([^"]*\)".*/\1/p' | \
        sort -u | head -15 | while read -r col; do
        [ -n "$col" ] && echo "    - $col"
    done

    # @JoinColumn 에서 FK 정보 추출
    echo ""
    echo "  외래키 (FK):"
    find "$project_path" -type f -name "*.java" \
        ! -path "*/.git/*" ! -path "*/build/*" ! -path "*/target/*" 2>/dev/null | \
        xargs grep -h "@JoinColumn" 2>/dev/null | \
        sed -n 's/.*name\s*=\s*"\([^"]*\)".*/\1/p' | \
        sort -u | head -10 | while read -r fk; do
        [ -n "$fk" ] && echo "    - $fk"
    done
}

# 함수: DB 스키마 분석 (Node.js db_analyzer 호출)
# Exit Codes: 0=성공, 1=에러, 2=설정필요(템플릿 생성됨)
analyze_db_schema() {
    local project_path="$1"
    local db_config="$2"

    echo ""
    echo "DB 스키마 분석:"

    # Node.js 존재 확인
    if ! command -v node &> /dev/null; then
        log_warn "Node.js가 설치되어 있지 않습니다. DB 분석을 건너뜁니다."
        log_warn "Node.js 설치 후 다시 시도하세요: https://nodejs.org/"
        return 1
    fi

    local db_analyzer_dir="$SCRIPT_DIR/db_analyzer"

    # db_analyzer 존재 확인
    if [ ! -d "$db_analyzer_dir" ]; then
        log_warn "DB 분석기가 없습니다: $db_analyzer_dir"
        return 1
    fi

    # node_modules 확인 및 자동 설치
    if [ ! -d "$db_analyzer_dir/node_modules" ]; then
        log_info "DB 분석기 의존성 설치 중..."
        (cd "$db_analyzer_dir" && npm install --silent)
        if [ $? -ne 0 ]; then
            log_error "의존성 설치 실패"
            return 1
        fi
        log_success "의존성 설치 완료"
    fi

    # 출력 파일 경로
    local output_file="$project_path/docs/db_schema.json"
    mkdir -p "$project_path/docs"

    # DB 분석기 실행 (비대화형 모드 사용)
    local db_cmd="node '$db_analyzer_dir/index.js' --non-interactive"

    if [ -n "$db_config" ] && [ -f "$db_config" ]; then
        # 설정 파일 사용
        db_cmd="$db_cmd --config '$db_config'"
    else
        # 프로젝트에서 DB 설정 자동 추출
        db_cmd="$db_cmd --extract-from '$project_path'"
    fi

    db_cmd="$db_cmd --output '$output_file'"

    log_info "DB 분석 실행 중..."
    eval $db_cmd
    local exit_code=$?

    case $exit_code in
        0)
            # 성공
            if [ -f "$output_file" ]; then
                log_success "DB 스키마 분석 완료: $output_file"

                # 결과 요약 출력
                local table_count=$(grep -c '"name":' "$output_file" 2>/dev/null || echo "0")
                local code_count=$(grep -c '"table":' "$output_file" 2>/dev/null || echo "0")
                echo "  - 테이블: $table_count 개"
                echo "  - 공통코드 테이블: $code_count 개"
            fi
            return 0
            ;;
        2)
            # 설정 필요 (템플릿 생성됨)
            log_warn "DB 설정이 불완전합니다."
            log_info "생성된 템플릿: $project_path/.ai-analyzer-template.json"
            log_info ""
            log_info "다음 단계:"
            log_info "  1. 템플릿 파일을 편집하여 DB 연결 정보 입력"
            log_info "  2. .ai-analyzer.json으로 저장"
            log_info "  3. 다시 실행: ./analyze_project.sh $project_path scan --db-config .ai-analyzer.json"
            log_info ""
            log_info "또는 AI 사용자의 경우:"
            log_info "  - 템플릿 파일을 읽고 사용자에게 DB 정보 질문"
            log_info "  - 답변으로 .ai-analyzer.json 생성"
            log_info "  - 다시 실행"
            return 2
            ;;
        *)
            # 에러
            log_error "DB 분석 실패 (exit code: $exit_code)"
            return 1
            ;;
    esac
}

# 함수: 프로젝트 구조 스캔 (확장)
scan_project_structure() {
    local project_path="$1"
    local output_file="${2:-}"
    local with_db="${3:-false}"
    local db_config="${4:-}"

    log_info "프로젝트 구조 스캔 중: $project_path"

    local project_type=$(detect_project_type "$project_path")
    log_info "감지된 프로젝트 타입: $project_type"

    # 출력 함수 (파일 또는 stdout)
    output() {
        if [ -n "$output_file" ]; then
            echo "$1" >> "$output_file"
        else
            echo "$1"
        fi
    }

    # 출력 파일 초기화
    [ -n "$output_file" ] && > "$output_file"

    output ""
    output "=========================================="
    output "        프로젝트 구조 분석 결과"
    output "=========================================="
    output ""
    output "프로젝트 경로: $project_path"
    output "프로젝트 타입: $project_type"
    output "분석 일시: $(date '+%Y-%m-%d %H:%M:%S')"
    output ""

    # 주요 디렉토리 구조
    output "주요 디렉토리:"
    find "$project_path" -maxdepth 2 -type d \
        ! -path "*/.git*" \
        ! -path "*/node_modules*" \
        ! -path "*/dist*" \
        ! -path "*/build*" \
        ! -path "*/target*" \
        ! -path "*/.gradle*" \
        ! -path "*/.venv*" \
        ! -path "*/venv*" \
        2>/dev/null | head -30 | while read -r dir; do
        local rel_path="${dir#$project_path}"
        [ -n "$rel_path" ] && output "  $rel_path/"
    done

    output ""

    # 설정 파일 목록
    output "설정 파일:"
    for config_file in "package.json" "build.gradle" "build.gradle.kts" "pom.xml" \
                       "requirements.txt" "pyproject.toml" "Cargo.toml" "go.mod" \
                       "application.yml" "application.properties" ".env.example" \
                       "docker-compose.yml" "Dockerfile"; do
        [ -f "$project_path/$config_file" ] && output "  - $config_file"
    done

    # 의존성 추출 (프로젝트 타입별)
    output ""
    output "의존성:"
    case "$project_type" in
        gradle)
            extract_gradle_dependencies "$project_path/build.gradle"
            ;;
        maven)
            extract_maven_dependencies "$project_path/pom.xml"
            ;;
        nodejs)
            extract_npm_dependencies "$project_path/package.json"
            ;;
        python)
            extract_python_dependencies "$project_path"
            ;;
    esac

    # 프로젝트 타입별 분석
    case "$project_type" in
        gradle|maven)
            classify_components "$project_path"
            analyze_config_files "$project_path"
            scan_api_endpoints "$project_path"
            analyze_entities "$project_path"
            analyze_common_codes "$project_path"
            analyze_db_schema_hints "$project_path"
            ;;
        nodejs)
            analyze_nodejs_monorepo "$project_path"
            scan_nodejs_routes "$project_path"
            ;;
        python)
            classify_python_components "$project_path"
            ;;
    esac

    # DB 스키마 분석 (--with-db 옵션)
    if [ "$with_db" = "true" ]; then
        analyze_db_schema "$project_path" "$db_config"
    fi

    output ""
    output "=========================================="

    [ -n "$output_file" ] && log_success "스캔 결과 저장: $output_file"
}

# 함수: 다중 프로젝트 관계 분석
analyze_multi_project_relations() {
    local output_file="$1"
    shift
    local project_paths=("$@")

    echo "" >> "$output_file"
    echo "==========================================" >> "$output_file"
    echo "        다중 프로젝트 관계 분석" >> "$output_file"
    echo "==========================================" >> "$output_file"
    echo "" >> "$output_file"

    local project_names=()
    for p in "${project_paths[@]}"; do
        project_names+=("$(basename "$p")")
    done

    for i in "${!project_paths[@]}"; do
        local p="${project_paths[$i]}"
        local name="${project_names[$i]}"
        
        echo "프로젝트: $name" >> "$output_file"
        
        # 참조 감지 (단순 문자열 매칭)
        local refs=()
        for other_name in "${project_names[@]}"; do
            [ "$name" == "$other_name" ] && continue
            
            # build.gradle, pom.xml 등에서 다른 프로젝트 이름이 나오는지 확인
            if grep -r "$other_name" "$p" --include="build.gradle" --include="pom.xml" --include="package.json" --include="settings.gradle" > /dev/null 2>&1; then
                refs+=("$other_name")
            fi
        done
        
        if [ ${#refs[@]} -gt 0 ]; then
            echo "  -> 참조함: ${refs[*]}" >> "$output_file"
        else
            echo "  -> 명시적 참조 없음" >> "$output_file"
        fi
        echo "" >> "$output_file"
    done
}

# 함수: AI 분석 실행
run_ai_analysis() {
    local mode="$1"
    shift
    local project_paths=("$@")
    
    # 첫 번째 프로젝트를 메인으로 간주 (문서 저장 위치)
    local main_project="${project_paths[0]}"

    log_info "AI 분석 시작..."

    # docs 디렉토리 생성
    local docs_dir="$main_project/docs"
    mkdir -p "$docs_dir"
    mkdir -p "$docs_dir/features"
    mkdir -p "$docs_dir/api"
    mkdir -p "$docs_dir/drafts"

    log_info "문서 디렉토리 생성: $docs_dir"

    # 분석용 컨텍스트 파일 생성
    local context_file="$docs_dir/.analysis-context.md"

    cat > "$context_file" << EOF
# 프로젝트 분석 컨텍스트

## 기본 정보
- 분석 일시: $(date '+%Y-%m-%d %H:%M:%S')
- 분석 모드: $mode
- 분석 대상 프로젝트 수: ${#project_paths[@]}

## 프로젝트 목록
EOF
    for p in "${project_paths[@]}"; do
        echo "- $(basename "$p") ($p)" >> "$context_file"
    done

    echo "" >> "$context_file"
    echo "## 상세 분석 내용" >> "$context_file"

    # 각 프로젝트별 파일 목록 및 구조 추가
    for p in "${project_paths[@]}"; do
        echo "### 프로젝트: $(basename "$p")" >> "$context_file"
        echo "\`\`\`" >> "$context_file"
        collect_source_files "$p" "$mode" >> "$context_file"
        echo "\`\`\`" >> "$context_file"
        echo "" >> "$context_file"
        
        # 구조 정보도 추가
        scan_project_structure "$p" "$context_file" "false" "" # DB분석은 중복 방지 위해 여기서 제외
    done
    
    # 다중 프로젝트 관계 분석 추가
    if [ ${#project_paths[@]} -gt 1 ]; then
        analyze_multi_project_relations "$context_file" "${project_paths[@]}"
    fi

    log_success "분석 컨텍스트 생성 완료: $context_file"

    echo ""
    echo "=========================================="
    echo "        AI 분석 준비 완료"
    echo "=========================================="
    echo ""
    echo "다음 단계:"
    echo "1. Claude Code 또는 Gemini CLI를 실행하세요"
    echo "2. 다음 프롬프트를 입력하세요:"
    echo ""
    echo "---"
    echo "$docs_dir/.analysis-context.md 파일을 읽고,"
    echo "다중 프로젝트 간의 관계와 각 프로젝트의 역할을 분석하여 다음 문서들을 생성해줘:"
    echo "- docs/README.md (전체 프로젝트 개요 및 관계도)"
    echo "- docs/architecture.md (전체 시스템 아키텍처)"
    echo "- docs/features/index.md (통합 기능 목록)"
    echo "---"
    echo ""
    echo "=========================================="
}

# 메인 실행
main() {
    # 인자 확인
    if [ $# -lt 1 ]; then
        usage
    fi

    local project_paths=()
    local mode="full"
    local with_db="false"
    local db_config=""
    
    # 인자 파싱 (경로 수집)
    while [[ $# -gt 0 && ! "$1" =~ ^- && "$1" != "full" && "$1" != "diff" && "$1" != "scan" && "$1" != "cost" ]]; do
        project_paths+=("$1")
        shift
    done
    
    # 모드 파싱 (옵션이면 건너뜀)
    if [[ $# -gt 0 && ! "$1" =~ ^- ]]; then
        mode="$1"
        shift
    fi

    # 옵션 파싱
    while [ $# -gt 0 ]; do
        case "$1" in
            --with-db)
                with_db="true"
                shift
                ;;
            --db-config)
                if [ -n "$2" ]; then
                    db_config="$2"
                    with_db="true"  # --db-config 지정 시 자동으로 --with-db 활성화
                    shift 2
                else
                    log_error "--db-config 옵션에 설정 파일 경로가 필요합니다."
                    exit 1
                fi
                ;;
            *)
                log_warn "알 수 없는 옵션: $1"
                shift
                ;;
        esac
    done

    # 경로 유효성 확인 및 정규화
    local valid_paths=()
    for p in "${project_paths[@]}"; do
        # realpath로 경로 정규화 (있으면)
        local normalized_path="$p"
        if command -v realpath &> /dev/null; then
            normalized_path=$(realpath "$p" 2>/dev/null || echo "$p")
        fi

        if [ -d "$normalized_path" ]; then
            valid_paths+=("$(cd "$normalized_path" && pwd)")
        else
            log_warn "존재하지 않는 경로 제외: $p"
        fi
    done
    
    if [ ${#valid_paths[@]} -eq 0 ]; then
        log_error "유효한 프로젝트 경로가 없습니다."
        exit 1
    fi

    project_paths=("${valid_paths[@]}")

    log_info "프로젝트 분석 시작 (총 ${#project_paths[@]}개 프로젝트)"
    log_info "분석 모드: $mode"
    [ "$with_db" = "true" ] && log_info "DB 분석: 활성화"

    # 전역 비용 변수 초기화
    TOTAL_ESTIMATED_COST=0

    # .aiignore 로드 (첫 번째 프로젝트 기준)
    load_aiignore "${project_paths[0]}"

    case "$mode" in
        cost)
            for p in "${project_paths[@]}"; do
                show_cost_estimate "$p" "full"
            done
            echo "------------------------------------------"
            echo "총 예상 비용: \$$TOTAL_ESTIMATED_COST"
            ;;
        scan)
            # 구조 스캔
            for p in "${project_paths[@]}"; do
                scan_project_structure "$p" "" "$with_db" "$db_config"
            done
            
            # 다중 프로젝트 관계 분석
            if [ ${#project_paths[@]} -gt 1 ]; then
                 analyze_multi_project_relations "/dev/stdout" "${project_paths[@]}"
            fi
            ;;
        diff)
            for p in "${project_paths[@]}"; do
                show_cost_estimate "$p" "diff"
            done
            echo ""
            echo "총 예상 비용: \$$TOTAL_ESTIMATED_COST"
            read -p "분석을 진행하시겠습니까? (y/n): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                # DB 분석 (필요시)
                if [ "$with_db" = "true" ]; then
                    analyze_db_schema "${project_paths[0]}" "$db_config"
                fi
                run_ai_analysis "diff" "${project_paths[@]}"
            else
                log_info "분석이 취소되었습니다."
            fi
            ;;
        full)
            for p in "${project_paths[@]}"; do
                show_cost_estimate "$p" "full"
            done
            echo ""
            echo "총 예상 비용: \$$TOTAL_ESTIMATED_COST"
            read -p "분석을 진행하시겠습니까? (y/n): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                # DB 분석 (필요시)
                if [ "$with_db" = "true" ]; then
                    analyze_db_schema "${project_paths[0]}" "$db_config"
                fi
                run_ai_analysis "full" "${project_paths[@]}"
            else
                log_info "분석이 취소되었습니다."
            fi
            ;;
        *)
            log_error "알 수 없는 모드: $mode"
            usage
            ;;
    esac
}

# 스크립트 실행
main "$@"
