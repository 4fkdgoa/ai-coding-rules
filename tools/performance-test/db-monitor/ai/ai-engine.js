/**
 * AI 엔진 - DB 모니터링 AI 분석
 *
 * 주요 기능:
 * 1. 쿼리 유사도 분석 (${} 동적 쿼리 매칭)
 * 2. 성능 문제 원인 분석
 * 3. 최적화 제안
 * 4. 비용 관리 및 캐싱
 */

const crypto = require('crypto');

class AIEngine {
    constructor(config) {
        this.config = config.ai || { enabled: false };
        this.mode = this.config.mode || 'standard';
        this.enabled = this.config.enabled && this.mode !== 'standard';

        if (!this.enabled) {
            console.log('ℹ️  AI 모드: 비활성화 (문자열 매칭만 사용)');
            return;
        }

        // Provider 초기화
        this.provider = this.createProvider();

        // 캐시 초기화
        this.cache = this.createCache();

        // 비용 추적기
        this.costTracker = new CostTracker(this.config);

        // 통계
        this.stats = {
            totalCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalCost: 0
        };

        console.log(`🤖 AI 모드: ${this.mode}`);
        console.log(`📦 Provider: ${this.config.provider}`);
        console.log(`💾 캐시: ${this.config.cache?.type || 'memory'}`);
    }

    /**
     * AI Provider 생성
     */
    createProvider() {
        const providerType = this.config.provider || 'anthropic';

        switch (providerType) {
            case 'anthropic':
                const AnthropicProvider = require('./providers/anthropic');
                return new AnthropicProvider(this.config);
            case 'openai':
                const OpenAIProvider = require('./providers/openai');
                return new OpenAIProvider(this.config);
            case 'google':
                const GoogleProvider = require('./providers/google');
                return new GoogleProvider(this.config);
            default:
                throw new Error(`지원하지 않는 Provider: ${providerType}`);
        }
    }

    /**
     * 캐시 생성
     */
    createCache() {
        const cacheType = this.config.cache?.type || 'memory';

        switch (cacheType) {
            case 'memory':
                const MemoryCache = require('./cache/memory-cache');
                return new MemoryCache(this.config.cache);
            case 'redis':
                const RedisCache = require('./cache/redis-cache');
                return new RedisCache(this.config.cache);
            default:
                throw new Error(`지원하지 않는 캐시: ${cacheType}`);
        }
    }

    /**
     * 느린 쿼리 분석
     */
    async analyzeSlowQuery(slowQuery) {
        if (!this.enabled) {
            return null;
        }

        // 1. 트리거 조건 체크
        if (!this.shouldAnalyze(slowQuery)) {
            return null;
        }

        // 2. 캐시 확인
        const cacheKey = this.generateCacheKey(slowQuery.queryText);
        const cached = await this.cache.get(cacheKey);

        if (cached) {
            this.stats.cacheHits++;
            console.log(`💾 캐시 히트: ${cacheKey.substring(0, 8)}...`);
            return cached;
        }

        this.stats.cacheMisses++;

        // 3. 비용 체크
        if (!this.costTracker.canMakeCall()) {
            console.warn('⚠️  AI 호출 한도 도달 - 스킵');
            return null;
        }

        try {
            // 4. AI 분석
            console.log(`🤖 AI 분석 시작: ${slowQuery.queryName || 'Unknown'}`);
            const startTime = Date.now();

            const analysis = await this.performAnalysis(slowQuery);

            const elapsed = Date.now() - startTime;
            console.log(`✅ AI 분석 완료 (${elapsed}ms)`);

            // 5. 캐시 저장
            await this.cache.set(cacheKey, analysis);

            // 6. 비용 추적
            this.costTracker.recordCall(analysis.usage.tokens, this.config.model);
            this.stats.totalCalls++;
            this.stats.totalCost += analysis.usage.cost;

            return analysis;

        } catch (error) {
            console.error('❌ AI 분석 실패:', error.message);
            return null;
        }
    }

    /**
     * 실제 AI 분석 수행
     */
    async performAnalysis(slowQuery) {
        const features = this.config.features || {};
        const results = {};

        // 원인 분석
        if (features.rootCauseAnalysis) {
            results.rootCause = await this.analyzeRootCause(slowQuery);
        }

        // 최적화 제안
        if (features.optimizationSuggestion) {
            results.optimization = await this.suggestOptimization(slowQuery);
        }

        return {
            queryName: slowQuery.queryName,
            analysis: results,
            usage: {
                tokens: 0,  // Provider에서 채움
                cost: 0
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 원인 분석
     */
    async analyzeRootCause(slowQuery) {
        const prompt = this.buildRootCausePrompt(slowQuery);
        const response = await this.provider.complete(prompt);

        return {
            cause: response.content,
            confidence: response.confidence || 0.8
        };
    }

    /**
     * 최적화 제안
     */
    async suggestOptimization(slowQuery) {
        const prompt = this.buildOptimizationPrompt(slowQuery);
        const response = await this.provider.complete(prompt);

        return {
            suggestions: response.suggestions || [],
            estimatedImprovement: response.estimatedImprovement || 'Unknown'
        };
    }

    /**
     * 원인 분석 프롬프트 생성
     */
    buildRootCausePrompt(slowQuery) {
        return `
당신은 MSSQL 성능 전문가입니다. 다음 느린 쿼리의 성능 문제 원인을 분석하세요.

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
${slowQuery.waitType ? `대기 타입: ${slowQuery.waitType}` : ''}

다음 형식으로 간결하게 JSON 응답 (500자 이내):
{
  "content": "주요 원인 1-2문장",
  "confidence": 0.8
}
`;
    }

    /**
     * 최적화 제안 프롬프트 생성
     */
    buildOptimizationPrompt(slowQuery) {
        return `
다음 느린 쿼리를 최적화할 방법을 제안하세요.

쿼리:
${slowQuery.queryText}

성능: ${slowQuery.executionTimeMs}ms

JSON 형식으로 응답 (최대 3개 제안):
{
  "suggestions": [
    {
      "priority": "high",
      "description": "인덱스 추가",
      "sql": "CREATE INDEX ...",
      "estimatedImprovement": "80%"
    }
  ],
  "estimatedImprovement": "80%"
}
`;
    }

    /**
     * 분석 여부 판단
     */
    shouldAnalyze(slowQuery) {
        const triggers = this.config.triggers || {};

        // 레벨 체크
        if (triggers.onLevel && !triggers.onLevel.includes(slowQuery.level)) {
            return false;
        }

        // 실행 시간 체크
        if (triggers.minExecutionTime && slowQuery.executionTimeMs < triggers.minExecutionTime) {
            return false;
        }

        return true;
    }

    /**
     * 캐시 키 생성
     */
    generateCacheKey(queryText) {
        // 쿼리 정규화 후 해시
        const normalized = this.normalizeQuery(queryText);
        return crypto.createHash('md5').update(normalized).digest('hex');
    }

    /**
     * 쿼리 정규화 (캐싱용)
     */
    normalizeQuery(queryText) {
        return queryText
            .replace(/\s+/g, ' ')          // 공백 정규화
            .replace(/\b\d+\b/g, '?')      // 숫자 → ?
            .replace(/'[^']*'/g, '?')      // 문자열 → ?
            .replace(/['"]/g, '')          // 따옴표 제거
            .trim()
            .toLowerCase()
            .substring(0, 500);            // 앞 500자 (시그니처)
    }

    /**
     * 통계 출력
     */
    printStats() {
        if (!this.enabled) {
            return;
        }

        console.log('\n' + '='.repeat(60));
        console.log('🤖 AI 엔진 통계');
        console.log('='.repeat(60));
        console.log(`총 AI 호출: ${this.stats.totalCalls}회`);
        console.log(`캐시 히트: ${this.stats.cacheHits}회 (${this.getCacheHitRate()}%)`);
        console.log(`캐시 미스: ${this.stats.cacheMisses}회`);
        console.log(`총 비용: $${this.stats.totalCost.toFixed(4)}`);
        console.log('='.repeat(60));

        this.costTracker.printStats();
    }

    /**
     * 캐시 히트율
     */
    getCacheHitRate() {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        if (total === 0) return 0;
        return Math.round((this.stats.cacheHits / total) * 100);
    }
}

/**
 * 비용 추적기
 */
class CostTracker {
    constructor(config) {
        this.budget = config.budget || {};
        this.triggers = config.triggers || {};

        this.maxCostPerHour = this.budget.maxCostPerHour || 0.1;
        this.maxCallsPerHour = this.triggers.maxAiCallsPerHour || 10;

        this.hourlySpent = 0;
        this.hourlyCalls = 0;
        this.resetTime = Date.now() + 3600000; // 1시간 후

        // 누적 통계
        this.totalSpent = 0;
        this.totalCalls = 0;
    }

    /**
     * AI 호출 가능 여부
     */
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

    /**
     * 호출 기록
     */
    recordCall(tokens, model) {
        const cost = this.calculateCost(tokens, model);

        this.hourlySpent += cost;
        this.hourlyCalls++;
        this.totalSpent += cost;
        this.totalCalls++;

        console.log(`💰 AI 비용: $${cost.toFixed(6)} (시간당 누적: $${this.hourlySpent.toFixed(4)})`);

        // 임계값 경고
        const threshold = this.budget.alertOnThreshold || 0.8;
        if (this.hourlySpent >= this.maxCostPerHour * threshold) {
            console.warn(`⚠️  시간당 예산 ${Math.round(threshold * 100)}% 도달 ($${this.hourlySpent.toFixed(4)} / $${this.maxCostPerHour})`);
        }
    }

    /**
     * 비용 계산
     */
    calculateCost(tokens, model) {
        // 모델별 비용 (per 1K tokens, 2026년 1월 기준)
        const pricing = {
            'claude-3-haiku-20240307': 0.00025,
            'claude-3-5-sonnet-20241022': 0.003,
            'claude-3-opus-20240229': 0.015,
            'gpt-3.5-turbo': 0.0005,
            'gpt-4': 0.03,
            'gemini-pro': 0.00025
        };

        const pricePerToken = (pricing[model] || 0.00025) / 1000;
        return tokens * pricePerToken;
    }

    /**
     * 시간 리셋 체크
     */
    checkReset() {
        if (Date.now() >= this.resetTime) {
            console.log(`\n📊 시간당 통계 리셋:`);
            console.log(`   - ${this.hourlyCalls}회 호출`);
            console.log(`   - $${this.hourlySpent.toFixed(4)} 사용\n`);

            this.hourlySpent = 0;
            this.hourlyCalls = 0;
            this.resetTime = Date.now() + 3600000;
        }
    }

    /**
     * 통계 출력
     */
    printStats() {
        console.log('\n💰 비용 추적기 통계');
        console.log('-'.repeat(60));
        console.log(`시간당: ${this.hourlyCalls}회 / $${this.hourlySpent.toFixed(4)}`);
        console.log(`누적: ${this.totalCalls}회 / $${this.totalSpent.toFixed(4)}`);
        console.log(`한도: ${this.maxCallsPerHour}회/시간, $${this.maxCostPerHour}/시간`);
        console.log('-'.repeat(60));
    }
}

module.exports = { AIEngine, CostTracker };
