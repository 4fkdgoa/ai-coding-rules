# DB 성능 분석 가이드 (소스 코드 없이)

쿼리를 모르더라도 프론트엔드에서 DB 성능을 분석하는 방법입니다.

---

## 방법 1: 브라우저 개발자 도구 (가장 쉬움)

### 단계별 가이드

#### 1. 브라우저에서 개발자 도구 열기
```
F12 또는 우클릭 > 검사
```

#### 2. Network 탭으로 이동
- Chrome/Edge: F12 → Network 탭
- 필터에서 "Fetch/XHR" 선택

#### 3. 페이지 새로고침 또는 액션 수행
- 재고 조회 버튼 클릭
- 필터 변경
- 페이지 이동

#### 4. API 요청 찾기
```
예시:
- stockList.json
- getBoardList.json
- list.json
```

#### 5. 각 API 클릭 후 정보 확인

**Headers 탭:**
```
Request URL: https://sdms.sclmotors.co.kr/sfa/stock/stockList.json
Request Method: POST
Status Code: 200 OK
```

**Timing 탭:** (가장 중요!)
```
Queueing: 0.5ms        - 브라우저 대기열
DNS Lookup: 0ms        - DNS 조회 (캐시됨)
Initial connection: 0ms - TCP 연결 (캐시됨)
SSL: 0ms               - SSL 핸드셰이크 (캐시됨)
Request sent: 0.2ms    - 요청 전송
Waiting (TTFB): 1,050ms - ⭐ 서버 응답 대기 (DB 쿼리 시간 포함!)
Content Download: 42ms  - 응답 다운로드
```

**Response 탭:**
```json
{
  "list": [
    { "stock_id": 1, "model": "...", ... },
    { "stock_id": 2, "model": "...", ... },
    ...
  ],
  "totalCount": 1234
}
```

#### 6. DB 성능 추정

**공식:**
```
DB 쿼리 시간 ≈ TTFB - (네트워크 지연 + 애플리케이션 처리)
```

**예시 계산:**
```
TTFB = 1,050ms
네트워크 지연 = ~10ms (같은 IDC 또는 빠른 네트워크)
애플리케이션 처리 = ~40ms (JSON 직렬화 등)

추정 DB 쿼리 시간 = 1,050 - 10 - 40 = 1,000ms
```

**결론:**
- DB 쿼리가 약 1초 걸림 → **느림**
- 최적화 필요!

---

## 방법 2: Playwright로 자동화

위 분석을 자동화하는 스크립트:

```javascript
const { chromium } = require('@playwright/test');

const page = await browser.newPage();

// 응답 시간 측정
page.on('response', async (response) => {
    if (response.url().includes('/stock/stockList.json')) {
        const timing = response.request().timing();

        console.log('API:', response.url());
        console.log('TTFB:', timing.responseStart, 'ms');
        console.log('응답 완료:', timing.responseEnd, 'ms');
        console.log('상태:', response.status());

        const body = await response.body();
        const data = JSON.parse(body.toString());

        console.log('레코드 수:', data.list?.length);
        console.log('응답 크기:', (body.length / 1024).toFixed(2), 'KB');

        // DB 쿼리 시간 추정
        const estimatedDBTime = timing.responseEnd - 50;
        console.log('추정 DB 쿼리 시간:', estimatedDBTime, 'ms');
    }
});
```

---

## 방법 3: Server-Timing 헤더 (백엔드 수정 필요)

만약 백엔드 소스 코드에 접근할 수 있다면, 이 방법이 **가장 정확**합니다.

### Java (Spring Boot) 예시

```java
@RestController
public class StockController {

    @PostMapping("/stock/stockList.json")
    public ResponseEntity<StockResponse> getStockList(@RequestBody StockRequest request) {
        // DB 쿼리 시작
        long dbStart = System.currentTimeMillis();

        List<Stock> stocks = stockRepository.findAll();  // 실제 DB 쿼리

        long dbEnd = System.currentTimeMillis();
        long dbTime = dbEnd - dbStart;

        // JSON 직렬화 시작
        long serializeStart = System.currentTimeMillis();

        StockResponse response = new StockResponse(stocks);

        long serializeEnd = System.currentTimeMillis();
        long serializeTime = serializeEnd - serializeStart;

        // Server-Timing 헤더 추가 (브라우저 개발자 도구에 표시됨)
        HttpHeaders headers = new HttpHeaders();
        headers.add("Server-Timing",
            String.format("db;dur=%d, serialize;dur=%d, total;dur=%d",
                dbTime, serializeTime, dbTime + serializeTime)
        );

        return ResponseEntity.ok()
            .headers(headers)
            .body(response);
    }
}
```

### 브라우저에서 확인

개발자 도구 → Network → API 선택 → Timing 탭:

```
Server Timing:
  db: 1,050ms           ⭐ 실제 DB 쿼리 시간!
  serialize: 40ms       - JSON 직렬화
  total: 1,090ms        - 총 서버 처리 시간
```

이렇게 하면 **정확한 DB 쿼리 시간**을 알 수 있습니다!

---

## 방법 4: Oracle DB 직접 분석 (DB 접근 권한 필요)

### 느린 쿼리 찾기

```sql
-- 실행 시간이 긴 SQL 찾기
SELECT
    sql_id,
    sql_text,
    executions,
    elapsed_time / 1000000 as elapsed_sec,
    elapsed_time / executions / 1000000 as avg_elapsed_sec,
    cpu_time / 1000000 as cpu_sec,
    disk_reads,
    buffer_gets
FROM v$sql
WHERE elapsed_time > 1000000  -- 1초 이상
ORDER BY elapsed_time DESC
FETCH FIRST 20 ROWS ONLY;
```

### 특정 테이블 관련 쿼리

```sql
-- STOCK 테이블 관련 쿼리
SELECT
    sql_id,
    sql_text,
    elapsed_time / executions / 1000000 as avg_sec
FROM v$sql
WHERE UPPER(sql_text) LIKE '%STOCK%'
  AND sql_text NOT LIKE '%V$SQL%'
ORDER BY elapsed_time DESC;
```

### 실행 계획 확인

```sql
-- SQL_ID로 실행 계획 확인
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('your_sql_id'));
```

**Full Table Scan이 보이면:**
```
TABLE ACCESS FULL | STOCK | 1234K rows  ← 인덱스 없이 전체 스캔
```

**인덱스 사용하면:**
```
INDEX RANGE SCAN  | IDX_STOCK_DATE | 100 rows  ← 인덱스로 필터링
TABLE ACCESS BY INDEX ROWID | STOCK | 100 rows
```

---

## 실전 분석 예시

### 현재 측정 결과 (Playwright)
```
/stock/stockList.json
  - 응답 시간: 1,092ms
  - 응답 크기: 167KB
  - 레코드 수: ?개 (추정 500~1000개)
```

### 추정 분석

#### 1. DB 쿼리 시간
```
TTFB (1,092ms) - 네트워크 (10ms) - 처리 (40ms) = ~1,040ms
```
**결론: DB 쿼리가 1초 걸림**

#### 2. 원인 추정
- 167KB → 약 500~1000개 레코드
- 레코드당 ~1~2ms → **인덱스 미사용 또는 JOIN이 많음**

#### 3. 개선 방안

**Case 1: Full Table Scan인 경우**
```sql
-- 현재 (추정)
SELECT * FROM STOCK WHERE created_at > SYSDATE - 30;
-- 실행 시간: 1,040ms (인덱스 없음)

-- 개선: 인덱스 추가
CREATE INDEX idx_stock_created ON STOCK(created_at);
-- 실행 시간: 50ms (95% 개선)
```

**Case 2: 불필요한 컬럼 조회**
```sql
-- 현재 (추정)
SELECT * FROM STOCK;  -- 50개 컬럼, 167KB
-- 실행 시간: 1,040ms

-- 개선: 필요한 컬럼만
SELECT stock_id, model, price, status FROM STOCK;  -- 4개 컬럼, 40KB
-- 실행 시간: 300ms (70% 개선)
```

**Case 3: 페이징 미적용**
```sql
-- 현재 (추정)
SELECT * FROM STOCK;  -- 1000개 레코드
-- 실행 시간: 1,040ms

-- 개선: 페이징
SELECT * FROM (
  SELECT a.*, ROWNUM rnum FROM (
    SELECT * FROM STOCK ORDER BY created_at DESC
  ) a WHERE ROWNUM <= 100
) WHERE rnum >= 1;  -- 100개만
-- 실행 시간: 80ms (92% 개선)
```

---

## 요약

### 소스 코드 없이 할 수 있는 분석

1. **브라우저 개발자 도구** (5분)
   - Network 탭 → Timing 확인
   - TTFB = 서버 + DB + 네트워크

2. **Playwright 자동화** (10분)
   - response.request().timing()
   - 여러 API 자동 측정

3. **응답 데이터 분석** (15분)
   - 레코드 수, 필드 수, 크기
   - 불필요한 데이터 확인

### 백엔드 접근 가능하면

4. **Server-Timing 헤더** (30분)
   - 정확한 DB 쿼리 시간
   - 브라우저에서 바로 확인

5. **Oracle DB 직접 조회** (1시간)
   - V$SQL 뷰로 느린 쿼리 찾기
   - EXPLAIN PLAN으로 실행 계획 확인

---

## 다음 단계

1. **브라우저 개발자 도구로 확인** (지금 바로!)
   - https://sdms.sclmotors.co.kr 접속
   - F12 → Network → Fetch/XHR
   - 재고 조회 클릭
   - stockList.json의 Timing 탭 확인

2. **스크린샷 공유**
   - Timing 탭 스크린샷을 보내주시면 정확한 분석 가능

3. **백엔드 코드 확인 (선택)**
   - `StockController.java` 또는 유사한 파일
   - SQL 쿼리 확인

필요하시면 실제 페이지에서 함께 분석해드릴 수 있습니다!
