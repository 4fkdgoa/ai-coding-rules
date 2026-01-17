# AI 모드 설계서

**작성일**: 2026-01-16
**버전**: v1.0
**목표**: 기존 문자열 매칭의 한계를 AI로 극복하면서도 비용 효율적인 시스템 구축

---

## 📊 현재 시스템 vs AI 모드 비교

| 구분 | 비AI 모드 (현재) | AI 모드 (제안) |
|------|-----------------|---------------|
| **매칭 방식** | 문자열 + 정규식 | 의미론적 이해 + 패턴 학습 |
| **`${}` 처리** | 제한적 (패턴 매칭만) | 동적 값 자동 추론 |
| **쿼리 유사도** | 불가능 | 가능 (임베딩 기반) |
| **원인 분석** | 단순 임계값 | 실행 계획 + AI 분석 |
| **최적화 제안** | 없음 | 구체적 제안 |
| **비용** | $0 | 변동 (최적화 가능) |
| **응답 속도** | <100ms | 가변 (캐싱 시 빠름) |

---

## 🎯 AI가 해결할 수 있는 문제

### 문제 1: `${}` 동적 쿼리 매칭

**현재 한계**:
```sql
-- XML
SELECT * FROM ${tableName} WHERE ID = #{id}

-- 실제 실행
SELECT * FROM STOCK_2024 WHERE ID = 12345

-- 매칭 실패! (STOCK_2024 ≠ ?)
```

**AI 해결**:
```javascript
// AI가 쿼리 의미 분석
const similarity = await ai.calculateQuerySimilarity(
    "SELECT * FROM ${tableName} WHERE ID = #{id}",
    "SELECT * FROM STOCK_2024 WHERE ID = 12345"
);
// → 0.95 (매우 유사) ✅
```

---

### 문제 2: 쿼리 변형 인식

**현재 한계**:
```sql
-- XML (원본)
SELECT * FROM STOCK WHERE STATUS = 'A'

-- 실제 (공백/줄바꿈 다름)
SELECT *
FROM STOCK
WHERE STATUS='A'

-- 매칭 실패! (정규화해도 미세하게 다름)
```

**AI 해결**:
```javascript
// 의미론적 임베딩 비교
const embedding1 = await ai.embedQuery(xmlQuery);
const embedding2 = await ai.embedQuery(actualQuery);
const cosineSimilarity = dotProduct(embedding1, embedding2);
// → 0.98 (동일 쿼리) ✅
```

---

### 문제 3: 성능 문제 원인 분석

**현재 한계**:
```
❌ 느린 쿼리 감지: 3,456ms
   (단순 알림만, 원인 불명)
```

**AI 해결**:
```
🤖 AI 분석 결과:

원인:
1. WHERE 절에 LIKE '%검색어%' 사용 (Full Table Scan)
2. STOCK_ISSUE 테이블 인덱스 미사용
3. STOCK_ISSUE: 1,234,567행 스캔

해결책:
1. Full-Text Search 도입 (예상 개선: 95%)
2. STOCK_ISSUE(ISSUE_DATE) 인덱스 추가
3. 쿼리 재작성: LIKE 'ABC%' (우측 와일드카드)

SQL:
CREATE INDEX IX_STOCK_ISSUE_DATE ON STOCK_ISSUE(ISSUE_DATE);
```

---

### 문제 4: 유사 쿼리 그룹화

**현재 한계**:
```
- StockManagerImpl.listStock (1,234ms)
- StockManagerImpl.getStockByDate (1,345ms)
- StockManagerImpl.searchStock (1,456ms)

(각각 별도 알림, 관계 파악 안됨)
```

**AI 해결**:
```
🤖 유사 쿼리 그룹:

그룹: "재고 조회 계열"
- StockManagerImpl.listStock
- StockManagerImpl.getStockByDate
- StockManagerImpl.searchStock

공통 패턴: WITH SSI AS (SELECT ... FROM STOCK_ISSUE)
공통 문제: STOCK_ISSUE Full Scan

일괄 최적화 가능!
```

---

## 🏗️ 아키텍처 설계

### 하이브리드 모드 (비용 최적화)

```
┌─────────────────────────────────────────────────────────┐
│  Mode Selection (config)                                │
│  - standard: AI 없음 (기본)                              │
│  - ai-assisted: AI 일부 사용 (권장)                      │
│  - ai-full: AI 전면 사용 (분석 우선)                     │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
    ┌──────────────────┐      ┌──────────────────┐
    │  Standard Mode   │      │   AI Mode        │
    │  (비용 $0)       │      │   (변동 비용)    │
    └──────────────────┘      └──────────────────┘
              │                         │
              ↓                         ↓
    ┌──────────────────┐      ┌──────────────────┐
    │ 문자열 매칭      │      │ AI 분석 엔진      │
    │ - Map.get()      │      │ - 임베딩          │
    │ - RegExp.test()  │      │ - 원인 분석       │
    └──────────────────┘      │ - 최적화 제안     │
                               └──────────────────┘
                                        │
                               ┌────────┴─────────┐
                               ↓                  ↓
                      ┌─────────────┐    ┌─────────────┐
                      │ 캐시 레이어  │    │ AI Provider │
                      │ (Redis/Mem) │    │ (Claude API)│
                      └─────────────┘    └─────────────┘
```

---

## ⚙️ 모드별 상세 설정

### Mode 1: Standard (기본, AI 없음)

```json
{
  "ai": {
    "mode": "standard",
    "enabled": false
  }
}
```

**동작**:
- 기존 문자열 매칭만 사용
- 비용 $0
- 빠른 응답 (<100ms)

---

### Mode 2: AI-Assisted (권장)

```json
{
  "ai": {
    "mode": "ai-assisted",
    "enabled": true,
    "provider": "anthropic",  // anthropic, openai, google
    "apiKey": "${ANTHROPIC_API_KEY}",
    "model": "claude-3-haiku-20240307",  // 빠르고 저렴

    "features": {
      "querySimilarity": true,      // 쿼리 유사도 분석
      "rootCauseAnalysis": true,    // 원인 분석
      "optimizationSuggestion": true, // 최적화 제안
      "queryGrouping": false        // 유사 쿼리 그룹화 (비용 高)
    },

    "triggers": {
      "onLevel": ["critical"],      // Critical만 AI 분석
      "minExecutionTime": 3000,     // 3초 이상만
      "maxAiCallsPerHour": 10       // 시간당 최대 10회
    },

    "cache": {
      "enabled": true,
      "ttlSeconds": 86400,          // 24시간
      "type": "memory"              // memory, redis
    }
  }
}
```

**동작**:
1. 일반 쿼리: 문자열 매칭 (비용 $0)
2. Critical 쿼리: AI 분석 (비용 발생)
3. 캐시 히트 시: 비용 $0

**예상 비용**:
- Critical 알림: 10건/시간
- AI 호출: 10회/시간
- Haiku 비용: $0.00025/1K tokens
- 평균 요청: 1K tokens
- **시간당 비용: $0.0025 (약 3원)**
- **월간 비용: $1.8 (약 2,400원)**

---

### Mode 3: AI-Full (분석 우선)

```json
{
  "ai": {
    "mode": "ai-full",
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",  // 고성능

    "features": {
      "querySimilarity": true,
      "rootCauseAnalysis": true,
      "optimizationSuggestion": true,
      "queryGrouping": true,
      "executionPlanAnalysis": true,  // 실행 계획 분석
      "indexRecommendation": true     // 인덱스 추천
    },

    "triggers": {
      "onLevel": ["critical", "warning"],
      "minExecutionTime": 1000,       // 1초 이상
      "maxAiCallsPerHour": 100
    }
  }
}
```

**예상 비용**:
- Warning 이상: 50건/시간
- Sonnet 비용: $0.003/1K tokens
- **시간당 비용: $0.15 (약 200원)**
- **월간 비용: $108 (약 144,000원)**

---

## 🔧 구현 계획

### Phase 1: AI 엔진 기본 구조 (2-3일)

**파일 구조**:
```
db-monitor/
├── ai/
│   ├── ai-engine.js           # AI 엔진 메인
│   ├── providers/
│   │   ├── anthropic.js       # Claude API
│   │   ├── openai.js          # GPT API
│   │   └── google.js          # Gemini API
│   ├── analyzers/
│   │   ├── similarity.js      # 쿼리 유사도
│   │   ├── root-cause.js      # 원인 분석
│   │   └── optimizer.js       # 최적화 제안
│   └── cache/
│       ├── memory-cache.js    # 메모리 캐시
│       └── redis-cache.js     # Redis 캐시
├── db-alert-monitor.js
└── query-watcher.js
```

**핵심 클래스**:
```javascript
class AIEngine {
    constructor(config) {
        this.mode = config.ai.mode;
        this.provider = this.createProvider(config.ai.provider);
        this.cache = this.createCache(config.ai.cache);
        this.costTracker = new CostTracker();
    }

    async analyzeSlowQuery(query, executionPlan, metrics) {
        // 1. 캐시 확인
        const cacheKey = this.generateCacheKey(query);
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        // 2. 비용 체크
        if (!this.costTracker.canMakeCall()) {
            return null; // 예산 초과
        }

        // 3. AI 호출
        const analysis = await this.provider.analyze({
            query: query,
            executionPlan: executionPlan,
            metrics: metrics
        });

        // 4. 캐시 저장
        await this.cache.set(cacheKey, analysis);

        // 5. 비용 추적
        this.costTracker.recordCall(analysis.tokens);

        return analysis;
    }

    generateCacheKey(query) {
        // 쿼리 정규화 후 해시
        const normalized = this.normalizeQuery(query);
        return crypto.createHash('md5').update(normalized).digest('hex');
    }
}
```

---

### Phase 2: 쿼리 유사도 분석 (1-2일)

**목표**: `${}` 동적 쿼리 자동 매칭

```javascript
class QuerySimilarityAnalyzer {
    async calculateSimilarity(query1, query2) {
        // 1. 임베딩 생성 (캐시 사용)
        const embedding1 = await this.getEmbedding(query1);
        const embedding2 = await this.getEmbedding(query2);

        // 2. 코사인 유사도
        const similarity = this.cosineSimilarity(embedding1, embedding2);

        return similarity;
    }

    async getEmbedding(query) {
        const cacheKey = `emb:${this.hash(query)}`;

        let embedding = await this.cache.get(cacheKey);
        if (!embedding) {
            embedding = await this.provider.createEmbedding(query);
            await this.cache.set(cacheKey, embedding, 7 * 24 * 3600); // 7일
        }

        return embedding;
    }

    cosineSimilarity(vec1, vec2) {
        const dot = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
        const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
        const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
        return dot / (mag1 * mag2);
    }
}
```

**사용 예시**:
```javascript
const analyzer = new QuerySimilarityAnalyzer(aiEngine);

const xmlQuery = "SELECT * FROM ${tableName} WHERE ID = #{id}";
const actualQuery = "SELECT * FROM STOCK_2024 WHERE ID = 12345";

const similarity = await analyzer.calculateSimilarity(xmlQuery, actualQuery);

if (similarity > 0.90) {
    console.log('✅ 동일 쿼리로 판단 (유사도: ' + similarity + ')');
    // StockManagerImpl.getById로 매칭
}
```

---

### Phase 3: 원인 분석 및 최적화 제안 (2-3일)

```javascript
class RootCauseAnalyzer {
    async analyze(slowQuery) {
        const prompt = this.buildPrompt(slowQuery);

        const response = await this.aiEngine.provider.complete({
            model: 'claude-3-haiku-20240307',
            maxTokens: 1000,
            temperature: 0.2,  // 일관된 분석
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        return this.parseResponse(response);
    }

    buildPrompt(slowQuery) {
        return `
당신은 MSSQL 성능 전문가입니다. 다음 느린 쿼리를 분석하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
쿼리
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${slowQuery.queryText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
성능 지표
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
실행 시간: ${slowQuery.executionTimeMs}ms
CPU 시간: ${slowQuery.cpuTimeMs}ms
논리적 읽기: ${slowQuery.logicalReads}회
대기 타입: ${slowQuery.waitType}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
실행 계획 (요약)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${slowQuery.executionPlanSummary}

다음 형식으로 JSON 응답:
{
  "rootCause": "주요 원인 1-2문장",
  "details": [
    "상세 원인 1",
    "상세 원인 2"
  ],
  "solutions": [
    {
      "priority": "high|medium|low",
      "description": "해결 방법",
      "sql": "실행할 SQL (선택)",
      "expectedImprovement": "예상 개선율 (예: 80%)"
    }
  ],
  "relatedQueries": [
    "유사한 문제가 있을 것 같은 다른 쿼리"
  ]
}
`;
    }

    parseResponse(response) {
        try {
            return JSON.parse(response.content);
        } catch (e) {
            // Fallback: 텍스트 파싱
            return {
                rootCause: response.content,
                details: [],
                solutions: []
            };
        }
    }
}
```

**알림 예시 (AI 분석 포함)**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI 분석 결과
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
ON STOCK_ISSUE(ISSUE_DATE, USE_YN);

[우선순위: LOW] 예상 개선: 10%
CTE를 서브쿼리로 변경하여 스캔 횟수 감소
```

---

### Phase 4: 쿼리 그룹화 (1-2일)

```javascript
class QueryGroupAnalyzer {
    async groupSimilarQueries(queries) {
        // 1. 임베딩 생성
        const embeddings = await Promise.all(
            queries.map(q => this.getEmbedding(q.text))
        );

        // 2. 클러스터링 (K-means 간단 구현)
        const clusters = this.kMeansClustering(embeddings, 5);

        // 3. 각 클러스터 대표 쿼리 선정
        const groups = clusters.map(cluster => ({
            representative: cluster[0],
            members: cluster,
            commonPattern: this.extractCommonPattern(cluster)
        }));

        return groups;
    }

    extractCommonPattern(cluster) {
        // AI로 공통 패턴 추출
        const prompt = `
다음 쿼리들의 공통 패턴을 찾으세요:

${cluster.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

공통점:
`;
        return this.aiEngine.complete(prompt);
    }
}
```

---

## 💰 비용 최적화 전략

### 전략 1: 계층적 캐싱

```
┌─────────────────────────────────────────┐
│  Level 1: 메모리 캐시 (Redis/Memory)    │
│  - 히트율: 80-90%                        │
│  - 응답 속도: <10ms                      │
│  - TTL: 24시간                           │
└─────────────────────────────────────────┘
                │ (Cache Miss)
                ↓
┌─────────────────────────────────────────┐
│  Level 2: 쿼리 정규화 + 해시 비교       │
│  - 동일 쿼리 판별 (파라미터만 다름)      │
│  - 비용: $0                              │
└─────────────────────────────────────────┘
                │ (정말 새로운 쿼리)
                ↓
┌─────────────────────────────────────────┐
│  Level 3: AI 호출                        │
│  - 히트율: 10-20%만 도달                 │
│  - 비용 발생                             │
└─────────────────────────────────────────┘
```

**예상 효과**:
- AI 호출: 100건 → 10-20건
- 비용 절감: 80-90%

---

### 전략 2: 배치 분석

```javascript
// ❌ 나쁜 방식: 즉시 분석
slowQuery발생 → AI호출 (비용 발생)

// ✅ 좋은 방식: 배치 분석
slowQuery발생 → 큐에 추가
10분마다 → 유사 쿼리 그룹화 → AI 1회 호출
```

**예상 효과**:
- 10건 개별 분석: $0.025
- 1건 배치 분석: $0.005
- 비용 절감: 80%

---

### 전략 3: 모델 선택

| 모델 | 속도 | 비용 | 정확도 | 사용처 |
|------|------|------|--------|--------|
| **Haiku** | 빠름 | 저렴 | 중간 | 일반 분석 (권장) |
| **Sonnet** | 중간 | 중간 | 높음 | 복잡한 분석 |
| **GPT-3.5** | 빠름 | 저렴 | 중하 | 단순 작업 |
| **Embedding** | 매우 빠름 | 매우 저렴 | - | 유사도 분석 |

**최적 조합**:
```json
{
  "ai": {
    "models": {
      "similarity": "text-embedding-3-small",  // $0.00002/1K
      "analysis": "claude-3-haiku-20240307",   // $0.00025/1K
      "complex": "claude-3-5-sonnet-20241022"  // $0.003/1K (필요시만)
    }
  }
}
```

---

### 전략 4: 사용량 제한

```javascript
class CostTracker {
    constructor(config) {
        this.maxCostPerHour = config.ai.budget.maxCostPerHour || 0.1; // $0.1
        this.maxCallsPerHour = config.ai.triggers.maxAiCallsPerHour || 10;

        this.hourlySpent = 0;
        this.hourlyCalls = 0;
        this.resetTime = Date.now() + 3600000; // 1시간 후
    }

    canMakeCall() {
        this.checkReset();

        if (this.hourlyCalls >= this.maxCallsPerHour) {
            console.warn(`⚠️  시간당 AI 호출 한도 도달 (${this.maxCallsPerHour}회)`);
            return false;
        }

        if (this.hourlySpent >= this.maxCostPerHour) {
            console.warn(`⚠️  시간당 AI 비용 한도 도달 ($${this.maxCostPerHour})`);
            return false;
        }

        return true;
    }

    recordCall(tokens, model) {
        const cost = this.calculateCost(tokens, model);
        this.hourlySpent += cost;
        this.hourlyCalls++;

        console.log(`💰 AI 비용: $${cost.toFixed(6)} (누적: $${this.hourlySpent.toFixed(4)})`);
    }

    checkReset() {
        if (Date.now() >= this.resetTime) {
            console.log(`📊 시간당 통계: ${this.hourlyCalls}회 호출, $${this.hourlySpent.toFixed(4)} 사용`);
            this.hourlySpent = 0;
            this.hourlyCalls = 0;
            this.resetTime = Date.now() + 3600000;
        }
    }
}
```

---

## 📊 성능 비교 (예상)

### 시나리오: 하루 1,000건 느린 쿼리 발생

| 항목 | Standard | AI-Assisted | AI-Full |
|------|----------|-------------|---------|
| **문자열 매칭** | 1,000건 (100%) | 1,000건 (100%) | 1,000건 (100%) |
| **AI 호출** | 0건 | 10건 (1%) | 100건 (10%) |
| **캐시 히트** | - | 90% | 80% |
| **실제 AI 호출** | 0건 | 1건 | 20건 |
| **일간 비용** | $0 | $0.025 | $0.60 |
| **월간 비용** | $0 | $0.75 | $18 |

---

## 🚀 프로토타입 코드

### config/alert-config.json

```json
{
  "ai": {
    "mode": "ai-assisted",
    "enabled": true,
    "provider": "anthropic",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "model": "claude-3-haiku-20240307",

    "features": {
      "querySimilarity": true,
      "rootCauseAnalysis": true,
      "optimizationSuggestion": true,
      "queryGrouping": false
    },

    "triggers": {
      "onLevel": ["critical"],
      "minExecutionTime": 3000,
      "maxAiCallsPerHour": 10
    },

    "cache": {
      "enabled": true,
      "ttlSeconds": 86400,
      "type": "memory"
    },

    "budget": {
      "maxCostPerHour": 0.1,
      "maxCostPerDay": 1.0,
      "alertOnThreshold": 0.8
    }
  }
}
```

---

## 📝 사용 예시

### 예시 1: AI 없이 동작

```bash
npm run monitor

# 1,000건 느린 쿼리 감지
# AI 호출: 0회
# 비용: $0
```

---

### 예시 2: AI-Assisted 모드

```bash
npm run monitor -- --ai-mode ai-assisted

# 1,000건 느린 쿼리 감지
# → 990건: 문자열 매칭 (즉시)
# → 10건: Critical (AI 분석)
#   → 9건: 캐시 히트
#   → 1건: AI 호출 ($0.0025)
```

**알림 (AI 분석 포함)**:
```
🚨 [CRITICAL] 느린 쿼리: StockManagerImpl.listStock

실행 시간: 3,456ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI 분석 (소요 시간: 1.2초)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

원인:
STOCK_ISSUE 테이블 Full Scan (1,234,567행)

해결책:
1. [HIGH] Full-Text Index 추가 → 95% 개선 예상
   SQL: CREATE FULLTEXT INDEX ...

2. [MEDIUM] ISSUE_DATE 인덱스 추가 → 30% 개선 예상
   SQL: CREATE INDEX ...

비용: $0.0025
```

---

### 예시 3: AI-Full 모드 (분석 우선)

```bash
npm run monitor -- --ai-mode ai-full

# Warning 이상 모두 AI 분석
# 유사 쿼리 자동 그룹화
# 일간 비용: $0.60
```

---

## 🎯 다음 단계

### Step 1: 프로토타입 구현 (우선)
- [ ] AIEngine 기본 구조
- [ ] Anthropic Provider 구현
- [ ] 메모리 캐시 구현
- [ ] CostTracker 구현

### Step 2: 핵심 기능 (Phase 1-2)
- [ ] 쿼리 유사도 분석
- [ ] 원인 분석
- [ ] 최적화 제안

### Step 3: 고급 기능 (Phase 3-4)
- [ ] 쿼리 그룹화
- [ ] 실행 계획 분석
- [ ] Redis 캐시 지원

### Step 4: 테스트 및 최적화
- [ ] AutoCRM 프로젝트 테스트
- [ ] 비용 모니터링
- [ ] 캐시 히트율 측정
- [ ] 프롬프트 최적화

---

## 📚 참고 문서

- [Claude API Documentation](https://docs.anthropic.com/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [MSSQL DMV Reference](https://learn.microsoft.com/sql/relational-databases/system-dynamic-management-views/)

---

**결론**: AI를 **선택적으로** 투입하여 비용은 최소화하고 분석 능력은 극대화하는 하이브리드 설계!
