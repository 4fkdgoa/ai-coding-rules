# AI Coding Assistant Rules

범용 코딩 규칙입니다. 프로젝트별 설정은 하단 `[프로젝트 설정]` 섹션을 채우세요.

---

## 코딩 표준

### 일반 규칙
- **들여쓰기**: 공백 4칸 (탭 사용 금지)
- **줄 길이**: 120자 권장
- **파일 크기**: 1500줄 이하, 초과 시 분리
- **인코딩**: UTF-8

### 네이밍 컨벤션
- **클래스/인터페이스**: `PascalCase`
- **메서드/변수**: `camelCase`
- **상수**: `UPPER_SNAKE_CASE`
- **파일명**: 클래스명과 동일 (Java), `snake_case` (Python)

### 메서드 네이밍
- `list*()` - 여러 항목 조회
- `get*()` - 단일 항목 조회
- `save*()` - 생성 또는 수정
- `insert*()` - 생성만
- `update*()` - 수정만
- `delete*()` - 하드 삭제 (DB에서 제거)
- `disable*()` - 소프트 삭제 (비활성화)

**중요**: delete vs disable 구분이 불명확하면 반드시 확인 후 진행

---

## 에러 처리 원칙

### 절대 금지
- 테스트 안 하고 "완료" 주장
- 필수 파라미터에 임의 기본값 대입
- 에러를 숨기기 위한 빈 try-catch
- 불명확한 요구사항 추측

### 올바른 처리
- 필수 파라미터 누락 시 → 예외 발생 또는 확인 요청
- 불명확한 요구사항 → 질문 후 진행
- 에러 발생 시 → 명확한 메시지와 함께 전파

---

## Git 커밋 규칙

### 커밋 메시지 형식
```
<type>: <subject>

[body]
```

### Type 종류
- `feat`: 새 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링 (기능 변경 없음)
- `docs`: 문서 변경
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정 변경

### 커밋 전 체크리스트
1. `git status` - 변경 파일 확인
2. `git diff` - 변경 내용 확인
3. `git log` - 최근 커밋 스타일 확인
4. 민감 정보(.env, credentials) 포함 여부 확인

### 금지 사항
- `git push --force` (main/master)
- `git commit --amend` (이미 push된 커밋)
- `--no-verify` 플래그 사용

---

## 코드 리뷰 체크리스트

### 기능
- [ ] 요구사항대로 동작하는가?
- [ ] 엣지 케이스 처리가 되어 있는가?
- [ ] 에러 처리가 적절한가?

### 코드 품질
- [ ] 중복 코드가 없는가?
- [ ] 메서드/클래스가 단일 책임을 가지는가?
- [ ] 네이밍이 명확한가?

### 보안
- [ ] SQL Injection 취약점이 없는가?
- [ ] XSS 취약점이 없는가?
- [ ] 민감 정보가 하드코딩되지 않았는가?

### 성능
- [ ] N+1 쿼리 문제가 없는가?
- [ ] 불필요한 반복이 없는가?
- [ ] 적절한 인덱스를 사용하는가?

---

## 테스트 규칙

### 테스트 필수 항목
- 새 기능 → 단위 테스트 필수
- 버그 수정 → 재현 테스트 필수
- API 변경 → 통합 테스트 필수

### 테스트 네이밍
```
test_<기능>_<조건>_<예상결과>
```
예: `test_login_invalidPassword_returnsUnauthorized`

### Mock 사용 원칙
- 외부 서비스(API, DB) → Mock 허용
- 내부 로직 → Mock 최소화
- 테스트 컨테이너 선호

---

## AI 어시스턴트 모드

> 프로젝트에서 사용하는 AI 도구에 맞게 모드를 선택하세요.

### MODE: Claude 주객체 (기본)

Claude Code가 메인 AI 어시스턴트로 동작합니다.

```yaml
ai_mode: claude_primary
main_ai: Claude Code
secondary_ai: Gemini CLI (선택적 교차검증)
```

**역할 분담**:
- **Claude Code**: 구현, 디버깅, 테스트 실행, Git 작업
- **Gemini CLI**: 코드 리뷰, 설계 검토, 문서 분석 (선택적)

**교차검증 규칙** (선택 시):
1. 중요 설계 변경 전 Gemini에 검토 요청
2. Gemini 피드백 반영 후 Claude가 구현
3. 구현 결과를 Gemini에 재검토 (선택적)

**사용 예시**:
```bash
# Claude Code에서 Gemini 호출
gemini "다음 설계 변경 검토해줘: [내용]"
```

---

### MODE: Gemini 주객체

Gemini CLI가 메인 AI 어시스턴트로 동작합니다.

```yaml
ai_mode: gemini_primary
main_ai: Gemini CLI
secondary_ai: Claude Code (선택적 구현 위임)
```

**역할 분담**:
- **Gemini CLI**: 설계, 분석, 문서화, 코드 리뷰
- **Claude Code**: 복잡한 구현, 파일 수정, 테스트 실행 (위임 시)

**위임 규칙**:
1. Gemini가 설계 및 명세 작성
2. 구현이 필요하면 Claude에 위임 (상세 명세 포함)
3. Claude 구현 결과를 Gemini가 검토

**사용 예시**:
```bash
# Gemini에서 Claude에 위임
# GEMINI.md 파일에 위임 지시사항 작성
```

---

### MODE: 단독 사용

하나의 AI 도구만 사용합니다.

```yaml
ai_mode: single
main_ai: Claude Code  # 또는 Gemini CLI
secondary_ai: none
```

**주의사항**:
- 교차검증 없이 진행
- 중요 변경 시 수동 리뷰 권장

---

## AI 어시스턴트 지시사항

### 작업 전
1. 관련 파일 먼저 읽기 (수정 전 이해)
2. 기존 패턴/컨벤션 파악
3. 불명확하면 질문

### 작업 중
- TodoWrite로 진행 상황 추적 (복잡한 작업 시)
- 한 번에 한 가지 작업에 집중
- 과도한 리팩토링 금지

### 작업 후
- 실제 테스트 실행 및 로그 확인
- 변경사항 요약
- 추가 작업 필요 시 명시

### 소통 규칙
- 이모지 사용 금지 (명시적 요청 제외)
- 간결한 응답
- 기술적 정확성 우선

---

## Skill 예시

### 커밋 Skill
```markdown
# /commit skill

1. git status로 변경 파일 확인
2. git diff로 변경 내용 분석
3. 변경 내용 기반 커밋 메시지 생성
4. 사용자 확인 후 커밋
```

### 코드 리뷰 Skill
```markdown
# /review skill

1. 변경된 파일 목록 확인
2. 각 파일별 변경사항 분석
3. 체크리스트 기반 리뷰
4. 개선점 제안
```

---

## [프로젝트 설정]

> 아래 섹션을 프로젝트에 맞게 수정하세요.

### 기본 정보
```yaml
project_name: "프로젝트명"
tech_stack: "Java 21 + Spring Boot 3.x"  # 또는 Python, Node.js 등
package_name: "com.example.project"
context_path: "/api"
```

### 디렉토리 구조
```
src/
├── main/
│   ├── java/          # 소스 코드
│   └── resources/     # 설정 파일
└── test/              # 테스트 코드
```

### DB 스키마 (주요 테이블)
```sql
-- 예시: 사용자 테이블
-- CREATE TABLE users (
--   id BIGINT PRIMARY KEY,
--   email VARCHAR(255),
--   created_at TIMESTAMP
-- );
```

### API 엔드포인트
```
GET  /api/users       - 사용자 목록
POST /api/users       - 사용자 생성
GET  /api/users/{id}  - 사용자 상세
```

### 공통 코드/유틸리티
```
# 공통으로 사용하는 클래스/함수 경로
- src/main/java/.../common/  # 공통 유틸
- src/main/java/.../config/  # 설정 클래스
```

### 팀 컨벤션 (추가 규칙)
```
# 팀에서 추가로 정한 규칙이 있으면 여기에
- 예: PR 제목 형식: [JIRA-123] 제목
- 예: 브랜치 네이밍: feature/JIRA-123-description
```

---

**마지막 업데이트**: 2026-01-11
