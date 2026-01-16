/**
 * DB 알림 로거
 * 이상 징후 발생 시 로그 파일 저장
 */

const fs = require('fs');
const path = require('path');

class AlertLogger {
    constructor(config) {
        this.config = config;
        this.logDir = path.resolve(__dirname, '..', config.directory || './logs');
        this.retentionDays = config.retentionDays || 30;

        this.ensureLogDirectory();
        this.cleanupOldLogs();
    }

    /**
     * 로그 디렉토리 생성
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
            console.log(`✅ 로그 디렉토리 생성: ${this.logDir}`);
        }
    }

    /**
     * 오래된 로그 파일 정리 (30일 이상)
     */
    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir);
            const now = Date.now();
            const cutoff = this.retentionDays * 24 * 60 * 60 * 1000;

            let deletedCount = 0;
            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtimeMs > cutoff) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            });

            if (deletedCount > 0) {
                console.log(`🗑️  ${deletedCount}개의 오래된 로그 파일 삭제 (${this.retentionDays}일 초과)`);
            }
        } catch (error) {
            console.error('로그 정리 실패:', error.message);
        }
    }

    /**
     * 알림 로그 저장
     */
    logAlert(alert) {
        const timestamp = new Date();
        const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
        const logFileName = `db-alert-${dateStr}.json`;
        const logFilePath = path.join(this.logDir, logFileName);

        // 로그 엔트리 생성
        const logEntry = {
            timestamp: timestamp.toISOString(),
            level: alert.level,
            alertType: alert.type,
            severity: alert.severity || 0,
            message: alert.message,
            details: {
                sessionId: alert.sessionId,
                executionTimeMs: alert.executionTimeMs,
                cpuTimeMs: alert.cpuTimeMs,
                logicalReads: alert.logicalReads,
                blockingSessionId: alert.blockingSessionId,
                waitType: alert.waitType,
                queryText: this.truncateQuery(alert.queryText),
                executionPlan: alert.executionPlan
            },
            metadata: {
                database: alert.database,
                server: alert.server,
                monitorVersion: '1.0.0'
            }
        };

        // 파일에 append
        this.appendToJsonFile(logFilePath, logEntry);

        return logFilePath;
    }

    /**
     * JSON 파일에 로그 추가
     */
    appendToJsonFile(filePath, entry) {
        try {
            let logs = [];

            // 기존 로그 읽기
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content.trim()) {
                    logs = JSON.parse(content);
                }
            }

            // 새 로그 추가
            logs.push(entry);

            // 파일 저장
            fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('로그 저장 실패:', error.message);

            // 실패 시 별도 파일에 저장 (백업)
            const backupFile = `${filePath}.${Date.now()}.backup`;
            fs.writeFileSync(backupFile, JSON.stringify([entry], null, 2));
        }
    }

    /**
     * 쿼리 텍스트 자르기
     */
    truncateQuery(queryText) {
        if (!queryText) return null;

        const maxLength = this.config.maxQueryTextLength || 500;
        if (queryText.length <= maxLength) {
            return queryText;
        }

        return queryText.substring(0, maxLength) + '... (truncated)';
    }

    /**
     * 일별 통계 생성
     */
    generateDailyStats(date = new Date()) {
        const dateStr = date.toISOString().split('T')[0];
        const logFileName = `db-alert-${dateStr}.json`;
        const logFilePath = path.join(this.logDir, logFileName);

        if (!fs.existsSync(logFilePath)) {
            return null;
        }

        const logs = JSON.parse(fs.readFileSync(logFilePath, 'utf-8'));

        const stats = {
            date: dateStr,
            totalAlerts: logs.length,
            byLevel: {
                critical: logs.filter(l => l.level === 'critical').length,
                warning: logs.filter(l => l.level === 'warning').length,
                info: logs.filter(l => l.level === 'info').length
            },
            byType: {},
            avgExecutionTime: 0,
            maxExecutionTime: 0,
            slowestQuery: null
        };

        // 타입별 집계
        logs.forEach(log => {
            const type = log.alertType;
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // 평균/최대 실행 시간
            const execTime = log.details.executionTimeMs;
            if (execTime) {
                stats.avgExecutionTime += execTime;
                if (execTime > stats.maxExecutionTime) {
                    stats.maxExecutionTime = execTime;
                    stats.slowestQuery = log.details.queryText;
                }
            }
        });

        if (logs.length > 0) {
            stats.avgExecutionTime = Math.round(stats.avgExecutionTime / logs.length);
        }

        return stats;
    }

    /**
     * 로그 검색
     */
    searchLogs(criteria) {
        const { startDate, endDate, level, type, minExecutionTime } = criteria;
        const results = [];

        const files = fs.readdirSync(this.logDir)
            .filter(f => f.startsWith('db-alert-') && f.endsWith('.json'))
            .sort();

        files.forEach(file => {
            const filePath = path.join(this.logDir, file);
            const logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            logs.forEach(log => {
                let match = true;

                if (startDate && log.timestamp < startDate) match = false;
                if (endDate && log.timestamp > endDate) match = false;
                if (level && log.level !== level) match = false;
                if (type && log.alertType !== type) match = false;
                if (minExecutionTime && log.details.executionTimeMs < minExecutionTime) match = false;

                if (match) {
                    results.push(log);
                }
            });
        });

        return results;
    }
}

module.exports = AlertLogger;
