# DB 알림 모니터링 시스템 사용 가이드

**버전**: 1.0
**작성일**: 2026-01-16

---

## 📌 개요

DB 알림 모니터링 시스템은 MSSQL 데이터베이스의 성능 이상 징후를 **자동으로 감지**하고, **로그 파일 저장** 및 **이메일 알림**을 보내는 도구입니다.

### 주요 기능
- ✅ 실시간 느린 쿼리 감지
- ✅ 차단(Blocking) 세션 감지
- ✅ 높은 CPU 사용량 감지
- ✅ 데드락 감지
- ✅ Table Scan 감지
- ✅ JSON 로그 자동 저장 (30일 보관)
- ✅ 이메일 알림 (Critical/Warning)
- ✅ 알림 Throttling (10분마다 최대 1회)

---

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd tools/performance-test
npm install
```

설치되는 패키지:
- `mssql` - MSSQL 연결
- `nodemailer` - 이메일 발송

### 2. 설정 파일 수정

`db-monitor/config/alert-config.json` 파일을 편집:

```json
{
  "email": {
    "enabled": true,
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "auth": {
        "user": "your-email@gmail.com",     // ← 변경
        "pass": "your-app-password"         // ← 변경
      }
    },
    "to": [
      "dba@company.com",                    // ← 변경
      "dev-team@company.com"                // ← 변경
    ]
  }
}
```

**Gmail 앱 비밀번호 발급 방법**:
1. Google 계정 > 보안 > 2단계 인증 활성화
2. 앱 비밀번호 생성 (https://myaccount.google.com/apppasswords)
3. 생성된 16자리 비밀번호를 `pass`에 입력

### 3. 환경변수 설정

DB 연결 정보 설정 (선택사항, 설정하지 않으면 기본값 사용):

```bash
# Linux/Mac
export DB_USER="sa"
export DB_PASSWORD="your_password"
export DB_SERVER="211.217.11.5"
export DB_NAME="AutoCRM_Samchully"

# Windows (PowerShell)
$env:DB_USER="sa"
$env:DB_PASSWORD="your_password"
$env:DB_SERVER="211.217.11.5"
$env:DB_NAME="AutoCRM_Samchully"
```

### 4. 모니터링 시작

```bash
npm run monitor
```

출력 예시:
```
📊 DB 알림 모니터링 시스템 v1.0
============================================================
✅ MSSQL 연결 성공
📊 모니터링 간격: 10초

🔍 DB 알림 모니터링 시작...
(Ctrl+C로 중단)

⏰ 16:30:15 - 체크 시작...
  ⚠️  [WARNING] 느린 쿼리 감지: 1,234ms
  📝 로그 저장: db-alert-2026-01-16.json
  📧 이메일 발송: WARNING - 느린 쿼리 감지: 1,234ms
  ✓ 체크 완료

⏰ 16:30:25 - 체크 시작...
  🚨 [CRITICAL] 차단 감지: 세션 52이(가) 세션 48을(를) 5,123ms 차단 중
  📝 로그 저장: db-alert-2026-01-16.json
  📧 이메일 발송: CRITICAL - 차단 감지
  ✓ 체크 완료
```

중단:
```
Ctrl+C

⏹️  모니터링 중단 요청...
✅ DB 연결 종료

============================================================
📊 모니터링 요약
============================================================
🚨 Critical: 3건
⚠️  Warning:  7건
ℹ️  Info:     12건
📝 총 알림:   22건
============================================================
```

---

## ⚙️ 설정 상세

### 임계값 설정 (thresholds)

```json
{
  "thresholds": {
    "critical": {
      "executionTimeMs": 3000,    // 3초 이상 → CRITICAL
      "cpuTimeMs": 2000,           // CPU 2초 이상
      "logicalReads": 50000,       // 읽기 50,000회 이상
      "blockingTimeMs": 5000       // 차단 5초 이상
    },
    "warning": {
      "executionTimeMs": 1000,    // 1초 이상 → WARNING
      "cpuTimeMs": 500,
      "logicalReads": 10000,
      "blockingTimeMs": 1000
    },
    "info": {
      "executionTimeMs": 500,     // 0.5초 이상 → INFO
      "cpuTimeMs": 300,
      "logicalReads": 5000,
      "blockingTimeMs": 500
    }
  }
}
```

**권장 설정**:
- **개발 환경**: 낮은 임계값 (문제 조기 발견)
- **운영 환경**: 높은 임계값 (중요한 문제만)

### 이메일 설정 (email)

```json
{
  "email": {
    "enabled": true,                      // 이메일 발송 활성화
    "sendOnLevels": ["critical", "warning"],  // 발송할 레벨
    "throttleMinutes": 10,                // 같은 알림 10분에 1회만
    "smtp": {
      "host": "smtp.gmail.com",           // SMTP 서버
      "port": 587,                        // 포트 (587: TLS, 465: SSL)
      "secure": false,                    // 465 포트면 true
      "auth": {
        "user": "your-email@gmail.com",
        "pass": "app-password"            // Gmail 앱 비밀번호
      }
    },
    "from": "DB Monitor <your-email@gmail.com>",
    "to": [
      "dba@company.com",
      "dev-team@company.com"
    ]
  }
}
```

**SMTP 설정 예시**:

| 서비스 | Host | Port | Secure |
|--------|------|------|--------|
| Gmail | smtp.gmail.com | 587 | false |
| Outlook | smtp.office365.com | 587 | false |
| Naver | smtp.naver.com | 587 | false |
| 사내 Exchange | mail.company.com | 25 | false |

### 로깅 설정 (logging)

```json
{
  "logging": {
    "enabled": true,                    // 로그 저장 활성화
    "directory": "./logs",              // 로그 디렉토리
    "retentionDays": 30,                // 보관 기간 (30일)
    "format": "json",                   // 로그 형식
    "includeQueryText": true,           // 쿼리 텍스트 포함
    "maxQueryTextLength": 500           // 쿼리 최대 길이
  }
}
```

로그 파일 위치:
```
tools/performance-test/db-monitor/logs/
├── db-alert-2026-01-16.json
├── db-alert-2026-01-15.json
└── db-alert-2026-01-14.json
```

### 모니터링 설정 (monitoring)

```json
{
  "monitoring": {
    "intervalSeconds": 10,              // 체크 간격 (10초)
    "enabledChecks": {
      "slowQueries": true,              // 느린 쿼리
      "blocking": true,                 // 차단 세션
      "tableScan": true,                // Table Scan
      "highCpu": true,                  // 높은 CPU
      "deadlocks": true                 // 데드락
    }
  }
}
```

**권장 간격**:
- **개발/테스트**: 10초 (빠른 피드백)
- **운영**: 30-60초 (부하 최소화)

---

## 📧 이메일 알림 예시

### Critical 알림

<img src="https://via.placeholder.com/800x600.png?text=Email+Screenshot" alt="Critical Alert Email">

**제목**: `🚨 [CRITICAL] DB Alert - SLOW QUERY`

**내용**:
```
알림 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
발생 시각: 2026-01-16 16:30:15
알림 레벨: CRITICAL
알림 유형: slow_query
세션 ID: 52
데이터베이스: AutoCRM_Samchully

성능 지표
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
실행 시간: 3,456 ms
CPU 시간: 2,123 ms
논리적 읽기: 67,890 회

쿼리
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WITH SSI AS (
  SELECT SI.ISSUE_ACT_GROUP, SI.ISSUE_ACT_SEQ, ...
  FROM STOCK_ISSUE SI
  ...
)

실행 계획 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Table Scan: 2개 (인덱스 미사용)
⚠️ Index Scan: 3개 (전체 스캔)
✅ Index Seek: 5개 (효율적)

권장 조치
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 쿼리 실행 시간이 매우 깁니다. WHERE 절 최적화 및 인덱스 추가를 검토하세요.
2. Table Scan이 발생하고 있습니다. WHERE 절에 사용되는 컬럼에 인덱스를 추가하세요.
```

---

## 📝 로그 파일 형식

`logs/db-alert-2026-01-16.json`:

```json
[
  {
    "timestamp": "2026-01-16T16:30:15.123Z",
    "level": "critical",
    "alertType": "slow_query",
    "severity": 0,
    "message": "느린 쿼리 감지: 3,456ms",
    "details": {
      "sessionId": 52,
      "executionTimeMs": 3456,
      "cpuTimeMs": 2123,
      "logicalReads": 67890,
      "blockingSessionId": null,
      "waitType": null,
      "queryText": "WITH SSI AS (SELECT...",
      "executionPlan": {
        "tableScans": 2,
        "indexScans": 3,
        "indexSeeks": 5
      }
    },
    "metadata": {
      "database": "AutoCRM_Samchully",
      "server": "211.217.11.5",
      "monitorVersion": "1.0.0"
    }
  },
  {
    "timestamp": "2026-01-16T16:35:42.789Z",
    "level": "warning",
    "alertType": "blocking",
    "message": "차단 감지: 세션 48이(가) 세션 52을(를) 1,234ms 차단 중",
    ...
  }
]
```

---

## 🔧 고급 사용법

### 1. 로그 검색

```javascript
const AlertLogger = require('./utils/alert-logger');
const alertConfig = require('./config/alert-config.json');

const logger = new AlertLogger(alertConfig.logging);

// Critical 알림만 검색
const criticalAlerts = logger.searchLogs({
    level: 'critical',
    startDate: '2026-01-16T00:00:00Z',
    endDate: '2026-01-16T23:59:59Z'
});

console.log(`Critical 알림: ${criticalAlerts.length}건`);

// 실행 시간 1초 이상인 알림 검색
const slowAlerts = logger.searchLogs({
    minExecutionTime: 1000
});
```

### 2. 일별 통계 생성

```javascript
const stats = logger.generateDailyStats(new Date('2026-01-16'));

console.log(`
날짜: ${stats.date}
총 알림: ${stats.totalAlerts}건
  - Critical: ${stats.byLevel.critical}건
  - Warning: ${stats.byLevel.warning}건
  - Info: ${stats.byLevel.info}건

평균 실행 시간: ${stats.avgExecutionTime}ms
최대 실행 시간: ${stats.maxExecutionTime}ms

가장 느린 쿼리:
${stats.slowestQuery}
`);
```

### 3. 테스트 이메일 발송

```javascript
const EmailSender = require('./utils/email-sender');
const alertConfig = require('./config/alert-config.json');

const emailSender = new EmailSender(alertConfig.email);

// 테스트 이메일 발송
await emailSender.sendTestEmail();
```

실행:
```bash
node -e "
const EmailSender = require('./db-monitor/utils/email-sender');
const config = require('./db-monitor/config/alert-config.json');
const sender = new EmailSender(config.email);
sender.sendTestEmail().then(() => process.exit());
"
```

### 4. 커스텀 임계값으로 실행

임시 설정 파일 생성:
```bash
cp db-monitor/config/alert-config.json db-monitor/config/alert-config-dev.json
```

`alert-config-dev.json` 편집 (낮은 임계값):
```json
{
  "thresholds": {
    "warning": {
      "executionTimeMs": 100,    // 더 낮은 임계값
      "cpuTimeMs": 50
    }
  }
}
```

코드 수정:
```javascript
// db-alert-monitor.js 7번째 줄
const configPath = path.join(__dirname, 'config', 'alert-config-dev.json');
```

### 5. 특정 체크만 활성화

`alert-config.json` 수정:
```json
{
  "monitoring": {
    "enabledChecks": {
      "slowQueries": true,
      "blocking": false,        // 차단 체크 비활성화
      "tableScan": false,
      "highCpu": false,
      "deadlocks": false
    }
  }
}
```

---

## 🐛 문제 해결

### 1. 이메일 발송 실패

**증상**:
```
❌ 이메일 발송 실패: Invalid login
```

**해결**:
1. Gmail 앱 비밀번호 재확인
2. 2단계 인증 활성화 확인
3. "보안 수준이 낮은 앱 허용" 비활성화 (앱 비밀번호 사용)

**테스트**:
```bash
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'your@gmail.com', pass: 'app-password' }
});
transporter.verify().then(console.log).catch(console.error);
"
```

### 2. DB 연결 실패

**증상**:
```
❌ MSSQL 연결 실패: Login failed for user 'sa'
```

**해결**:
1. 환경변수 확인: `echo $DB_USER $DB_PASSWORD`
2. MSSQL 서버 연결 테스트: `telnet 211.217.11.5 1433`
3. 방화벽 설정 확인
4. SQL Server 인증 모드 확인 (혼합 모드)

### 3. 로그 파일이 생성되지 않음

**증상**:
로그 파일이 `logs/` 디렉토리에 생성되지 않음

**해결**:
1. 디렉토리 권한 확인:
```bash
ls -ld tools/performance-test/db-monitor/logs
```

2. 수동 생성:
```bash
mkdir -p tools/performance-test/db-monitor/logs
chmod 755 tools/performance-test/db-monitor/logs
```

3. 로깅 활성화 확인:
```json
{
  "logging": {
    "enabled": true    // ← 확인
  }
}
```

### 4. 알림이 너무 많이 발생

**증상**:
10초마다 수십 개의 알림 발생

**해결 1**: 임계값 상향 조정
```json
{
  "thresholds": {
    "warning": {
      "executionTimeMs": 2000  // 1000 → 2000으로
    }
  }
}
```

**해결 2**: 체크 간격 증가
```json
{
  "monitoring": {
    "intervalSeconds": 60  // 10 → 60으로
  }
}
```

**해결 3**: 특정 체크 비활성화
```json
{
  "monitoring": {
    "enabledChecks": {
      "slowQueries": true,
      "highCpu": false    // CPU 체크 비활성화
    }
  }
}
```

### 5. Throttling 조정

**증상**:
같은 알림이 10분 내에 다시 발생해도 메일 안 옴

**원인**:
Throttling이 작동 중 (정상)

**변경**:
```json
{
  "email": {
    "throttleMinutes": 5  // 10 → 5분으로 변경
  }
}
```

---

## 📊 실전 시나리오

### 시나리오 1: 운영 서버 배포 후 모니터링

```bash
# 1. 배포 전 테스트 이메일
npm run monitor &
PID=$!
sleep 30
kill $PID

# 2. 설정 확인
cat db-monitor/config/alert-config.json

# 3. 백그라운드 실행
nohup npm run monitor > monitor.log 2>&1 &
echo $! > monitor.pid

# 4. 로그 확인
tail -f monitor.log

# 5. 중단
kill $(cat monitor.pid)
```

### 시나리오 2: 일일 성능 리포트 생성

`daily-report.js`:
```javascript
const AlertLogger = require('./db-monitor/utils/alert-logger');
const alertConfig = require('./db-monitor/config/alert-config.json');

const logger = new AlertLogger(alertConfig.logging);
const stats = logger.generateDailyStats();

if (stats) {
    console.log(`
📅 일일 성능 리포트 (${stats.date})
${'='.repeat(60)}
총 알림: ${stats.totalAlerts}건
  🚨 Critical: ${stats.byLevel.critical}건
  ⚠️  Warning:  ${stats.byLevel.warning}건
  ℹ️  Info:     ${stats.byLevel.info}건

평균 실행 시간: ${stats.avgExecutionTime}ms
최대 실행 시간: ${stats.maxExecutionTime}ms

가장 느린 쿼리:
${stats.slowestQuery || 'N/A'}
${'='.repeat(60)}
    `);
}
```

실행:
```bash
node daily-report.js
```

cron 등록 (매일 오전 9시):
```bash
crontab -e
# 추가:
0 9 * * * cd /path/to/ai-coding-rules/tools/performance-test && node daily-report.js | mail -s "DB 일일 리포트" dba@company.com
```

### 시나리오 3: 긴급 상황 대응

**상황**: 운영 서버가 느려짐

```bash
# 1. 즉시 모니터링 시작 (낮은 임계값)
DB_USER=sa DB_PASSWORD=pwd npm run monitor

# 2. 별도 터미널에서 로그 실시간 확인
tail -f db-monitor/logs/db-alert-$(date +%Y-%m-%d).json | jq .

# 3. Critical 알림 확인
cat db-monitor/logs/db-alert-$(date +%Y-%m-%d).json | \
  jq '.[] | select(.level == "critical")'

# 4. 가장 느린 쿼리 찾기
cat db-monitor/logs/db-alert-$(date +%Y-%m-%d).json | \
  jq -r 'sort_by(.details.executionTimeMs) | reverse | .[0]'
```

---

## 🎯 베스트 프랙티스

### 1. 운영 환경 설정

```json
{
  "thresholds": {
    "critical": {
      "executionTimeMs": 5000,     // 5초 (높게)
      "cpuTimeMs": 3000,
      "blockingTimeMs": 10000
    }
  },
  "monitoring": {
    "intervalSeconds": 30          // 30초 (부하 최소화)
  },
  "email": {
    "sendOnLevels": ["critical"],  // Critical만 발송
    "throttleMinutes": 15          // 15분에 1회
  }
}
```

### 2. 개발 환경 설정

```json
{
  "thresholds": {
    "warning": {
      "executionTimeMs": 500,      // 낮게 (조기 발견)
      "cpuTimeMs": 300
    }
  },
  "monitoring": {
    "intervalSeconds": 10          // 10초 (빠른 피드백)
  },
  "email": {
    "enabled": false,              // 이메일 비활성화
  },
  "logging": {
    "enabled": true                // 로그만 활성화
  }
}
```

### 3. 알림 우선순위

| 레벨 | 대응 시간 | 조치 |
|------|----------|------|
| 🚨 Critical | 즉시 (5분 이내) | DBA 긴급 대응 |
| ⚠️  Warning | 30분 이내 | 개발팀 확인 |
| ℹ️  Info | 1시간 이내 | 로그 검토 |

### 4. 주기적 리뷰

- **일일**: Critical 알림 전수 조사
- **주간**: Warning 트렌드 분석
- **월간**: 임계값 조정 및 최적화

---

## 📚 참고 자료

- [nodemailer 공식 문서](https://nodemailer.com/)
- [MSSQL DMV 가이드](https://docs.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-views/)
- [Gmail 앱 비밀번호](https://support.google.com/accounts/answer/185833)

---

**문의**: 문제 발생 시 GitHub Issues 등록
