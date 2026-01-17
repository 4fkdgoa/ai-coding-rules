#!/bin/bash
#
# cross_check_auto.sh - AI 크로스체크 완전 자동화 스크립트
# Claude(Maker) <-> Gemini(Reviewer) 자동 협업
#
# 사용법:
#   ./cross_check_auto.sh design <설계요청파일> [출력디렉토리]
#   ./cross_check_auto.sh implement <구현요청파일> [출력디렉토리]
#   ./cross_check_auto.sh full <요청파일> [출력디렉토리] [--auto-commit] [--auto-pr]
#
# 옵션:
#   --auto-commit  : 승인 시 자동 커밋
#   --auto-pr      : 승인 시 자동 PR 생성
#   --max-rounds N : 최대 크로스체크 횟수 (기본: 3)
#
# 예시:
#   ./cross_check_auto.sh design docs/design_request.md docs/output
#   ./cross_check_auto.sh full docs/request.md output --auto-commit --auto-pr
#

set -e

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
CLAUDE_MODEL="sonnet"  # 구현에는 Sonnet 사용 (빠르고 효율적)
GEMINI_MODEL="gemini-3-pro-preview"
AUTO_COMMIT=false
AUTO_PR=false

# 함수: 로그 출력
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }
log_ai() { echo -e "${MAGENTA}[AI]${NC} $1"; }

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
    echo "  --auto-commit     : 승인 시 자동 커밋"
    echo "  --auto-pr         : 승인 시 자동 PR 생성"
    echo "  --max-rounds N    : 최대 크로스체크 횟수 (기본: 3)"
    echo ""
    echo "무한루프 방지: 최대 ${MAX_ROUNDS}회 교차검증 후 중단"
    exit 1
}

# 함수: 타임스탬프 생성
get_timestamp() {
    date +"%Y-%m-%d_%H%M%S"
}

# 함수: Claude Code CLI 자동 호출 (파일 기반)
run_claude_auto() {
    local prompt="$1"
    local output_file="$2"
    local task_name="${3:-claude_task}"

    log_ai "Claude ($CLAUDE_MODEL) 실행 중..."
    log_info "프롬프트: ${prompt:0:100}..."

    # Claude CLI 실행 (응답을 파일로 저장)
    local temp_response="/tmp/claude_response_$$.txt"

    if claude -m "claude-$CLAUDE_MODEL-4-5" "$prompt" > "$temp_response" 2>&1; then
        # 성공 시 output_file로 복사
        cp "$temp_response" "$output_file"
        log_success "Claude 응답 저장: $output_file"

        # 로그 디렉토리에도 백업
        mkdir -p "$LOG_DIR"
        cp "$temp_response" "$LOG_DIR/$(get_timestamp)_${task_name}.log"

        rm -f "$temp_response"
        return 0
    else
        log_error "Claude 실행 실패!"
        cat "$temp_response"
        rm -f "$temp_response"
        return 1
    fi
}

# 함수: Gemini CLI 자동 호출 (파일 기반)
run_gemini_auto() {
    local prompt="$1"
    local output_file="$2"
    local task_name="${3:-gemini_task}"

    log_ai "Gemini ($GEMINI_MODEL) 실행 중..."
    log_info "프롬프트: ${prompt:0:100}..."

    # Gemini CLI 실행
    local temp_response="/tmp/gemini_response_$$.txt"

    if gemini -m "$GEMINI_MODEL" --yolo "$prompt" > "$temp_response" 2>&1; then
        cp "$temp_response" "$output_file"
        log_success "Gemini 응답 저장: $output_file"

        # 로그 디렉토리에도 백업
        mkdir -p "$LOG_DIR"
        cp "$temp_response" "$LOG_DIR/$(get_timestamp)_${task_name}.log"

        rm -f "$temp_response"
        return 0
    else
        log_error "Gemini 실행 실패!"
        cat "$temp_response"
        rm -f "$temp_response"
        return 1
    fi
}

# 함수: 결과 파일에서 승인/반려 판정
check_approval() {
    local review_file="$1"

    if [ ! -f "$review_file" ]; then
        log_warn "리뷰 파일이 존재하지 않습니다: $review_file"
        return 1
    fi

    # 승인 키워드 확인
    if grep -qiE "(승인|APPROVED|LGTM|통과|문제.*없)" "$review_file" 2>/dev/null; then
        # 반려 키워드가 없으면 승인
        if ! grep -qiE "(반려|REJECTED|수정.*필요|문제.*있|개선.*필요)" "$review_file" 2>/dev/null; then
            return 0  # 승인
        fi
    fi
    return 1  # 반려 또는 수정 필요
}

# 함수: 변경사항 해시 계산 (무한루프 방지)
get_changes_hash() {
    git diff HEAD 2>/dev/null | md5sum | awk '{print $1}'
}

# 함수: 변경사항이 이전과 동일한지 확인
is_same_changes() {
    local prev_hash="$1"
    local curr_hash=$(get_changes_hash)

    [ "$prev_hash" = "$curr_hash" ]
}

# 함수: 자동 커밋
auto_commit() {
    local commit_msg="$1"

    if [ "$AUTO_COMMIT" != "true" ]; then
        log_info "자동 커밋 비활성화 (--auto-commit 플래그 필요)"
        return 0
    fi

    log_step "자동 커밋 시작..."

    # 변경사항 확인
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_info "변경된 파일 목록:"
        git status --short

        # 모든 변경사항 스테이징
        git add -A

        # 커밋
        if git commit -m "$commit_msg"; then
            log_success "커밋 완료: $commit_msg"

            # 원격 저장소로 푸시
            local current_branch=$(git branch --show-current)
            if git push -u origin "$current_branch" 2>&1; then
                log_success "푸시 완료: origin/$current_branch"
                return 0
            else
                log_warn "푸시 실패 - 수동으로 푸시하세요"
                return 1
            fi
        else
            log_error "커밋 실패"
            return 1
        fi
    else
        log_info "변경사항 없음 - 커밋 생략"
        return 0
    fi
}

# 함수: 자동 PR 생성
auto_create_pr() {
    local pr_title="$1"
    local pr_body="$2"

    if [ "$AUTO_PR" != "true" ]; then
        log_info "자동 PR 생성 비활성화 (--auto-pr 플래그 필요)"
        return 0
    fi

    # gh CLI 확인
    if ! command -v gh &> /dev/null; then
        log_warn "GitHub CLI (gh) not found - PR 생성 생략"
        log_info "설치: https://cli.github.com/"
        return 1
    fi

    log_step "자동 PR 생성 시작..."

    local current_branch=$(git branch --show-current)

    # PR 생성
    if gh pr create --title "$pr_title" --body "$pr_body" 2>&1; then
        log_success "PR 생성 완료"
        return 0
    else
        log_warn "PR 생성 실패 - 수동으로 생성하세요"
        return 1
    fi
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

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    local timestamp=$(get_timestamp)

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        local design_file="$output_dir/design_v${round}.md"
        local review_file="$output_dir/design_review_v${round}.md"

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

검토 결과를 작성하고, 마지막에 반드시 다음 중 하나를 명시해줘:
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

            # 자동 커밋
            auto_commit "feat: add design document (approved by Gemini, round $round)"

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

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    local timestamp=$(get_timestamp)

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        local impl_log="$output_dir/impl_v${round}.log"
        local review_file="$output_dir/impl_review_v${round}.md"

        # 현재 변경사항 해시 (무한루프 방지)
        local curr_hash=$(get_changes_hash)
        if [ -n "$prev_hash" ] && [ "$curr_hash" = "$prev_hash" ]; then
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

검토 결과를 작성하고, 마지막에 반드시 다음 중 하나를 명시해줘:
- [승인] : 구현이 적합함
- [수정 필요] : 개선이 필요함 (구체적인 수정 사항 명시)"

        if ! run_gemini_auto "$review_prompt" "$review_file" "impl_review_r${round}"; then
            log_error "Gemini 실행 실패 (Round $round)"
            return 1
        fi

        # Step 4: 승인 여부 확인
        if check_approval "$review_file"; then
            log_success "✓ 구현 승인됨! (Round $round)"

            # 자동 커밋
            auto_commit "feat: implement feature (approved by Gemini, round $round)"

            # 자동 PR 생성
            local pr_body="## Summary
AI 크로스체크를 통해 구현 완료 (Claude + Gemini)

- 총 라운드: $round
- 최종 승인: Gemini
- 리뷰 파일: $review_file

## Changes
$(cat "$diff_file" 2>/dev/null || echo "변경 파일 목록 없음")

## Review Notes
$(cat "$review_file" | head -20)"

            auto_create_pr "feat: implement feature (AI cross-checked)" "$pr_body"

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

# 함수: 테스트 크로스체크 (자동)
cross_check_test_auto() {
    local request_file="$1"
    local output_dir="$2"
    local round=1

    log_step "=== 테스트 크로스체크 시작 (자동 모드) ==="
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    local timestamp=$(get_timestamp)

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        local test_result="$output_dir/test_result_v${round}.log"
        local review_file="$output_dir/test_review_v${round}.md"

        # Step 1: Claude가 테스트 작성 및 실행
        local test_prompt
        if [ $round -eq 1 ]; then
            test_prompt="다음 설계/구현에 대한 테스트를 작성하고 실행해줘:

$(cat "$request_file")

테스트 작성 시 주의사항:
1. 단위 테스트 (unit test) 우선
2. 엣지 케이스 테스트
3. 에러 처리 테스트
4. Mock/Stub 적절히 활용

테스트 작성 후 실행하고, 실행 결과(성공/실패 로그)를 출력해줘."
        else
            local prev_review="$output_dir/test_review_v$((round-1)).md"
            test_prompt="이전 테스트에 대한 피드백:

$(cat "$prev_review")

위 피드백을 반영하여 테스트를 수정하고 실행해줘. 실행 결과를 출력해줘."
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
1. 테스트 커버리지 충분성
2. 엣지 케이스 처리
3. 테스트 코드 가독성
4. Mock/Stub 적절성
5. 실패한 테스트가 있다면 원인 분석

검토 결과를 작성하고, 마지막에 반드시 다음 중 하나를 명시해줘:
- [승인] : 테스트가 적합함
- [수정 필요] : 개선이 필요함 (구체적인 수정 사항 명시)"

        if ! run_gemini_auto "$review_prompt" "$review_file" "test_review_r${round}"; then
            log_error "Gemini 실행 실패 (Round $round)"
            return 1
        fi

        # Step 3: 승인 여부 확인
        if check_approval "$review_file"; then
            log_success "✓ 테스트 승인됨! (Round $round)"

            # 자동 커밋
            auto_commit "test: add tests (approved by Gemini, round $round)"

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

    log_success "=========================================="
    log_success "전체 파이프라인 완료!"
    log_success "=========================================="

    # 최종 PR 생성 (아직 안 했다면)
    if [ "$AUTO_PR" = "true" ]; then
        local pr_body="## Summary
AI 크로스체크 파이프라인 완료 (Claude + Gemini)

- ✅ 설계 승인
- ✅ 구현 승인
- ✅ 테스트 승인

## Pipeline Phases
1. Design: $output_dir/design/design_final.md
2. Implementation: $output_dir/impl/
3. Testing: $output_dir/test/

## Quality Assurance
모든 단계에서 Gemini의 코드 리뷰 승인을 받았습니다."

        auto_create_pr "feat: complete feature with AI cross-check pipeline" "$pr_body"
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
            --auto-commit)
                AUTO_COMMIT=true
                shift
                ;;
            --auto-pr)
                AUTO_PR=true
                shift
                ;;
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
    log_info "  AI 크로스체크 완전 자동화 시스템"
    log_info "=========================================="
    log_info "모드: $mode"
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"
    log_info "최대 라운드: $MAX_ROUNDS"
    log_info "자동 커밋: $AUTO_COMMIT"
    log_info "자동 PR: $AUTO_PR"
    log_info "=========================================="
    echo ""

    case "$mode" in
        design)
            cross_check_design_auto "$request_file" "$output_dir"
            ;;
        implement|impl)
            cross_check_implement_auto "$request_file" "$output_dir"
            ;;
        test)
            cross_check_test_auto "$request_file" "$output_dir"
            ;;
        full|pipeline)
            run_full_pipeline_auto "$request_file" "$output_dir"
            ;;
        *)
            log_error "알 수 없는 모드: $mode"
            usage
            ;;
    esac
}

main "$@"
