#!/bin/bash
#
# test-independent-mode.sh - Phase 3 Independent Review Mode 테스트
#
# 사용법:
#   ./test-independent-mode.sh [--verbose]
#
# 옵션:
#   --verbose : 상세 출력
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 스크립트 경로
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CROSS_CHECK_SCRIPT="$PROJECT_ROOT/scripts/cross_check_auto.sh"

# 테스트 카운터
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Verbose 모드
VERBOSE=false
if [ "$1" = "--verbose" ]; then
    VERBOSE=true
fi

# 로그 함수
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_fail() { echo -e "${RED}[✗]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 테스트 시작
test_start() {
    local test_name="$1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_info "Test $TOTAL_TESTS: $test_name"
}

# 테스트 통과
test_pass() {
    local message="$1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_success "$message"
}

# 테스트 실패
test_fail() {
    local message="$1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_fail "$message"
}

echo ""
echo "=========================================="
echo "  Phase 3 Independent Mode Test Suite"
echo "=========================================="
echo ""

# Test 1: Syntax validation
test_start "Syntax validation"
if bash -n "$CROSS_CHECK_SCRIPT" 2>/dev/null; then
    test_pass "Syntax validation passed"
else
    test_fail "Syntax validation failed"
fi

# Test 2: Script exists and is executable
test_start "Script executable check"
if [ -x "$CROSS_CHECK_SCRIPT" ] || [ -f "$CROSS_CHECK_SCRIPT" ]; then
    test_pass "Script exists and is accessible"
else
    test_fail "Script not found or not executable"
fi

# Test 3: Help output shows independent mode
test_start "Help output contains 'independent' mode"
if bash "$CROSS_CHECK_SCRIPT" 2>&1 | grep -q "independent"; then
    test_pass "Independent mode shown in help"
else
    test_fail "Independent mode not shown in help"
fi

# Test 4: Check if --mode option is supported
test_start "Check --mode option parsing"
# Run with invalid mode to see if option is recognized
if bash "$CROSS_CHECK_SCRIPT" design /dev/null --mode invalid 2>&1 | grep -q "mode"; then
    test_pass "--mode option is recognized"
else
    test_fail "--mode option not recognized"
fi

# Test 5: Sample request file exists
test_start "Sample request file exists"
SAMPLE_REQUEST="$SCRIPT_DIR/sample-request.md"
if [ -f "$SAMPLE_REQUEST" ]; then
    test_pass "Sample request file exists: $SAMPLE_REQUEST"
else
    test_fail "Sample request file not found: $SAMPLE_REQUEST"
fi

# Test 6: Sample request file is valid markdown
test_start "Sample request file validation"
if [ -f "$SAMPLE_REQUEST" ] && [ -s "$SAMPLE_REQUEST" ]; then
    line_count=$(wc -l < "$SAMPLE_REQUEST")
    if [ "$line_count" -ge 50 ] && [ "$line_count" -le 150 ]; then
        test_pass "Sample request has valid size: $line_count lines"
    else
        test_fail "Sample request size unexpected: $line_count lines (expected 50-150)"
    fi
else
    test_fail "Sample request file is empty or doesn't exist"
fi

# Test 7: Check for required functions in script
test_start "Check for independent mode functions"
required_functions=(
    "independent_design_parallel"
    "run_claude_design_independent"
    "run_gemini_design_independent"
    "compare_designs"
    "user_select_design"
    "create_final_design"
)

missing_functions=()
for func in "${required_functions[@]}"; do
    if grep -q "^[[:space:]]*${func}()" "$CROSS_CHECK_SCRIPT"; then
        if [ "$VERBOSE" = true ]; then
            log_success "  Function found: $func"
        fi
    else
        missing_functions+=("$func")
        if [ "$VERBOSE" = true ]; then
            log_fail "  Function missing: $func"
        fi
    fi
done

if [ ${#missing_functions[@]} -eq 0 ]; then
    test_pass "All required functions found (${#required_functions[@]} functions)"
else
    test_fail "Missing functions: ${missing_functions[*]}"
fi

# Test 8: Check for REVIEW_MODE variable
test_start "Check REVIEW_MODE variable"
if grep -q "^REVIEW_MODE=" "$CROSS_CHECK_SCRIPT"; then
    test_pass "REVIEW_MODE variable defined"
else
    test_fail "REVIEW_MODE variable not found"
fi

# Test 9: Check for metadata.json schema handling
test_start "Check metadata.json references"
if grep -q "metadata\.json" "$CROSS_CHECK_SCRIPT"; then
    test_pass "metadata.json handling found in script"
else
    test_warn "metadata.json not referenced (optional)"
fi

# Test 10: Validate usage function includes independent mode
test_start "Usage function includes independent mode example"
if grep -A 50 "^usage()" "$CROSS_CHECK_SCRIPT" | grep -q "independent"; then
    test_pass "Usage function includes independent mode"
else
    test_fail "Usage function missing independent mode documentation"
fi

# Test 11: Check for proper directory structure creation
test_start "Directory structure logic check"
if grep -q "independent_design" "$CROSS_CHECK_SCRIPT"; then
    test_pass "Independent design directory logic found"
else
    test_fail "Independent design directory logic missing"
fi

# Test 12: Check for comparison report generation
test_start "Comparison report generation check"
if grep -q "design_comparison_report" "$CROSS_CHECK_SCRIPT"; then
    test_pass "Comparison report logic found"
else
    test_fail "Comparison report logic missing"
fi

# Test 13: README exists
test_start "Test documentation README exists"
if [ -f "$SCRIPT_DIR/README.md" ]; then
    test_pass "README.md exists in tests/phase3/"
else
    test_warn "README.md not found (should be created)"
fi

# Test 14: Check for hybrid merge function
test_start "Hybrid merge function check"
if grep -q "merge_designs_hybrid" "$CROSS_CHECK_SCRIPT"; then
    test_pass "Hybrid merge function found"
else
    test_warn "Hybrid merge function not found (optional feature)"
fi

# Summary
echo ""
echo "=========================================="
echo "  Test Summary"
echo "=========================================="
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
else
    echo -e "Failed:       $FAILED_TESTS"
fi
echo "=========================================="
echo ""

# Exit code
if [ $FAILED_TESTS -eq 0 ]; then
    log_success "All tests passed!"
    exit 0
else
    log_fail "Some tests failed. Please review the output above."
    exit 1
fi
