#!/bin/bash
#
# cross_check_auto.sh - AI 크로스체크 완전 자동화 스크립트 (v2.0)
# Claude(Maker) <-> Gemini(Reviewer) 자동 협업
#
# 사용법:
#   ./cross_check_auto.sh design <설계요청파일> [출력디렉토리]
#   ./cross_check_auto.sh implement <구현요청파일> [출력디렉토리]
#   ./cross_check_auto.sh full <요청파일> [출력디렉토리] [--max-rounds N]
#
# 옵션:
#   --max-rounds N : 최대 크로스체크 횟수 (기본: 3)
#
# 예시:
#   ./cross_check_auto.sh design docs/design_request.md
#   ./cross_check_auto.sh full docs/request.md output --max-rounds 5
#
# 주의:
#   - 이 스크립트는 자동으로 커밋하지 않습니다
#   - 모든 테스트 완료 후 사용자가 직접 검토하고 커밋하세요
#

set -e
set -o pipefail  # 파이프라인에서 에러 발생 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ROUNDS=3  # 무한루프 방지: 최대 크로스체크 횟수
LOG_DIR="logs/cross_check_auto"
CLAUDE_MODEL_ID="claude-sonnet-4-5"  # 명시적인 전체 모델 ID
GEMINI_MODEL="gemini-3-pro-preview"
MAX_RETRIES=3  # API 재시도 횟수
RETRY_DELAY=5  # 재시도 대기 시간 (초)

# 임시 파일 목록 (정리용)
TEMP_FILES=()

# 함수: 로그 출력
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }
log_ai() { echo -e "${MAGENTA}[AI]${NC} $1"; }

# 함수: 임시 파일 정리 (trap)
cleanup() {
    if [ ${#TEMP_FILES[@]} -gt 0 ]; then
        log_info "임시 파일 정리 중..."
        for temp_file in "${TEMP_FILES[@]}"; do
            rm -f "$temp_file" 2>/dev/null || true
        done
    fi
}

trap cleanup EXIT INT TERM

# 함수: 사용법
usage() {
    echo "사용법: $0 <모드> <요청파일> [출력디렉토리] [옵션]"
    echo ""
    echo "모드:"
    echo "  design     - 설계 크로스체크 (Claude 설계 → Gemini 검토)"
    echo "  implement  - 구현 크로스체크 (Claude 구현 → Gemini 검토)"
    echo "  test       - 테스트 크로스체크 (Claude 테스트 → Gemini 검토)"
    echo "  full       - 전체 파이프라인 (설계 → 구현 → 테스트)"
    echo ""
    echo "옵션:"
    echo "  --max-rounds N    : 최대 크로스체크 횟수 (기본: 3)"
    echo ""
    echo "주의:"
    echo "  - 자동 커밋하지 않음 (사용자가 직접 검토 후 커밋)"
    echo "  - 무한루프 방지: 최대 ${MAX_ROUNDS}회 교차검증 후 중단"
    exit 1
}

# 함수: 타임스탬프 생성
get_timestamp() {
    date +"%Y-%m-%d_%H%M%S"
}

# 함수: 파일 크기 검증
validate_file_size() {
    local file="$1"
    local max_size=102400  # 100KB

    if [ ! -f "$file" ]; then
        return 1
    fi

    local file_size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    if [ "$file_size" -gt "$max_size" ]; then
        log_error "파일이 너무 큽니다: $file (${file_size} bytes, 최대 ${max_size} bytes)"
        return 1
    fi
    return 0
}

# 함수: Claude Code CLI 자동 호출 (재시도 포함)
run_claude_auto() {
    local prompt="$1"
    local output_file="$2"
    local task_name="${3:-claude_task}"

    log_ai "Claude ($CLAUDE_MODEL_ID) 실행 중..."
    log_info "프롬프트: ${prompt:0:100}..."

    # 안전한 임시 파일 생성 (mktemp)
    local temp_response=$(mktemp /tmp/claude_response.XXXXXX)
    TEMP_FILES+=("$temp_response")

    local retry=0
    while [ $retry -lt $MAX_RETRIES ]; do
        if claude -m "$CLAUDE_MODEL_ID" "$prompt" > "$temp_response" 2>&1; then
            # 성공 시 output_file로 복사
            cp "$temp_response" "$output_file"
            log_success "Claude 응답 저장: $output_file"

            # 로그 디렉토리에도 백업
            mkdir -p "$LOG_DIR"
            cp "$temp_response" "$LOG_DIR/$(get_timestamp)_${task_name}.log"

            return 0
        fi

        retry=$((retry + 1))
        if [ $retry -lt $MAX_RETRIES ]; then
            log_warn "Claude 실행 실패 (시도 $retry/$MAX_RETRIES). ${RETRY_DELAY}초 후 재시도..."
            sleep $RETRY_DELAY
        fi
    done

    log_error "Claude 실행 최종 실패!"
    cat "$temp_response"
    return 1
}

# 함수: Gemini CLI 자동 호출 (재시도 포함)
run_gemini_auto() {
    local prompt="$1"
    local output_file="$2"
    local task_name="${3:-gemini_task}"

    log_ai "Gemini ($GEMINI_MODEL) 실행 중..."
    log_info "프롬프트: ${prompt:0:100}..."

    # 안전한 임시 파일 생성 (mktemp)
    local temp_response=$(mktemp /tmp/gemini_response.XXXXXX)
    TEMP_FILES+=("$temp_response")

    local retry=0
    while [ $retry -lt $MAX_RETRIES ]; do
        if gemini -m "$GEMINI_MODEL" --yolo "$prompt" > "$temp_response" 2>&1; then
            cp "$temp_response" "$output_file"
            log_success "Gemini 응답 저장: $output_file"

            # 로그 디렉토리에도 백업
            mkdir -p "$LOG_DIR"
            cp "$temp_response" "$LOG_DIR/$(get_timestamp)_${task_name}.log"

            return 0
        fi

        retry=$((retry + 1))
        if [ $retry -lt $MAX_RETRIES ]; then
            log_warn "Gemini 실행 실패 (시도 $retry/$MAX_RETRIES). ${RETRY_DELAY}초 후 재시도..."
            sleep $RETRY_DELAY
        fi
    done

    log_error "Gemini 실행 최종 실패!"
    cat "$temp_response"
    return 1
}

# 함수: 결과 파일에서 승인/반려 판정 (개선 버전)
check_approval() {
    local review_file="$1"

    if [ ! -f "$review_file" ]; then
        log_warn "리뷰 파일이 존재하지 않습니다: $review_file"
        return 1
    fi

    # 파일의 마지막 20줄에서만 판정 키워드 검색 (결론 부분)
    local conclusion=$(tail -20 "$review_file")

    # 명시적 반려 키워드 우선 확인
    if echo "$conclusion" | grep -qiE "\[(반려|수정.*필요|REJECTED)\]"; then
        log_info "판정: 반려 (명시적 키워드 발견)"
        return 1  # 명시적 반려
    fi

    # 명시적 승인 키워드 확인
    if echo "$conclusion" | grep -qiE "\[(승인|APPROVED|LGTM)\]"; then
        log_info "판정: 승인 (명시적 키워드 발견)"
        return 0  # 명시적 승인
    fi

    # 명시적 판정이 없으면 반려 처리 (안전 우선)
    log_warn "명시적 판정 키워드가 없습니다. 안전을 위해 반려 처리합니다."
    log_warn "리뷰 파일 마지막 부분에 [승인] 또는 [수정 필요]를 명시하도록 AI에게 요청하세요."
    return 1
}

# 함수: 변경사항 해시 계산 (무한루프 방지)
get_changes_hash() {
    git diff HEAD 2>/dev/null | md5sum 2>/dev/null | awk '{print $1}' || echo "no_git"
}

# 함수: 커밋 가이드 출력
show_commit_guide() {
    local phase="$1"  # design, implement, test, full
    local output_dir="$2"

    echo ""
    log_success "=========================================="
    log_success "  AI 크로스체크 완료!"
    log_success "=========================================="
    echo ""
    log_info "결과 디렉토리: $output_dir"
    echo ""

    # 변경사항 확인
    if git diff --quiet && git diff --cached --quiet; then
        log_info "변경사항 없음 (설계 단계이거나 코드 변경이 없음)"
    else
        log_warn "변경된 파일이 있습니다. 검토 후 커밋하세요."
        echo ""
        echo "변경된 파일 목록:"
        git status --short
        echo ""

        # 민감 파일 경고
        local sensitive=$(git status --porcelain | grep -E '(\\.env|\\.key|credential|secret|password|token)' || true)
        if [ -n "$sensitive" ]; then
            log_error "⚠️  민감 정보 파일 감지!"
            echo "$sensitive"
            log_error "커밋 전에 반드시 확인하세요!"
            echo ""
        fi

        # 추천 커밋 메시지
        local commit_msg=""
        case "$phase" in
            design)
                commit_msg="feat: add design document (AI cross-checked by Claude + Gemini)"
                ;;
            implement)
                commit_msg="feat: implement feature (AI cross-checked by Claude + Gemini)"
                ;;
            test)
                commit_msg="test: add tests (AI cross-checked by Claude + Gemini)"
                ;;
            full)
                commit_msg="feat: complete feature with design, implementation, and tests (AI cross-checked)"
                ;;
        esac

        log_info "추천 커밋 명령어:"
        echo ""
        echo "  git add -A"
        echo "  git commit -m \"$commit_msg\""
        echo "  git push"
        echo ""
    fi

    log_info "상세 로그: $LOG_DIR"
    log_info "테스트 리포트: $output_dir"
    echo ""
}

# 함수: 테스트 결과 문서 생성
generate_test_report() {
    local output_dir="$1"
    local round="$2"
    local test_result="$3"
    local review_file="$4"

    local report_file="$output_dir/TEST_REPORT_v${round}.md"

    cat > "$report_file" <<EOF
# 테스트 리포트 - Round $round

**생성 시각**: $(date '+%Y-%m-%d %H:%M:%S')

---

## 1. 테스트 실행 결과

\`\`\`
$(cat "$test_result" 2>/dev/null || echo "테스트 결과 없음")
\`\`\`

---

## 2. Gemini 리뷰 결과

$(cat "$review_file" 2>/dev/null || echo "리뷰 없음")

---

## 3. 판정

$(if check_approval "$review_file"; then echo "✅ **승인**"; else echo "❌ **수정 필요**"; fi)

---

*이 리포트는 cross_check_auto.sh에 의해 자동 생성되었습니다.*
EOF

    log_success "테스트 리포트 생성: $report_file"
}

# 함수: 설계 크로스체크 (자동)
cross_check_design_auto() {
    local request_file="$1"
    local output_dir="$2"
    local round=1
    local prev_hash=""

    log_step "=== 설계 크로스체크 시작 (자동 모드) ==="
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"

    # 파일 크기 검증
    if ! validate_file_size "$request_file"; then
        return 1
    fi

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        local design_file="$output_dir/design_v${round}.md"
        local review_file="$output_dir/design_review_v${round}.md"

        # 무한루프 방지: 변경사항 해시 비교
        local curr_hash=$(get_changes_hash)
        if [ $round -gt 1 ] && [ -n "$prev_hash" ] && [ "$curr_hash" = "$prev_hash" ]; then
            log_error "변경사항 없음 - 무한루프 감지!"
            log_error "이전 라운드와 동일한 상태입니다."
            return 1
        fi
        prev_hash="$curr_hash"

        # Step 1: Claude가 설계 작성
        local design_prompt
        if [ $round -eq 1 ]; then
            design_prompt="다음 파일을 읽고 상세한 설계서를 작성해줘:

$(cat "$request_file")

설계서는 다음 항목을 포함해야 해:
1. 요구사항 분석
2. 시스템 아키텍처
3. 주요 컴포넌트 설계
4. 데이터 모델
5. API 명세 (있다면)
6. 예상 문제점 및 해결 방안

설계서를 작성하고, 결과만 출력해줘."
        else
            local prev_review="$output_dir/design_review_v$((round-1)).md"
            design_prompt="이전 설계서에 대한 피드백:

$(cat "$prev_review")

위 피드백을 반영하여 설계서를 수정해줘. 수정된 설계서만 출력해줘."
        fi

        # Claude 실행
        if ! run_claude_auto "$design_prompt" "$design_file" "design_r${round}"; then
            log_error "Claude 실행 실패 (Round $round)"
            return 1
        fi

        # Step 2: Gemini가 설계 검토
        local review_prompt="다음 설계서를 검토해줘:

$(cat "$design_file")

원본 요청사항:
$(cat "$request_file")

검토 항목:
1. 요구사항 충족 여부
2. 아키텍처 적합성
3. 확장성 및 유지보수성
4. 잠재적 문제점
5. 보안 고려사항

검토 결과를 작성하고, 마지막 줄에 반드시 다음 중 하나를 명시해줘:
- [승인] : 설계가 적합함
- [수정 필요] : 개선이 필요함 (구체적인 수정 사항 명시)"

        if ! run_gemini_auto "$review_prompt" "$review_file" "design_review_r${round}"; then
            log_error "Gemini 실행 실패 (Round $round)"
            return 1
        fi

        # Step 3: 승인 여부 확인
        if check_approval "$review_file"; then
            log_success "✓ 설계 승인됨! (Round $round)"

            # 최종 파일로 복사
            cp "$design_file" "$output_dir/design_final.md"
            log_success "최종 설계서: $output_dir/design_final.md"

            return 0
        fi

        log_warn "설계 수정 필요 (Round $round)"

        # 다음 라운드 준비
        round=$((round + 1))
    done

    # 최대 라운드 초과
    log_error "=========================================="
    log_error "최대 크로스체크 횟수($MAX_ROUNDS회) 초과!"
    log_error "사용자 개입이 필요합니다."
    log_error ""
    log_error "마지막 설계서: $output_dir/design_v${MAX_ROUNDS}.md"
    log_error "마지막 리뷰: $output_dir/design_review_v${MAX_ROUNDS}.md"
    log_error "=========================================="

    return 1
}

# 함수: 구현 크로스체크 (자동)
cross_check_implement_auto() {
    local request_file="$1"
    local output_dir="$2"
    local round=1
    local prev_hash=""

    log_step "=== 구현 크로스체크 시작 (자동 모드) ==="
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"

    if ! validate_file_size "$request_file"; then
        return 1
    fi

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        local impl_log="$output_dir/impl_v${round}.log"
        local review_file="$output_dir/impl_review_v${round}.md"

        # 무한루프 방지: 변경사항 해시 비교
        local curr_hash=$(get_changes_hash)
        if [ $round -gt 1 ] && [ -n "$prev_hash" ] && [ "$curr_hash" = "$prev_hash" ]; then
            log_error "변경사항 없음 - 무한루프 감지!"
            log_error "이전 라운드와 동일한 변경사항입니다."
            return 1
        fi
        prev_hash="$curr_hash"

        # Step 1: Claude가 구현
        local impl_prompt
        if [ $round -eq 1 ]; then
            impl_prompt="다음 설계서를 읽고 코드를 구현해줘:

$(cat "$request_file")

구현 시 주의사항:
1. CLAUDE.md의 코딩 규칙 준수
2. 보안 취약점 최소화
3. 테스트 가능한 코드 작성
4. 명확한 주석 작성 (복잡한 로직만)

구현 완료 후, 변경된 파일 목록과 주요 변경사항을 요약해줘."
        else
            local prev_review="$output_dir/impl_review_v$((round-1)).md"
            impl_prompt="이전 구현에 대한 피드백:

$(cat "$prev_review")

위 피드백을 반영하여 코드를 수정해줘. 수정 완료 후 변경사항을 요약해줘."
        fi

        # Claude 실행
        if ! run_claude_auto "$impl_prompt" "$impl_log" "impl_r${round}"; then
            log_error "Claude 실행 실패 (Round $round)"
            return 1
        fi

        # Step 2: 변경사항 자동 감지 (git diff)
        log_info "변경사항 감지 중..."
        local diff_file="$output_dir/changes_v${round}.diff"
        git diff --name-only > "$diff_file" 2>/dev/null || true
        git diff > "$output_dir/changes_v${round}_full.diff" 2>/dev/null || true

        if [ ! -s "$diff_file" ]; then
            log_warn "변경된 파일이 없습니다. (Round $round)"
        else
            log_info "변경된 파일:"
            cat "$diff_file"
        fi

        # Step 3: Gemini가 코드 리뷰
        local review_prompt="다음 구현을 검토해줘:

변경된 파일 목록:
$(cat "$diff_file" 2>/dev/null || echo "파일 목록 없음")

구현 로그:
$(cat "$impl_log")

변경사항 상세 (diff):
$(cat "$output_dir/changes_v${round}_full.diff" 2>/dev/null | head -500)

원본 요청사항:
$(cat "$request_file")

검토 항목:
1. 요구사항 충족 여부
2. 코드 품질 (가독성, 유지보수성)
3. 잠재적 버그 또는 보안 취약점
4. 성능 이슈
5. 테스트 커버리지

검토 결과를 작성하고, 마지막 줄에 반드시 다음 중 하나를 명시해줘:
- [승인] : 구현이 적합함
- [수정 필요] : 개선이 필요함 (구체적인 수정 사항 명시)"

        if ! run_gemini_auto "$review_prompt" "$review_file" "impl_review_r${round}"; then
            log_error "Gemini 실행 실패 (Round $round)"
            return 1
        fi

        # Step 4: 승인 여부 확인
        if check_approval "$review_file"; then
            log_success "✓ 구현 승인됨! (Round $round)"
            return 0
        fi

        log_warn "구현 수정 필요 (Round $round)"

        # 다음 라운드 준비
        round=$((round + 1))
    done

    # 최대 라운드 초과
    log_error "=========================================="
    log_error "최대 크로스체크 횟수($MAX_ROUNDS회) 초과!"
    log_error "사용자 개입이 필요합니다."
    log_error ""
    log_error "마지막 구현 로그: $output_dir/impl_v${MAX_ROUNDS}.log"
    log_error "마지막 리뷰: $output_dir/impl_review_v${MAX_ROUNDS}.md"
    log_error "=========================================="

    return 1
}

# 함수: 테스트 크로스체크 (자동, 강화된 로깅)
cross_check_test_auto() {
    local request_file="$1"
    local output_dir="$2"
    local round=1
    local prev_hash=""

    log_step "=== 테스트 크로스체크 시작 (자동 모드) ==="
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"

    if ! validate_file_size "$request_file"; then
        return 1
    fi

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        local test_result="$output_dir/test_result_v${round}.log"
        local review_file="$output_dir/test_review_v${round}.md"

        # 무한루프 방지: 변경사항 해시 비교
        local curr_hash=$(get_changes_hash)
        if [ $round -gt 1 ] && [ -n "$prev_hash" ] && [ "$curr_hash" = "$prev_hash" ]; then
            log_error "변경사항 없음 - 무한루프 감지!"
            log_error "이전 라운드와 동일한 상태입니다."
            return 1
        fi
        prev_hash="$curr_hash"

        # Step 1: Claude가 테스트 작성 및 실행 (상세 로깅)
        local test_prompt
        if [ $round -eq 1 ]; then
            test_prompt="다음 설계/구현에 대한 테스트를 작성하고 실행해줘:

$(cat "$request_file")

테스트 작성 시 주의사항:
1. 단위 테스트 (unit test) 우선
2. 엣지 케이스 테스트
3. 에러 처리 테스트
4. Mock/Stub 적절히 활용

테스트 작성 후 실행하고, 다음 형식으로 결과를 출력해줘:

## 테스트 케이스 1: [테스트명]
- 입력 데이터: [입력값]
- 예상 결과: [예상값]
- 실제 결과: [실제값]
- 상태: [PASS/FAIL]

## 테스트 케이스 2: ...
(각 테스트마다 위 형식 반복)

## 전체 요약
- 총 테스트: N개
- 성공: N개
- 실패: N개
- 커버리지: N%
"
        else
            local prev_review="$output_dir/test_review_v$((round-1)).md"
            test_prompt="이전 테스트에 대한 피드백:

$(cat "$prev_review")

위 피드백을 반영하여 테스트를 수정하고 실행해줘. 실행 결과를 위와 동일한 형식으로 출력해줘."
        fi

        # Claude 실행
        if ! run_claude_auto "$test_prompt" "$test_result" "test_r${round}"; then
            log_error "Claude 실행 실패 (Round $round)"
            return 1
        fi

        # Step 2: Gemini가 테스트 커버리지 및 품질 리뷰
        local review_prompt="다음 테스트 결과를 검토해줘:

$(cat "$test_result")

원본 요청사항:
$(cat "$request_file")

검토 항목:
1. 테스트 커버리지 충분성 (엣지 케이스 포함 여부)
2. 각 테스트 케이스의 입력/예상/실제 결과 적절성
3. 테스트 코드 가독성
4. Mock/Stub 적절성
5. 실패한 테스트가 있다면 원인 분석

검토 결과를 작성하고, 마지막 줄에 반드시 다음 중 하나를 명시해줘:
- [승인] : 테스트가 적합함
- [수정 필요] : 개선이 필요함 (구체적인 수정 사항 명시)"

        if ! run_gemini_auto "$review_prompt" "$review_file" "test_review_r${round}"; then
            log_error "Gemini 실행 실패 (Round $round)"
            return 1
        fi

        # Step 3: 테스트 리포트 생성
        generate_test_report "$output_dir" "$round" "$test_result" "$review_file"

        # Step 4: 승인 여부 확인
        if check_approval "$review_file"; then
            log_success "✓ 테스트 승인됨! (Round $round)"
            return 0
        fi

        log_warn "테스트 수정 필요 (Round $round)"

        # 다음 라운드 준비
        round=$((round + 1))
    done

    # 최대 라운드 초과
    log_error "=========================================="
    log_error "최대 크로스체크 횟수($MAX_ROUNDS회) 초과!"
    log_error "사용자 개입이 필요합니다."
    log_error ""
    log_error "마지막 테스트 결과: $output_dir/test_result_v${MAX_ROUNDS}.log"
    log_error "마지막 리뷰: $output_dir/test_review_v${MAX_ROUNDS}.md"
    log_error "=========================================="

    return 1
}

# 함수: 전체 파이프라인 (설계 → 구현 → 테스트)
run_full_pipeline_auto() {
    local request_file="$1"
    local output_dir="$2"

    log_step "=== 전체 크로스체크 파이프라인 (자동) ==="
    log_info "설계 → 구현 → 테스트 순서로 진행합니다."
    echo ""

    # 1. 설계
    log_step "[Phase 1/3] 설계 크로스체크"
    if ! cross_check_design_auto "$request_file" "$output_dir/design"; then
        log_error "설계 단계에서 실패. 파이프라인 중단."
        return 1
    fi

    # 2. 구현
    log_step "[Phase 2/3] 구현 크로스체크"
    if ! cross_check_implement_auto "$output_dir/design/design_final.md" "$output_dir/impl"; then
        log_error "구현 단계에서 실패. 파이프라인 중단."
        return 1
    fi

    # 3. 테스트
    log_step "[Phase 3/3] 테스트 크로스체크"
    if ! cross_check_test_auto "$output_dir/design/design_final.md" "$output_dir/test"; then
        log_error "테스트 단계에서 실패. 파이프라인 중단."
        return 1
    fi

    return 0
}

# 메인
main() {
    # 옵션 파싱
    local mode=""
    local request_file=""
    local output_dir=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --max-rounds)
                MAX_ROUNDS="$2"
                shift 2
                ;;
            *)
                if [ -z "$mode" ]; then
                    mode="$1"
                elif [ -z "$request_file" ]; then
                    request_file="$1"
                elif [ -z "$output_dir" ]; then
                    output_dir="$1"
                fi
                shift
                ;;
        esac
    done

    # 필수 인자 확인
    if [ -z "$mode" ] || [ -z "$request_file" ]; then
        usage
    fi

    # 기본 출력 디렉토리
    output_dir="${output_dir:-output/cross_check_auto_$(get_timestamp)}"

    # 요청 파일 확인
    if [ ! -f "$request_file" ]; then
        log_error "요청 파일이 존재하지 않습니다: $request_file"
        exit 1
    fi

    log_info "=========================================="
    log_info "  AI 크로스체크 완전 자동화 시스템 v2.0"
    log_info "=========================================="
    log_info "모드: $mode"
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"
    log_info "최대 라운드: $MAX_ROUNDS"
    log_info "=========================================="
    echo ""

    local result=0
    case "$mode" in
        design)
            if cross_check_design_auto "$request_file" "$output_dir"; then
                show_commit_guide "design" "$output_dir"
            else
                result=1
            fi
            ;;
        implement|impl)
            if cross_check_implement_auto "$request_file" "$output_dir"; then
                show_commit_guide "implement" "$output_dir"
            else
                result=1
            fi
            ;;
        test)
            if cross_check_test_auto "$request_file" "$output_dir"; then
                show_commit_guide "test" "$output_dir"
            else
                result=1
            fi
            ;;
        full|pipeline)
            if run_full_pipeline_auto "$request_file" "$output_dir"; then
                show_commit_guide "full" "$output_dir"
            else
                result=1
            fi
            ;;
        *)
            log_error "알 수 없는 모드: $mode"
            usage
            ;;
    esac

    exit $result
}

main "$@"
