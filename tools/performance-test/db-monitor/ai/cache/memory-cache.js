/**
 * 메모리 캐시 (간단하고 빠름)
 */

class MemoryCache {
    constructor(config = {}) {
        this.ttl = (config.ttlSeconds || 86400) * 1000; // 기본 24시간
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0
        };

        // 주기적 정리 (1분마다)
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);

        console.log(`💾 메모리 캐시 초기화 (TTL: ${config.ttlSeconds || 86400}초)`);
    }

    /**
     * 캐시 조회
     */
    async get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // TTL 체크
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.evictions++;
            return null;
        }

        this.stats.hits++;
        return entry.value;
    }

    /**
     * 캐시 저장
     */
    async set(key, value, customTtl = null) {
        const ttl = customTtl ? customTtl * 1000 : this.ttl;

        this.cache.set(key, {
            value: value,
            expiresAt: Date.now() + ttl
        });

        this.stats.sets++;
    }

    /**
     * 캐시 삭제
     */
    async delete(key) {
        return this.cache.delete(key);
    }

    /**
     * 전체 삭제
     */
    async clear() {
        this.cache.clear();
        console.log('💾 캐시 전체 삭제');
    }

    /**
     * 만료된 항목 정리
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 만료된 캐시 정리: ${cleaned}개`);
            this.stats.evictions += cleaned;
        }
    }

    /**
     * 통계
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100)
            : 0;

        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: hitRate
        };
    }

    /**
     * 정리 중지
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = MemoryCache;
