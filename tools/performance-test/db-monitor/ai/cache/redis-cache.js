/**
 * Redis 캐시 (분산 환경용)
 *
 * 사용하려면:
 * npm install redis
 */

class RedisCache {
    constructor(config = {}) {
        this.ttl = config.ttlSeconds || 86400;
        this.host = config.host || 'localhost';
        this.port = config.port || 6379;
        this.prefix = config.prefix || 'db-monitor:';

        // Redis 클라이언트 (lazy 초기화)
        this.client = null;
        this.connected = false;

        console.log(`💾 Redis 캐시 설정 (${this.host}:${this.port})`);
    }

    /**
     * Redis 연결
     */
    async connect() {
        if (this.connected) return;

        try {
            const redis = require('redis');
            this.client = redis.createClient({
                socket: {
                    host: this.host,
                    port: this.port
                }
            });

            await this.client.connect();
            this.connected = true;

            console.log('✅ Redis 연결 성공');

        } catch (error) {
            console.error('❌ Redis 연결 실패:', error.message);
            console.log('⚠️  메모리 캐시로 폴백');

            // 폴백: 메모리 캐시
            const MemoryCache = require('./memory-cache');
            return new MemoryCache({ ttlSeconds: this.ttl });
        }
    }

    /**
     * 캐시 조회
     */
    async get(key) {
        if (!this.connected) await this.connect();
        if (!this.client) return null;

        try {
            const value = await this.client.get(this.prefix + key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis GET 실패:', error.message);
            return null;
        }
    }

    /**
     * 캐시 저장
     */
    async set(key, value, customTtl = null) {
        if (!this.connected) await this.connect();
        if (!this.client) return;

        const ttl = customTtl || this.ttl;

        try {
            await this.client.setEx(
                this.prefix + key,
                ttl,
                JSON.stringify(value)
            );
        } catch (error) {
            console.error('Redis SET 실패:', error.message);
        }
    }

    /**
     * 캐시 삭제
     */
    async delete(key) {
        if (!this.connected) await this.connect();
        if (!this.client) return;

        try {
            await this.client.del(this.prefix + key);
        } catch (error) {
            console.error('Redis DEL 실패:', error.message);
        }
    }

    /**
     * 전체 삭제 (패턴 매칭)
     */
    async clear() {
        if (!this.connected) await this.connect();
        if (!this.client) return;

        try {
            const keys = await this.client.keys(this.prefix + '*');
            if (keys.length > 0) {
                await this.client.del(keys);
                console.log(`💾 Redis 캐시 전체 삭제: ${keys.length}개`);
            }
        } catch (error) {
            console.error('Redis CLEAR 실패:', error.message);
        }
    }

    /**
     * 연결 종료
     */
    async destroy() {
        if (this.client && this.connected) {
            await this.client.quit();
            console.log('Redis 연결 종료');
        }
    }
}

module.exports = RedisCache;
