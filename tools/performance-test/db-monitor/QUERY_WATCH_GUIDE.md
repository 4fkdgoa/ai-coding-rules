# 특정 쿼리 모니터링 가이드

**핵심 질문**: "StockManagerImpl.xml의 listStock 쿼리만 감시하고 싶은데?"
**답변**: 이 가이드를 따라하세요!

---

## 📌 개요

기존 방식: **모든 느린 쿼리**를 감지
개선된 방식: **특정 쿼리만 지정**하여 모니터링

### 사용 시나리오

1. **특정 XML 쿼리 ID 지정**
   ```
   StockManagerImpl.xml의 listStock만 1초 이상 시 알림
   SaleConferManagerImpl.xml의 searchConfer만 0.5초 이상 시 알림
   ```

2. **쿼리 패턴 매칭**
   ```
   "WITH SSI AS (SELECT" 패턴을 포함하는 쿼리만 감시
   "LIKE '%검색어%'" 패턴을 사용하는 쿼리만 감시
   ```

3. **개별 임계값 설정**
   ```
   - listStock: 1,000ms
   - getStock: 500ms
   - searchCustomer: 1,500ms (LIKE 사용하므로 여유)
   ```

---

## 🚀 빠른 시작

### 방법 1: 설정 파일 사용 (권장)

`config/watch-queries.json` 생성:

```json
{
  "watchQueries": [
    {
      "name": "StockManagerImpl.listStock",
      "pattern": "WITH SSI AS \\(SELECT.*FROM STOCK_ISSUE",
      "threshold": 1000
    },
    {
      "name": "CustomerManagerImpl.searchCustomer",
      "pattern": "SELECT.*FROM CUSTOMER.*WHERE.*LIKE",
      "threshold": 1500
    }
  ]
}
```

실행:
```bash
npm run monitor -- --watch-config config/watch-queries.json
```

### 방법 2: XML 자동 로드

iBatis/MyBatis XML 파일에서 자동으로 쿼리 추출:

```bash
npm run monitor -- --xml-dir /path/to/ibatis/sql
```

XML 구조:
```xml
<sqlMap namespace="StockManagerImpl">
    <select id="listStock" resultClass="stockVO">
        WITH SSI AS (
            SELECT SI.ISSUE_ACT_GROUP, SI.ISSUE_ACT_SEQ
            FROM STOCK_ISSUE SI
            ...
        )
        SELECT * FROM SSI
    </select>

    <select id="getStock" resultClass="stockVO">
        SELECT * FROM STOCK WHERE STOCK_SEQ = #stockSeq#
    </select>
</sqlMap>
```

자동 인식:
- `StockManagerImpl.listStock`
- `StockManagerImpl.getStock`

---

## ⚙️ 상세 설정

### watchQueries 배열

| 필드 | 필수 | 설명 | 예시 |
|------|------|------|------|
| name | ✅ | 쿼리 이름 (알림에 표시) | `StockManagerImpl.listStock` |
| pattern | ✅ | 정규식 패턴 | `WITH SSI AS.*FROM STOCK_ISSUE` |
| threshold | ✅ | 임계값 (밀리초) | `1000` (1초) |
| description | ❌ | 설명 (선택) | `재고 목록 조회` |

### pattern 작성 팁

**1. 단순 텍스트 매칭**
```json
{
  "pattern": "FROM STOCK WHERE STOCK_SEQ"
}
```
→ 정확히 이 문자열이 포함된 쿼리만

**2. 정규식 사용**
```json
{
  "pattern": "SELECT.*FROM STOCK.*JOIN STOCK_EXT"
}
```
→ SELECT와 FROM STOCK, JOIN STOCK_EXT가 순서대로 나오는 쿼리

**3. CTE(WITH) 매칭**
```json
{
  "pattern": "WITH SSI AS \\(SELECT.*FROM STOCK_ISSUE"
}
```
→ WITH절이 있는 특정 쿼리

**4. LIKE 사용 쿼리**
```json
{
  "pattern": "WHERE.*LIKE '%.*%'"
}
```
→ LIKE로 검색하는 쿼리 (일반적으로 느림)

**5. 복잡한 JOIN**
```json
{
  "pattern": "JOIN.*JOIN.*JOIN"
}
```
→ 3개 이상 테이블을 JOIN하는 쿼리

### 이스케이프 주의사항

JSON에서는 백슬래시를 두 번 입력:
```json
{
  "pattern": "\\(SELECT"   // 괄호 매칭
}
```

정규식 테스트 사이트: https://regex101.com/

---

## 📊 실행 예시

### 콘솔 출력

```
📊 DB 알림 모니터링 시스템 v1.0
============================================================
✅ MSSQL 연결 성공
📁 3개 XML 파일에서 15개 쿼리 로드
✅ 워치 추가: StockManagerImpl.listStock (임계값: 1000ms)
✅ 워치 추가: CustomerManagerImpl.searchCustomer (임계값: 1500ms)

🔍 워치 쿼리 모니터링 시작...

⏰ 16:30:15 - 체크 시작...
  🎯 [StockManagerImpl.listStock] 1,234ms (임계값: 1,000ms)
  📝 로그 저장: db-alert-2026-01-16.json
  📧 이메일 발송: WATCH QUERY - StockManagerImpl.listStock
  ✓ 체크 완료

⏰ 16:30:25 - 체크 시작...
  ✓ 체크 완료 (감지 없음)

⏰ 16:30:35 - 체크 시작...
  🎯 [CustomerManagerImpl.searchCustomer] 1,678ms (임계값: 1,500ms)
  📝 로그 저장: db-alert-2026-01-16.json
  📧 이메일 발송: WATCH QUERY - CustomerManagerImpl.searchCustomer
  ✓ 체크 완료
```

### 이메일 알림

**제목**: `⚠️ [WARNING] Watch Query - StockManagerImpl.listStock`

**내용**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
쿼리 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
쿼리 이름: StockManagerImpl.listStock
발생 시각: 2026-01-16 16:30:15
세션 ID: 52
데이터베이스: AutoCRM_Samchully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
성능 지표
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
실행 시간: 1,234 ms (임계값: 1,000 ms ⚠️)
CPU 시간: 892 ms
논리적 읽기: 45,678 회

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
쿼리
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WITH SSI AS (
  SELECT SI.ISSUE_ACT_GROUP, SI.ISSUE_ACT_SEQ, ...
  FROM STOCK_ISSUE SI
  ...
)
SELECT * FROM SSI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
통계 (최근 24시간)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
실행 횟수: 47회
평균 시간: 1,092ms
최대 시간: 1,876ms
최소 시간: 678ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
권장 조치
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. StockManagerImpl.listStock 쿼리 최적화 필요
2. WHERE 절에 인덱스 추가 검토
3. JOIN 순서 재검토
```

### 로그 파일

`logs/db-alert-2026-01-16.json`:
```json
[
  {
    "timestamp": "2026-01-16T16:30:15.123Z",
    "level": "warning",
    "alertType": "watch_query",
    "message": "워치 쿼리 감지: StockManagerImpl.listStock (1,234ms)",
    "details": {
      "queryName": "StockManagerImpl.listStock",
      "threshold": 1000,
      "executionTimeMs": 1234,
      "cpuTimeMs": 892,
      "logicalReads": 45678,
      "queryText": "WITH SSI AS (SELECT...",
      "sessionId": 52,
      "database": "AutoCRM_Samchully"
    },
    "stats": {
      "count": 47,
      "avgTime": 1092,
      "maxTime": 1876,
      "minTime": 678
    }
  }
]
```

---

## 🔬 고급 사용법

### 1. XML 전체 디렉토리 로드

```javascript
const QueryWatcher = require('./query-watcher');

const watcher = new QueryWatcher(dbPool, config);

// iBatis XML 디렉토리 전체 로드
await watcher.loadFromDirectory('/path/to/ibatis/sql');

// 모든 쿼리가 자동으로 매핑됨
// - StockManagerImpl.listStock
// - StockManagerImpl.getStock
// - SaleConferManagerImpl.listConfer
// - ...
```

### 2. 동적 워치 추가

```javascript
// 런타임에 워치 추가
watcher.addWatch(
    'CustomQuery.search',           // 이름
    'SELECT.*FROM CUSTOM.*LIKE',    // 패턴
    2000                             // 임계값 (2초)
);

// 즉시 모니터링 시작
const alerts = await watcher.checkWatchedQueries();
```

### 3. 통계 조회

```javascript
// 특정 쿼리 통계
const stats = watcher.getStats('StockManagerImpl.listStock');
console.log(`
평균 시간: ${stats.avgTime}ms
최대 시간: ${stats.maxTime}ms
실행 횟수: ${stats.count}회
`);

// 전체 쿼리 통계 (평균 시간순 정렬)
const allStats = watcher.getStats();
watcher.printStats();
```

출력:
```
================================================================================
📊 워치 쿼리 통계
================================================================================
Query Name                                            Count   Avg (ms)   Max (ms)   Min (ms)
--------------------------------------------------------------------------------
StockManagerImpl.listStock                               47       1092       1876        678
CustomerManagerImpl.searchCustomer                       23       1456       2134        892
SaleConferManagerImpl.listConfer                         89        743       1234        456
StockManagerImpl.getStock                               234        312        678        123
================================================================================
```

### 4. 조건부 알림

```json
{
  "watchQueries": [
    {
      "name": "SlowQuery.searchLike",
      "pattern": "LIKE '%.*%'",
      "threshold": 1000,
      "alertOnCount": 5,
      "description": "5회 이상 발생 시에만 알림"
    }
  ]
}
```

### 5. 시간대별 임계값

```json
{
  "watchQueries": [
    {
      "name": "StockManagerImpl.listStock",
      "pattern": "WITH SSI AS",
      "thresholds": [
        {
          "timeRange": "09:00-18:00",
          "threshold": 1000,
          "description": "업무 시간 (엄격)"
        },
        {
          "timeRange": "18:00-09:00",
          "threshold": 3000,
          "description": "야간 (여유)"
        }
      ]
    }
  ]
}
```

---

## 🐛 문제 해결

### 1. XML 파싱 실패

**증상**:
```
XML 파싱 실패: StockManagerImpl.xml
Error: Invalid iBatis XML
```

**원인**: XML 형식이 표준과 다름

**해결**:
1. XML 파일 구조 확인:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE sqlMap PUBLIC "-//iBATIS.com//DTD SQL Map 2.0//EN"
    "http://www.ibatis.com/dtd/sql-map-2.dtd">

<sqlMap namespace="StockManagerImpl">
    <select id="listStock">
        ...
    </select>
</sqlMap>
```

2. MyBatis 형식:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.example.StockMapper">
    <select id="listStock">
        ...
    </select>
</mapper>
```

### 2. 패턴 매칭 안됨

**증상**:
워치 추가했는데 실제 쿼리 실행 시 알림 안 옴

**원인**: 패턴이 실제 쿼리와 불일치

**해결**:
1. 로그에서 실제 쿼리 확인:
```bash
tail -f logs/db-alert-*.json | jq '.details.queryText'
```

2. 패턴 테스트:
```javascript
const pattern = /WITH SSI AS/i;
const actualQuery = "WITH SSI AS (SELECT...";
console.log(pattern.test(actualQuery)); // true/false
```

3. 패턴 완화:
```json
{
  "pattern": "STOCK_ISSUE"  // 단순하게
}
```

### 3. 너무 많은 알림

**증상**:
같은 쿼리에 대해 알림이 계속 옴

**해결**:
임계값을 높이거나 throttling 적용:

```json
{
  "watchQueries": [
    {
      "name": "SlowQuery",
      "threshold": 2000,
      "throttleMinutes": 30
    }
  ]
}
```

---

## 📚 참고: 정규식 패턴 예시

### 기본 패턴

```javascript
// 특정 테이블 조회
"SELECT.*FROM STOCK"

// 특정 테이블 JOIN
"FROM STOCK.*JOIN STOCK_EXT"

// WHERE 절 LIKE
"WHERE.*LIKE '%.*%'"

// ORDER BY
"ORDER BY.*DESC"

// COUNT(*)
"SELECT COUNT\\(\\*\\)"

// DISTINCT
"SELECT DISTINCT"
```

### 고급 패턴

```javascript
// CTE (WITH절)
"WITH \\w+ AS \\(SELECT"

// 서브쿼리
"SELECT.*\\(SELECT.*\\)"

// UNION
"SELECT.*UNION.*SELECT"

// 다중 JOIN (3개 이상)
"JOIN.*JOIN.*JOIN"

// 동적 쿼리 (IN절)
"WHERE.*IN \\([^)]+\\)"

// 날짜 범위 검색
"WHERE.*BETWEEN.*AND"
```

---

## 🎯 실전 시나리오

### 시나리오 1: 느린 재고 조회 감시

**목표**: StockManagerImpl.listStock이 1초 이상 걸리면 즉시 알림

**설정**:
```json
{
  "watchQueries": [
    {
      "name": "StockManagerImpl.listStock",
      "pattern": "WITH SSI AS.*FROM STOCK_ISSUE",
      "threshold": 1000
    }
  ],
  "email": {
    "enabled": true,
    "to": ["dba@company.com", "dev-team@company.com"]
  }
}
```

**결과**: 1초 이상 걸릴 때마다 이메일 수신 → 즉시 대응

### 시나리오 2: LIKE 검색 최적화

**목표**: LIKE '%검색어%' 사용하는 모든 쿼리 찾기

**설정**:
```json
{
  "watchQueries": [
    {
      "name": "LIKE_Search",
      "pattern": "WHERE.*LIKE '%.*%'",
      "threshold": 500
    }
  ]
}
```

**결과**: LIKE 사용 쿼리 목록 확보 → 인덱스 추가 또는 Full-Text Search 도입

### 시나리오 3: 복잡한 JOIN 감시

**목표**: 3개 이상 테이블 JOIN하는 쿼리 감시

**설정**:
```json
{
  "watchQueries": [
    {
      "name": "Complex_JOIN",
      "pattern": "JOIN.*JOIN.*JOIN",
      "threshold": 800
    }
  ]
}
```

**결과**: 복잡한 JOIN 쿼리 식별 → 쿼리 분리 또는 인덱스 최적화

---

**다음 문서**: [LOCK_MONITOR_GUIDE.md](LOCK_MONITOR_GUIDE.md) - Lock 상세 모니터링
