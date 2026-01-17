/**
 * Lock History Manager
 * LRU 기반 메모리 관리 + 파일 영속화
 */

const fs = require('fs');
const path = require('path');

class LockHistoryManager {
    constructor(options = {}) {
        this.maxEntries = options.maxEntries || 10000;
        this.persistPath = options.persistPath || path.join(__dirname, '../data/lock-history.json');
        this.persistInterval = options.persistInterval || 60000; // 1분마다 저장
        this.history = new Map();

        // 자동 영속화 타이머
        this.persistTimer = null;

        // 디렉토리 생성
        this.ensureDataDir();

        // 기존 히스토리 로드
        this.load();

        // 주기적 영속화 시작
        this.startPersistTimer();
    }

    /**
     * 데이터 디렉토리 생성
     */
    ensureDataDir() {
        const dir = path.dirname(this.persistPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Lock 충돌 추가/업데이트
     */
    add(key, data) {
        // LRU 방식: 오래된 항목 제거
        if (this.history.size >= this.maxEntries) {
            const oldest = this.history.keys().next().value;
            this.history.delete(oldest);
            console.log(`⚠️  Lock history 한도 도달, 오래된 항목 제거: ${oldest}`);
        }

        // 기존 항목 제거 후 재추가 (LRU - 최근 사용된 항목이 마지막으로 이동)
        if (this.history.has(key)) {
            this.history.delete(key);
        }

        this.history.set(key, {
            ...data,
            lastUpdated: Date.now()
        });
    }

    /**
     * Lock 충돌 조회
     */
    get(key) {
        const data = this.history.get(key);

        if (data) {
            // LRU: 조회 시 항목을 마지막으로 이동
            this.history.delete(key);
            this.history.set(key, data);
        }

        return data;
    }

    /**
     * Lock 충돌 존재 여부
     */
    has(key) {
        return this.history.has(key);
    }

    /**
     * Lock 충돌 제거
     */
    delete(key) {
        return this.history.delete(key);
    }

    /**
     * 전체 항목 수
     */
    get size() {
        return this.history.size;
    }

    /**
     * 모든 키 반환
     */
    keys() {
        return this.history.keys();
    }

    /**
     * 모든 엔트리 반환
     */
    entries() {
        return this.history.entries();
    }

    /**
     * 오래된 항목 정리 (5분 이상 업데이트 없는 항목)
     */
    cleanup(maxAge = 5 * 60 * 1000) {
        const now = Date.now();
        const removed = [];

        for (const [key, data] of this.history.entries()) {
            if (now - data.lastUpdated > maxAge) {
                this.history.delete(key);
                removed.push(key);
            }
        }

        if (removed.length > 0) {
            console.log(`🧹 Lock history 정리: ${removed.length}개 항목 제거`);
        }

        return removed;
    }

    /**
     * 파일에 저장
     */
    persist() {
        try {
            const data = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                entries: Array.from(this.history.entries())
            };

            fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`💾 Lock history 저장: ${this.history.size}개 항목 → ${this.persistPath}`);
        } catch (error) {
            console.error(`❌ Lock history 저장 실패:`, error.message);
        }
    }

    /**
     * 파일에서 로드
     */
    load() {
        try {
            if (!fs.existsSync(this.persistPath)) {
                console.log(`📂 Lock history 파일 없음 (새로 시작)`);
                return;
            }

            const content = fs.readFileSync(this.persistPath, 'utf-8');
            const data = JSON.parse(content);

            // 버전 확인
            if (data.version !== '1.0') {
                console.warn(`⚠️  Lock history 버전 불일치: ${data.version}`);
                return;
            }

            // Map으로 복원
            this.history = new Map(data.entries);

            console.log(`📂 Lock history 로드: ${this.history.size}개 항목 (${data.timestamp})`);

            // 오래된 항목 정리 (1시간 이상)
            this.cleanup(60 * 60 * 1000);

        } catch (error) {
            console.error(`❌ Lock history 로드 실패:`, error.message);
            this.history = new Map();
        }
    }

    /**
     * 주기적 영속화 시작
     */
    startPersistTimer() {
        if (this.persistTimer) {
            clearInterval(this.persistTimer);
        }

        this.persistTimer = setInterval(() => {
            this.persist();
        }, this.persistInterval);

        console.log(`⏰ Lock history 자동 저장: ${this.persistInterval / 1000}초마다`);
    }

    /**
     * 주기적 영속화 중지
     */
    stopPersistTimer() {
        if (this.persistTimer) {
            clearInterval(this.persistTimer);
            this.persistTimer = null;
        }
    }

    /**
     * 종료 (마지막 저장)
     */
    shutdown() {
        this.stopPersistTimer();
        this.persist();
        console.log(`🛑 Lock History Manager 종료`);
    }

    /**
     * 통계 정보
     */
    getStats() {
        let totalDuration = 0;
        let maxDuration = 0;
        let oldestEntry = null;

        for (const [key, data] of this.history.entries()) {
            const duration = Date.now() - data.startTime;
            totalDuration += duration;

            if (duration > maxDuration) {
                maxDuration = duration;
                oldestEntry = { key, ...data };
            }
        }

        return {
            totalEntries: this.history.size,
            maxEntries: this.maxEntries,
            usagePercent: (this.history.size / this.maxEntries * 100).toFixed(1),
            avgDuration: this.history.size > 0 ? Math.floor(totalDuration / this.history.size) : 0,
            maxDuration: maxDuration,
            oldestEntry: oldestEntry
        };
    }
}

module.exports = LockHistoryManager;
