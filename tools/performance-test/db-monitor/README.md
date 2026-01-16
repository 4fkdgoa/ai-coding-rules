# MSSQL DB 성능 모니터링 도구

AutoCRM_Samchully 프로젝트의 MSSQL DB 성능을 실시간으로 모니터링하고 분석하는 도구입니다.

---

## 기능

1. **실시간 쿼리 모니터링**
   - 현재 실행 중인 쿼리 감시
   - CPU 시간, 읽기 횟수, 대기 상태 확인

2. **느린 쿼리 분석**
   - 지정된 시간(기본 1초) 이상 걸리는 쿼리 찾기
   - 평균 실행 시간, 횟수, CPU 사용량 분석

3. **실행 계획 분석**
   - Table Scan vs Index Scan vs Index Seek
   - 인덱스 미사용 쿼리 감지
   - JOIN 성능 분석

4. **테이블 인덱스 분석**
   - 테이블별 인덱스 목록
   - 인덱스 사용 통계 (Seek, Scan 횟수)
   - 미사용 인덱스 감지

---

## 설정

### 1. DB 연결 정보 수정

`mssql-profiler.js` 파일의 연결 설정을 실제 정보로 변경:

```javascript
const config = {
    user: 'your_username',      // ← 실제 사용자명
    password: 'your_password',  // ← 실제 비밀번호
    server: '211.217.11.5',     // SDMS 서버 (이미 설정됨)
    database: 'AutoCRM_Samchully',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};
```

### 2. 방화벽 확인

MSSQL 서버(211.217.11.5)의 포트 1433이 열려 있는지 확인:

```bash
telnet 211.217.11.5 1433
```

---

## 사용법

### 1. 느린 쿼리 분석 (가장 유용)

```bash
cd performance-test/db-monitor
node mssql-profiler.js
```

출력 예시:
```
📊 MSSQL DB 성능 프로파일러
============================================================

🐌 500ms 이상 느린 쿼리 분석...

[느린 쿼리 1]
  평균 실행 시간: 1,092.35ms
  실행 횟수: 47회
  평균 CPU 시간: 850.12ms
  평균 읽기: 12,345회
  마지막 실행: 2026-01-15T08:30:15.123Z
  쿼리: WITH SSI AS (SELECT SI.ISSUE_ACT_GROUP, SI.ISSUE_ACT_SEQ...

  📋 실행 계획 요약:
    ⚠️  Table Scan: 3개 (인덱스 미사용 - 개선 필요!)
    ⚠️  Index Scan: 5개 (전체 인덱스 스캔 - 개선 가능)
    ✅ Index Seek: 8개 (효율적)

📑 STOCK 테이블 인덱스 분석...

인덱스: PK_STOCK
  타입: CLUSTERED
  컬럼: STOCK_SEQ
  Seek: 1234회
  Scan: 567회
  Update: 89회

인덱스: IX_STOCK_VIN_NO
  타입: NONCLUSTERED
  컬럼: VIN_NO
  Seek: 456회
  Scan: 0회
  Update: 89회
```

### 2. 실시간 모니터링

`mssql-profiler.js` 파일에서 주석 해제:

```javascript
// main() 함수 마지막 부분
await profiler.startMonitoring();  // 주석 해제
```

실행:
```bash
node mssql-profiler.js
```

Ctrl+C로 중단할 때까지 2초마다 실행 중인 쿼리 표시:
```
⏰ 16:35:42 - 실행 중인 쿼리:

[쿼리 1]
  세션 ID: 52
  실행 시간: 1,250ms
  CPU 시간: 980ms
  읽기: 15,678회
  대기: CXPACKET
  쿼리: SELECT ST.STOCK_SEQ, ST.VIN_NO, ST.CREATE_DATE FROM STOCK ST LEFT JOIN...
```

### 3. 특정 테이블 인덱스만 분석

```javascript
// main() 함수 수정
async function main() {
    const profiler = new MSSQLProfiler();
    await profiler.connect();

    // 원하는 테이블만 분석
    await profiler.analyzeIndexes('STOCK');
    await profiler.analyzeIndexes('SALE_CONFER');
    await profiler.analyzeIndexes('STOCK_EXT');

    await profiler.disconnect();
}
```

---

## 실전 활용 예시

### 시나리오: /stock/stockList.json API가 느림 (1,092ms)

#### 1단계: 느린 쿼리 찾기
```bash
node mssql-profiler.js
```

#### 2단계: 실행 계획 확인
```
[느린 쿼리 1]
  쿼리: WITH SSI AS (SELECT ... FROM STOCK_ISSUE ...)

  📋 실행 계획:
    ⚠️  Table Scan: STOCK_EXT (500,000 rows)
    ⚠️  Index Scan: STOCK_ISSUE
    ✅ Index Seek: STOCK (CLUSTERED)
```

**문제 발견:**
- `STOCK_EXT` 테이블 전체 스캔 (인덱스 없음)
- `STOCK_ISSUE` 인덱스 스캔 (효율적이지 않음)

#### 3단계: 인덱스 분석
```bash
# STOCK_EXT 테이블 인덱스 확인
await profiler.analyzeIndexes('STOCK_EXT');
```

결과:
```
인덱스: IX_STOCK_EXT_STOCK_SEQ
  컬럼: STOCK_SEQ
  Seek: 234회
  Scan: 0회

인덱스: 없음 (CREATE_DATE, CUSTOM_CLEARANCE_DATE)
```

#### 4단계: 인덱스 추가 권장

쿼리를 보니 `CREATE_DATE`로 정렬하고 있음:
```sql
ROW_NUMBER() OVER(ORDER BY ST.CREATE_DATE) AS RN
```

**해결책:**
```sql
-- STOCK 테이블에 CREATE_DATE 인덱스 추가
CREATE NONCLUSTERED INDEX IX_STOCK_CREATE_DATE
ON STOCK (CREATE_DATE DESC)
INCLUDE (STOCK_SEQ, VIN_NO);

-- STOCK_EXT에 자주 사용되는 컬럼 인덱스
CREATE NONCLUSTERED INDEX IX_STOCK_EXT_DATES
ON STOCK_EXT (CUSTOM_CLEARANCE_DATE, BUYING_DATE)
INCLUDE (STOCK_GUBUN_SEQ, PDI_STATUS);
```

#### 5단계: 효과 측정

인덱스 추가 후 다시 실행:
```bash
node mssql-profiler.js
```

기대 결과:
```
[쿼리]
  평균 실행 시간: 1,092ms → 120ms (89% 개선!)

  📋 실행 계획:
    ✅ Index Seek: STOCK (CREATE_DATE)
    ✅ Index Seek: STOCK_EXT (STOCK_SEQ)
```

---

## 문제 해결

### 연결 실패
```
Error: Login failed for user 'your_username'
```

**해결:**
1. 사용자명/비밀번호 확인
2. MSSQL 서버에서 해당 계정 권한 확인
3. 방화벽 설정 확인

### 타임아웃
```
Error: Timeout: Request failed to complete
```

**해결:**
1. 쿼리가 너무 오래 걸림 (정상)
2. 타임아웃 증가:
```javascript
const config = {
    // ...
    requestTimeout: 60000,  // 60초로 증가
    connectionTimeout: 30000
};
```

### 권한 부족
```
Error: SELECT permission denied on sys.dm_exec_requests
```

**해결:**
```sql
-- DBA에게 요청: VIEW SERVER STATE 권한 부여
GRANT VIEW SERVER STATE TO your_username;
```

---

## 고급 사용법

### 1. 특정 쿼리만 프로파일링

```javascript
const profiler = new MSSQLProfiler();
await profiler.connect();

// 실제 쿼리 파일 읽기
const fs = require('fs');
const query = fs.readFileSync('../../eclipse-workspace-2024/AutoCRM_Samchully/src/resources/ibatis/sql/StockManagerImpl.xml', 'utf-8');

// listStock 쿼리만 추출 (XML 파싱 필요)
const listStockQuery = extractQueryFromXML(query, 'listStock');

// 실행 계획 분석
const analysis = await profiler.analyzeExecutionPlan(listStockQuery, '재고 목록');

// 최적화 제안
profiler.suggestOptimizations(analysis);
```

### 2. Playwright와 통합

Playwright로 페이지 로드할 때 동시에 DB 모니터링:

```javascript
// performance-test/tests/sdms-with-db-monitor.spec.js
const { test } = require('@playwright/test');
const MSSQLProfiler = require('../db-monitor/mssql-profiler');

test('DB 모니터링과 함께 성능 측정', async ({ page }) => {
    const profiler = new MSSQLProfiler();
    await profiler.connect();

    // DB 모니터링 시작
    const dbPromise = profiler.analyzeSlowQueries(500);

    // 동시에 페이지 접속
    await page.goto('https://sdms.sclmotors.co.kr/sfa/sm/rm/smrm01.do');
    await page.waitForLoadState('networkidle');

    // DB 분석 결과 대기
    const slowQueries = await dbPromise;

    console.log('느린 쿼리 개수:', slowQueries.length);

    await profiler.disconnect();
});
```

### 3. 자동 리포트 생성

```javascript
// 분석 결과를 파일로 저장
const fs = require('fs');

const report = {
    timestamp: new Date().toISOString(),
    slowQueries: await profiler.analyzeSlowQueries(500),
    stockIndexes: await profiler.analyzeIndexes('STOCK'),
    stockExtIndexes: await profiler.analyzeIndexes('STOCK_EXT')
};

fs.writeFileSync('db-analysis-report.json', JSON.stringify(report, null, 2));
console.log('리포트 저장 완료: db-analysis-report.json');
```

---

## 참고 자료

### MSSQL 성능 DMV (Dynamic Management Views)
- `sys.dm_exec_requests` - 현재 실행 중인 요청
- `sys.dm_exec_query_stats` - 쿼리 실행 통계
- `sys.dm_exec_query_plan` - 쿼리 실행 계획
- `sys.dm_db_index_usage_stats` - 인덱스 사용 통계

### 실행 계획 용어
- **Table Scan**: 테이블 전체 읽기 (가장 느림)
- **Index Scan**: 인덱스 전체 읽기 (중간)
- **Index Seek**: 인덱스로 특정 행 찾기 (가장 빠름)
- **Nested Loop**: 중첩 루프 JOIN
- **Hash Match**: 해시 JOIN
- **Merge Join**: 병합 JOIN

---

## 다음 단계

1. ✅ MSSQL 연결 설정
2. ✅ 느린 쿼리 분석
3. ✅ 인덱스 추가 권장사항 확인
4. 🔄 인덱스 추가 (DBA 승인 필요)
5. 🔄 효과 측정
6. 🔄 정기 모니터링 (주 1회)

질문이나 문제가 있으면 알려주세요!
