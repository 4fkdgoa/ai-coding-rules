# Phase 3 Independent Review Mode - Test Documentation

This directory contains test cases and documentation for Phase 3 of the AI Cross-Check Automation System, which implements Independent Review Mode to eliminate Confirmation Bias.

## Overview

**Phase 3 Goal**: Enable independent design reviews where multiple AIs create separate design proposals without seeing each other's work, then compare and select the best approach.

**Key Innovation**: Prevents Confirmation Bias by having Claude and Gemini independently design solutions to the same requirements, rather than having Gemini only review Claude's existing design.

## Directory Structure

```
tests/phase3/
├── README.md                   # This file
├── sample-request.md          # Sample design request (user authentication system)
└── test-independent-mode.sh   # Automated test suite
```

## Files

### sample-request.md

A realistic design request for a user authentication and authorization system, including:

- Comprehensive requirements (authentication, authorization, security)
- Technical constraints (tech stack, database, deployment)
- Non-functional requirements (performance, scalability, compliance)
- Success criteria and expected deliverables

**Purpose**: Provides a real-world scenario for testing independent mode functionality.

**Size**: ~100 lines (meets specification of 50-100 lines)

### test-independent-mode.sh

Automated test suite that validates Phase 3 implementation.

**Usage**:
```bash
# Run all tests
./test-independent-mode.sh

# Run with verbose output
./test-independent-mode.sh --verbose
```

**Test Coverage**:

1. **Syntax Validation**: Ensures cross_check_auto.sh has no syntax errors
2. **Script Accessibility**: Verifies script exists and is accessible
3. **Help Documentation**: Checks that independent mode is documented in help output
4. **Option Parsing**: Validates --mode option is recognized
5. **Sample Files**: Confirms sample-request.md exists and has valid size
6. **Function Presence**: Verifies all required functions exist:
   - `independent_design_parallel()`
   - `run_claude_design_independent()`
   - `run_gemini_design_independent()`
   - `compare_designs()`
   - `user_select_design()`
   - `create_final_design()`
7. **Configuration Variables**: Checks REVIEW_MODE variable is defined
8. **Metadata Handling**: Confirms metadata.json support
9. **Usage Documentation**: Validates usage function includes independent mode
10. **Directory Logic**: Checks independent design directory creation
11. **Comparison Reports**: Verifies comparison report generation logic
12. **Documentation**: Ensures test documentation exists
13. **Hybrid Merge**: Checks for hybrid merge functionality

**Exit Codes**:
- `0`: All tests passed
- `1`: One or more tests failed

## Running the Tests

### Prerequisites

Before running tests, ensure:

1. `scripts/cross_check_auto.sh` exists
2. Phase 3 implementation is complete (TODO 1-9 from phase3-implementation-todo.md)
3. You have bash installed (Linux/Mac/Git Bash on Windows)

### Quick Test

```bash
cd tests/phase3
./test-independent-mode.sh
```

### Verbose Mode

For detailed output showing each function check:

```bash
./test-independent-mode.sh --verbose
```

## Test Results Interpretation

### All Green (All Tests Passed)

```
==========================================
  Test Summary
==========================================
Total Tests:  14
Passed:       14
Failed:       0
==========================================

[✓] All tests passed!
```

This indicates Phase 3 is correctly implemented and ready for use.

### Some Failures

If tests fail, review the output to identify missing components:

```
[✗] Test 7: Check for independent mode functions
Missing functions: compare_designs user_select_design
```

This means you need to implement the missing functions in `scripts/cross_check_auto.sh`.

## Integration with Main Test Suite

These tests focus specifically on Phase 3 functionality. They complement but don't replace:

- **End-to-End Testing**: Actually running independent mode with real AI calls
- **Regression Testing**: Ensuring standard design mode still works
- **Performance Testing**: Measuring execution time and API calls

See TODO 12 in `docs/phase3-implementation-todo.md` for comprehensive testing checklist.

## Using the Sample Request

The sample request can be used to:

1. **Test Independent Mode**:
   ```bash
   ./scripts/cross_check_auto.sh design tests/phase3/sample-request.md --mode independent
   ```

2. **Compare with Standard Mode**:
   ```bash
   # Standard mode (Gemini reviews Claude's design)
   ./scripts/cross_check_auto.sh design tests/phase3/sample-request.md

   # Independent mode (both design independently, then compare)
   ./scripts/cross_check_auto.sh design tests/phase3/sample-request.md --mode independent
   ```

3. **Validate Output Structure**:

   After running independent mode, you should see:
   ```
   output/independent_design_TIMESTAMP/
   ├── design_claude_v1.md           # Claude's independent design
   ├── design_gemini_v1.md           # Gemini's independent design
   ├── design_comparison_report.md   # AI-generated comparison
   ├── design_final.md                # User's final choice (or hybrid)
   ├── metadata.json                  # Metadata about the run
   └── logs/
       ├── claude_design_independent.log
       ├── gemini_design_independent.log
       └── comparison.log
   ```

## Known Limitations

1. **No Live AI Testing**: This test suite only validates code structure, not actual AI responses
2. **No Performance Metrics**: Execution time and API call counts require manual testing
3. **No Output Validation**: Doesn't verify the quality of generated designs

These limitations are addressed in TODO 12 (End-to-End Testing).

## Troubleshooting

### Test Script Won't Run

```bash
# Make sure it's executable
chmod +x test-independent-mode.sh

# Check bash is available
which bash
```

### Syntax Errors in cross_check_auto.sh

```bash
# Run shellcheck for detailed analysis
shellcheck scripts/cross_check_auto.sh
```

### Function Not Found

If test reports missing functions, check that you've completed TODO 1-9:

```bash
# Search for function in script
grep -n "function_name()" scripts/cross_check_auto.sh
```

## Next Steps

After all tests pass:

1. Run manual end-to-end test with real AI calls
2. Test standard mode still works (regression)
3. Measure performance (execution time, API calls)
4. Update main documentation (README.md, CLAUDE.md)
5. Commit changes and create git tag v3.0-phase3

See `docs/phase3-implementation-todo.md` for complete checklist.

## Related Documentation

- [`docs/phase3-implementation-todo.md`](../../docs/phase3-implementation-todo.md) - Complete TODO list
- [`docs/cross-check-auto-v3-design.md`](../../docs/cross-check-auto-v3-design.md) - Overall v3.0 design
- [`scripts/cross_check_auto.sh`](../../scripts/cross_check_auto.sh) - Main script

---

**Last Updated**: 2026-01-18
**Version**: 1.0
**Status**: Phase 3 Testing
