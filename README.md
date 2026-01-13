# AI Coding Rules

AI 코딩 어시스턴트(Claude Code, Gemini CLI, Cursor 등)를 위한 프로젝트 규칙 및 프롬프트 모음

## 사용법

### 1. 빠른 시작 (Claude Code)

```bash
# repo를 로컬에 클론
git clone https://github.com/4fdkgo/ai-coding-rules ~/.ai-rules

# 새 프로젝트에 CLAUDE.md 복사
cp ~/.ai-rules/CLAUDE.md ./

# 또는 curl로 직접 (Public일 때)
curl -o CLAUDE.md https://raw.githubusercontent.com/4fdkgo/ai-coding-rules/main/CLAUDE.md
```

### 2. AI 모드 선택

프로젝트에서 사용하는 AI 도구에 맞게 파일 선택:

| 모드 | 메인 파일 | 설명 |
|------|----------|------|
| Claude 주객체 | `CLAUDE.md` | Claude Code가 메인, Gemini는 교차검증 |
| Gemini 주객체 | `GEMINI.md` + `CLAUDE.md` | Gemini CLI가 메인, Claude에 구현 위임 |
| 단독 사용 | `CLAUDE.md` 또는 `GEMINI.md` | 하나의 AI만 사용 |

### 3. 템플릿 선택

```bash
# Java/Spring 프로젝트
cp ~/.ai-rules/templates/java-spring.md ./CLAUDE.md

# Python 프로젝트
cp ~/.ai-rules/templates/python.md ./CLAUDE.md

# Node.js 프로젝트
cp ~/.ai-rules/templates/nodejs.md ./CLAUDE.md
```

### 4. 프로젝트별 설정 추가

CLAUDE.md 복사 후, 하단의 `[프로젝트 설정]` 섹션을 채우세요:
- 프로젝트 정보
- DB 스키마
- API 엔드포인트
- 공통 코드 위치
- 팀 컨벤션

## 구조

```
ai-coding-rules/
├── CLAUDE.md              # 메인 규칙 (Claude 주객체)
├── GEMINI.md              # Gemini 주객체용 규칙
├── templates/
│   ├── java-spring.md     # Java/Spring Boot
│   ├── python.md          # Python/FastAPI/Django
│   └── nodejs.md          # Node.js/Express/NestJS
├── scripts/
│   ├── run_claude.ps1     # Claude CLI 실행 + 로그
│   ├── run_gemini.ps1     # Gemini CLI 실행 + 로그
│   ├── run_ai.ps1         # 통합 실행 스크립트
│   ├── cross_review.ps1   # Claude <-> Gemini 교차 리뷰
│   ├── request_code_review.ps1  # 코드 리뷰 요청 (단일 AI)
│   └── dual_review.ps1    # Claude + Gemini 동시 리뷰 (크로스체크)
├── snippets/
│   ├── git-commit.md      # Git 커밋 규칙
│   ├── code-review.md     # 코드 리뷰 체크리스트
│   ├── testing.md         # 테스트 작성 규칙
│   ├── db-query.md        # DB 쿼리 최적화 가이드
│   ├── db-connection.md   # DB 연결 (MSSQL/Oracle/PostgreSQL/MySQL)
│   ├── ai-test-framework.md    # AI 테스트 프레임워크 구축
│   ├── ai-cli-setup.md    # AI CLI 설치 및 인증 (Claude/Gemini)
│   ├── ai-integration-reality.md  # AI 간 연동 실상 및 거짓말 방지
│   ├── log-shortcuts.md   # [로그분석], [로그추적] 단축 키워드
│   ├── powershell-encoding.md   # PowerShell 인코딩 가이드 (Windows)
│   └── project-templates.md     # 프로젝트 공통 설정 (.gemini, .vscode, gradle 등)
└── skills/
    ├── skill-examples.md  # Skill 작성 예시 (/commit, /review 등)
    └── custom-tools.md    # 커스텀 도구 (로그 분석, API 테스트)
```

## AI 모드 상세

### Claude 주객체 모드 (기본)

```yaml
ai_mode: claude_primary
main_ai: Claude Code
secondary_ai: Gemini CLI (선택적 교차검증)
```

**역할 분담**:
- **Claude Code**: 구현, 디버깅, 테스트 실행, Git 작업
- **Gemini CLI**: 코드 리뷰, 설계 검토, 문서 분석 (선택적)

### Gemini 주객체 모드

```yaml
ai_mode: gemini_primary
main_ai: Gemini CLI
secondary_ai: Claude Code (구현 위임)
```

**역할 분담**:
- **Gemini CLI**: 설계, 분석, 문서화, 코드 리뷰
- **Claude Code**: 복잡한 구현, 파일 수정, 테스트 실행 (위임 시)

## Private/Public 전환

작업할 때만 Public으로:

```bash
# Public으로 변경 (작업 시작)
gh repo edit 4fdkgo/ai-coding-rules --visibility public

# Private으로 변경 (작업 완료)
gh repo edit 4fdkgo/ai-coding-rules --visibility private
```

## 포함된 규칙

### 코딩 표준
- 들여쓰기: 공백 4칸
- 줄 길이: 120자 권장
- 파일 크기: 1500줄 이하
- 네이밍 컨벤션 (PascalCase, camelCase, UPPER_SNAKE_CASE)
- 메서드 네이밍 (list/get/save/insert/update/delete/disable)

### 에러 처리 원칙
- 테스트 안 하고 "완료" 주장 금지
- 필수 파라미터에 임의 기본값 대입 금지
- 에러를 숨기기 위한 빈 try-catch 금지
- 불명확한 요구사항 추측 금지

### Git 커밋 규칙
- Conventional Commits 형식 (feat/fix/refactor/docs/test/chore)
- 민감 정보 커밋 방지
- force push, amend 제한

### 테스트 규칙
- 새 기능 → 단위 테스트 필수
- 버그 수정 → 재현 테스트 필수
- API 변경 → 통합 테스트 필수

## 주요 문서 설명

### AI CLI 스크립트 (scripts/)

**권장: Bash 스크립트** (Git Bash / WSL / Linux) - 인코딩 문제 없음

| 스크립트 | 용도 | 사용법 |
|----------|------|--------|
| `run_claude.sh` | Claude CLI 실행 + 로그 | `./run_claude.sh "질문"` |
| `run_gemini.sh` | Gemini CLI 실행 + 로그 | `./run_gemini.sh "질문"` |
| `run_ai.sh` | 통합 실행 | `./run_ai.sh claude "질문"` |
| `cross_review.sh` | 교차 리뷰 요청 | `./cross_review.sh claude gemini "리뷰해줘" file.java` |
| `dual_review.sh` | 동시 리뷰 (크로스체크) | `./dual_review.sh src/file.java` |

**PowerShell 스크립트** (Windows) - 인코딩 문제 있을 수 있음

| 스크립트 | 용도 | 사용법 |
|----------|------|--------|
| `run_claude.ps1` | Claude CLI 실행 + 로그 | `.\run_claude.ps1 "질문"` |
| `run_gemini.ps1` | Gemini CLI 실행 + 로그 | `.\run_gemini.ps1 "질문"` |
| `run_ai.ps1` | 통합 실행 | `.\run_ai.ps1 claude "질문"` |

**로그 저장 위치**:
- `logs/claude/` - Claude 실행 로그
- `logs/gemini/` - Gemini 실행 로그
- `logs/cross_review/` - 교차 리뷰 로그
- `logs/code_review/` - 코드 리뷰 로그
- `logs/dual_review/` - 동시 리뷰 로그 (Claude + Gemini + 요약)

### AI 도구 관련 문서

| 문서 | 내용 |
|------|------|
| [ai-cli-setup.md](snippets/ai-cli-setup.md) | Claude/Gemini CLI 설치, 인증, 상호 호출 방법 |
| [ai-integration-reality.md](snippets/ai-integration-reality.md) | AI 도구별 실제 능력, 거짓말 방지 규칙, 교차 검증 |
| [ai-test-framework.md](snippets/ai-test-framework.md) | Python 기반 AI API 테스트 프레임워크 구축 |
| [log-shortcuts.md](snippets/log-shortcuts.md) | `[로그분석]`, `[로그추적]` 단축 키워드 사용법 |

### DB 연결

| 문서 | 내용 |
|------|------|
| [db-connection.md](snippets/db-connection.md) | Python/Node.js DB 연결 (MSSQL, Oracle, PostgreSQL, MySQL) |
| [db-query.md](snippets/db-query.md) | SQL Injection 방지, N+1 문제, 인덱스 활용 |

### 개발 프로세스

| 문서 | 내용 |
|------|------|
| [git-commit.md](snippets/git-commit.md) | Conventional Commits, 커밋 전 체크리스트 |
| [code-review.md](snippets/code-review.md) | 리뷰 체크리스트, 코멘트 작성법 |
| [testing.md](snippets/testing.md) | 테스트 네이밍, AAA/GWT 패턴, Mock 원칙 |

## 핵심 규칙 요약

### AI 거짓말 방지

```markdown
1. "실행했다" 주장 시 → 로그 파일 경로 필수
2. 권한 없는 작업 → 즉시 보고 (수정했다고 거짓말 금지)
3. 추측 vs 확인된 사실 → 명확히 구분
4. 완료 전 완료 주장 → 금지 (TodoWrite로 추적)
```

### AI CLI 상호 호출

```markdown
- Claude에서 Gemini 호출 → GEMINI_API_KEY 환경 변수 필요
- Gemini에서 Claude 호출 → 불가능 (run_shell_command 없음)
- 해결: 별도 터미널 또는 API 키 환경 변수
```

## 기여

프로젝트별 유용한 규칙이 있으면 PR 환영합니다.

---

**마지막 업데이트**: 2026-01-11
