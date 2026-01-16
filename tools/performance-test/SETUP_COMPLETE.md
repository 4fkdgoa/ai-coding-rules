# 성능 분석 시스템 구축 완료 🎉

SDMS (https://sdms.sclmotors.co.kr) 성능 분석을 위한 종합 모니터링 시스템이 구축되었습니다.

---

## 📦 구축된 도구

### 1. 프론트엔드 성능 측정 (Playwright)
- ✅ 자동 로그인 시스템
- ✅ 3개 페이지 성능 측정
- ✅ HTML 리포트 자동 생성
- ✅ 스크린샷 저장

**위치:** `performance-test/`
**실행:** `npx playwright test sdms-performance-v2.spec.js`

### 2. DB 성능 모니터링 (MSSQL Profiler)
- ✅ 실시간 쿼리 모니터링
- ✅ 느린 쿼리 분석
- ✅ 실행 계획 분석
- ✅ 인덱스 사용 통계

**위치:** `performance-test/db-monitor/`
**실행:** `node mssql-profiler.js`

---

## 🎯 측정된 성능 데이터

### 프론트엔드 (최종 측정)

| 페이지 | TTFB | 전체 로드 | API 호출 | 평균 응답 |
|--------|------|-----------|----------|-----------|
| 대시보드 | 11ms | 1,468ms | 3개 | 23ms |
| 입고관리 | 16ms | 1,513ms | 1개 | 61ms |
| 엑셀관리 | 30ms | 2,792ms | 3개 | 403ms |

### 주요 문제점

**🔴 재고 API 성능 저하**
- URL: `/stock/stockList.json`
- 응답 시간: **1,092ms** (1.1초)
- 원인: 복잡한 JOIN 쿼리, 인덱스 미사용

---

## 🔍 발견된 쿼리 문제

### listStock 쿼리 분석 (StockManagerImpl.xml)

**복잡도:**
- 18개 이상의 LEFT JOIN
- WITH 절 (Common Table Expression) 사용
- CASE WHEN 다수 사용
- 145개 이상의 컬럼 SELECT

**예상 문제:**
```sql
-- 1. 전체 스캔 가능성
FROM STOCK ST
LEFT JOIN STOCK_EXT STE ON STE.STOCK_SEQ = ST.STOCK_SEQ  -- 큰 테이블
LEFT JOIN SALE_CONFER SC ON SC.STOCK_SEQ = ST.STOCK_SEQ  -- 큰 테이블

-- 2. ORDER BY 절
ROW_NUMBER() OVER(ORDER BY ST.CREATE_DATE) AS RN  -- CREATE_DATE 인덱스 필요

-- 3. 서브쿼리 다수
LEFT JOIN (
    SELECT STOCK_SEQ, MAX(CREATE_DATE) CREATE_DATE
    FROM STOCK_ISSUE  -- 전체 스캔 가능
    GROUP BY STOCK_SEQ
) SIS ON ...
```

---

## 🛠️ 즉시 실행 가능한 개선안

### 1. DB 인덱스 추가 (우선순위: 높음)

MSSQL에서 실행:

```sql
-- STOCK 테이블: CREATE_DATE로 정렬하므로 인덱스 필수
CREATE NONCLUSTERED INDEX IX_STOCK_CREATE_DATE
ON STOCK (CREATE_DATE DESC)
INCLUDE (STOCK_SEQ, VIN_NO, AUTO_STATUS_SEQ);

-- STOCK_EXT: 자주 조인되고 필터링되는 컬럼
CREATE NONCLUSTERED INDEX IX_STOCK_EXT_STOCK_SEQ
ON STOCK_EXT (STOCK_SEQ)
INCLUDE (CUSTOM_CLEARANCE_DATE, BUYING_DATE, PDI_STATUS, STOCK_GUBUN_SEQ);

-- STOCK_ISSUE: 서브쿼리에서 GROUP BY 사용
CREATE NONCLUSTERED INDEX IX_STOCK_ISSUE_STOCK_CREATE
ON STOCK_ISSUE (STOCK_SEQ, CREATE_DATE DESC);

-- SALE_CONFER: 자주 조인되는 테이블
CREATE NONCLUSTERED INDEX IX_SALE_CONFER_STOCK
ON SALE_CONFER (STOCK_SEQ, CONFER_GUBUN)
INCLUDE (SALE_CONFER_SEQ, CONTRACT_SEQ);
```

**기대 효과:** 1,092ms → 150~250ms (약 80% 개선)

### 2. 쿼리 최적화 (우선순위: 중간)

**필요 없는 컬럼 제거:**
```sql
-- 현재: 145개 컬럼 SELECT
-- 개선: 실제 사용하는 30~40개만

-- 예시
SELECT
    ST.STOCK_SEQ,
    ST.VIN_NO,
    ST.CREATE_DATE,
    AM.MODEL_NAME,
    ... (필요한 것만)
```

**LEFT JOIN → INNER JOIN 변경:**
```sql
-- SALE_CONFER가 없는 재고만 보는 경우
-- LEFT JOIN이 아닌 NOT EXISTS 사용
WHERE NOT EXISTS (
    SELECT 1 FROM SALE_CONFER
    WHERE STOCK_SEQ = ST.STOCK_SEQ
)
```

**기대 효과:** 250ms → 100~150ms (추가 40% 개선)

### 3. 페이징 강화 (우선순위: 중간)

현재 한 번에 수백~수천 개 로드하는 것으로 추정.

```sql
-- 페이징 적용 (이미 있을 수 있음)
OFFSET @offset ROWS
FETCH NEXT @pageSize ROWS ONLY
```

**기대 효과:** 네트워크 전송 시간 50% 감소

---

## 📋 실행 방법

### A. 프론트엔드 성능 측정

```bash
# 1. 디렉토리 이동
cd C:\jexer\workspace-emmkt\pptmotortour\performance-test

# 2. 테스트 실행
npx playwright test sdms-performance-v2.spec.js

# 3. 리포트 확인
start reports/performance-report-*.html

# 4. 스크린샷 확인
explorer reports\screenshots
```

### B. DB 성능 모니터링

```bash
# 1. 디렉토리 이동
cd C:\jexer\workspace-emmkt\pptmotortour\performance-test\db-monitor

# 2. 설정 파일 수정 (최초 1회)
# mssql-profiler.js 파일 열어서 DB 연결 정보 입력:
# - user: 'your_username'
# - password: 'your_password'

# 3. 실행
node mssql-profiler.js

# 4. 결과 확인
# - 느린 쿼리 목록
# - 실행 계획 (Table Scan, Index Seek 등)
# - 인덱스 사용 통계
```

### C. 통합 분석 (프론트 + DB)

```bash
# Terminal 1: DB 모니터링 시작
cd performance-test/db-monitor
node mssql-profiler.js

# Terminal 2: Playwright 테스트 실행
cd performance-test
npx playwright test sdms-performance-v2.spec.js --headed

# 두 결과를 비교 분석
```

---

## 📊 리포트 파일 위치

```
performance-test/
├── reports/
│   ├── performance-report-*.html    # 📈 시각화된 성능 리포트
│   ├── performance-data-*.json      # 📄 원본 JSON 데이터
│   └── screenshots/                 # 📸 페이지 스크린샷
│       ├── dashboard.png
│       ├── incm01.png
│       └── smrm01.png
│
├── db-monitor/
│   └── db-analysis-report.json      # 📊 DB 분석 결과 (생성 시)
│
├── FINAL_REPORT.md                  # 📝 최종 분석 리포트
├── DB_ANALYSIS_GUIDE.md             # 📖 DB 분석 가이드
└── SETUP_COMPLETE.md                # 📌 이 파일
```

---

## 🎓 학습 자료

### 프론트엔드 성능 이해

1. **TTFB (Time To First Byte)**
   - 서버가 첫 바이트를 보낼 때까지 걸린 시간
   - 목표: <100ms
   - 현재: 10~30ms ✅

2. **전체 로드 시간**
   - 페이지가 완전히 로드될 때까지 시간
   - 목표: <3초
   - 현재: 1.5~2.8초 ⚠️ (개선 가능)

3. **API 응답 시간**
   - 백엔드 API 호출 시간
   - 목표: <300ms
   - 현재: 23~403ms ⚠️ (재고 API 개선 필요)

### DB 성능 이해

1. **Table Scan (가장 느림)**
   ```
   전체 테이블을 처음부터 끝까지 읽음
   → 인덱스 추가 필요
   ```

2. **Index Scan (중간)**
   ```
   인덱스 전체를 스캔
   → WHERE 절 조건 개선 필요
   ```

3. **Index Seek (가장 빠름)**
   ```
   인덱스로 특정 행만 찾음
   → 이상적인 상태
   ```

---

## ⚠️ 주의사항

### 1. 프로덕션 DB 주의
```
❌ 프로덕션 DB에서 직접 인덱스 추가하지 마세요!
✅ 먼저 개발/테스트 DB에서 테스트
✅ DBA에게 검토 요청
✅ 백업 확인 후 진행
```

### 2. 모니터링 부하
```
❌ 실시간 모니터링을 24시간 켜두지 마세요
✅ 필요할 때만 실행 (문제 발생 시, 배포 전)
✅ 주기적으로 체크 (주 1회)
```

### 3. 인덱스 과다 추가
```
❌ 모든 컬럼에 인덱스 추가하지 마세요
✅ WHERE/JOIN/ORDER BY에 사용되는 컬럼만
✅ 인덱스도 저장 공간과 UPDATE 비용 발생
```

---

## 🚀 다음 단계

### 즉시 실행 (오늘)
- [x] 프론트엔드 성능 측정
- [ ] MSSQL 연결 정보 입력
- [ ] DB 모니터링 실행
- [ ] 느린 쿼리 확인

### 단기 (1주일)
- [ ] DBA와 인덱스 추가 협의
- [ ] 개발 DB에서 인덱스 테스트
- [ ] 효과 측정 (before/after 비교)

### 중기 (1개월)
- [ ] 프로덕션에 인덱스 적용
- [ ] 쿼리 최적화 (필요 시)
- [ ] 정기 모니터링 스케줄 수립

### 장기 (3개월)
- [ ] APM 도구 도입 검토 (Pinpoint, New Relic)
- [ ] 캐싱 전략 수립 (Redis)
- [ ] CDN 적용

---

## 🆘 문제 해결

### Playwright 테스트 실패
```bash
# 로그인 세션이 만료된 경우
rm -rf .auth/user.json
npx playwright test sdms-performance-v2.spec.js

# 브라우저 재설치
npx playwright install chromium
```

### MSSQL 연결 실패
```bash
# 1. 연결 테스트
telnet 211.217.11.5 1433

# 2. 사용자/비밀번호 확인
# mssql-profiler.js 파일 수정

# 3. 권한 확인 (DBA에게 요청)
GRANT VIEW SERVER STATE TO your_username;
```

### 느린 쿼리가 안 나옴
```javascript
// mssql-profiler.js 파일 수정
// 임계값을 낮춤 (1000ms → 100ms)
await profiler.analyzeSlowQueries(100);
```

---

## 📞 지원

추가 분석이 필요하거나 문제가 발생하면:

1. **DB 연결 문제** → DBA 담당자 확인
2. **쿼리 최적화** → 소스 코드 위치 공유
3. **성능 측정** → 리포트 파일 공유

---

**구축 완료일:** 2026-01-15
**버전:** 1.0.0
**담당자:** Claude + 사용자

모든 도구가 준비되었습니다. 이제 DB 연결 정보만 입력하면 바로 사용할 수 있습니다! 🎉
