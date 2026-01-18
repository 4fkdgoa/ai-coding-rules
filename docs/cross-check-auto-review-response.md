# cross_check_auto.sh 코드 리뷰 결과

**리뷰어**: Claude Opus 4.5
**리뷰 일자**: 2026-01-17
**대상 파일**: `scripts/cross_check_auto.sh` (735 lines)

---

## 1. 아키텍처 검토

### [적절함] Claude CLI 자동 호출 방식

**장점:**
- CLI 파이프라인 방식으로 자동화가 잘 설계됨
- `run_claude_auto()`, `run_gemini_auto()` 함수로 AI 호출이 일관되게 추상화됨
- 출력을 파일로 저장하고 로그에도 백업하는 이중화 전략이 좋음

**개선 필요 사항:**

1. **모델 이름 하드코딩 문제 (Line 85)**
   ```bash
   claude -m "claude-$CLAUDE_MODEL-4-5" "$prompt"
   ```
   - `CLAUDE_MODEL="sonnet"` + `"claude-$CLAUDE_MODEL-4-5"` = `"claude-sonnet-4-5"`
   - 향후 모델 버전 변경 시 여러 곳 수정 필요
   - **권장**: 전체 모델 ID를 설정 변수로 분리
   ```bash
   CLAUDE_MODEL_ID="claude-sonnet-4-5"  # 명시적인 전체 모델 ID
   ```

2. **파일 기반 프롬프트 처리 - 크기 제한 없음 (Line 266, 384 등)**
   ```bash
   design_prompt="...$(cat "$request_file")..."
   ```
   - 큰 파일을 cat하면 명령행 길이 제한(ARG_MAX) 초과 가능
   - **권장**: 파일 크기 검증 추가
   ```bash
   if [ $(stat -c%s "$request_file") -gt 100000 ]; then
       log_error "요청 파일이 너무 큽니다 (100KB 제한)"
       return 1
   fi
   ```

### [개선 필요] 승인/반려 판정 로직 (check_approval 함수)

**현재 로직 (Line 135-151):**
```bash
check_approval() {
    if grep -qiE "(승인|APPROVED|LGTM|통과|문제.*없)" "$review_file" 2>/dev/null; then
        if ! grep -qiE "(반려|REJECTED|수정.*필요|문제.*있|개선.*필요)" "$review_file" 2>/dev/null; then
            return 0  # 승인
        fi
    fi
    return 1
}
```

**문제점:**
1. **정규식 충돌**: "문제.*없"과 "문제.*있"이 동시에 매칭될 수 있음
   - 예: "이 문제는 있지만 큰 문제는 없습니다" -> 둘 다 매칭
2. **위치 무관**: 문서 중간의 키워드도 매칭됨
   - 예: "예전에는 수정 필요했지만 지금은 [승인]합니다" -> 반려로 판정
3. **오탐 가능성**: "LGTM" 외에 문맥 없는 키워드 매칭
   - 예: "이 승인 프로세스는..." (승인 단어 언급만으로 승인 처리)

**권장 개선안:**
```bash
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
        return 1  # 명시적 반려
    fi

    # 명시적 승인 키워드 확인
    if echo "$conclusion" | grep -qiE "\[(승인|APPROVED|LGTM)\]"; then
        return 0  # 명시적 승인
    fi

    # 명시적 판정이 없으면 반려 처리 (안전 우선)
    log_warn "명시적 판정 키워드가 없습니다. 반려 처리합니다."
    return 1
}
```

**추가 권장 - JSON 응답 포맷:**
더 안정적인 방법은 AI에게 JSON 응답을 요청하는 것입니다.
```bash
# 프롬프트에 추가
echo "응답 마지막에 다음 JSON 형식으로 판정 결과를 출력해줘:
\`\`\`json
{\"status\": \"approved\" 또는 \"rejected\", \"reason\": \"판정 이유\"}
\`\`\`"

# 파싱
check_approval_json() {
    local json=$(grep -oP '```json\s*\K\{[^}]+\}' "$review_file" | tail -1)
    if [ -n "$json" ]; then
        local status=$(echo "$json" | jq -r '.status')
        [ "$status" = "approved" ] && return 0
    fi
    return 1
}
```

---

## 2. 보안 검토

### [위험 있음] 자동 커밋 기능

**현재 구현 (Line 166-206):**
```bash
auto_commit() {
    if [ "$AUTO_COMMIT" != "true" ]; then
        return 0
    fi
    git add -A
    git commit -m "$commit_msg"
    git push -u origin "$current_branch"
}
```

**위험 요소:**

1. **`git add -A` 사용 - 모든 파일 스테이징**
   - `.env`, `credentials.json` 등 민감 파일도 커밋될 수 있음
   - **심각도: 높음**
   - **권장**: 민감 파일 필터링 추가
   ```bash
   # 민감 파일 확인
   local sensitive_files=$(git diff --cached --name-only | grep -E '\.(env|pem|key|credentials|secret)')
   if [ -n "$sensitive_files" ]; then
       log_error "민감 파일이 포함되어 있습니다:"
       echo "$sensitive_files"
       log_error "자동 커밋을 중단합니다."
       git reset HEAD -- $sensitive_files
       return 1
   fi
   ```

2. **커밋 메시지 검증 없음**
   - 빈 메시지나 잘못된 형식의 메시지가 들어갈 수 있음
   - **권장**: 커밋 메시지 검증
   ```bash
   if [ -z "$commit_msg" ] || [ ${#commit_msg} -lt 10 ]; then
       log_error "커밋 메시지가 너무 짧습니다"
       return 1
   fi
   ```

3. **자동 Push - 되돌리기 어려움**
   - 잘못된 코드가 원격에 즉시 푸시됨
   - **권장**: `--auto-push` 플래그 분리 또는 드라이런 모드 추가
   ```bash
   # --dry-run 옵션 추가
   if [ "$DRY_RUN" = "true" ]; then
       log_info "[DRY-RUN] 다음 명령이 실행될 예정:"
       log_info "  git add -A"
       log_info "  git commit -m \"$commit_msg\""
       log_info "  git push -u origin $current_branch"
       return 0
   fi
   ```

4. **main/master 브랜치 보호 없음**
   - 실수로 메인 브랜치에서 실행 시 직접 푸시됨
   - **권장**: 브랜치 보호 로직 추가
   ```bash
   local current_branch=$(git branch --show-current)
   if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
       log_error "main/master 브랜치에서는 자동 커밋이 금지됩니다!"
       return 1
   fi
   ```

### [위험 있음] 임시 파일 보안

**현재 구현 (Line 83, 114):**
```bash
local temp_response="/tmp/claude_response_$$.txt"
local temp_response="/tmp/gemini_response_$$.txt"
```

**문제점:**
- `/tmp`는 모든 사용자가 접근 가능
- PID(`$$`)만으로는 예측 가능 (심볼릭 링크 공격 가능)

**권장:**
```bash
local temp_response=$(mktemp -t "claude_response_XXXXXX.txt")
# 사용 후 반드시 삭제 (trap 사용)
trap "rm -f '$temp_response'" EXIT
```

### [적절함] 무한루프 방지 - 충분하지만 강화 필요

**현재 구현:**
1. `MAX_ROUNDS` 제한 (기본 3회) - Line 34
2. 변경사항 해시 비교 - Line 154-164

**추가 권장 - 연속 동일 피드백 감지:**
```bash
# 이전 피드백과 현재 피드백 유사도 확인
check_feedback_similarity() {
    local prev_review="$1"
    local curr_review="$2"

    if [ -f "$prev_review" ] && [ -f "$curr_review" ]; then
        # 단순 비교: 핵심 키워드 추출 후 비교
        local prev_keywords=$(grep -oE "(수정|필요|문제|오류|버그)" "$prev_review" | sort -u)
        local curr_keywords=$(grep -oE "(수정|필요|문제|오류|버그)" "$curr_review" | sort -u)

        if [ "$prev_keywords" = "$curr_keywords" ]; then
            log_warn "이전 피드백과 유사한 피드백이 감지되었습니다."
            return 0  # 유사함
        fi
    fi
    return 1  # 다름
}
```

---

## 3. 버그 검토

### [발견된 버그] 설계 크로스체크의 해시 비교 미사용

**위치**: `cross_check_design_auto()` 함수 (Line 240-346)

**문제:**
```bash
cross_check_design_auto() {
    local prev_hash=""  # 선언만 하고 사용 안 함!
    ...
    while [ $round -le $MAX_ROUNDS ]; do
        # prev_hash 비교 로직이 없음
        ...
    done
}
```

`cross_check_implement_auto()`에는 해시 비교가 있지만 (Line 370-377), 설계와 테스트 함수에는 없습니다.

**수정 권장:**
설계 파일 내용을 해시하여 비교하는 로직 추가:
```bash
# 설계 파일 해시 계산
local curr_hash=$(md5sum "$design_file" | awk '{print $1}')
if [ -n "$prev_hash" ] && [ "$curr_hash" = "$prev_hash" ]; then
    log_error "설계 내용 변경 없음 - 무한루프 감지!"
    return 1
fi
prev_hash="$curr_hash"
```

### [발견된 버그] 테스트 크로스체크의 해시 비교 누락

**위치**: `cross_check_test_auto()` 함수 (Line 496-596)

**문제:**
```bash
cross_check_test_auto() {
    # prev_hash 변수 자체가 없음
    while [ $round -le $MAX_ROUNDS ]; do
        # 무한루프 방지 로직 없음
        ...
    done
}
```

### [발견된 버그] cat 파이프라인 에러 무시

**위치**: Line 471
```bash
$(cat "$review_file" | head -20)
```

**문제:**
- `cat`이 실패해도 스크립트가 계속 진행됨
- `set -e`가 있지만 파이프라인 내부 에러는 잡지 못함

**수정 권장:**
```bash
# set -o pipefail 추가 (Line 21 근처)
set -e
set -o pipefail
```

### [발견된 버그] diff 파일 크기 제한 문제

**위치**: Line 431
```bash
$(cat "$output_dir/changes_v${round}_full.diff" 2>/dev/null | head -500)
```

**문제:**
- `head -500`은 500줄을 의미하는데, 각 줄이 매우 길면 프롬프트가 여전히 너무 커질 수 있음
- 바이너리 파일이 diff에 포함되면 문제 발생 가능

**수정 권장:**
```bash
# 텍스트 파일만, 크기 제한 적용
git diff --text HEAD 2>/dev/null | head -c 50000 > "$output_dir/changes_v${round}_full.diff"
```

### [잠재적 버그] 경쟁 조건 (Race Condition)

**위치**: Line 83-94
```bash
local temp_response="/tmp/claude_response_$$.txt"
claude ... > "$temp_response" 2>&1
cp "$temp_response" "$output_file"
rm -f "$temp_response"
```

**문제:**
- 스크립트가 동시에 여러 인스턴스 실행되면 같은 PID 파일 사용 가능
- 프로세스 종료 후 PID 재사용 시 충돌

**수정 권장:**
```bash
local temp_response=$(mktemp)
```

---

## 4. 개선 제안

### [제안 1] 재시도 로직 추가

AI API 호출 실패 시 재시도가 없습니다.

```bash
run_with_retry() {
    local max_retries=3
    local retry_delay=5
    local cmd="$1"

    for ((i=1; i<=max_retries; i++)); do
        if eval "$cmd"; then
            return 0
        fi
        log_warn "실행 실패 (시도 $i/$max_retries). ${retry_delay}초 후 재시도..."
        sleep $retry_delay
        retry_delay=$((retry_delay * 2))  # 지수 백오프
    done

    log_error "최대 재시도 횟수 초과"
    return 1
}

# 사용 예
run_with_retry "claude -m '$CLAUDE_MODEL_ID' '$prompt' > '$temp_response'"
```

### [제안 2] 중단 및 복구 (--resume) 옵션

```bash
# 상태 저장
save_state() {
    local state_file="$output_dir/.cross_check_state"
    cat > "$state_file" << EOF
CURRENT_PHASE=$current_phase
CURRENT_ROUND=$round
LAST_SUCCESS_ROUND=$((round-1))
TIMESTAMP=$(date +%s)
EOF
}

# 상태 복원
load_state() {
    local state_file="$output_dir/.cross_check_state"
    if [ -f "$state_file" ]; then
        source "$state_file"
        log_info "이전 상태 복원: Phase=$CURRENT_PHASE, Round=$CURRENT_ROUND"
    fi
}

# --resume 옵션 처리
if [ "$RESUME" = "true" ] && [ -f "$state_file" ]; then
    load_state
fi
```

### [제안 3] 타임아웃 설정

AI 호출이 무한히 대기할 수 있습니다.

```bash
AI_TIMEOUT=300  # 5분

run_claude_auto() {
    if timeout $AI_TIMEOUT claude -m "$CLAUDE_MODEL_ID" "$prompt" > "$temp_response" 2>&1; then
        ...
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_error "Claude 호출 타임아웃 (${AI_TIMEOUT}초)"
        fi
        return 1
    fi
}
```

### [제안 4] 로그 정리 정책

```bash
# 오래된 로그 자동 정리 (7일 이상)
cleanup_old_logs() {
    find "$LOG_DIR" -type f -mtime +7 -delete 2>/dev/null || true
    log_info "7일 이상 된 로그 정리 완료"
}

# 메인 시작 시 호출
cleanup_old_logs
```

### [제안 5] 확인 프롬프트 추가 (자동 커밋 전)

```bash
auto_commit() {
    if [ "$AUTO_COMMIT" != "true" ]; then
        return 0
    fi

    # 인터랙티브 모드에서는 확인 요청
    if [ -t 0 ]; then  # stdin이 터미널인 경우
        log_warn "다음 파일들이 커밋됩니다:"
        git status --short
        read -p "계속하시겠습니까? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            log_info "커밋 취소됨"
            return 0
        fi
    fi

    # 커밋 진행...
}
```

### [제안 6] 옵션 플래그 명명 개선

현재 옵션 이름들이 적절하지만, 일관성을 위해:

| 현재 | 제안 | 이유 |
|------|------|------|
| `--auto-commit` | 유지 | 명확함 |
| `--auto-pr` | 유지 | 명확함 |
| `--max-rounds` | `--max-rounds` 또는 `-r` | 단축 옵션 추가 |
| (없음) | `--dry-run` | 실행 없이 미리보기 |
| (없음) | `--resume` | 중단된 작업 재개 |
| (없음) | `--quiet` / `-q` | 출력 최소화 |
| (없음) | `--verbose` / `-v` | 상세 출력 |

---

## 5. 우려 사항

### [우려 1] AI 응답 품질 의존성

**문제:**
- AI가 프롬프트를 무시하고 다른 형식으로 응답할 수 있음
- "파일로 저장해줘"라고 했는데 화면 출력만 할 수 있음
- 승인/반려 키워드를 명시하지 않을 수 있음

**완화 방안:**
1. 프롬프트에 더 강력한 지시 추가:
   ```
   중요: 반드시 응답 마지막에 [승인] 또는 [수정 필요]를 명시하세요.
   이 키워드가 없으면 자동으로 반려 처리됩니다.
   ```
2. 응답 검증 로직 추가:
   ```bash
   validate_response() {
       local response_file="$1"

       # 최소 길이 확인
       if [ $(wc -c < "$response_file") -lt 100 ]; then
           log_error "응답이 너무 짧습니다"
           return 1
       fi

       # 필수 키워드 확인
       if ! grep -qE "\[(승인|수정.*필요|APPROVED|REJECTED)\]" "$response_file"; then
           log_warn "판정 키워드가 없습니다"
       fi

       return 0
   }
   ```

### [우려 2] 비용 누적

**문제:**
- 무한루프 방지가 있지만, 많은 프로젝트에서 반복 실행 시 비용 급증
- 특히 긴 diff를 프롬프트에 포함하면 토큰 사용량 증가

**완화 방안:**
1. 토큰/비용 추적 로깅:
   ```bash
   log_info "예상 토큰 사용량: ~$(echo "$prompt" | wc -w) words"
   ```
2. 일일 사용량 제한 옵션:
   ```bash
   --daily-limit 100000  # 일일 토큰 제한
   ```

### [우려 3] 테스트 커버리지 검증 불가

**문제:**
- "테스트 승인"이 실제 테스트 통과를 의미하지 않음
- AI가 테스트를 "실행했다고 주장"만 할 수 있음

**완화 방안:**
```bash
# 실제 테스트 실행 결과 확인
verify_tests() {
    local test_cmd="${TEST_COMMAND:-npm test}"

    log_step "테스트 실행 검증..."
    if ! $test_cmd 2>&1 | tee "$output_dir/test_actual_result.log"; then
        log_error "실제 테스트 실패!"
        return 1
    fi

    log_success "테스트 통과 확인됨"
    return 0
}

# 테스트 승인 전 실제 검증
if check_approval "$review_file"; then
    if ! verify_tests; then
        log_error "AI는 승인했지만 실제 테스트가 실패했습니다"
        return 1
    fi
fi
```

### [우려 4] 롤백 메커니즘 부재

**문제:**
- 자동 커밋/푸시 후 문제 발생 시 롤백이 어려움
- 여러 커밋이 이미 푸시된 경우 특히 복잡

**완화 방안:**
```bash
# 시작 전 상태 저장
INITIAL_HEAD=$(git rev-parse HEAD)

# 롤백 함수
rollback() {
    log_warn "롤백 시작: $INITIAL_HEAD 로 복구"
    git reset --hard "$INITIAL_HEAD"
    log_success "롤백 완료"
}

# 에러 발생 시 자동 롤백 (선택적)
trap 'rollback' ERR
```

### [우려 5] Gemini --yolo 플래그

**위치**: Line 116
```bash
gemini -m "$GEMINI_MODEL" --yolo "$prompt"
```

**문제:**
- `--yolo` 플래그의 정확한 동작이 문서화되어 있지 않음
- 안전하지 않은 동작을 허용할 수 있음

**권장:**
- 플래그의 의미를 주석으로 문서화
- 안전한 대안이 있다면 교체 검토

---

## 종합 평가

### [수정 필요]

**전체 점수: 7/10**

**잘 된 점:**
- 전체 아키텍처와 워크플로우 설계가 합리적
- 로깅 및 출력 메시지가 명확함
- 모드 분리 (design/implement/test/full)가 유연함
- 옵션 플래그로 위험 기능 명시적 활성화 필요

**필수 수정 사항 (프로덕션 사용 전):**

| 우선순위 | 항목 | 위험도 |
|---------|------|--------|
| P0 | 민감 파일 커밋 방지 | 높음 |
| P0 | main/master 브랜치 보호 | 높음 |
| P1 | 승인/반려 판정 로직 개선 | 중간 |
| P1 | 설계/테스트 함수 해시 비교 추가 | 중간 |
| P1 | 임시 파일 보안 (mktemp 사용) | 중간 |
| P2 | 재시도 로직 추가 | 낮음 |
| P2 | 타임아웃 설정 | 낮음 |
| P2 | set -o pipefail 추가 | 낮음 |

**사용 권장 시나리오:**
- 개발 브랜치에서 실험적 사용: OK
- 중요 프로젝트 자동화: 위 수정 후 사용
- CI/CD 통합: 추가 안전장치 필요

---

## 요약

`cross_check_auto.sh`는 AI 협업 워크플로우를 자동화하는 흥미로운 접근입니다. 기본 구조는 잘 설계되어 있으나, **자동 커밋/푸시 기능의 보안 강화**와 **승인 판정 로직의 정확성 개선**이 필요합니다. 특히 민감 파일 필터링과 main 브랜치 보호는 프로덕션 사용 전 반드시 추가해야 합니다.

---

**리뷰 완료**
