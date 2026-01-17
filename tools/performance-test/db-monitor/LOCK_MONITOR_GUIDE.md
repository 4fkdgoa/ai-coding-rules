# Lock 상세 모니터링 가이드

**핵심 질문**: "락 걸리는거 체크한다던가?"
**답변**: 예! Lock 타입, 테이블, 대기 시간 모두 감지합니다!

---

## 📌 개요

기존 방식: **Blocking(차단) 세션만** 감지
개선된 방식: **Lock 상세 정보** 모두 감지

### Lock 모니터링 항목

1. **Lock 충돌 (Blocking)**
   - 차단하는 세션 (Blocker)
   - 차단당하는 세션 (Blocked)
   - 대기 시간

2. **Lock 상세 정보**
   - Lock 타입 (S, X, U, IS, IX, SIX 등)
   - 테이블/인덱스 레벨
   - 호스트, 프로그램 정보

3. **Lock 통계**
   - Lock 대기 시간 누적
   - 테이블별 Lock 횟수
   - Lock 타입별 분포

4. **데드락 감지**
   - 교착 상태 발생 즉시 알림
   - 데드락 XML 분석

---

## 🔒 Lock 타입 설명

| Lock 모드 | 이름 | 설명 | 발생 상황 |
|-----------|------|------|-----------|
| **S** | Shared | 읽기 락 | SELECT |
| **X** | Exclusive | 쓰기 락 (독점) | INSERT, UPDATE, DELETE |
| **U** | Update | 업데이트 대기 | UPDATE (X로 전환 대기) |
| **IS** | Intent Shared | 읽기 의도 | SELECT (테이블 레벨) |
| **IX** | Intent Exclusive | 쓰기 의도 | UPDATE (테이블 레벨) |
| **SIX** | Shared Intent Exclusive | 읽기 + 쓰기 의도 | SELECT + UPDATE 혼합 |
| **Sch-S** | Schema Stability | 스키마 안정 | 일반 쿼리 |
| **Sch-M** | Schema Modification | 스키마 수정 | ALTER TABLE |

### Lock 충돌 매트릭스

|     | S | X | U | IS | IX | SIX |
|-----|---|---|---|----|----|-----|
| **S**   | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **X**   | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **U**   | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **IS**  | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **IX**  | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **SIX** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

✅ = 호환 (동시 가능)
❌ = 충돌 (대기 발생)

---

## 🚀 빠른 시작

### 기본 실행

Lock 모니터링은 기본적으로 활성화되어 있습니다:

```bash
npm run monitor
```

출력:
```
⏰ 16:30:15 - 체크 시작...
  🔒 Lock 충돌 감지: 세션 52 → 48 (5,123ms)
      리소스: PAGE (STOCK 테이블)
      Lock 타입: X (Exclusive) ← S (Shared)
  📝 로그 저장: db-alert-2026-01-16.json
  📧 이메일 발송: LOCK CONFLICT - 세션 52 차단
  ✓ 체크 완료
```

### Lock만 집중 모니터링

```bash
npm run monitor:lock
```

Lock 충돌만 체크 (다른 감지 비활성화):
- 느린 쿼리: OFF
- 높은 CPU: OFF
- **Lock 충돌**: ON
- 데드락: ON

---

## ⚙️ 설정

### config/alert-config.json

```json
{
  "lockMonitoring": {
    "enabled": true,
    "checkInterval": 10,
    "thresholds": {
      "waitTimeMs": 1000,
      "criticalWaitTimeMs": 5000
    },
    "watchTables": [
      "STOCK",
      "STOCK_EXT",
      "SALE_CONFER",
      "CUSTOMER"
    ],
    "detectDeadlocks": true,
    "logLockStats": true
  }
}
```

| 필드 | 설명 | 기본값 |
|------|------|--------|
| `enabled` | Lock 모니터링 활성화 | `true` |
| `checkInterval` | 체크 간격 (초) | `10` |
| `waitTimeMs` | Warning 임계값 | `1000` (1초) |
| `criticalWaitTimeMs` | Critical 임계값 | `5000` (5초) |
| `watchTables` | 감시할 테이블 목록 | `[]` (전체) |
| `detectDeadlocks` | 데드락 감지 | `true` |
| `logLockStats` | 통계 로그 저장 | `true` |

---

## 📊 실행 예시

### Lock 충돌 감지

```
============================================================
🚨 Lock 충돌 감지: 1건
============================================================

[차단 정보]
  차단된 세션: 48 (WEB-SERVER-01 - SDMS Web Application)
  차단 중인 세션: 52 (DB-SERVER - SQL Management Studio)
  대기 시간: 5,123ms
  대기 유형: LCK_M_S

[Lock 상세]
  리소스 타입: PAGE
  테이블: STOCK
  차단된 Lock 모드: S (Shared - 읽기)
  차단 중인 Lock 모드: X (Exclusive - 쓰기)

[차단된 쿼리]
SELECT ST.STOCK_SEQ, ST.VIN_NO, ST.CREATE_DATE
FROM STOCK ST
WHERE ST.STOCK_GUBUN_SEQ = 1

[차단 중인 쿼리]
UPDATE STOCK
SET STOCK_STATUS = 'SOLD'
WHERE STOCK_SEQ = 12345
```

### Lock 통계

```bash
npm run monitor:stats
```

출력:
```
================================================================================
🔒 Lock 대기 통계
================================================================================
Wait Type                      Tasks     Total (ms)        Avg (ms)
--------------------------------------------------------------------------------
LCK_M_S                           47         23,456             499
LCK_M_X                           12         45,678           3,806
LCK_M_U                            5          8,901           1,780
LCK_M_IS                         234          1,234               5
================================================================================
```

### 테이블별 Lock 분포

```bash
npm run monitor:locks -- --table STOCK
```

출력:
```
================================================================================
🔒 STOCK 테이블 Lock 분석
================================================================================
Lock Mode                    Description                     Count
--------------------------------------------------------------------------------
IS                          Intent Shared (읽기 의도)          234
IX                          Intent Exclusive (쓰기 의도)        67
S                           Shared (읽기)                       89
X                           Exclusive (쓰기)                    12
================================================================================
```

---

## 📧 이메일 알림

### Lock 충돌 알림

**제목**: `🚨 [CRITICAL] Lock Conflict - Session 52 blocking 48`

**내용**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
알림 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
발생 시각: 2026-01-16 16:30:15
알림 레벨: CRITICAL
알림 유형: lock_conflict
데이터베이스: AutoCRM_Samchully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
차단 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
차단된 세션: 48
차단 중인 세션: 52
대기 시간: 5,123 ms

차단된 프로그램: SDMS Web Application
차단 중인 프로그램: SQL Management Studio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lock 상세
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
리소스 타입: PAGE
테이블: STOCK
차단된 Lock 모드: S (Shared - 읽기)
차단 중인 Lock 모드: X (Exclusive - 쓰기)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
차단된 쿼리
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT ST.STOCK_SEQ, ST.VIN_NO, ST.CREATE_DATE
FROM STOCK ST
WHERE ST.STOCK_GUBUN_SEQ = 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
차단 중인 쿼리
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPDATE STOCK
SET STOCK_STATUS = 'SOLD'
WHERE STOCK_SEQ = 12345

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
권장 조치
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 트랜잭션 길이를 단축하세요
2. 잠금 순서를 일관되게 유지하세요
3. READ COMMITTED SNAPSHOT 사용 검토
4. 필요한 경우 WITH (NOLOCK) 힌트 사용
```

---

## 🔬 고급 사용법

### 1. 특정 테이블만 감시

```json
{
  "lockMonitoring": {
    "watchTables": ["STOCK", "CUSTOMER"]
  }
}
```

STOCK과 CUSTOMER 테이블의 Lock만 알림.

### 2. 데드락 히스토리 조회

```javascript
const LockMonitor = require('./lock-monitor');

const lockMonitor = new LockMonitor(dbPool);

// 최근 데드락 조회
const deadlocks = await lockMonitor.detectDeadlocks();

for (const deadlock of deadlocks) {
    console.log(`
데드락 ID: ${deadlock.deadlockId}
발생 시각: ${deadlock.timestamp}
데이터베이스: ${deadlock.databaseId}
    `);
}
```

### 3. Lock 체인 추적

복잡한 차단 관계 추적:

```
세션 A → 세션 B → 세션 C → 세션 D
(대기)    (차단)    (차단)    (차단)
```

```javascript
const conflicts = await lockMonitor.detectLockConflicts();

// 차단 체인 구성
const chains = buildLockChain(conflicts);

for (const chain of chains) {
    console.log(`차단 체인: ${chain.join(' → ')}`);
}
```

### 4. Lock 에스컬레이션 감지

Row Lock → Page Lock → Table Lock 전환 감지:

```javascript
// Lock 에스컬레이션 임계값
{
  "lockMonitoring": {
    "escalationThreshold": {
      "rowLocks": 5000,    // 5000개 이상 → Page Lock
      "pageLocks": 1000    // 1000개 이상 → Table Lock
    }
  }
}
```

---

## 🐛 문제 해결

### 1. Lock 정보 조회 실패

**증상**:
```
Error: SELECT permission denied on sys.dm_tran_locks
```

**원인**: 권한 부족

**해결**:
```sql
GRANT VIEW SERVER STATE TO monitor_user;
GRANT VIEW DATABASE STATE TO monitor_user;
```

### 2. 데드락 감지 안됨

**증상**:
데드락이 발생했는데 알림이 안 옴

**원인**: Extended Events 비활성화

**해결**:
```sql
-- system_health 세션 확인
SELECT *
FROM sys.dm_xe_sessions
WHERE name = 'system_health';

-- 비활성화되어 있으면 활성화
ALTER EVENT SESSION system_health ON SERVER STATE = START;
```

### 3. Lock 통계가 비어있음

**증상**:
`getLockWaitStats()` 결과가 빈 배열

**원인**: Lock 대기가 한 번도 발생하지 않음 (정상)

**해결**:
- 운영 환경에서는 정상적으로 통계 수집됨
- 개발 환경에서는 Lock 충돌이 적어 통계가 없을 수 있음

---

## 📚 Lock 최적화 가이드

### 1. Lock 경합 줄이기

**Bad**:
```sql
BEGIN TRANSACTION

-- 1. 긴 작업 (Lock 유지 시간 길음)
SELECT * FROM STOCK WHERE ...  -- 10,000 rows
UPDATE STOCK SET ... WHERE ...

-- 2. 외부 API 호출 (Lock 유지 중)
WAITFOR DELAY '00:00:05'

COMMIT
```

**Good**:
```sql
-- 1. 트랜잭션 밖에서 먼저 조회
SELECT * FROM STOCK WHERE ...

-- 2. 트랜잭션 짧게 유지
BEGIN TRANSACTION
UPDATE STOCK SET ... WHERE STOCK_SEQ = @stockSeq
COMMIT

-- 3. 외부 API 호출은 트랜잭션 밖에서
```

### 2. Lock 순서 일관성

**Bad** (데드락 발생 가능):
```sql
-- 세션 A
UPDATE STOCK SET ... WHERE STOCK_SEQ = 1
UPDATE CUSTOMER SET ... WHERE CUSTOMER_SEQ = 2

-- 세션 B
UPDATE CUSTOMER SET ... WHERE CUSTOMER_SEQ = 2  -- A 대기
UPDATE STOCK SET ... WHERE STOCK_SEQ = 1       -- 데드락!
```

**Good**:
```sql
-- 항상 같은 순서로 Lock 획득
-- 세션 A, B 모두:
UPDATE STOCK SET ... WHERE STOCK_SEQ = 1
UPDATE CUSTOMER SET ... WHERE CUSTOMER_SEQ = 2
```

### 3. Isolation Level 조정

```sql
-- 기본 (READ COMMITTED)
-- → Lock이 많음

-- Snapshot Isolation 사용
SET TRANSACTION ISOLATION LEVEL SNAPSHOT
-- → 읽기는 Lock 없음, 쓰기만 Lock
```

### 4. 힌트 사용 (주의!)

```sql
-- READ UNCOMMITTED (Dirty Read 허용)
SELECT * FROM STOCK WITH (NOLOCK)

-- READPAST (Lock 걸린 행 건너뛰기)
SELECT * FROM STOCK WITH (READPAST)

-- UPDLOCK (업데이트 예정 표시)
SELECT * FROM STOCK WITH (UPDLOCK) WHERE STOCK_SEQ = 1
```

⚠️ **주의**: 힌트는 데이터 일관성을 해칠 수 있으므로 신중히 사용!

---

## 🎯 실전 시나리오

### 시나리오 1: 재고 업데이트 충돌

**문제**: STOCK 테이블 업데이트 시 자주 Lock 충돌

**분석**:
```bash
npm run monitor:locks -- --table STOCK
```

결과:
```
X (Exclusive) Lock: 67건
평균 대기 시간: 3,806ms
```

**해결**:
1. 트랜잭션 범위 축소
2. Optimistic Locking 도입 (버전 컬럼)
3. Row-Level Lock 유지 (Page Lock 에스컬레이션 방지)

### 시나리오 2: 배치 작업 중 차단

**문제**: 야간 배치 작업이 온라인 트랜잭션 차단

**분석**:
```bash
npm run monitor -- --lock-only
```

결과:
```
[차단 중인 세션]
프로그램: Batch Job
Lock 모드: X (Exclusive)
대기 세션: 12개 (Web Application)
```

**해결**:
1. 배치 작업을 더 작은 단위로 분할
2. TABLOCK 대신 ROWLOCK 힌트 사용
3. 온라인 트랜잭션 우선순위 상향 조정

### 시나리오 3: 데드락 빈발

**문제**: 주문-재고 동시 업데이트 시 데드락

**분석**:
```javascript
const deadlocks = await lockMonitor.detectDeadlocks();
// 데드락 XML 분석으로 원인 파악
```

**해결**:
1. Lock 순서 통일 (항상 STOCK → ORDER)
2. Snapshot Isolation 사용
3. 재시도 로직 추가

---

**다음 문서**: [README.md](README.md) - 메인 가이드로 돌아가기
