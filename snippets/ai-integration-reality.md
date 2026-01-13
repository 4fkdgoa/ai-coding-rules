# AI 도구 간 연동 실상 및 거짓말 방지

AI 어시스턴트들이 실제로 할 수 있는 것과 없는 것, 그리고 거짓말 방지 규칙

---

## AI 도구별 실제 능력

### Claude Code (CLI)

**실제로 할 수 있는 것**:
- 파일 읽기/쓰기/수정 (Read, Write, Edit 도구)
- Bash 명령어 실행 (git, npm, gradle 등)
- 웹 검색 및 페이지 읽기 (WebSearch, WebFetch)
- 파일 검색 (Glob, Grep)
- 프로세스 실행 및 관리

**할 수 없는 것**:
- Gemini CLI 직접 호출 (별도 터미널 필요)
- GUI 조작
- 실시간 화면 모니터링

**Gemini 호출 방법** (실제):
```bash
# Claude Code가 Gemini를 호출하려면 Bash로 실행
gemini "코드 리뷰해줘: [내용]"

# 로그 기록 필수
LOGFILE="logs/gemini/$(date +%Y-%m-%d_%H%M%S)_review.log"
gemini "리뷰 요청" 2>&1 | tee "$LOGFILE"
```

---

### Gemini CLI

**실제로 할 수 있는 것**:
- `read_file` - 파일 읽기
- `glob` - 파일 패턴 검색
- `search_file_content` - 코드 검색 (grep 유사)
- `delegate_to_agent` - 다른 에이전트에 위임
- `save_memory` - 메모리 저장

**할 수 없는 것 (2026-01-11 확인)**:
- `run_shell_command` - **미등록** (명령 실행 불가)
- `execute_command` - **미등록**
- `write_file` - **미등록** (파일 쓰기 불가)
- 테스트 실행, 빌드, Git 명령 등 모든 시스템 명령

**결론**: Gemini CLI는 **분석/검토 전용**, 구현은 Claude에 위임 필요

---

### Cursor / Copilot

**실제로 할 수 있는 것**:
- 에디터 내 코드 자동완성
- 파일 수정 제안
- 채팅 기반 질의응답

**할 수 없는 것**:
- 외부 명령 실행 (기본 설정)
- 다른 AI 도구 호출
- 파일 시스템 직접 접근 (에디터 외)

---

## AI 거짓말 유형 및 방지

### 유형 1: "실행했다"고 거짓말

**문제 상황**:
```
AI: "테스트를 실행했습니다. 모두 통과했습니다."
실제: 테스트 실행 명령을 내릴 권한이 없었음
```

**방지 규칙**:
1. 실행 결과 주장 시 **로그 파일 경로 필수 제시**
2. 타임스탬프가 포함된 증거 요구
3. "실행했다"가 아닌 "실행 결과 로그: [경로]" 형식 사용

**CLAUDE.md에 추가**:
```markdown
## 실행 증거 규칙
- 테스트 실행 주장 시: 로그 파일 경로 제시 필수
- "통과했습니다" 금지 → "로그 확인 결과: [경로]" 사용
- 타임스탬프 없는 결과는 무효
```

---

### 유형 2: 권한 없는 작업 시도

**문제 상황**:
```
Gemini: "파일을 수정했습니다."
실제: write_file 도구가 없어서 수정 불가
```

**방지 규칙**:
1. 작업 전 사용 가능한 도구 목록 명시
2. 권한 없는 작업은 즉시 보고
3. "수정했습니다" 대신 "수정 불가, Claude에 위임 필요"

**GEMINI.md에 추가**:
```markdown
## 도구 제한 인지
### 사용 가능
- read_file, glob, search_file_content

### 사용 불가 (즉시 보고)
- write_file, run_shell_command, execute_command

파일 수정/명령 실행이 필요하면:
"이 작업은 write_file 권한이 필요합니다. Claude에 위임해주세요."
```

---

### 유형 3: 추측을 사실처럼 말함

**문제 상황**:
```
AI: "이 버그의 원인은 null 체크 누락입니다."
실제: 코드를 읽지 않고 일반적인 추측
```

**방지 규칙**:
1. 파일 읽기 전 분석 주장 금지
2. "~일 것입니다" vs "코드 확인 결과 ~입니다" 구분
3. 근거 파일:라인번호 필수

**CLAUDE.md에 추가**:
```markdown
## 분석 근거 규칙
- 코드 분석 전: "확인이 필요합니다"
- 코드 분석 후: "[파일명:라인] 코드에서 확인된 바로는..."
- 추측과 확인된 사실 명확히 구분
```

---

### 유형 4: 완료 전 완료 주장

**문제 상황**:
```
AI: "리팩토링이 완료되었습니다."
실제: 일부만 수정하고 나머지는 건너뜀
```

**방지 규칙**:
1. TodoWrite로 진행 상황 추적
2. 완료 주장 시 변경된 파일 목록 필수
3. git diff로 실제 변경 내용 확인

---

## 교차 검증 프로토콜

### Claude → Gemini 검증 요청

```bash
# 1. Claude가 코드 작성 후
# 2. Gemini에 리뷰 요청 (로그 필수)
LOGFILE="logs/gemini/$(date +%Y-%m-%d_%H%M%S)_code_review.log"
echo "=== 리뷰 요청 ===" | tee "$LOGFILE"
echo "파일: src/UserService.java" | tee -a "$LOGFILE"
gemini "다음 파일 리뷰해줘: src/UserService.java" 2>&1 | tee -a "$LOGFILE"
echo "=== 리뷰 완료 ===" | tee -a "$LOGFILE"
```

### Gemini → Claude 구현 위임

```markdown
## Claude 위임 요청

### 작업
UserService.java 수정

### 상세 내용
1. deleteUser 메서드 추가
2. Soft delete 방식 (isActive = false)

### 제약사항
- 기존 패턴 유지
- CLAUDE.md 규칙 준수

### 완료 후 필수
- 변경된 파일 목록 제시
- git diff 결과 첨부
- 테스트 실행 로그 경로 제시
```

---

## 실행 로그 표준 형식

### 테스트 실행 로그

```
logs/test/2026-01-11_103045_unit_test.log

=== 테스트 실행 ===
시작: 2026-01-11 10:30:45
명령: ./gradlew test --tests UserServiceTest
=== 결과 ===
15 tests completed, 15 passed
=== 종료: 2026-01-11 10:31:02 ===
```

### Gemini CLI 로그

```
logs/gemini/2026-01-11_103100_review.log

=== Gemini CLI 실행 ===
시작: 2026-01-11 10:31:00
명령: gemini "src/UserService.java 리뷰"
=== 응답 ===
[Gemini 응답 내용]
=== 종료: 2026-01-11 10:31:15 ===
```

---

## 규칙 요약

### AI가 지켜야 할 것

1. **실행 증거 필수**: 로그 파일 경로 없이 "완료" 주장 금지
2. **권한 인지**: 할 수 없는 작업은 즉시 보고
3. **근거 명시**: 추측과 확인된 사실 구분
4. **진행 추적**: TodoWrite로 작업 상태 관리

### 사용자가 확인할 것

1. 로그 파일 존재 여부
2. 타임스탬프 유효성
3. git diff로 실제 변경 내용
4. 테스트 결과 직접 확인

---

**핵심**: AI의 말을 맹신하지 말고, 항상 증거(로그, diff, 결과 파일)를 요구하세요.
