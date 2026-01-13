# AI CLI 도구 설치 및 실행 가이드

Claude Code, Gemini CLI 등 AI CLI 도구 설치, 인증, 상호 호출 방법

---

## 핵심 주의사항

> **중요**: AI CLI 도구들은 서로의 인증 세션을 공유하지 않습니다.
> - Claude Code 안에서 `gemini` 명령 실행 → Gemini 계정 로그인 필요
> - Gemini CLI 안에서 `claude` 명령 실행 → Claude 계정 로그인 필요
> - 각 도구는 독립적인 인증 세션을 가집니다

> **Gemini CLI의 한계**: Gemini CLI는 `run_shell_command` 도구가 없어서 터미널 명령을 직접 실행할 수 없습니다.
> - `claude "질문"` 명령을 Gemini가 직접 실행하는 것은 **불가능**
> - 별도 터미널에서 수동 실행하거나, PowerShell 스크립트를 미리 만들어 놓아야 함

---

## Claude Code 설치 및 설정

### 1. 설치

```bash
# npm으로 설치
npm install -g @anthropic-ai/claude-code

# 또는 직접 다운로드
# https://claude.ai/code 에서 설치 파일 다운로드
```

### 2. 인증 (로그인)

```bash
# 로그인 (브라우저 인증)
claude login

# 또는 API 키로 인증
claude auth --api-key YOUR_API_KEY

# 로그인 상태 확인
claude whoami
```

### 3. 실행

```bash
# 대화형 모드
claude

# 단일 명령
claude "이 파일 분석해줘"

# 특정 디렉토리에서 실행
claude --cwd /path/to/project

# 모델 지정
claude --model opus
```

### 4. 설정 파일 위치

```
Windows: C:\Users\<user>\.claude\
Linux/Mac: ~/.claude/

주요 파일:
- settings.json     # 사용자 설정
- credentials.json  # 인증 정보 (비밀)
- projects/         # 프로젝트별 설정
```

---

## Gemini CLI 설치 및 설정

### 1. 설치

```bash
# npm으로 설치
npm install -g @anthropic-ai/gemini-cli

# 또는 pip (Python)
pip install gemini-cli

# 또는 Google Cloud SDK 포함
gcloud components install gemini
```

### 2. 인증 (로그인)

```bash
# Google 계정 로그인 (브라우저)
gemini auth login

# 또는 API 키 사용
export GEMINI_API_KEY="your-api-key"

# 로그인 상태 확인
gemini auth status
```

### 3. 실행

```bash
# 대화형 모드
gemini

# 단일 명령
gemini "이 코드 리뷰해줘"

# 파일 분석
gemini --file src/main.java "이 파일 분석해줘"
```

### 4. 설정 파일 위치

```
Windows: C:\Users\<user>\.gemini\
Linux/Mac: ~/.gemini/ 또는 ~/.config/gemini/

주요 파일:
- config.json       # 설정
- credentials.json  # 인증 정보
```

---

## 상호 호출 시 문제점

### 문제: Claude에서 Gemini 호출 시 인증 오류

```bash
# Claude Code 세션 내에서 실행
$ gemini "코드 리뷰해줘"
Error: Not authenticated. Please run 'gemini auth login'
```

**원인**: Claude Code의 인증 세션은 Gemini CLI와 공유되지 않음

**해결책**:
1. 별도 터미널에서 `gemini auth login` 실행
2. 또는 환경 변수로 API 키 설정

```bash
# 환경 변수 방식 (권장)
export GEMINI_API_KEY="your-api-key"
gemini "코드 리뷰해줘"
```

### 문제: Gemini에서 Claude 호출 시 권한 부족

```bash
# Gemini CLI 내에서 시도
> run_shell_command: claude "파일 수정해줘"
Error: Tool 'run_shell_command' is not registered
```

**원인**: Gemini CLI는 `run_shell_command` 도구가 없음

**해결책**: Gemini는 분석만, 실행은 Claude에게 수동 위임

---

## 올바른 상호 호출 패턴

### 패턴 1: 환경 변수로 API 키 공유

```bash
# .bashrc 또는 .zshrc에 추가
export ANTHROPIC_API_KEY="claude-api-key"
export GEMINI_API_KEY="gemini-api-key"

# Claude Code에서 Gemini 호출 가능
gemini "리뷰해줘"  # API 키로 인증됨
```

### 패턴 2: 별도 터미널 세션

```
터미널 1: Claude Code 실행 (로그인 상태)
터미널 2: Gemini CLI 실행 (로그인 상태)

작업 흐름:
1. Claude가 코드 작성 (터미널 1)
2. 수동으로 Gemini에 리뷰 요청 (터미널 2)
3. Gemini 피드백 확인
4. Claude가 수정 (터미널 1)
```

### 패턴 3: 스크립트를 통한 호출 (자동화)

```bash
#!/bin/bash
# cross_ai_review.sh

# API 키 설정 (환경 변수 또는 파일에서 로드)
source ~/.ai_credentials

# Gemini에 리뷰 요청
echo "=== Gemini 리뷰 요청 ===" | tee logs/review.log
GEMINI_API_KEY=$GEMINI_KEY gemini "$1" 2>&1 | tee -a logs/review.log
```

---

## Windows 환경 설정

### PowerShell 환경 변수

```powershell
# 현재 세션만
$env:ANTHROPIC_API_KEY = "your-claude-key"
$env:GEMINI_API_KEY = "your-gemini-key"

# 영구 설정
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "your-key", "User")
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-key", "User")
```

### CMD 환경 변수

```cmd
:: 현재 세션만
set ANTHROPIC_API_KEY=your-claude-key
set GEMINI_API_KEY=your-gemini-key

:: 영구 설정 (관리자 권한)
setx ANTHROPIC_API_KEY "your-key"
setx GEMINI_API_KEY "your-key"
```

---

## 인증 방법 비교

| 도구 | 브라우저 인증 | API 키 | 환경 변수 |
|------|-------------|--------|----------|
| Claude Code | `claude login` | `--api-key` | `ANTHROPIC_API_KEY` |
| Gemini CLI | `gemini auth login` | 설정 파일 | `GEMINI_API_KEY` |
| Cursor | IDE 내 로그인 | 설정 | - |
| GitHub Copilot | GitHub 계정 | - | - |

---

## 트러블슈팅

### Claude Code 인증 문제

```bash
# 로그인 상태 초기화
claude logout
claude login

# 캐시 삭제
rm -rf ~/.claude/cache/
```

### Gemini CLI 인증 문제

```bash
# 재인증
gemini auth logout
gemini auth login

# 토큰 갱신
gemini auth refresh
```

### API 키 확인

```bash
# Claude
echo $ANTHROPIC_API_KEY

# Gemini
echo $GEMINI_API_KEY

# Windows PowerShell
echo $env:ANTHROPIC_API_KEY
echo $env:GEMINI_API_KEY
```

---

## 보안 주의사항

1. **API 키를 코드에 하드코딩하지 마세요**
2. **환경 변수 또는 비밀 관리 도구 사용**
3. **.gitignore에 인증 파일 추가**

```gitignore
# AI 도구 인증 파일
.claude/credentials.json
.gemini/credentials.json
*.api_key
.env
```

---

## 요약

| 시나리오 | 해결책 |
|---------|--------|
| Claude에서 Gemini 호출 | 환경 변수 `GEMINI_API_KEY` 설정 |
| Gemini에서 Claude 호출 | **불가** - 수동 위임 또는 별도 터미널 |
| 여러 AI 동시 사용 | 각각 별도 터미널에서 로그인 |
| 자동화 스크립트 | API 키 환경 변수 사용 |

---

## Gemini CLI에서 Claude CLI 호출하기 (상세 가이드)

Gemini CLI는 `run_shell_command` 도구가 없어서 직접 터미널 명령을 실행할 수 없습니다.
따라서 **미리 준비된 스크립트를 사용자가 수동으로 실행**하는 방식을 사용해야 합니다.

### 방법 1: PowerShell 스크립트 미리 준비 (권장)

**1. 스크립트 생성 (run_claude.ps1)**

```powershell
# run_claude.ps1 - Gemini가 Claude에 질문할 때 사용
param(
    [Parameter(Mandatory=$true)]
    [string]$Question,

    [string]$LogDir = "logs/claude"
)

# 로그 디렉토리 생성
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 타임스탬프 로그 파일명
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$logFile = "$LogDir/${timestamp}_claude_response.log"

# 헤더 기록
@"
=== Claude CLI 실행 ===
실행 시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
질문: $Question
=== 응답 ===
"@ | Out-File -FilePath $logFile -Encoding UTF8

# Claude 실행 및 로그 저장
try {
    $response = claude $Question 2>&1
    $response | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host "Claude 응답:"
    Write-Host $response
} catch {
    "Error: $_" | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host "Error: $_"
}

# 종료 시각 기록
"=== 종료 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $logFile -Append -Encoding UTF8

Write-Host ""
Write-Host "로그 저장됨: $logFile"
```

**2. 사용 방법**

```powershell
# Gemini가 "Claude에게 물어봐"라고 할 때 사용자가 직접 실행
.\run_claude.ps1 -Question "DynamicPromptService.java 파일의 JSON 강제 로직 검토해줘"

# 짧은 질문
.\run_claude.ps1 "이 코드 리뷰해줘"
```

**3. Gemini에게 위임 방법 알려주기 (GEMINI.md에 추가)**

```markdown
## Claude CLI 호출 방법

Claude CLI를 직접 실행할 수 없습니다.
사용자에게 다음 명령어를 실행하라고 요청하세요:

```powershell
.\run_claude.ps1 -Question "[질문 내용]"
```

실행 후 `logs/claude/` 폴더의 최신 로그 파일을 읽어서 결과를 확인하세요.
```

---

### 방법 2: Batch 파일 사용 (더 간단)

**run_claude.bat**

```batch
@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

set QUESTION=%*
set LOGDIR=logs\claude
set TIMESTAMP=%date:~0,4%-%date:~5,2%-%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOGFILE=%LOGDIR%\%TIMESTAMP%_claude.log

if not exist %LOGDIR% mkdir %LOGDIR%

echo === Claude CLI 실행 === > %LOGFILE%
echo 실행 시각: %date% %time% >> %LOGFILE%
echo 질문: %QUESTION% >> %LOGFILE%
echo === 응답 === >> %LOGFILE%

claude %QUESTION% >> %LOGFILE% 2>&1

echo === 종료 시각: %date% %time% === >> %LOGFILE%

echo 로그 저장됨: %LOGFILE%
type %LOGFILE%
```

**사용법**

```cmd
run_claude.bat 이 코드 분석해줘
```

---

### 방법 3: Gemini가 요청만 작성, 사용자가 복사/실행

Gemini가 Claude에게 물어볼 내용을 작성하면, 사용자가 직접 터미널에서 실행:

```
[Gemini 출력]
Claude에게 다음 질문을 해주세요:

claude "src/main/java/.../DynamicPromptService.java 파일의 getStage1PromptForPipeline 메서드를 검토해줘. JSON 형식 강제가 제대로 되는지 확인하고, 개선안 제시해줘."

실행 후 결과를 알려주시면 분석하겠습니다.
```

---

### 흔한 에러와 해결

| 에러 메시지 | 원인 | 해결책 |
| --- | --- | --- |
| `Path ... was not found` | Claude가 참조하는 경로가 없음 | 해당 디렉토리 생성 또는 무시 |
| `Credit balance is too low` | API 사용량 한도 초과 | 계정 확인, Pro 플랜 필요할 수 있음 |
| `Not authenticated` | 로그인 안됨 | `claude login` 실행 |
| `Command not found: claude` | CLI 미설치 | `npm install -g @anthropic-ai/claude-code` |

---

## 로그 분석 도구 설치

### Windows에서 rg (ripgrep) 설치

```powershell
# winget으로 설치 (권장)
winget install BurntSushi.ripgrep.MSVC

# 또는 Chocolatey
choco install ripgrep

# 또는 Scoop
scoop install ripgrep
```

**설치 확인**

```powershell
rg --version
# ripgrep 14.x.x
```

---

### Windows에서 jq 설치

```powershell
# winget으로 설치
winget install jqlang.jq

# 또는 Chocolatey
choco install jq

# 또는 Scoop
scoop install jq
```

**설치 확인**

```powershell
jq --version
# jq-1.7.x
```

---

### BareTail / BareTailPro 설치 (실시간 로그 뷰어)

**다운로드**
- BareTail (무료): https://www.baremetalsoft.com/baretail/
- BareTailPro (유료): https://www.baremetalsoft.com/baretailpro/

**설치 후 사용**

```powershell
# 실행 (경로에 맞게 수정)
& "C:\Program Files\BareTailPro\baretailpro.exe" "C:\logs\app.log"

# 여러 파일 동시 모니터링
& "C:\jexer\baretailpro.exe" "logs\app.log" "logs\error.log" "logs\ai-json.log"
```

---

### Linux/Mac 도구 설치

```bash
# ripgrep
brew install ripgrep      # Mac
apt install ripgrep       # Ubuntu/Debian
dnf install ripgrep       # Fedora

# jq
brew install jq           # Mac
apt install jq            # Ubuntu/Debian

# multitail (실시간 로그 뷰어)
brew install multitail    # Mac
apt install multitail     # Ubuntu/Debian
```

---

### 도구 경로 확인 (Windows)

WinGet으로 설치한 도구는 다음 경로에 심볼릭 링크 생성:

```
C:\Users\<user>\AppData\Local\Microsoft\WinGet\Links\
```

이 경로가 PATH에 있는지 확인:

```powershell
$env:PATH -split ";" | Where-Object { $_ -like "*WinGet*" }
```

없으면 추가:

```powershell
# 현재 세션
$env:PATH += ";C:\Users\$env:USERNAME\AppData\Local\Microsoft\WinGet\Links"

# 영구 설정
[Environment]::SetEnvironmentVariable(
    "PATH",
    $env:PATH + ";C:\Users\$env:USERNAME\AppData\Local\Microsoft\WinGet\Links",
    "User"
)
```

---

**핵심**: 각 AI CLI는 독립적인 인증 세션을 가집니다. 상호 호출하려면 API 키 환경 변수를 설정하거나 별도 터미널을 사용하세요. Gemini에서 Claude를 호출하려면 미리 준비된 스크립트를 사용자가 수동으로 실행해야 합니다.
