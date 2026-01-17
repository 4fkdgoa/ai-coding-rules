# AI 모드 가이드

**AI를 활용한 지능형 쿼리 분석 및 최적화 제안**

---

## 📌 개요

기본 모드는 **AI 없이** 문자열 매칭만 사용합니다.
AI 모드를 활성화하면 훨씬 강력한 분석 기능을 사용할 수 있습니다.

| 기능 | 비AI 모드 | AI 모드 |
|------|----------|---------|
| **쿼리 매칭** | 문자열 비교 | 의미론적 유사도 |
| **`${}` 처리** | 제한적 | 자동 추론 ✅ |
| **원인 분석** | 없음 | 실행 계획 + AI 분석 ✅ |
| **최적화 제안** | 없음 | 구체적 SQL 제안 ✅ |
| **비용** | $0 | $0.75/월 (ai-assisted) |

---

## 🚀 빠른 시작

### 1. API 키 설정

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. 설정 파일 수정

`config/alert-config.json`:

```json
{
  "ai": {
    "mode": "ai-assisted",
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-3-haiku-20240307",

    "features": {
      "querySimilarity": true,
      "rootCauseAnalysis": true,
      "optimizationSuggestion": true
    },

    "triggers": {
      "onLevel": ["critical"],
      "minExecutionTime": 3000,
      "maxAiCallsPerHour": 10
    }
  }
}
```

### 3. 실행

```bash
npm run monitor
```

---

## 🎯 AI가 해결하는 문제

### 문제 1: `${}` 동적 쿼리 매칭

**Before (문자열 매칭)**:
```sql
-- XML
SELECT * FROM ${tableName} WHERE ID = #{id}

-- 실제 실행
SELECT * FROM STOCK_2024 WHERE ID = 12345

-- ❌ 매칭 실패! (STOCK_2024 ≠ ?)
```

**After (AI 유사도)**:
```javascript
const similarity = await ai.calculateQuerySimilarity(xml, actual);
// → 0.95 (✅ 동일 쿼리로 판단)
```

---

### 문제 2: 원인 분석 + 최적화 제안

**Before**:
```
❌ 느린 쿼리 감지: 3,456ms
   (단순 알림만)
```

**After**:
```
🤖 AI 분석 결과:

원인:
STOCK_ISSUE 테이블 Full Scan (1,234,567행)

해결책:
1. [HIGH] Full-Text Index 추가 → 95% 개선 예상
   SQL: CREATE FULLTEXT INDEX ON STOCK_ISSUE(ISSUE_REMARK);

2. [MEDIUM] ISSUE_DATE 인덱스 추가 → 30% 개선 예상
   SQL: CREATE INDEX IX_STOCK_ISSUE_DATE
        ON STOCK_ISSUE(ISSUE_DATE, USE_YN);

비용: $0.0025
```

---

## ⚙️ 3가지 모드

### Mode 1: Standard (기본)

```json
{
  "ai": {
    "mode": "standard",
    "enabled": false
  }
}
```

- **AI 사용**: 없음
- **월간 비용**: $0
- **추천**: 기본 사용

---

### Mode 2: AI-Assisted (권장) ⭐

```json
{
  "ai": {
    "mode": "ai-assisted",
    "enabled": true,
    "triggers": {
      "onLevel": ["critical"],
      "minExecutionTime": 3000,
      "maxAiCallsPerHour": 10
    }
  }
}
```

- **AI 사용**: Critical만 분석
- **월간 비용**: **$0.75**
- **추천**: 대부분의 경우
- **특징**: 캐싱으로 90% 비용 절감

**예상 동작**:
- 1,000건 느린 쿼리 감지
- → 990건: 문자열 매칭 (즉시)
- → 10건: Critical (AI 분석)
  - → 9건: 캐시 히트 ($0)
  - → 1건: AI 호출 ($0.0025)

---

### Mode 3: AI-Full (분석 우선)

```json
{
  "ai": {
    "mode": "ai-full",
    "enabled": true,
    "triggers": {
      "onLevel": ["critical", "warning"],
      "minExecutionTime": 1000
    }
  }
}
```

- **AI 사용**: Warning 이상 모두
- **월간 비용**: $18
- **추천**: 분석 우선 프로젝트

---

## 💰 비용 최적화

### 1. 계층적 캐싱

```
요청 100건
  ↓
├─ 80-90건: 캐시 히트 ($0)
└─ 10-20건: 캐시 미스
     ↓
   실제 AI 호출: 1-2건 ($0.0025)

비용 절감: 90%
```

### 2. 호출 한도 관리

```json
{
  "triggers": {
    "maxAiCallsPerHour": 10
  },
  "budget": {
    "maxCostPerHour": 0.1,
    "alertOnThreshold": 0.8
  }
}
```

- 시간당 최대 10회 호출
- 시간당 최대 $0.1
- 80% 도달 시 경고

### 3. 모델 선택

| 모델 | 속도 | 비용 | 정확도 | 사용처 |
|------|------|------|--------|--------|
| **Haiku** | 빠름 | 저렴 | 중간 | 일반 분석 (권장) |
| **Sonnet** | 중간 | 중간 | 높음 | 복잡한 분석 |

**Haiku 비용**: $0.00025/1K tokens
**Sonnet 비용**: $0.003/1K tokens

---

## 📊 실제 알림 예시

### AI 없음 (Standard)

```
🚨 [CRITICAL] 느린 쿼리: StockManagerImpl.listStock

실행 시간: 3,456ms
CPU 시간: 2,123ms
논리적 읽기: 45,678회

쿼리:
WITH SSI AS (SELECT ... FROM STOCK_ISSUE)
SELECT * FROM SSI
```

---

### AI 분석 (AI-Assisted)

```
🚨 [CRITICAL] 느린 쿼리: StockManagerImpl.listStock

실행 시간: 3,456ms
CPU 시간: 2,123ms
논리적 읽기: 45,678회

쿼리:
WITH SSI AS (SELECT ... FROM STOCK_ISSUE)
SELECT * FROM SSI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI 분석 (소요: 1.2초, 비용: $0.0025)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

주요 원인:
STOCK_ISSUE 테이블에서 1,234,567행을 Full Scan하여
인덱스를 사용하지 못하고 있습니다.

상세 분석:
1. WHERE절의 LIKE '%검색어%' 패턴이 인덱스 사용 불가
2. WITH절(CTE)이 STOCK_ISSUE를 2번 스캔
3. JOIN 순서가 비효율적 (큰 테이블 먼저)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 최적화 제안
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[우선순위: HIGH] 예상 개선: 95%
Full-Text Search 인덱스 추가

SQL:
CREATE FULLTEXT INDEX ON STOCK_ISSUE(ISSUE_REMARK);

[우선순위: MEDIUM] 예상 개선: 30%
ISSUE_DATE 컬럼 인덱스 추가

SQL:
CREATE INDEX IX_STOCK_ISSUE_DATE
ON STOCK_ISSUE(ISSUE_DATE, USE_YN)
INCLUDE (ISSUE_REMARK);

[우선순위: LOW] 예상 개선: 10%
CTE를 서브쿼리로 변경하여 스캔 횟수 감소
```

---

## 🛠️ 문제 해결

### Q1. "ANTHROPIC_API_KEY가 설정되지 않았습니다"

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

또는 `.env` 파일 사용:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

### Q2. "시간당 AI 호출 한도 도달"

설정 파일에서 한도 증가:
```json
{
  "triggers": {
    "maxAiCallsPerHour": 20
  }
}
```

---

### Q3. 비용이 예상보다 높음

1. **캐시 확인**:
   ```bash
   # 로그에서 캐시 히트율 확인
   grep "캐시 히트" monitor.log
   ```

2. **트리거 조건 강화**:
   ```json
   {
     "triggers": {
       "onLevel": ["critical"],       // warning 제외
       "minExecutionTime": 5000       // 5초 이상만
     }
   }
   ```

3. **모델 변경** (Sonnet → Haiku):
   ```json
   {
     "model": "claude-3-haiku-20240307"
   }
   ```

---

## 📚 상세 기술 문서

AI 모드의 **전체 설계 문서**는 [AI_MODE_DESIGN.md](AI_MODE_DESIGN.md)를 참고하세요 (834줄):

- 아키텍처 상세 설계
- 비용 최적화 전략 (계층적 캐싱, 배치 분석)
- 프로토타입 코드 (AIEngine, CostTracker)
- 쿼리 유사도 알고리즘 (임베딩 기반)
- Provider 통합 (Anthropic, OpenAI, Google)

---

**버전**: 1.0
**작성일**: 2026-01-16
**월간 비용 (ai-assisted)**: $0.75
