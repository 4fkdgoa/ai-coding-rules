#!/bin/bash
#
# test-parsing.sh - JSON 파싱 및 검증 테스트
#
# 사용법:
#   ./test-parsing.sh
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CROSS_CHECK_SCRIPT="$PROJECT_ROOT/scripts/cross_check_auto.sh"

# 함수 정의 (cross_check_auto.sh에서 필요한 함수들을 복사)
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# parse_ai_response 함수 (cross_check_auto.sh에서 복사)
parse_ai_response() {
    local response_file="$1"
    local field="$2"

    if [ ! -f "$response_file" ]; then
        log_error "응답 파일이 존재하지 않습니다: $response_file"
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        log_warn "jq가 설치되지 않았습니다. JSON 파싱을 건너뜁니다."
        return 1
    fi

    local json_content=""

    # 1. 전체 파일이 JSON인지 확인
    if jq empty "$response_file" 2>/dev/null; then
        json_content=$(cat "$response_file")
    else
        # 2. 마크다운 코드 블록(```json ... ```) 내부에서 JSON 추출
        json_content=$(sed -n '/```json/,/```/p' "$response_file" | sed '1d;$d' 2>/dev/null)

        # 3. 일반 코드 블록(``` ... ```) 내부에서 JSON 추출
        if [ -z "$json_content" ]; then
            json_content=$(sed -n '/```/,/```/p' "$response_file" | sed '1d;$d' 2>/dev/null)
        fi
    fi

    if [ -z "$json_content" ]; then
        log_warn "JSON 콘텐츠를 찾을 수 없습니다: $response_file"
        return 1
    fi

    # 필드 추출
    if [ -n "$field" ]; then
        echo "$json_content" | jq -r "$field" 2>/dev/null
    else
        echo "$json_content"
    fi
}

# validate_schema 함수
validate_schema() {
    local response_file="$1"
    local schema_file="$PROJECT_ROOT/schemas/ai-review-response.schema.json"

    if [ ! -f "$response_file" ]; then
        log_error "응답 파일이 존재하지 않습니다: $response_file"
        return 1
    fi

    if [ ! -f "$schema_file" ]; then
        log_warn "스키마 파일이 존재하지 않습니다: $schema_file (검증 건너뜀)"
        return 0
    fi

    if ! command -v jq &> /dev/null; then
        log_warn "jq가 설치되지 않았습니다. 스키마 검증을 건너뜁니다."
        return 0
    fi

    # JSON 추출
    local json_content=$(parse_ai_response "$response_file")
    if [ -z "$json_content" ]; then
        return 1
    fi

    # 필수 필드 존재 확인
    local required_fields=("version" "timestamp" "reviewer" "phase" "verdict" "security_issues" "improvements" "metrics")
    local missing_fields=()

    for field in "${required_fields[@]}"; do
        if ! echo "$json_content" | jq -e ".$field" &>/dev/null; then
            missing_fields+=("$field")
        fi
    done

    if [ ${#missing_fields[@]} -gt 0 ]; then
        log_error "필수 필드가 누락되었습니다: ${missing_fields[*]}"
        return 1
    fi

    log_success "스키마 검증 통과"
    return 0
}

# check_approval_json 함수
check_approval_json() {
    local review_file="$1"

    local verdict=$(parse_ai_response "$review_file" ".verdict" 2>/dev/null)

    if [ -z "$verdict" ] || [ "$verdict" = "null" ]; then
        return 1
    fi

    log_info "JSON 판정: $verdict"

    case "$verdict" in
        APPROVED)
            return 0
            ;;
        APPROVED_WITH_CHANGES)
            local p0_count=$(parse_ai_response "$review_file" ".metrics.p0_count" 2>/dev/null)
            local p1_count=$(parse_ai_response "$review_file" ".metrics.p1_count" 2>/dev/null)

            if [ "$p0_count" = "0" ] && [ "$p1_count" = "0" ]; then
                log_info "조건부 승인: P0/P1 이슈 없음 → 승인"
                return 0
            else
                log_info "조건부 승인: P0($p0_count) 또는 P1($p1_count) 이슈 존재 → 수정 필요"
                return 1
            fi
            ;;
        REJECTED)
            return 1
            ;;
        *)
            log_warn "알 수 없는 verdict 값: $verdict"
            return 1
            ;;
    esac
}

# 테스트 실행
run_tests() {
    local test_count=0
    local pass_count=0
    local fail_count=0

    echo ""
    log_info "=========================================="
    log_info "  JSON 파싱 및 검증 테스트"
    log_info "=========================================="
    echo ""

    # jq 설치 확인
    if ! command -v jq &> /dev/null; then
        log_error "jq가 설치되지 않았습니다. 설치 후 다시 시도하세요."
        log_info "설치 방법: sudo apt-get install jq (Ubuntu/Debian)"
        log_info "           brew install jq (macOS)"
        exit 1
    fi

    # Test 1: sample-approved.json
    echo "----------------------------------------"
    log_info "Test 1: APPROVED 판정 테스트"
    test_count=$((test_count + 1))

    local file="$SCRIPT_DIR/sample-approved.json"
    if validate_schema "$file" && check_approval_json "$file"; then
        log_success "✓ Test 1 PASS: APPROVED 판정 정상"
        pass_count=$((pass_count + 1))
    else
        log_error "✗ Test 1 FAIL"
        fail_count=$((fail_count + 1))
    fi
    echo ""

    # Test 2: sample-approved-with-changes.json (승인 - P0/P1 없음)
    echo "----------------------------------------"
    log_info "Test 2: APPROVED_WITH_CHANGES 판정 테스트 (승인)"
    test_count=$((test_count + 1))

    file="$SCRIPT_DIR/sample-approved-with-changes.json"
    if validate_schema "$file" && check_approval_json "$file"; then
        log_success "✓ Test 2 PASS: APPROVED_WITH_CHANGES (P0/P1 없음) → 승인"
        pass_count=$((pass_count + 1))
    else
        log_error "✗ Test 2 FAIL"
        fail_count=$((fail_count + 1))
    fi
    echo ""

    # Test 3: sample-rejected.json (반려)
    echo "----------------------------------------"
    log_info "Test 3: REJECTED 판정 테스트"
    test_count=$((test_count + 1))

    file="$SCRIPT_DIR/sample-rejected.json"
    if validate_schema "$file"; then
        if check_approval_json "$file"; then
            log_error "✗ Test 3 FAIL: REJECTED인데 승인됨"
            fail_count=$((fail_count + 1))
        else
            log_success "✓ Test 3 PASS: REJECTED 판정 정상"
            pass_count=$((pass_count + 1))
        fi
    else
        log_error "✗ Test 3 FAIL: 스키마 검증 실패"
        fail_count=$((fail_count + 1))
    fi
    echo ""

    # Test 4: sample-markdown-wrapped.md (마크다운 코드 블록)
    echo "----------------------------------------"
    log_info "Test 4: 마크다운 코드 블록 파싱 테스트"
    test_count=$((test_count + 1))

    file="$SCRIPT_DIR/sample-markdown-wrapped.md"
    if validate_schema "$file" && check_approval_json "$file"; then
        log_success "✓ Test 4 PASS: 마크다운 코드 블록 파싱 성공"
        pass_count=$((pass_count + 1))
    else
        log_error "✗ Test 4 FAIL"
        fail_count=$((fail_count + 1))
    fi
    echo ""

    # Test 5: sample-text-fallback.md (텍스트 폴백)
    echo "----------------------------------------"
    log_info "Test 5: 텍스트 폴백 테스트"
    test_count=$((test_count + 1))

    file="$SCRIPT_DIR/sample-text-fallback.md"
    if check_approval_json "$file"; then
        log_error "✗ Test 5 FAIL: JSON이 없는데 파싱 성공함"
        fail_count=$((fail_count + 1))
    else
        log_info "JSON 파싱 실패 (예상됨) - 텍스트 폴백이 정상 동작할 것임"
        # 텍스트 폴백은 cross_check_auto.sh의 check_approval에서 처리됨
        log_success "✓ Test 5 PASS: JSON 파싱 실패 감지 성공"
        pass_count=$((pass_count + 1))
    fi
    echo ""

    # 결과 요약
    echo "=========================================="
    log_info "테스트 결과 요약"
    echo "----------------------------------------"
    echo "총 테스트: $test_count"
    echo "성공: $pass_count"
    echo "실패: $fail_count"
    echo "=========================================="
    echo ""

    if [ $fail_count -eq 0 ]; then
        log_success "모든 테스트 통과! ✓"
        return 0
    else
        log_error "$fail_count 개 테스트 실패"
        return 1
    fi
}

# 메인
main() {
    run_tests
}

main "$@"
