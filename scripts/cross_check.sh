#!/bin/bash
#
# cross_check.sh - AI 크로스체크 자동화 스크립트
# Claude(Maker) <-> Gemini(Reviewer) 교차 검증
#
# 사용법:
#   ./cross_check.sh design <설계요청파일> [출력디렉토리]
#   ./cross_check.sh implement <구현요청파일> [출력디렉토리]
#   ./cross_check.sh test <테스트요청파일> [출력디렉토리]
#
# 예시:
#   ./cross_check.sh design docs/design_request.md docs/output
#   ./cross_check.sh implement docs/impl_request.md
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ROUNDS=2  # 무한루프 방지: 최대 크로스체크 횟수
LOG_DIR="logs/cross_check"
GEMINI_MODEL="gemini-3-pro-preview"

# 함수: 로그 출력
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 함수: 사용법
usage() {
    echo "사용법: $0 <모드> <요청파일> [출력디렉토리]"
    echo ""
    echo "모드:"
    echo "  design     - 설계 크로스체크 (Claude 설계 → Gemini 검토)"
    echo "  implement  - 구현 크로스체크 (Claude 구현 → Gemini 검토)"
    echo "  test       - 테스트 크로스체크 (Claude 테스트 → Gemini 검토)"
    echo ""
    echo "무한루프 방지: 최대 ${MAX_ROUNDS}회 교차검증 후 사용자 개입 요청"
    exit 1
}

# 함수: 타임스탬프 생성
get_timestamp() {
    date +"%Y-%m-%d_%H%M%S"
}

# 함수: Gemini CLI 실행
run_gemini() {
    local prompt="$1"
    local output_file="$2"
    local yolo="${3:-}"

    local gemini_cmd="gemini -m $GEMINI_MODEL"
    [ "$yolo" = "--yolo" ] && gemini_cmd="$gemini_cmd --yolo"

    log_info "Gemini 실행 중..."
    $gemini_cmd "$prompt" 2>&1 | tee "$output_file"
    return ${PIPESTATUS[0]}
}

# 함수: 결과 파일에서 승인/반려 판정
check_approval() {
    local review_file="$1"

    # 승인 키워드 확인
    if grep -qiE "(승인|APPROVED|LGTM|통과|문제.*없)" "$review_file" 2>/dev/null; then
        if ! grep -qiE "(반려|REJECTED|수정.*필요|문제.*있|개선.*필요)" "$review_file" 2>/dev/null; then
            return 0  # 승인
        fi
    fi
    return 1  # 반려 또는 수정 필요
}

# 함수: 설계 크로스체크
cross_check_design() {
    local request_file="$1"
    local output_dir="$2"
    local round=1

    log_step "=== 설계 크로스체크 시작 ==="
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    local timestamp=$(get_timestamp)
    local design_file="$output_dir/design_v${round}.md"
    local review_file="$output_dir/design_review_v${round}.md"

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        # Step 1: Claude가 설계 작성 (사용자가 Claude Code에서 실행)
        log_info "[Claude 작업 필요] 다음 프롬프트를 Claude Code에 입력하세요:"
        echo ""
        echo "=========================================="
        if [ $round -eq 1 ]; then
            echo "$request_file 파일을 읽고 설계서를 작성해줘."
            echo "결과는 $design_file 에 저장해줘."
        else
            local prev_review="$output_dir/design_review_v$((round-1)).md"
            echo "$prev_review 파일의 피드백을 반영하여"
            echo "설계서를 수정해줘. 결과는 $design_file 에 저장해줘."
        fi
        echo "=========================================="
        echo ""

        read -p "Claude 작업 완료 후 Enter를 눌러주세요 (q=중단): " user_input
        [ "$user_input" = "q" ] && { log_info "사용자 중단"; exit 0; }

        # 설계 파일 존재 확인
        if [ ! -f "$design_file" ]; then
            log_error "설계 파일이 생성되지 않았습니다: $design_file"
            read -p "다시 시도하시겠습니까? (y/n): " retry
            [ "$retry" != "y" ] && exit 1
            continue
        fi

        # Step 2: Gemini가 설계 검토
        log_info "[Gemini 검토] 설계서 리뷰 중..."

        local review_prompt="$design_file 파일의 설계서를 검토해줘.

검토 항목:
1. 요구사항 충족 여부
2. 아키텍처 적합성
3. 확장성 및 유지보수성
4. 잠재적 문제점

검토 결과를 $review_file 에 작성해줘.
마지막에 [승인] 또는 [수정 필요]를 명시해줘."

        run_gemini "$review_prompt" "$LOG_DIR/${timestamp}_design_review_r${round}.log" "--yolo"

        # 리뷰 파일 존재 확인
        if [ ! -f "$review_file" ]; then
            log_warn "리뷰 파일이 생성되지 않았습니다. 수동 확인 필요."
            break
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
        design_file="$output_dir/design_v${round}.md"
        review_file="$output_dir/design_review_v${round}.md"
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

# 함수: 구현 크로스체크
cross_check_implement() {
    local request_file="$1"
    local output_dir="$2"
    local round=1

    log_step "=== 구현 크로스체크 시작 ==="
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    local timestamp=$(get_timestamp)
    local impl_log="$output_dir/impl_v${round}.log"
    local review_file="$output_dir/impl_review_v${round}.md"

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        # Step 1: Claude가 구현
        log_info "[Claude 작업 필요] 다음 프롬프트를 Claude Code에 입력하세요:"
        echo ""
        echo "=========================================="
        if [ $round -eq 1 ]; then
            echo "$request_file 파일을 읽고 구현해줘."
        else
            local prev_review="$output_dir/impl_review_v$((round-1)).md"
            echo "$prev_review 파일의 피드백을 반영하여 수정해줘."
        fi
        echo ""
        echo "완료 후 변경된 파일 목록을 $impl_log 에 기록해줘."
        echo "=========================================="
        echo ""

        read -p "Claude 작업 완료 후 Enter를 눌러주세요 (q=중단): " user_input
        [ "$user_input" = "q" ] && { log_info "사용자 중단"; exit 0; }

        # Step 2: 변경사항 자동 감지 (git diff)
        log_info "변경사항 감지 중..."
        local diff_file="$output_dir/changes_v${round}.diff"
        git diff --name-only > "$diff_file" 2>/dev/null || true
        git diff > "$output_dir/changes_v${round}_full.diff" 2>/dev/null || true

        if [ ! -s "$diff_file" ]; then
            log_warn "변경된 파일이 없습니다."
            read -p "계속 진행하시겠습니까? (y/n): " cont
            [ "$cont" != "y" ] && exit 0
        else
            log_info "변경된 파일:"
            cat "$diff_file"
        fi

        # Step 3: Gemini가 코드 리뷰
        log_info "[Gemini 검토] 구현 리뷰 중..."

        local review_prompt="다음 파일들의 변경사항을 검토해줘:
$(cat "$diff_file" 2>/dev/null || echo "변경 파일 목록 없음")

원본 요청: $request_file

검토 항목:
1. 요구사항 충족 여부
2. 코드 품질 (가독성, 유지보수성)
3. 잠재적 버그 또는 보안 취약점
4. 테스트 커버리지

검토 결과를 $review_file 에 작성해줘.
마지막에 [승인] 또는 [수정 필요]를 명시해줘."

        run_gemini "$review_prompt" "$LOG_DIR/${timestamp}_impl_review_r${round}.log" "--yolo"

        # 리뷰 파일 존재 확인
        if [ ! -f "$review_file" ]; then
            log_warn "리뷰 파일이 생성되지 않았습니다. 수동 확인 필요."
            break
        fi

        # Step 4: 승인 여부 확인
        if check_approval "$review_file"; then
            log_success "✓ 구현 승인됨! (Round $round)"
            return 0
        fi

        log_warn "구현 수정 필요 (Round $round)"

        # 다음 라운드 준비
        round=$((round + 1))
        impl_log="$output_dir/impl_v${round}.log"
        review_file="$output_dir/impl_review_v${round}.md"
    done

    # 최대 라운드 초과
    log_error "=========================================="
    log_error "최대 크로스체크 횟수($MAX_ROUNDS회) 초과!"
    log_error "사용자 개입이 필요합니다."
    log_error ""
    log_error "마지막 리뷰: $output_dir/impl_review_v${MAX_ROUNDS}.md"
    log_error "=========================================="

    return 1
}

# 함수: 테스트 크로스체크
cross_check_test() {
    local request_file="$1"
    local output_dir="$2"
    local round=1

    log_step "=== 테스트 크로스체크 시작 ==="
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"

    mkdir -p "$output_dir"
    mkdir -p "$LOG_DIR"

    local timestamp=$(get_timestamp)
    local test_result="$output_dir/test_result_v${round}.log"
    local review_file="$output_dir/test_review_v${round}.md"

    while [ $round -le $MAX_ROUNDS ]; do
        log_step "--- Round $round / $MAX_ROUNDS ---"

        # Step 1: Claude가 테스트 작성 및 실행
        log_info "[Claude 작업 필요] 다음 프롬프트를 Claude Code에 입력하세요:"
        echo ""
        echo "=========================================="
        if [ $round -eq 1 ]; then
            echo "$request_file 파일을 읽고 테스트를 작성하고 실행해줘."
        else
            local prev_review="$output_dir/test_review_v$((round-1)).md"
            echo "$prev_review 파일의 피드백을 반영하여 테스트를 수정해줘."
        fi
        echo ""
        echo "테스트 실행 결과를 $test_result 에 저장해줘."
        echo "=========================================="
        echo ""

        read -p "Claude 작업 완료 후 Enter를 눌러주세요 (q=중단): " user_input
        [ "$user_input" = "q" ] && { log_info "사용자 중단"; exit 0; }

        # 테스트 결과 파일 존재 확인
        if [ ! -f "$test_result" ]; then
            log_warn "테스트 결과 파일이 없습니다. 수동으로 결과를 입력하세요."
            read -p "테스트 통과 여부 (pass/fail): " test_status
            echo "테스트 상태: $test_status" > "$test_result"
        fi

        # Step 2: Gemini가 테스트 커버리지 및 품질 리뷰
        log_info "[Gemini 검토] 테스트 리뷰 중..."

        local review_prompt="$test_result 파일의 테스트 결과를 분석하고,
테스트 코드의 품질을 검토해줘.

검토 항목:
1. 테스트 커버리지 충분성
2. 엣지 케이스 처리
3. 테스트 코드 가독성
4. Mock/Stub 적절성
5. 실패한 테스트가 있다면 원인 분석

검토 결과를 $review_file 에 작성해줘.
마지막에 [승인] 또는 [수정 필요]를 명시해줘."

        run_gemini "$review_prompt" "$LOG_DIR/${timestamp}_test_review_r${round}.log" "--yolo"

        # 리뷰 파일 존재 확인
        if [ ! -f "$review_file" ]; then
            log_warn "리뷰 파일이 생성되지 않았습니다. 수동 확인 필요."
            break
        fi

        # Step 3: 승인 여부 확인
        if check_approval "$review_file"; then
            log_success "✓ 테스트 승인됨! (Round $round)"
            return 0
        fi

        log_warn "테스트 수정 필요 (Round $round)"

        # 다음 라운드 준비
        round=$((round + 1))
        test_result="$output_dir/test_result_v${round}.log"
        review_file="$output_dir/test_review_v${round}.md"
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
run_full_pipeline() {
    local request_file="$1"
    local output_dir="$2"

    log_step "=== 전체 크로스체크 파이프라인 ==="
    log_info "설계 → 구현 → 테스트 순서로 진행합니다."

    # 1. 설계
    log_step "[Phase 1/3] 설계 크로스체크"
    if ! cross_check_design "$request_file" "$output_dir/design"; then
        log_error "설계 단계에서 실패. 파이프라인 중단."
        return 1
    fi

    # 2. 구현
    log_step "[Phase 2/3] 구현 크로스체크"
    if ! cross_check_implement "$output_dir/design/design_final.md" "$output_dir/impl"; then
        log_error "구현 단계에서 실패. 파이프라인 중단."
        return 1
    fi

    # 3. 테스트
    log_step "[Phase 3/3] 테스트 크로스체크"
    if ! cross_check_test "$output_dir/design/design_final.md" "$output_dir/test"; then
        log_error "테스트 단계에서 실패. 파이프라인 중단."
        return 1
    fi

    log_success "=========================================="
    log_success "전체 파이프라인 완료!"
    log_success "=========================================="
    return 0
}

# 메인
main() {
    if [ $# -lt 2 ]; then
        usage
    fi

    local mode="$1"
    local request_file="$2"
    local output_dir="${3:-output/cross_check_$(get_timestamp)}"

    # 요청 파일 확인
    if [ ! -f "$request_file" ]; then
        log_error "요청 파일이 존재하지 않습니다: $request_file"
        exit 1
    fi

    log_info "=========================================="
    log_info "  AI 크로스체크 자동화 시스템"
    log_info "=========================================="
    log_info "모드: $mode"
    log_info "요청 파일: $request_file"
    log_info "출력 디렉토리: $output_dir"
    log_info "최대 라운드: $MAX_ROUNDS"
    log_info "=========================================="
    echo ""

    case "$mode" in
        design)
            cross_check_design "$request_file" "$output_dir"
            ;;
        implement|impl)
            cross_check_implement "$request_file" "$output_dir"
            ;;
        test)
            cross_check_test "$request_file" "$output_dir"
            ;;
        full|pipeline)
            run_full_pipeline "$request_file" "$output_dir"
            ;;
        *)
            log_error "알 수 없는 모드: $mode"
            usage
            ;;
    esac
}

main "$@"
