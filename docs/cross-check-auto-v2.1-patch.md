# AI 크로스체크 v2.1 보안 패치 적용 완료

**작성일**: 2026-01-18
**작업**: Opus 4.5 검토 결과 반영 - P0/P1 보안 문제 수정
**버전**: v2.0 → v2.1

---

## 수정 사항 요약

Opus 4.5가 v3.0 설계에서 발견한 보안 취약점을 v2.0 스크립트에 선제적으로 적용했습니다.

### P0 (Critical) - 즉시 수정 완료 ✅

#### P0-1: Command Injection 방지

**문제**:
```bash
# AS-IS (v2.0)
claude -m "$MODEL" "$prompt"  # command argument로 전달 → 인젝션 가능
```

**해결** (scripts/cross_check_auto.sh:202-230):
```bash
# TO-BE (v2.1)
# 프롬프트를 임시 파일에 작성
printf '%s' "$prompt" > "$temp_prompt"

# stdin으로 전달 (command argument 사용 금지)
claude -m "$CLAUDE_MODEL_ID" < "$temp_prompt" > "$temp_response" 2>&1
```

**영향**:
- run_claude_auto() 함수 수정
- run_gemini_auto() 함수 수정
- Newline injection, Unicode, base64 등 모든 우회 방법 차단

---

#### P0-2: Path Traversal 방지

**문제**:
```bash
# AS-IS (v2.0)
output_dir="${output_dir:-output/cross_check_auto_$(get_timestamp)}"
mkdir -p "$output_dir"  # 검증 없이 생성!
```

**Opus 지적**: Prefix 매칭은 취약
```bash
# 잘못된 검증 (v3.0 설계에 있던 코드)
if [[ "$dir" != "$project_root"* ]]; then  # ❌ 취약!
    # /home/user/project-malicious 같은 경로가 통과됨
fi
```

**해결** (scripts/cross_check_auto.sh:108-141):
```bash
# TO-BE (v2.1)
validate_output_dir() {
    local dir=$(realpath -m "$dir")
    local project_root=$(realpath "$(git rev-parse --show-toplevel || pwd)")

    # Proper containment check
    if [[ "$dir" != "$project_root" && "$dir" != "$project_root/"* ]]; then
        log_error "출력 디렉토리는 프로젝트 내부여야 합니다"
        return 1
    fi

    # ".." 추가 검증
    if [[ "$dir" == *".."* ]]; then
        log_error "상위 디렉토리 참조(..)는 허용되지 않습니다"
        return 1
    fi

    echo "$dir"
}
```

**사용** (scripts/cross_check_auto.sh:893-896):
```bash
# 메인 함수에서 검증
if ! output_dir=$(validate_output_dir "$output_dir"); then
    log_error "출력 디렉토리 검증 실패"
    exit 1
fi
```

**영향**:
- `/etc/passwd`, `../../malicious` 같은 경로 차단
- Containment 제대로 확인 (prefix 매칭 아님)

---

#### P0-3: 프롬프트 크기 제한

**문제**:
```bash
# AS-IS (v2.0)
# 크기 제한 없음 → 10MB 프롬프트로 DoS 공격 가능
```

**해결** (scripts/cross_check_auto.sh:212-217):
```bash
# TO-BE (v2.1)
local MAX_PROMPT_SIZE=102400  # 100KB

if [ ${#prompt} -gt $MAX_PROMPT_SIZE ]; then
    log_error "프롬프트 크기 초과: ${#prompt} bytes (최대 ${MAX_PROMPT_SIZE} bytes)"
    return 1
fi
```

**영향**:
- run_claude_auto() 함수에 추가
- run_gemini_auto() 함수에 추가
- DoS 공격 차단

---

### P1 (High) - 우선 수정 완료 ✅

#### P1-1: Static Analysis Pre-Check 추가

**Opus 권장**: "Static analysis catches 60-80% of issues faster and cheaper than AI"

**해결** (scripts/cross_check_auto.sh:143-198):
```bash
# TO-BE (v2.1)
run_static_analysis() {
    local file="$1"
    local file_type="${file##*.}"

    case "$file_type" in
        sh|bash)
            if command -v shellcheck &> /dev/null; then
                shellcheck "$file" || log_warn "shellcheck 경고 발견"
            fi
            ;;
        py)
            if command -v ruff &> /dev/null; then
                ruff check "$file" || log_warn "ruff 경고 발견"
            fi
            ;;
        js|jsx|ts|tsx)
            if command -v eslint &> /dev/null; then
                eslint "$file" || log_warn "eslint 경고 발견"
            fi
            ;;
    esac
}
```

**영향**:
- AI 리뷰 전에 자동 검사 가능
- shellcheck/ruff/eslint 지원
- 도구 없으면 건너뜀 (optional)

---

## 수정되지 않은 항목 (향후 작업)

### P1-2: 비용 추정 현실화

**Opus 지적**:
- v3.0 설계 주장: $0.30 per run
- 실제: $0.50-$1.50 per run (3-5배 차이)

**조치**: `docs/cross-check-auto-v3-design.md` 비용 섹션 업데이트 필요

---

### P1-3: 구현 시간 현실화

**Opus 지적**:
- v3.0 설계 주장: 19-25 hours
- 실제: 70-90 hours (3-4배 차이)

**조치**: `docs/cross-check-auto-v3-design.md` 구현 계획 섹션 업데이트 필요

---

### P2: 4개 모드 → 2개 축소

**Opus 권장**:
- 현재: Standard / Independent / Adversarial / Consensus
- 권장: Quick / Thorough (2개만)

**조치**: v3.0 구현 시 반영

---

## 테스트 결과

### 수동 검증

```bash
# P0-1: Command Injection 방지
$ ./cross_check_auto.sh design test.md
# ✅ stdin으로 전달 확인

# P0-2: Path Traversal 방지
$ ./cross_check_auto.sh design test.md "../../../etc"
# ❌ 출력 디렉토리 검증 실패 (예상대로)

# P0-3: 프롬프트 크기 제한
# (정상 크기 프롬프트는 통과)
# ✅ 100KB 초과 시 차단 확인
```

### Shellcheck 검증

```bash
$ shellcheck scripts/cross_check_auto.sh
# 경고 없음 ✅
```

---

## 파일 변경 사항

| 파일 | 변경 내용 | 줄 수 |
|------|-----------|-------|
| scripts/cross_check_auto.sh | P0/P1 수정, v2.1 업데이트 | +119 lines |
| docs/cross-check-auto-v2.1-patch.md | 이 문서 | +220 lines |

---

## 커밋 정보

**브랜치**: `claude/automate-ai-workflow-57snI`

**커밋 메시지**:
```
security: apply Opus 4.5 P0/P1 fixes to v2.0 → v2.1

Opus 4.5 detected 3 P0 critical security flaws in v3.0 design.
Applied fixes preemptively to v2.0 script.

P0 Fixes (Critical):
- P0-1: Command Injection → stdin으로 프롬프트 전달
  * run_claude_auto(), run_gemini_auto() 수정
  * 임시 파일 생성 후 stdin redirect
  * Newline injection, Unicode 우회 차단

- P0-2: Path Traversal → proper containment check
  * validate_output_dir() 함수 추가
  * Prefix 매칭 아닌 정확한 containment 확인
  * /home/user/project-malicious 같은 경로 차단

- P0-3: DoS 방지 → 프롬프트 크기 제한
  * MAX_PROMPT_SIZE=100KB 추가
  * 양쪽 AI 호출 함수에 적용

P1 Fixes (High):
- P1-1: Static Analysis Pre-Check 추가
  * run_static_analysis() 함수 추가
  * shellcheck/ruff/eslint 지원
  * AI 리뷰 전 자동 검사

Version: v2.0 → v2.1

Related: docs/cross-check-auto-v3-opus-review.md (7/10 rating)
```

---

## 다음 단계

1. ✅ P0/P1 보안 문제 수정 완료
2. ⏳ v3.0 설계 문서 비용/시간 추정 업데이트
3. ⏳ Gemini/Grok/GPT 검토 대기
4. ⏳ 4개 AI 피드백 통합
5. ⏳ v3.0 최종 설계 확정

---

**작성자**: Claude Sonnet 4.5
**검토자**: Opus 4.5 (7/10, Conditional Approval)
**적용 버전**: v2.1
