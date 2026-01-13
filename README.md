# AI Coding Rules

AI 코딩 어시스턴트(Claude Code, Gemini CLI, Cursor 등)를 위한 프로젝트 규칙 및 스크립트 모음

---

## 이 저장소가 뭔가요?

AI 코딩 도구를 사용할 때 프로젝트별로 일관된 규칙을 적용하기 위한 템플릿과 유틸리티입니다.

**포함된 것:**
- `CLAUDE.md`, `GEMINI.md` - AI에게 전달할 코딩 규칙
- `scripts/` - AI CLI 실행 + 자동 로그 저장 스크립트
- `templates/` - 언어별 규칙 템플릿 (Java, Python, Node.js)
- `snippets/` - DB 연결, 테스트, 로그 분석 등 참고 문서

---

## 빠른 시작

### 1단계: 클론

```bash
git clone https://github.com/4fkdgoa/ai-coding-rules.git ~/.ai-rules
```

### 2단계: 프로젝트에 규칙 파일 복사

```bash
# 새 프로젝트 폴더에서
cd ~/my-project

# 기본 규칙 복사
cp ~/.ai-rules/CLAUDE.md ./

# Gemini도 사용한다면 함께 복사
cp ~/.ai-rules/GEMINI.md ./

# 또는 언어별 템플릿 사용
cp ~/.ai-rules/templates/java-spring.md ./CLAUDE.md   # Java
cp ~/.ai-rules/templates/python.md ./CLAUDE.md        # Python
cp ~/.ai-rules/templates/nodejs.md ./CLAUDE.md        # Node.js
```

### 3단계: 프로젝트 정보 수정

복사한 `CLAUDE.md` 파일 하단의 `[프로젝트 설정]` 섹션을 프로젝트에 맞게 수정하세요.

> **AI 모드 선택**: `CLAUDE.md` 상단의 `ai_mode` 설정으로 Claude 주객체/Gemini 주객체 모드를 선택할 수 있습니다.

---

## AI CLI 스크립트 사용법

AI CLI 실행 시 자동으로 로그를 남기는 스크립트입니다.

### 전제 조건

- **Claude Code CLI 설치**: `npm install -g @anthropic-ai/claude-code`
- **Gemini CLI 설치**: `npm install -g @anthropic-ai/gemini-cli` (또는 `pip install gemini-cli`)
- Git Bash (Windows) 또는 Linux/Mac 터미널

> **Note**: Gemini CLI 설치법은 사용하는 도구에 따라 다를 수 있습니다. Google Cloud 기반이면 `gcloud components install gemini` 등을 사용하세요.

### 스크립트를 어디서든 실행하기 (한 번만 설정)

스크립트를 매번 복사하지 말고, PATH에 추가하세요:

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
echo 'export PATH="$HOME/.ai-rules/scripts:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Windows Git Bash의 경우:

```bash
echo 'export PATH="$HOME/.ai-rules/scripts:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

이제 **어느 폴더에서든** 스크립트를 실행할 수 있습니다.

### 기본 사용법

```bash
# Claude에게 질문 (어느 폴더에서든 실행 가능)
run_claude.sh "고객 검색 API 만들어줘"

# Gemini에게 질문
run_gemini.sh "이 코드 리뷰해줘"

# 통합 스크립트 (claude 또는 gemini 선택)
run_ai.sh claude "버그 수정해줘"
run_ai.sh gemini "아키텍처 분석해줘"
```

### 작업명 지정 (로그 파일명에 포함)

```bash
run_claude.sh "고객 API 구현" customer_api
# → logs/claude/2026-01-11_143052_customer_api.log

run_gemini.sh "코드 리뷰" code_review
# → logs/gemini/2026-01-11_143052_code_review.log
```

### 교차 리뷰 (한 AI가 다른 AI에게 리뷰 요청)

```bash
# Claude가 Gemini에게 리뷰 요청
cross_review.sh claude gemini "이 로직 검토해줘" src/Service.java

# Gemini가 Claude에게 구현 검토 요청
cross_review.sh gemini claude "보안 취약점 확인해줘" src/AuthController.java
```

### 동시 리뷰 (Claude + Gemini 둘 다 리뷰)

```bash
# 기본 리뷰
dual_review.sh src/PaymentService.java

# 특정 포커스 (security, performance, logic, style)
dual_review.sh src/UserService.java security
```

---

## 로그 파일 위치

스크립트 실행 시 **현재 작업 중인 프로젝트 폴더**에 로그가 저장됩니다:

```text
my-project/                # 현재 작업 폴더 (pwd)
├── logs/
│   ├── claude/            # Claude CLI 실행 로그
│   │   └── 2026-01-11_143052_customer_api.log
│   ├── gemini/            # Gemini CLI 실행 로그
│   │   └── 2026-01-11_143052_code_review.log
│   ├── cross_review/      # 교차 리뷰 로그
│   └── dual_review/       # 동시 리뷰 로그
├── src/
└── ...
```

> 프로젝트별로 로그가 분리되므로, `.gitignore`에 `logs/` 추가를 권장합니다.

### 로그 파일 내용 예시

```
=== CLAUDE CLI 실행 ===
실행 시각: 2026-01-11 14:30:52
작업명: customer_api
실행 명령어: claude "고객 검색 API 만들어줘"
질문:
고객 검색 API 만들어줘
=== 응답 ===
[Claude의 응답 내용]
=== 종료 시각: 2026-01-11 14:31:15 ===
```

---

## 파일 구조

```
ai-coding-rules/
├── CLAUDE.md                    # Claude Code용 메인 규칙
├── GEMINI.md                    # Gemini CLI용 규칙
├── README.md                    # 이 파일
│
├── scripts/                     # AI CLI 실행 스크립트
│   ├── run_claude.sh            # Claude 실행 + 로그 (Bash)
│   ├── run_gemini.sh            # Gemini 실행 + 로그 (Bash)
│   ├── run_ai.sh                # 통합 실행 스크립트 (Bash)
│   ├── cross_review.sh          # 교차 리뷰 (Bash)
│   ├── dual_review.sh           # 동시 리뷰 (Bash)
│   ├── run_claude.ps1           # (PowerShell - 인코딩 이슈 있음)
│   ├── run_gemini.ps1           # (PowerShell - 인코딩 이슈 있음)
│   └── run_ai.ps1               # (PowerShell - 인코딩 이슈 있음)
│
├── templates/                   # 언어별 규칙 템플릿
│   ├── java-spring.md           # Java/Spring Boot
│   ├── python.md                # Python/FastAPI/Django
│   └── nodejs.md                # Node.js/Express/NestJS
│
├── snippets/                    # 참고 문서
│   ├── ai-cli-setup.md          # AI CLI 설치 및 인증
│   ├── ai-integration-reality.md # AI 거짓말 방지 규칙
│   ├── db-connection.md         # DB 연결 (MSSQL/Oracle/PostgreSQL/MySQL)
│   ├── project-templates.md     # .vscode, .gemini, gradle 등 설정
│   ├── powershell-encoding.md   # Windows 인코딩 문제 해결
│   └── ...
│
└── skills/                      # 커스텀 스킬/도구 (프롬프트 템플릿)
    ├── skill-examples.md        # /commit, /review 등 명령어 예시
    └── custom-tools.md          # 로그 분석, API 테스트 도구
```

> **Note**: `logs/` 폴더는 스크립트 실행 시 **각 프로젝트 폴더**에 자동 생성됩니다.

---

## 왜 로그를 남기나요?

**AI 세션은 서로 독립적입니다.**

- Claude A 세션에서 Gemini를 호출해도, 그 Gemini는 Claude A와 대화 이력을 공유하지 않음
- Gemini가 Claude를 호출해도 마찬가지
- **로그 파일만이 AI 간 작업 내역의 유일한 증거**

```
┌─────────────────┐        ┌─────────────────┐
│  Claude 세션 A  │   ≠    │  Claude 세션 B  │
│  (대화 이력 O)  │        │  (새 세션, 이력 X)
└─────────────────┘        └─────────────────┘
```

따라서 크로스체크나 작업 추적을 위해 **로그를 남기는 것이 필수**입니다.

---

## 핵심 규칙 요약

### AI 거짓말 방지

```
1. "실행했다" 주장 시 → 로그 파일 경로 필수
2. 권한 없는 작업 → 즉시 보고 (거짓말 금지)
3. 추측 vs 확인된 사실 → 명확히 구분
4. 테스트 안 하고 "완료" 주장 → 금지
```

### 코딩 표준

- 들여쓰기: 공백 4칸
- 줄 길이: 120자 권장
- 파일 크기: 1500줄 이하
- 메서드 네이밍: `list*()`, `get*()`, `save*()`, `delete*()`, `disable*()`

---

## Windows 사용자 참고

### Git Bash 사용 (권장)

PowerShell은 한글 인코딩 문제가 있습니다. Git Bash를 사용하세요:

```bash
# Git Bash 실행 후
cd ~/.ai-rules/scripts
./run_claude.sh "질문"
```

### PowerShell 사용 시

인코딩 문제로 로그 파일에서 한글이 깨질 수 있습니다.
자세한 내용은 [snippets/powershell-encoding.md](snippets/powershell-encoding.md) 참고.

---

## 기여

프로젝트별 유용한 규칙이 있으면 PR 환영합니다.

---

**마지막 업데이트**: 2026-01-11
