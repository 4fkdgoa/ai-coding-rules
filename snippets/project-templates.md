# 프로젝트 공통 설정 템플릿

다른 프로젝트에서 재사용 가능한 설정 파일 템플릿

---

## 1. .gemini/ (Gemini CLI 설정)

Gemini CLI가 읽는 프로젝트별 규칙 파일

```
.gemini/
├── coding-style.md      # 코딩 스타일 가이드
├── deployment-guide.md  # 배포 가이드
└── git-workflow.md      # Git 워크플로우
```

### coding-style.md 예시

```markdown
# Coding Style Guide

## 1. Java Code Style
- **Java Version**: Java 21+ (Java 8 호환성 고려)
- **Indentation**: 4 spaces (Tab 사용 금지)
- **Encoding**: UTF-8

### Naming Conventions
- **Classes/Interfaces**: `PascalCase`
- **Methods/Fields**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Method Naming Patterns
- `list*()`: 다건 조회
- `get*()`: 단건 조회
- `save*()`: 생성 또는 수정
- `delete*()`: 하드 삭제
- `disable*()`: 소프트 삭제

## 2. Comment Guidelines
- DO: 복잡한 로직, 실행 순서 설명
- DON'T: 뻔한 코드 설명, AI 생성 표시
- Emojis: 코드/주석에 사용 금지

## 3. Error Handling
- No Silent Failures: 빈 catch 금지
- No Arbitrary Defaults: 필수 파라미터 임의값 금지
```

---

## 2. .github/workflows/ (GitHub Actions)

Gemini 자동 리뷰 워크플로우

```
.github/workflows/
├── gemini-review.yml         # PR 코드 리뷰
├── gemini-triage.yml         # 이슈 분류
├── gemini-invoke.yml         # 수동 호출
├── gemini-dispatch.yml       # 이벤트 디스패치
└── gemini-scheduled-triage.yml  # 스케줄 작업
```

### gemini-review.yml 핵심 설정

```yaml
name: 'Gemini Review'
on:
  workflow_call:
    inputs:
      additional_context:
        type: 'string'
        required: false

jobs:
  review:
    runs-on: 'ubuntu-latest'
    timeout-minutes: 7
    permissions:
      contents: 'read'
      issues: 'write'
      pull-requests: 'write'
    steps:
      - uses: 'actions/checkout@v5'
      - uses: 'google-github-actions/run-gemini-cli@v0'
        with:
          gemini_api_key: '${{ secrets.GEMINI_API_KEY }}'
          # ... 설정
```

### 필요한 Secrets/Variables

| 이름 | 유형 | 설명 |
|------|------|------|
| `GEMINI_API_KEY` | Secret | Gemini API 키 |
| `APP_ID` | Variable | GitHub App ID (선택) |
| `APP_PRIVATE_KEY` | Secret | GitHub App 키 (선택) |
| `GOOGLE_CLOUD_PROJECT` | Variable | GCP 프로젝트 (Vertex AI 사용 시) |

---

## 3. .vscode/ (VS Code 설정)

### settings.json (Java 프로젝트용)

```json
{
    "java.configuration.runtimes": [
        {
            "name": "JavaSE-21",
            "path": "C:\\Program Files\\Zulu\\zulu-21",
            "default": true
        }
    ],
    "java.import.gradle.enabled": true,
    "java.import.gradle.wrapper.enabled": true,
    "java.gradle.buildServer.enabled": "on",
    "java.configuration.updateBuildConfiguration": "automatic",
    "spring-boot.ls.java.home": "C:\\Program Files\\Zulu\\zulu-21",
    "spring.dashboard.openWith": "integrated"
}
```

### settings.json (Python 프로젝트용)

```json
{
    "python.defaultInterpreterPath": "${workspaceFolder}/.venv/Scripts/python.exe",
    "python.formatting.provider": "black",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "files.encoding": "utf8"
}
```

### launch.json (Spring Boot 디버깅)

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "java",
            "name": "Spring Boot Debug",
            "request": "launch",
            "mainClass": "net.autocrm.ai.Application",
            "projectName": "aibot"
        }
    ]
}
```

### tasks.json (빌드 태스크)

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "bootRun",
            "type": "shell",
            "command": "./gradlew bootRun",
            "problemMatcher": []
        },
        {
            "label": "build",
            "type": "shell",
            "command": "./gradlew clean build -x test",
            "problemMatcher": []
        }
    ]
}
```

---

## 4. gradle/wrapper/ (Gradle Wrapper)

### gradle-wrapper.properties

```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

### 관련 파일 (프로젝트 루트에 필요)

```
project/
├── gradlew          # Unix 실행 스크립트
├── gradlew.bat      # Windows 실행 스크립트
└── gradle/
    └── wrapper/
        ├── gradle-wrapper.jar
        └── gradle-wrapper.properties
```

**Gradle Wrapper 생성 명령어**:
```bash
gradle wrapper --gradle-version 8.14.3
```

---

## 5. .venv/ (Python 가상환경)

### 생성 방법

```bash
# 가상환경 생성
python -m venv .venv

# 활성화 (Windows)
.venv\Scripts\activate

# 활성화 (Linux/Mac)
source .venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 의존성 저장
pip freeze > requirements.txt
```

### .gitignore에 추가

```gitignore
.venv/
__pycache__/
*.pyc
```

---

## 6. node_modules/ (Node.js)

### 생성 방법

```bash
# package.json 생성
npm init -y

# 의존성 설치
npm install

# 개발 의존성 설치
npm install --save-dev eslint prettier
```

### .gitignore에 추가

```gitignore
node_modules/
package-lock.json  # 또는 포함 (팀 정책에 따라)
```

---

## 7. 전체 프로젝트 구조 예시

```
my-project/
├── .gemini/                  # Gemini CLI 규칙
│   ├── coding-style.md
│   └── git-workflow.md
├── .github/
│   └── workflows/            # GitHub Actions
│       ├── gemini-review.yml
│       └── ci.yml
├── .vscode/                  # VS Code 설정
│   ├── settings.json
│   ├── launch.json
│   └── tasks.json
├── gradle/wrapper/           # Gradle Wrapper (Java)
│   └── gradle-wrapper.properties
├── .venv/                    # Python 가상환경 (Python)
├── node_modules/             # Node 모듈 (Node.js)
├── CLAUDE.md                 # Claude Code 규칙
├── GEMINI.md                 # Gemini 규칙 (선택)
├── gradlew                   # Gradle Wrapper 실행파일
├── gradlew.bat
├── build.gradle              # Gradle 빌드 (Java)
├── package.json              # npm 설정 (Node.js)
├── requirements.txt          # Python 의존성
└── .gitignore
```

---

## 8. .gitignore 템플릿

### Java/Spring Boot

```gitignore
# Gradle
.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar

# IDE
.idea/
*.iml
.vscode/

# AI Tools
.claude/
*.claude
.gemini/settings.json

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db
```

### Python

```gitignore
# Virtual Environment
.venv/
venv/
ENV/

# Python
__pycache__/
*.py[cod]
*.pyo
.pytest_cache/

# IDE
.vscode/
.idea/

# AI Tools
.claude/
```

### Node.js

```gitignore
# Dependencies
node_modules/

# Build
dist/
build/

# Logs
logs/
*.log
npm-debug.log*

# IDE
.vscode/
.idea/

# AI Tools
.claude/
```

---

**마지막 업데이트**: 2026-01-11
