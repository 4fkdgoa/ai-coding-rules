/**
 * Anthropic (Claude) API Provider
 *
 * 사용하려면:
 * npm install @anthropic-ai/sdk
 */

class AnthropicProvider {
    constructor(config) {
        this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
        this.model = config.model || 'claude-3-haiku-20240307';
        this.maxTokens = config.maxTokens || 1000;
        this.temperature = config.temperature || 0.2; // 일관된 분석

        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다');
        }

        // Anthropic SDK 초기화
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            this.client = new Anthropic({
                apiKey: this.apiKey
            });
            console.log(`✅ Anthropic Provider 초기화 (모델: ${this.model})`);
        } catch (error) {
            console.error('❌ @anthropic-ai/sdk 설치 필요: npm install @anthropic-ai/sdk');
            throw error;
        }
    }

    /**
     * 텍스트 완성 (분석)
     */
    async complete(prompt) {
        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            // 응답 파싱
            const content = response.content[0].text;
            const tokens = response.usage.input_tokens + response.usage.output_tokens;

            return {
                content: content,
                tokens: tokens,
                model: this.model
            };

        } catch (error) {
            console.error('Anthropic API 호출 실패:', error.message);
            throw error;
        }
    }

    /**
     * 임베딩 생성 (쿼리 유사도용)
     *
     * 참고: Anthropic은 임베딩 API가 없음
     * → Voyage AI 또는 OpenAI 임베딩 사용 권장
     */
    async createEmbedding(text) {
        console.warn('⚠️  Anthropic은 임베딩 API를 제공하지 않습니다');
        console.warn('   → Voyage AI 또는 OpenAI 임베딩 사용을 권장합니다');

        // 폴백: 텍스트 해시 (임시)
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(text).digest();

        // 해시를 벡터처럼 변환 (임시 방편)
        const vector = Array.from(hash.slice(0, 32)).map(b => b / 255);

        return vector;
    }

    /**
     * JSON 응답 파싱
     */
    parseJSON(content) {
        try {
            // JSON 블록 추출 (```json ... ``` 또는 {...})
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                content.match(/(\{[\s\S]*\})/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }

            // 전체를 JSON으로 시도
            return JSON.parse(content);

        } catch (error) {
            console.warn('JSON 파싱 실패, 원본 텍스트 반환:', error.message);
            return { content: content };
        }
    }

    /**
     * 쿼리 분석 (통합 메서드)
     */
    async analyze({ query, executionPlan, metrics }) {
        const prompt = `
당신은 MSSQL 성능 전문가입니다. 다음 느린 쿼리를 분석하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
쿼리
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${query}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
성능 지표
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
실행 시간: ${metrics.executionTimeMs}ms
CPU 시간: ${metrics.cpuTimeMs}ms
논리적 읽기: ${metrics.logicalReads}회
${metrics.waitType ? `대기 타입: ${metrics.waitType}` : ''}

다음 형식으로 JSON 응답:
{
  "rootCause": "주요 원인 1-2문장",
  "details": [
    "상세 원인 1",
    "상세 원인 2"
  ],
  "solutions": [
    {
      "priority": "high",
      "description": "해결 방법",
      "sql": "실행할 SQL (선택)",
      "estimatedImprovement": "예상 개선율"
    }
  ],
  "confidence": 0.8
}
`;

        const response = await this.complete(prompt);
        const analysis = this.parseJSON(response.content);

        return {
            ...analysis,
            usage: {
                tokens: response.tokens,
                model: response.model
            }
        };
    }
}

module.exports = AnthropicProvider;
