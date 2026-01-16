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

## 신규 프로젝트 분석 (레거시 코드)

처음 보는 프로젝트를 분석하고 문서를 자동 생성하고 싶을 때 사용합니다.

### 1단계: 분석 스크립트 실행

```bash
# 단일 프로젝트 분석
analyze_project.sh /path/to/project

# 다중 프로젝트 분석 (의존성 관계 파악 포함)
analyze_project.sh /path/to/project1 /path/to/project2 full

# DB 스키마 분석 포함
analyze_project.sh /path/to/project full --with-db
```

### 2단계: AI에게 문서 생성 요청

스크립트 실행이 완료되면 `docs/.analysis-context.md` 파일이 생성됩니다.
이후 화면에 출력되는 안내에 따라 Claude나 Gemini에게 다음 프롬프트를 입력하세요:

```
docs/.analysis-context.md 파일을 읽고, 프로젝트를 분석하여 다음 문서들을 생성해줘:
- docs/README.md (프로젝트 개요)
- docs/architecture.md (아키텍처)
- docs/features/index.md (기능 목록)
```

자세한 내용은 [문서 생성 가이드](docs/project-analyzer-design.md)를 참조하세요.

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

### 크로스체크 자동화 (반자동 프롬프트 가이드)

설계/구현/테스트 단계별로 AI 간의 상호 검증을 수행합니다. (Human-in-the-loop 방식)

```bash
# 설계 크로스체크
./scripts/cross_check.sh design docs/design_request.md

# 전체 파이프라인 (설계->구현->테스트)
./scripts/cross_check.sh full docs/request.md
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
│   ├── analyze_project.sh       # 프로젝트 구조 분석 및 문서화 준비
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

PowerShell은 한글 인코딩 문제가 있습니다. **Git Bash를 사용하는 것을 강력히 권장합니다**:

```bash
# Git Bash 실행 후
cd ~/.ai-rules/scripts
./run_claude.sh "질문"
```

### PowerShell 사용 시 (인코딩 문제 해결)

PowerShell을 사용해야 한다면 다음 방법으로 UTF-8 인코딩을 설정하세요:

#### 방법 1: PowerShell 7+ 사용 (권장)

PowerShell 7 이상은 UTF-8을 기본으로 지원합니다.

```powershell
# PowerShell 7+ 설치 (winget)
winget install Microsoft.PowerShell

# 또는 다운로드: https://github.com/PowerShell/PowerShell/releases
```

#### 방법 2: 세션별 인코딩 설정

매번 PowerShell을 시작할 때 실행:

```powershell
# UTF-8 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# chcp로 코드 페이지 변경
chcp 65001
```

#### 방법 3: 프로필에 영구 설정

PowerShell 프로필에 인코딩 설정을 추가:

```powershell
# 프로필 파일 열기
notepad $PROFILE

# 다음 내용 추가:
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null
```

프로필 파일이 없다면 먼저 생성:

```powershell
New-Item -Path $PROFILE -Type File -Force
```

#### 인코딩 확인

```powershell
# 현재 코드 페이지 확인 (65001이면 UTF-8)
chcp

# 출력 인코딩 확인
[Console]::OutputEncoding
```

#### 주의사항

- Windows Terminal을 사용하면 UTF-8 지원이 더 좋습니다
- 기존 CMD보다 PowerShell 7+ 또는 Git Bash를 권장합니다
- 로그 파일이 여전히 깨진다면 Git Bash로 전환하세요

자세한 내용은 [snippets/powershell-encoding.md](snippets/powershell-encoding.md) 참고.

---

## FAQ (자주 묻는 질문)

### Claude Code가 멈춘 것 같아요 (Stuck)

**증상:**
- 응답이 10초 이상 멈춤
- 프롬프트를 입력해도 반응 없음
- 터미널이 아무 출력도 하지 않음

**원인:**
- 내부 버퍼 오버플로우 (긴 컨텍스트)
- 무한 루프 상태
- 네트워크 타임아웃

**해결방법:**

1. **Ctrl+C로 중단** 후 세션 재시작
2. **컨텍스트 정리**:
   ```bash
   /clear  # 대화 이력 초기화
   ```
3. **파일 읽기 최소화**: 한 번에 너무 많은 파일을 읽지 마세요
4. **작은 단위로 작업**: 큰 작업을 여러 단계로 나누기

### Claude가 멈추는데 Gemini는 괜찮나요?

**비교:**

| 항목 | Claude Code | Gemini CLI |
|------|-------------|-----------|
| **Stuck 빈도** | 가끔 발생 (긴 컨텍스트) | 거의 없음 |
| **장점** | 정확한 코드 생성, 파일 수정 도구 | 빠른 응답, 안정적 |
| **단점** | 긴 작업 시 멈춤 가능 | 파일 수정 시 수동 작업 필요 |
| **권장 용도** | 실제 코드 작성/수정 | 설계 검토, 분석, 리뷰 |

**권장 워크플로우:**
1. **Gemini**: 설계 및 아키텍처 검토
2. **Claude**: 실제 코드 구현
3. **교차 리뷰**: `cross_review.sh`로 상호 검증

### 어떤 AI를 메인으로 써야 하나요?

**ai_mode 선택 가이드** (CLAUDE.md 참고):

#### Claude 주객체 모드 (기본)
```yaml
ai_mode: claude_primary
```
- 코드 작성/수정이 많은 경우
- Git 커밋이 자주 필요한 경우
- 빠른 개발 속도가 중요한 경우

#### Gemini 주객체 모드
```yaml
ai_mode: gemini_primary
```
- 설계 및 분석 위주 작업
- 여러 프로젝트 비교 분석
- 문서화 및 리뷰 중심

#### 단독 사용 모드
```yaml
ai_mode: single
```
- 하나의 AI만 사용
- 교차 검증 불필요
- 간단한 프로젝트

### 로그가 너무 많이 쌓여요

**로그 자동 정리:**

스크립트가 자동으로 30일 이상 된 로그를 삭제합니다:
- `run_gemini.sh`: 30일 자동 정리
- `cross_review.sh`: 30일 자동 정리

**수동 정리:**
```bash
# 7일 이상 된 로그 삭제
find logs/ -name "*.log" -mtime +7 -delete

# 특정 작업 로그만 삭제
rm -rf logs/claude/*_test_*.log
```

### AI가 "실행했다"고 거짓말해요

**거짓말 방지 규칙** (CLAUDE.md 참고):

1. ✅ **로그 파일 경로 요구**
   ```
   AI: "테스트를 실행했습니다"
   You: "로그 파일 경로 알려줘"
   ```

2. ✅ **실제 출력 확인**
   ```bash
   cat logs/claude/2026-01-14_*.log
   ```

3. ✅ **명시적 지시**
   ```
   "테스트 실행하고 결과 로그를 남겨줘"
   ```

### Git Bash vs PowerShell 중 뭘 써야 하나요?

**권장 순서:**

1. **Git Bash** (가장 권장)
   - 인코딩 문제 없음
   - Bash 스크립트 완벽 지원
   - Windows/Mac/Linux 동일 경험

2. **PowerShell 7+**
   - UTF-8 기본 지원
   - 최신 Windows Terminal과 함께 사용

3. **PowerShell 5.x** (구버전)
   - 인코딩 수동 설정 필요
   - chcp 65001 필수

4. **CMD** (비추천)
   - Bash 스크립트 실행 불가
   - 인코딩 문제 심함

### 프로젝트별로 규칙을 다르게 하고 싶어요

**방법 1: 프로젝트별 CLAUDE.md 생성**

```bash
cd ~/my-project1
cp ~/.ai-rules/templates/java-spring.md ./CLAUDE.md
# [프로젝트 설정] 섹션 수정

cd ~/my-project2
cp ~/.ai-rules/templates/nodejs.md ./CLAUDE.md
# [프로젝트 설정] 섹션 수정
```

**방법 2: 템플릿 커스터마이징**

```bash
# 팀 공통 규칙
cp ~/.ai-rules/CLAUDE.md ~/team-rules/CLAUDE-team.md
# 수정 후 모든 프로젝트에 배포
```

### 여러 프로젝트를 동시에 분석하고 싶어요

**다중 프로젝트 분석:**

```bash
# Base + Customer 프로젝트 동시 분석
analyze_project.sh \
  /path/to/base-solution \
  /path/to/customer-a-custom \
  /path/to/customer-b-custom \
  full

# 관계도 자동 생성
# → docs/.analysis-context.md
```

**활용 예시:**
- 공통 라이브러리 + 여러 마이크로서비스
- Base 솔루션 + 고객사별 커스터마이징
- 프론트엔드 + 백엔드 프로젝트

### DB 스키마 분석은 어떻게 하나요?

```bash
# 1. DB 정보 없이 실행 (템플릿 생성)
analyze_project.sh /path/to/project scan --with-db

# 2. 생성된 템플릿 수정
# → .ai-analyzer-template.json 편집

# 3. .ai-analyzer.json으로 저장 후 재실행
mv .ai-analyzer-template.json .ai-analyzer.json
analyze_project.sh /path/to/project scan --db-config .ai-analyzer.json
```

**출력:**
- `docs/db_schema.json`: 테이블 구조, FK, 인덱스
- `docs/db_schema.md`: 읽기 쉬운 마크다운

---

## 기여

프로젝트별 유용한 규칙이 있으면 PR 환영합니다.

---

**마지막 업데이트**: 2026-01-14