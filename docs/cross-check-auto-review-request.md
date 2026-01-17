# AI 워크플로우 완전 자동화 검토 요청

## 개요

AI 크로스체크 시스템을 **Human-in-the-loop에서 완전 자동화**로 개선했습니다.

- 기존: `cross_check.sh` (반자동 - 사용자가 각 단계마다 수동으로 Claude에 프롬프트 입력)
- 신규: `cross_check_auto.sh` (완전 자동 - Claude와 Gemini가 자동으로 협업)

---

## 주요 변경사항

### 1. Claude Code CLI 자동 호출

**기존 방식 (cross_check.sh):**
```bash
# 사용자에게 프롬프트 출력
echo "다음을 Claude Code에 입력하세요:"
echo "$prompt"
read -p "완료 후 Enter..."
```

**개선 (cross_check_auto.sh):**
```bash
# 자동으로 Claude CLI 호출
run_claude_auto() {
    local prompt="$1"
    local output_file="$2"

    claude -m "claude-sonnet-4-5" "$prompt" > "$output_file"
}
```

→ **사용자 개입 없이 자동 실행**

---

### 2. 자동 커밋 + PR 생성

**기능:**
- `--auto-commit` : 승인 시 자동으로 `git add`, `git commit`, `git push`
- `--auto-pr` : GitHub CLI를 사용하여 자동 PR 생성

**예시:**
```bash
./scripts/cross_check_auto.sh full docs/request.md output \
  --auto-commit --auto-pr
```

→ **설계부터 PR 생성까지 완전 자동**

---

### 3. 무한루프 방지 강화

**기존 (cross_check.sh):**
- 단순히 `MAX_ROUNDS=2` 제한만 존재

**개선 (cross_check_auto.sh):**
```bash
# 변경사항 해시 계산
get_changes_hash() {
    git diff HEAD | md5sum | awk '{print $1}'
}

# 이전 라운드와 동일한 변경사항인지 확인
if [ "$curr_hash" = "$prev_hash" ]; then
    log_error "변경사항 없음 - 무한루프 감지!"
    return 1
fi
```

→ **동일한 변경이 반복되면 즉시 중단**

---

### 4. 파일 기반 프롬프트 처리

**기존:**
- 프롬프트를 문자열로 전달 (파일 내용 참조 불가)

**개선:**
```bash
# 요청 파일을 읽어서 프롬프트에 포함
design_prompt="다음 파일을 읽고 설계서를 작성해줘:

$(cat "$request_file")

설계서는 다음 항목을 포함해야 해:
1. 요구사항 분석
2. 시스템 아키텍처
..."
```

→ **복잡한 요청사항을 파일로 관리 가능**

---

## 사용 시나리오

### 시나리오 1: 설계만 자동화

```bash
# docs/design_request.md에 요구사항 작성 후
./scripts/cross_check_auto.sh design docs/design_request.md

# 결과:
# - output/design_v1.md (Claude 설계서)
# - output/design_review_v1.md (Gemini 리뷰)
# - output/design_final.md (승인된 최종 설계서)
```

### 시나리오 2: 전체 파이프라인 자동화

```bash
# 설계 → 구현 → 테스트 → 자동 커밋 → PR 생성
./scripts/cross_check_auto.sh full docs/request.md output \
  --auto-commit --auto-pr --max-rounds 5

# 완전 자동:
# 1. Claude가 설계 → Gemini 리뷰 → (최대 5회 반복)
# 2. Claude가 구현 → Gemini 리뷰 → (최대 5회 반복)
# 3. Claude가 테스트 → Gemini 리뷰 → (최대 5회 반복)
# 4. 모두 승인되면 자동 커밋
# 5. 자동 PR 생성
```

---

## 검토 요청 사항

### 1. 아키텍처 & 설계

**질문:**
- Claude CLI 자동 호출 방식이 적절한가?
- 파일 기반 프롬프트 처리 방식에 문제가 없는가?
- 승인/반려 판정 로직 (`check_approval` 함수)이 충분한가?

**현재 승인/반려 판정 로직:**
```bash
check_approval() {
    # 승인 키워드: 승인, APPROVED, LGTM, 통과, 문제.*없
    # 반려 키워드: 반려, REJECTED, 수정.*필요, 문제.*있

    if grep -qiE "(승인|APPROVED|LGTM)" "$review_file"; then
        if ! grep -qiE "(반려|REJECTED|수정.*필요)" "$review_file"; then
            return 0  # 승인
        fi
    fi
    return 1  # 반려
}
```

→ **개선 필요한가요?** (예: JSON 응답 포맷, 구조화된 출력 등)

---

### 2. 보안 & 안전성

**우려 사항:**

1. **자동 커밋의 위험성**
   - 잘못된 코드가 자동으로 커밋될 수 있음
   - 현재: `--auto-commit` 플래그로 명시적 활성화 필요
   - **더 안전한 방법이 있을까요?**

2. **무한루프 방지가 충분한가?**
   - 현재: 변경사항 해시 비교 + 최대 라운드 제한
   - 추가로 필요한 안전장치는?

3. **Claude/Gemini 응답 검증**
   - AI가 잘못된 응답을 할 경우?
   - 파일 생성 실패 시 처리?

---

### 3. 코드 품질 & 버그

**검토 항목:**

1. **Bash 스크립트 안전성**
   - `set -e` 사용 (에러 시 즉시 중단)
   - 변수 인용 (`"$var"`)
   - 파일 존재 확인
   - **추가로 개선할 부분?**

2. **에러 처리**
   - Claude/Gemini 실행 실패 시?
   - 네트워크 에러 시?
   - **재시도 로직 필요한가?**

3. **로그 관리**
   - 현재: `logs/cross_check_auto/` 에 모든 로그 저장
   - 로그가 너무 많아지면?
   - **로그 정리 정책 필요한가?**

---

### 4. 사용성 & UX

**피드백 요청:**

1. **옵션 플래그 명명**
   - `--auto-commit` vs `--commit`
   - `--auto-pr` vs `--pr`
   - `--max-rounds` vs `--rounds` or `--max-iterations`
   - **더 직관적인 이름이 있을까요?**

2. **출력 메시지**
   - 현재: 색상 코드로 구분 (INFO, SUCCESS, WARN, ERROR, AI)
   - 너무 많은 출력? 너무 적은 출력?

3. **중단 및 복구**
   - 중간에 중단하면?
   - 특정 라운드부터 재시작 가능?
   - **`--resume` 옵션 필요한가?**

---

### 5. 성능 & 확장성

**우려 사항:**

1. **속도**
   - Claude Sonnet 4.5 사용 (구현용)
   - Gemini 3 Pro Preview 사용 (리뷰용)
   - 전체 파이프라인 실행 시간: **예상 10-30분** (라운드당 5분)
   - **더 빠르게 할 수 있나?** (모델 변경, 병렬 처리 등)

2. **비용**
   - Claude API 호출 비용
   - Gemini API 호출 비용
   - **비용 최적화 방법?**

3. **확장성**
   - 현재: 설계/구현/테스트만 지원
   - 추가 단계 필요? (예: 배포, 문서화)

---

## 예상되는 문제점 & 해결 방안

### 문제 1: AI가 파일을 생성하지 않음

**시나리오:**
```bash
# Claude에게 "design.md 파일에 저장해줘"라고 했는데
# Claude가 화면에만 출력하고 파일을 안 만듦
```

**현재 해결 방안:**
- 파일 존재 확인 후 에러 출력
- 사용자 개입 요청

**개선 필요:**
- Claude 응답을 자동으로 파일로 저장?
- 프롬프트를 더 명확하게? ("반드시 파일로 저장하고, 파일 경로를 출력해줘")

---

### 문제 2: 승인/반려 판정 실패

**시나리오:**
```bash
# Gemini 리뷰:
# "전반적으로 좋지만, 한 가지 수정이 필요합니다..."
# → 승인도 반려도 명시 안 함
```

**현재 해결 방안:**
- 프롬프트에 "마지막에 [승인] 또는 [수정 필요]를 명시해줘"라고 명시

**개선 필요:**
- JSON 응답 포맷 강제? `{"status": "approved", "reason": "..."}`
- 애매한 경우 기본값? (반려 처리?)

---

### 문제 3: 무한루프 (동일한 수정 반복)

**시나리오:**
```bash
# Round 1: Claude 구현 → Gemini "A를 수정하세요"
# Round 2: Claude 수정 → Gemini "A를 수정하세요" (동일한 피드백)
# Round 3: Claude 수정 → Gemini "A를 수정하세요" (무한 반복)
```

**현재 해결 방안:**
- 변경사항 해시 비교 (동일하면 중단)
- 최대 라운드 제한 (기본 3회)

**개선 필요:**
- Gemini 피드백의 유사도 분석?
- Claude에게 "이전 피드백이 해결되지 않았습니다"라고 알림?

---

## 요청 사항 요약

**Opus 4.5에 다음을 검토해주세요:**

1. ✅ **아키텍처 검토**: 자동화 방식이 적절한가?
2. 🔒 **보안 검토**: 자동 커밋/PR의 위험성은?
3. 🐛 **버그 검토**: 코드에 잠재적 버그가 있는가?
4. 📝 **개선 제안**: 더 나은 방법은?
5. ⚠️ **우려 사항**: 예상되는 문제점은?

---

## 관련 파일

- **메인 스크립트**: `scripts/cross_check_auto.sh` (774 lines)
- **기존 스크립트**: `scripts/cross_check.sh` (비교용)
- **README**: `README.md` (사용법 추가)

---

## 피드백 형식

**다음 형식으로 피드백 부탁드립니다:**

```markdown
## 1. 아키텍처 검토
- [적절함/개선 필요] ...

## 2. 보안 검토
- [안전함/위험 있음] ...

## 3. 버그 검토
- [발견된 버그] ...

## 4. 개선 제안
- [제안 1] ...
- [제안 2] ...

## 5. 우려 사항
- [우려 1] ...
- [우려 2] ...

## 종합 평가
- [승인/수정 필요]
```

---

**검토 감사합니다!**
