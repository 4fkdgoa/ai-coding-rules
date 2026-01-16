# SDMS 성능 분석 최종 리포트

생성일: 2026-01-15
테스트 버전: v2 (로그인 세션 유지)

---

## 성능 분석 도구 설치 완료

### 설치된 도구
- **Playwright** - 브라우저 자동화 및 성능 측정
- **PerformanceAnalyzer** - 커스텀 성능 분석 모듈
- **ReportGenerator** - HTML 리포트 자동 생성

### 실행 방법
```bash
cd performance-test

# 기본 실행 (헤드리스)
npx playwright test sdms-performance-v2.spec.js

# 브라우저 보면서 실행
npx playwright test sdms-performance-v2.spec.js --headed

# HTML 리포트 열기
start reports/performance-report-*.html
```

---

## 측정된 페이지 성능

### 1. 대시보드 (/sfa/mainManager.jsp)

#### 페이지 로딩
- **TTFB**: 11ms (매우 빠름)
- **전체 로드 시간**: 1,468ms (1.5초)
- **DOM 로드**: 3ms

#### API 호출
- **총 API 호출**: 3개
- **평균 응답 시간**: 23ms
- **최대 응답 시간**: 27ms

**API 상세:**
1. `getBoardList.json` - 18ms (공지사항)
2. `showroom/list.json` (1) - 27ms (쇼룸 목록, 10KB)
3. `showroom/list.json` (2) - 24ms (쇼룸 목록, 10KB)

#### 리소스
- **총 요청**: 118개
- **JavaScript**: 68개, 4.6MB
- **CSS**: 28개, 1.3MB
- **폰트**: 5개, 1.6MB
- **XHR**: 14개, 25KB

---

### 2. 입고관리 (/sfa/in/cm/incm01.crm)

#### 페이지 로딩
- **TTFB**: 16ms (매우 빠름)
- **전체 로드 시간**: 1,513ms (1.5초)
- **DOM 로드**: 1ms

#### API 호출
- **총 API 호출**: 1개
- **응답 시간**: 61ms

**API 상세:**
1. `incm01.crm` - 61ms (HTML 페이지, 43KB)

#### 리소스
- **총 요청**: 97개
- **JavaScript**: 61개, 3.8MB
- **CSS**: 27개, 1.3MB
- **폰트**: 5개, 1.6MB

---

### 3. 엑셀 관리 (/sfa/sm/rm/smrm01.do)

#### 페이지 로딩
- **TTFB**: 30ms (빠름)
- **전체 로드 시간**: 2,792ms (2.8초)
- **DOM 로드**: 1ms

#### API 호출
- **총 API 호출**: 3개
- **평균 응답 시간**: 403ms
- **최대 응답 시간**: 1,092ms (1.1초)

**API 상세:**
1. `smrm01.do` - 90ms (HTML 페이지, 98KB)
2. `auto/class/list.json` - 26ms (차량 분류, 6.7KB)
3. `stock/stockList.json` - **1,092ms** (재고 목록, 167KB) ⚠️

#### 리소스
- **총 요청**: 103개
- **JavaScript**: 65개, 3.9MB
- **CSS**: 27개, 1.3MB
- **폰트**: 5개, 1.6MB

---

## 주요 발견사항

### ✅ 강점

1. **서버 응답 속도 우수**
   - TTFB 10~30ms (목표: <100ms)
   - 대부분의 API 응답 20~60ms 이내

2. **효율적인 DOM 처리**
   - DOM 로딩 1~3ms
   - 페이지 렌더링 빠름

3. **적절한 리소스 관리**
   - 캐싱 활용으로 불필요한 요청 최소화
   - CDN 사용 (jQuery, 폰트 등)

### ⚠️ 개선 필요사항

#### 1. 재고 목록 API 성능 저하 (높은 우선순위)
**문제:**
- `/sfa/stock/stockList.json` API 응답 시간: **1,092ms** (1.1초)
- 응답 크기: 167KB

**원인 추정:**
- 대량 데이터 조회 (DB 쿼리 최적화 부족)
- 인덱스 미사용
- 불필요한 컬럼 조회
- 페이징 미적용

**권장 해결책:**
```sql
-- 1. 쿼리 실행 계획 확인
EXPLAIN PLAN FOR
SELECT * FROM STOCK WHERE ...;

-- 2. 필요한 컬럼만 조회
SELECT stock_id, model, price FROM STOCK;  -- 167KB → ~50KB

-- 3. 페이징 적용
SELECT * FROM (
  SELECT a.*, ROWNUM rnum FROM (
    SELECT * FROM STOCK ORDER BY created_at DESC
  ) a WHERE ROWNUM <= 100
) WHERE rnum >= 1;

-- 4. 인덱스 추가
CREATE INDEX idx_stock_created ON STOCK(created_at);
```

**기대 효과:**
- 1,092ms → **100~200ms** (약 80% 개선)

---

#### 2. JavaScript 번들 크기 최적화 (중간 우선순위)

**문제:**
- 대시보드: 68개 스크립트, 4.6MB
- 입고관리: 61개 스크립트, 3.8MB
- 엑셀 관리: 65개 스크립트, 3.9MB

**권장 해결책:**
1. **번들링 및 압축**
   - Webpack/Rollup으로 파일 통합
   - gzip/brotli 압축 (4.6MB → ~1MB)

2. **코드 스플리팅**
   - 페이지별 필요한 스크립트만 로드
   - Dynamic import 사용

3. **트리 쉐이킹**
   - 사용하지 않는 코드 제거

**기대 효과:**
- 페이지 로드 시간: 1.5초 → **0.5~0.8초**

---

#### 3. 폰트 최적화 (낮은 우선순위)

**문제:**
- 폰트 크기: 1.6MB (5개 파일)

**권장 해결책:**
1. WOFF2 포맷 사용 (경량화)
2. Subset 폰트 (한글 2,350자만)
3. `font-display: swap` 적용

**기대 효과:**
- 1.6MB → **300~500KB**

---

## DB 성능 측정 방법

현재 측정된 것은 **HTTP 응답 시간 (서버 + DB + 네트워크)**입니다.
순수 DB 쿼리 시간을 측정하려면:

### 방법 1: Server-Timing 헤더 추가 (권장)

**백엔드 코드 수정 (Java/Spring 예시):**
```java
@GetMapping("/stock/stockList.json")
public ResponseEntity<List<Stock>> getStockList() {
    long dbStart = System.currentTimeMillis();
    List<Stock> stocks = stockService.findAll();
    long dbTime = System.currentTimeMillis() - dbStart;

    HttpHeaders headers = new HttpHeaders();
    headers.add("Server-Timing", "db;dur=" + dbTime);

    return ResponseEntity.ok()
        .headers(headers)
        .body(stocks);
}
```

**Playwright에서 확인:**
```javascript
const serverTiming = response.headers()['server-timing'];
// "db;dur=850" → DB 쿼리 850ms
```

### 방법 2: Oracle AWR/ASH 리포트

```sql
-- SQL 실행 통계 확인
SELECT sql_id, executions, elapsed_time/executions/1000000 as avg_sec
FROM v$sql
WHERE sql_text LIKE '%STOCK%'
ORDER BY elapsed_time DESC;
```

### 방법 3: 애플리케이션 로그 분석

Spring Boot + JPA 로깅:
```properties
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE
```

---

## 다음 단계

### 즉시 실행 (1주일 이내)
- [ ] `/stock/stockList.json` API 쿼리 최적화
- [ ] DB 실행 계획 분석 (EXPLAIN PLAN)
- [ ] 인덱스 추가

### 단기 목표 (1개월 이내)
- [ ] Server-Timing 헤더 추가 (DB 시간 측정)
- [ ] JavaScript 번들링 (Webpack 도입)
- [ ] gzip 압축 활성화 (웹서버 설정)

### 중기 목표 (3개월 이내)
- [ ] 코드 스플리팅 (페이지별 번들)
- [ ] 폰트 최적화 (Subset, WOFF2)
- [ ] 정기 성능 모니터링 (주 1회 자동 실행)

### 장기 목표 (6개월 이내)
- [ ] APM 도구 도입 (Pinpoint, New Relic)
- [ ] CDN 적용 (정적 리소스)
- [ ] HTTP/2 또는 HTTP/3 적용

---

## 성능 목표

### 현재 vs 목표

| 메트릭 | 현재 | 목표 | 상태 |
|--------|------|------|------|
| 재고 API 응답 | 1,092ms | 200ms | ⚠️ 개선 필요 |
| 페이지 로드 (대시보드) | 1,468ms | 1,000ms | ⚠️ 개선 필요 |
| 페이지 로드 (입고관리) | 1,513ms | 1,000ms | ⚠️ 개선 필요 |
| 페이지 로드 (엑셀 관리) | 2,792ms | 1,500ms | ⚠️ 개선 필요 |
| TTFB | 11~30ms | <100ms | ✅ 목표 달성 |
| API 응답 (평균) | 23~403ms | <300ms | ⚠️ 일부 개선 |

---

## 리포트 파일

- **HTML 리포트**: `reports/performance-report-*.html` (브라우저에서 열기)
- **JSON 데이터**: `reports/performance-data-*.json` (프로그래밍 분석용)
- **스크린샷**: `reports/screenshots/*.png` (페이지 확인용)

---

## 문의 및 추가 분석

추가로 필요한 분석:
- 특정 사용자 시나리오 (엑셀 다운로드, 대량 데이터 조회 등)
- 동시 사용자 부하 테스트
- 모바일 성능 측정
- 다른 브라우저 (Firefox, Safari) 테스트

위 내용이 필요하시면 요청해주세요!
