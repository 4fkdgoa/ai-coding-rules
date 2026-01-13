# 로그 분석 단축 키워드 가이드

CLAUDE.md에 정의하여 사용하는 로그 분석/추적 단축 키워드

---

## 단축 키워드란?

사용자가 `[키워드]` 형식으로 입력하면 AI가 미리 정의된 명령을 실행하는 방식.
복잡한 명령을 매번 입력하지 않고 간단히 호출할 수 있습니다.

---

## CLAUDE.md에 정의하는 방법

```markdown
## 단축 키워드

### [로그추적]
실시간 로그 모니터링 도구 실행

```bash
& "C:\jexer\baretailpro.exe" "C:\jexer\logs\applogs\ai-json.log" "C:\jexer\logs\applogs\app.log"
```

### [로그분석]
rg와 jq를 이용한 로그 분석 모드

사용 예시:
- 에러 검색: `rg "ERROR" logs/server.log -C 5`
- JSON 필터: `cat logs/ai-json.log | jq 'select(.level=="ERROR")'`
- 특정 시간대: `rg "2026-01-11 10:" logs/app.log`

### [빌드]
프로젝트 빌드 실행

```bash
./gradlew clean build -x test
```

### [테스트]
전체 테스트 실행

```bash
./gradlew test --info
```
```

---

## 주요 단축 키워드 정의

### [로그추적] - 실시간 모니터링

```markdown
### [로그추적]

**목적**: 실시간 로그 파일 모니터링

**Windows (BareTailPro)**:
```powershell
& "C:\jexer\baretailpro.exe" "C:\jexer\logs\applogs\ai-json.log" "C:\jexer\logs\applogs\app.log"
```

**Linux/Mac (tail)**:
```bash
tail -f logs/app.log logs/error.log
```

**멀티 파일 (multitail)**:
```bash
multitail -i logs/app.log -i logs/error.log
```
```

---

### [로그분석] - 로그 검색/분석

```markdown
### [로그분석]

**목적**: 로그 파일 검색 및 분석

**도구 위치**: `C:\Users\<user>\AppData\Local\Microsoft\WinGet\Links\`

**기본 사용법**:

```bash
# 에러 검색 (컨텍스트 5줄)
rg "ERROR" logs/server.log -C 5

# 특정 패턴 검색
rg "NullPointerException" logs/ -g "*.log"

# 오늘 날짜 로그만
rg "2026-01-11" logs/app.log

# 시간 범위 검색
rg "2026-01-11 10:[0-5]" logs/app.log
```

**JSON 로그 분석 (jq)**:

```bash
# 에러만 필터링
cat logs/ai-json.log | jq 'select(.level=="ERROR")'

# 특정 필드 추출
cat logs/ai-json.log | jq '{time: .timestamp, msg: .message}'

# 응답 시간 3초 초과
cat logs/ai-json.log | jq 'select(.responseTime > 3000)'

# 특정 사용자 로그
cat logs/ai-json.log | jq 'select(.userId=="user123")'
```

**조합 예시**:

```bash
# 에러 로그만 jq로 예쁘게 출력
rg '"level":"ERROR"' logs/ai-json.log | jq .

# 최근 100줄 중 에러
tail -100 logs/app.log | rg "ERROR"
```
```

---

### [에러분석] - 에러 로그 집중 분석

```markdown
### [에러분석]

**목적**: 에러/예외 로그 분석

**Java 스택트레이스 추출**:
```bash
# Exception 포함 라인 + 스택트레이스
rg -A 20 "Exception|Error" logs/app.log

# 특정 예외만
rg -A 10 "NullPointerException" logs/app.log

# 발생 횟수 카운트
rg "Exception" logs/app.log | wc -l
```

**에러 패턴 분석**:
```bash
# 에러 메시지별 그룹핑
rg "ERROR.*:" logs/app.log | cut -d':' -f3 | sort | uniq -c | sort -rn
```
```

---

### [성능분석] - 응답 시간 분석

```markdown
### [성능분석]

**목적**: API 응답 시간, 처리 시간 분석

**응답 시간 추출**:
```bash
# JSON 로그에서 응답 시간 추출
cat logs/ai-json.log | jq '.responseTimeMs' | sort -n

# 3초 초과 요청
cat logs/ai-json.log | jq 'select(.responseTimeMs > 3000) | {time: .timestamp, api: .endpoint, ms: .responseTimeMs}'

# 평균 응답 시간
cat logs/ai-json.log | jq '.responseTimeMs' | awk '{sum+=$1; count++} END {print sum/count}'
```

**느린 쿼리 분석**:
```bash
# 1초 이상 쿼리
rg "took [0-9]{4,}ms" logs/sql.log
```
```

---

### [빌드] / [테스트] / [서버시작]

```markdown
### [빌드]
```bash
# Gradle
./gradlew clean build -x test

# Maven
mvn clean package -DskipTests

# npm
npm run build
```

### [테스트]
```bash
# Gradle
./gradlew test --info

# 특정 테스트만
./gradlew test --tests "UserServiceTest"

# pytest
pytest -v tests/
```

### [서버시작]
```bash
# Spring Boot (백그라운드)
nohup java -jar build/libs/app.jar > server.log 2>&1 &
echo $! > server.pid

# 포그라운드
./gradlew bootRun
```

### [서버중지]
```bash
# PID 파일 사용
kill $(cat server.pid)

# 포트로 찾기
kill $(lsof -t -i:8080)

# Windows
taskkill /F /PID $(cat server.pid)
```
```

---

## Windows 전용 도구 경로

```markdown
## 도구 경로 (Windows)

### WinGet 설치 도구
위치: `C:\Users\<user>\AppData\Local\Microsoft\WinGet\Links\`

포함 도구:
- `rg.exe` - ripgrep (빠른 검색)
- `jq.exe` - JSON 처리
- `fd.exe` - 빠른 파일 찾기

### 직접 설치 도구
- BareTailPro: `C:\jexer\baretailpro.exe`
- Git Bash: `C:\Program Files\Git\bin\bash.exe`
```

---

## 사용 예시

### 사용자 입력
```
[로그분석] 오늘 발생한 에러 보여줘
```

### AI 실행
```bash
# 오늘 날짜 에러 로그 검색
rg "$(date +%Y-%m-%d).*ERROR" logs/app.log -C 3

# 또는 JSON 로그
cat logs/ai-json.log | jq 'select(.level=="ERROR" and .timestamp | startswith("2026-01-11"))'
```

---

## 프로젝트별 커스터마이징

```markdown
## [프로젝트 설정] - 단축 키워드

### [로그추적]
```powershell
& "C:\jexer\baretailpro.exe" "C:\jexer\workspace-vs\autocrm\aibot\logs\app.log"
```

### [로그분석]
```bash
# 프로젝트 로그 디렉토리
LOG_DIR="C:\jexer\workspace-vs\autocrm\aibot\logs"

# AI 응답 로그
rg "classification" "$LOG_DIR/ai-json.log" | jq .

# Tool 호출 로그
rg "executedTools" "$LOG_DIR/ai-json.log" | jq .
```

### [DB쿼리]
```bash
# 쿼리 로그 분석
rg "SELECT|INSERT|UPDATE" logs/sql.log

# 느린 쿼리
rg "took [0-9]{4,}ms" logs/sql.log
```
```

---

## 요약

| 키워드 | 용도 | 주요 도구 |
|--------|------|----------|
| `[로그추적]` | 실시간 모니터링 | BareTailPro, tail -f |
| `[로그분석]` | 로그 검색/필터 | rg, jq, grep |
| `[에러분석]` | 에러/예외 분석 | rg -A, jq select |
| `[성능분석]` | 응답시간 분석 | jq, awk |
| `[빌드]` | 프로젝트 빌드 | gradle, maven, npm |
| `[테스트]` | 테스트 실행 | gradle test, pytest |

---

**사용법**: CLAUDE.md의 `[프로젝트 설정]` 섹션에 프로젝트에 맞게 커스터마이징하세요.
