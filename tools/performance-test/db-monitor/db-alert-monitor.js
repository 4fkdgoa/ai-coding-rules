/**
 * DB 알림 모니터링 시스템
 * 이상 징후 자동 감지 → 로그 저장 + 이메일 발송
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const AlertLogger = require('./utils/alert-logger');
const EmailSender = require('./utils/email-sender');
const WebhookSender = require('./utils/webhook-sender');
const QueryWatcher = require('./query-watcher');
const LockMonitor = require('./lock-monitor');
const LockHistoryManager = require('./utils/lock-history-manager');

// 설정 파일 로드
const configPath = path.join(__dirname, 'config', 'alert-config.json');
const alertConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// MSSQL 연결 설정
const dbConfig = {
    user: process.env.DB_USER || 'your_username',
    password: process.env.DB_PASSWORD || 'your_password',
    server: process.env.DB_SERVER || '211.217.11.5',
    database: process.env.DB_NAME || 'AutoCRM_Samchully',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

class DBAlertMonitor {
    constructor() {
        this.pool = null;
        this.logger = new AlertLogger(alertConfig.logging);
        this.emailSender = new EmailSender(alertConfig.email);
        this.webhookSender = new WebhookSender(alertConfig.webhook || {});
        this.queryWatcher = null;  // 특정 쿼리 감시
        this.lockMonitor = null;   // Lock 상세 모니터링
        this.thresholds = alertConfig.thresholds;
        this.enabledChecks = alertConfig.monitoring.enabledChecks;
        this.intervalSeconds = alertConfig.monitoring.intervalSeconds || 10;
        this.monitorInterval = null;
        this.alertCount = { critical: 0, warning: 0, info: 0 };

        // Lock 누적 추적 (LRU + 영속화)
        this.lockHistory = new LockHistoryManager({
            maxEntries: 10000,
            persistInterval: 60000  // 1분마다 저장
        });
        this.lockAccumulationThreshold = (alertConfig.lockMonitoring?.accumulationMinutes || 10) * 60 * 1000;
    }

    /**
     * DB 연결
     */
    async connect() {
        try {
            this.pool = await sql.connect(dbConfig);
            console.log('✅ MSSQL 연결 성공');
            console.log(`📊 모니터링 간격: ${this.intervalSeconds}초`);

            // QueryWatcher 초기화 (특정 쿼리 감시)
            if (alertConfig.watchQueries && alertConfig.watchQueries.length > 0) {
                this.queryWatcher = new QueryWatcher(this.pool, alertConfig);
                console.log(`🎯 특정 쿼리 감시: ${alertConfig.watchQueries.length}개`);
            }

            // LockMonitor 초기화
            if (alertConfig.lockMonitoring?.enabled !== false) {
                this.lockMonitor = new LockMonitor(this.pool);
                console.log('🔒 Lock 상세 모니터링 활성화');
            }

            return true;
        } catch (error) {
            console.error('❌ MSSQL 연결 실패:', error.message);
            return false;
        }
    }

    /**
     * 연결 종료
     */
    async disconnect() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        // Lock history 저장 및 종료
        if (this.lockHistory) {
            this.lockHistory.shutdown();
        }

        if (this.pool) {
            await this.pool.close();
            console.log('\n✅ DB 연결 종료');
        }
        this.printSummary();
    }

    /**
     * 모니터링 시작
     */
    async startMonitoring() {
        console.log('\n🔍 DB 알림 모니터링 시작...');
        console.log('(Ctrl+C로 중단)\n');

        // 초기 체크
        await this.checkAll();

        // 주기적 체크
        this.monitorInterval = setInterval(async () => {
            await this.checkAll();
        }, this.intervalSeconds * 1000);

        // Ctrl+C 처리
        process.on('SIGINT', async () => {
            console.log('\n\n⏹️  모니터링 중단 요청...');
            await this.disconnect();
            process.exit();
        });
    }

    /**
     * 모든 체크 실행
     */
    async checkAll() {
        const timestamp = new Date().toLocaleTimeString('ko-KR');
        console.log(`⏰ ${timestamp} - 체크 시작...`);

        try {
            // 1. 느린 쿼리 전체 감지
            if (this.enabledChecks.slowQueries) {
                await this.checkSlowQueries();
            }

            // 2. 특정 쿼리 감시 (QueryWatcher)
            if (this.queryWatcher) {
                await this.checkWatchedQueries();
            }

            // 3. 차단(Blocking) 체크
            if (this.enabledChecks.blocking) {
                await this.checkBlocking();
            }

            // 4. Lock 누적 체크 (장시간 유지)
            if (this.lockMonitor) {
                await this.checkLockAccumulation();
            }

            // 5. 높은 CPU 체크
            if (this.enabledChecks.highCpu) {
                await this.checkHighCpu();
            }

            // 6. 데드락 체크
            if (this.enabledChecks.deadlocks) {
                await this.checkDeadlocks();
            }

            // 7. 인덱스 사용률 체크 (추가)
            if (this.enabledChecks.indexUsage !== false) {
                await this.checkIndexUsage();
            }

            // 8. 버퍼 캐시 히트율 체크 (추가)
            if (this.enabledChecks.bufferCache !== false) {
                await this.checkBufferCacheHit();
            }

            console.log(`  ✓ 체크 완료\n`);

        } catch (error) {
            console.error(`  ✗ 체크 실패:`, error.message);
        }
    }

    /**
     * 느린 쿼리 체크
     */
    async checkSlowQueries() {
        const result = await this.pool.request()
            .input('dbName', sql.NVarChar, dbConfig.database)
            .query(`
            SELECT TOP 5
                req.session_id,
                req.status,
                req.command,
                SUBSTRING(qt.text, (req.statement_start_offset/2)+1,
                    ((CASE req.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt.text)
                        ELSE req.statement_end_offset
                    END - req.statement_start_offset)/2)+1) AS query_text,
                req.cpu_time,
                req.total_elapsed_time,
                req.logical_reads,
                req.writes,
                req.wait_type,
                req.wait_time,
                req.blocking_session_id,
                DB_NAME(req.database_id) AS database_name
            FROM sys.dm_exec_requests req
            CROSS APPLY sys.dm_exec_sql_text(req.sql_handle) AS qt
            WHERE req.session_id != @@SPID
            AND req.status = 'running'
            AND DB_NAME(req.database_id) = @dbName
            ORDER BY req.total_elapsed_time DESC
        `);

        for (const row of result.recordset) {
            const level = this.determineLevel(row.total_elapsed_time, 'executionTimeMs');

            if (level) {
                await this.createAlert({
                    type: 'slow_query',
                    level: level,
                    message: `느린 쿼리 감지: ${row.total_elapsed_time}ms`,
                    sessionId: row.session_id,
                    database: row.database_name,
                    executionTimeMs: row.total_elapsed_time,
                    cpuTimeMs: row.cpu_time,
                    logicalReads: row.logical_reads,
                    blockingSessionId: row.blocking_session_id || null,
                    waitType: row.wait_type || null,
                    queryText: row.query_text
                });
            }
        }
    }

    /**
     * 차단(Blocking) 체크
     */
    async checkBlocking() {
        const result = await this.pool.request()
            .input('dbName', sql.NVarChar, dbConfig.database)
            .query(`
            SELECT
                blocked.session_id AS blocked_session,
                blocking.session_id AS blocking_session,
                blocked.wait_time AS wait_time_ms,
                blocked.wait_type,
                SUBSTRING(qt_blocked.text, (blocked.statement_start_offset/2)+1,
                    ((CASE blocked.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt_blocked.text)
                        ELSE blocked.statement_end_offset
                    END - blocked.statement_start_offset)/2)+1) AS blocked_query,
                SUBSTRING(qt_blocking.text, (blocking.statement_start_offset/2)+1,
                    ((CASE blocking.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt_blocking.text)
                        ELSE blocking.statement_end_offset
                    END - blocking.statement_start_offset)/2)+1) AS blocking_query,
                DB_NAME(blocked.database_id) AS database_name
            FROM sys.dm_exec_requests blocked
            CROSS APPLY sys.dm_exec_sql_text(blocked.sql_handle) AS qt_blocked
            LEFT JOIN sys.dm_exec_requests blocking ON blocked.blocking_session_id = blocking.session_id
            LEFT JOIN sys.dm_exec_sql_text(blocking.sql_handle) AS qt_blocking ON 1=1
            WHERE blocked.blocking_session_id != 0
            AND DB_NAME(blocked.database_id) = @dbName
        `);

        for (const row of result.recordset) {
            const level = this.determineLevel(row.wait_time_ms, 'blockingTimeMs');

            if (level) {
                await this.createAlert({
                    type: 'blocking',
                    level: level,
                    message: `차단 감지: 세션 ${row.blocking_session}이(가) 세션 ${row.blocked_session}을(를) ${row.wait_time_ms}ms 차단 중`,
                    sessionId: row.blocked_session,
                    database: row.database_name,
                    executionTimeMs: row.wait_time_ms,
                    blockingSessionId: row.blocking_session,
                    waitType: row.wait_type,
                    queryText: `[차단된 쿼리]\n${row.blocked_query}\n\n[차단 중인 쿼리]\n${row.blocking_query || '알 수 없음'}`
                });
            }
        }
    }

    /**
     * 높은 CPU 사용량 체크
     */
    async checkHighCpu() {
        const result = await this.pool.request()
            .input('dbName', sql.NVarChar, dbConfig.database)
            .input('cpuThreshold', sql.Int, this.thresholds.info.cpuTimeMs)
            .query(`
            SELECT TOP 5
                req.session_id,
                req.cpu_time,
                req.total_elapsed_time,
                req.logical_reads,
                SUBSTRING(qt.text, (req.statement_start_offset/2)+1,
                    ((CASE req.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt.text)
                        ELSE req.statement_end_offset
                    END - req.statement_start_offset)/2)+1) AS query_text,
                DB_NAME(req.database_id) AS database_name
            FROM sys.dm_exec_requests req
            CROSS APPLY sys.dm_exec_sql_text(req.sql_handle) AS qt
            WHERE req.session_id != @@SPID
            AND req.status = 'running'
            AND DB_NAME(req.database_id) = @dbName
            AND req.cpu_time > @cpuThreshold
            ORDER BY req.cpu_time DESC
        `);

        for (const row of result.recordset) {
            const level = this.determineLevel(row.cpu_time, 'cpuTimeMs');

            if (level) {
                await this.createAlert({
                    type: 'high_cpu',
                    level: level,
                    message: `높은 CPU 사용: ${row.cpu_time}ms`,
                    sessionId: row.session_id,
                    database: row.database_name,
                    executionTimeMs: row.total_elapsed_time,
                    cpuTimeMs: row.cpu_time,
                    logicalReads: row.logical_reads,
                    queryText: row.query_text
                });
            }
        }
    }

    /**
     * 데드락 체크
     */
    async checkDeadlocks() {
        // sys.dm_exec_query_stats에서 최근 데드락 감지
        const result = await this.pool.request().query(`
            SELECT TOP 1
                qs.execution_count,
                qs.total_elapsed_time,
                qs.last_execution_time,
                SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
                    ((CASE qs.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt.text)
                        ELSE qs.statement_end_offset
                    END - qs.statement_start_offset)/2)+1) AS query_text
            FROM sys.dm_exec_query_stats qs
            CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS qt
            WHERE qt.text LIKE '%deadlock%'
            OR qt.text LIKE '%1205%'
            ORDER BY qs.last_execution_time DESC
        `);

        // 실제로는 Extended Events나 SQL Profiler를 사용하는 것이 더 정확
        // 여기서는 간단한 버전만 구현
    }

    /**
     * 레벨 판정
     */
    determineLevel(value, thresholdKey) {
        if (value >= this.thresholds.critical[thresholdKey]) {
            return 'critical';
        } else if (value >= this.thresholds.warning[thresholdKey]) {
            return 'warning';
        } else if (value >= this.thresholds.info[thresholdKey]) {
            return 'info';
        }
        return null;
    }

    /**
     * 알림 생성 및 처리
     */
    async createAlert(alertData) {
        const alert = {
            timestamp: new Date().toISOString(),
            ...alertData
        };

        // 실행 계획 분석 (선택적)
        if (this.enabledChecks.tableScan && alert.queryText) {
            alert.executionPlan = await this.analyzeExecutionPlan(alert.queryText);
        }

        // 로그 저장
        if (alertConfig.logging.enabled) {
            const logFile = this.logger.logAlert(alert);
            console.log(`  📝 로그 저장: ${path.basename(logFile)}`);
        }

        // 이메일 발송
        if (alertConfig.email.enabled) {
            const sent = await this.emailSender.sendAlert(alert);
            if (sent) {
                console.log(`  📧 이메일 발송: ${alert.level.toUpperCase()} - ${alert.message}`);
            }
        }

        // Webhook 발송
        if (alertConfig.webhook && alertConfig.webhook.enabled) {
            const sent = await this.webhookSender.sendAlert(alert);
            if (sent) {
                console.log(`  🔔 Webhook 발송: ${alert.level.toUpperCase()} - ${alert.message}`);
            }
        }

        // 콘솔 출력
        const levelEmoji = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };
        console.log(`  ${levelEmoji[alert.level]} [${alert.level.toUpperCase()}] ${alert.message}`);

        // 카운트 증가
        this.alertCount[alert.level]++;
    }

    /**
     * 간단한 실행 계획 분석
     */
    async analyzeExecutionPlan(queryText) {
        try {
            // SHOWPLAN_XML을 사용하여 실행 계획 가져오기
            await this.pool.request().query('SET SHOWPLAN_XML ON');
            const result = await this.pool.request().query(queryText);
            await this.pool.request().query('SET SHOWPLAN_XML OFF');

            const plan = result.recordset[0] ? result.recordset[0]['XML'] : '';

            return {
                tableScans: (plan.match(/PhysicalOp="Table Scan"/g) || []).length,
                indexScans: (plan.match(/PhysicalOp="Index Scan"/g) || []).length,
                indexSeeks: (plan.match(/PhysicalOp="Index Seek"/g) || []).length
            };
        } catch (error) {
            // 실행 계획 가져오기 실패 시 무시
            return null;
        }
    }

    /**
     * 특정 쿼리 감시 (QueryWatcher)
     */
    async checkWatchedQueries() {
        const alerts = await this.queryWatcher.checkWatchedQueries();

        for (const alert of alerts) {
            // 레벨 판정 (임계값 기준)
            const level = this.determineLevel(alert.executionTimeMs, 'executionTimeMs');

            if (level) {
                await this.createAlert({
                    type: 'watch_query',
                    level: level,
                    message: `워치 쿼리 감지: ${alert.queryName} (${alert.executionTimeMs}ms, 임계값: ${alert.threshold}ms)`,
                    sessionId: alert.sessionId,
                    database: alert.database,
                    executionTimeMs: alert.executionTimeMs,
                    cpuTimeMs: alert.cpuTimeMs,
                    logicalReads: alert.logicalReads,
                    blockingSessionId: alert.blockingSessionId,
                    waitType: alert.waitType,
                    queryText: alert.queryText,
                    queryName: alert.queryName,
                    threshold: alert.threshold
                });
            }
        }
    }

    /**
     * 인덱스 사용률 체크 (미사용 인덱스 감지)
     */
    async checkIndexUsage() {
        const result = await this.pool.request()
            .input('dbName', sql.NVarChar, dbConfig.database)
            .query(`
            SELECT
                OBJECT_NAME(i.object_id) AS table_name,
                i.name AS index_name,
                i.type_desc AS index_type,
                ISNULL(ius.user_seeks, 0) AS user_seeks,
                ISNULL(ius.user_scans, 0) AS user_scans,
                ISNULL(ius.user_lookups, 0) AS user_lookups,
                ISNULL(ius.user_updates, 0) AS user_updates
            FROM sys.indexes i
            LEFT JOIN sys.dm_db_index_usage_stats ius
                ON i.object_id = ius.object_id
                AND i.index_id = ius.index_id
                AND ius.database_id = DB_ID(@dbName)
            WHERE i.object_id > 100  -- 시스템 테이블 제외
            AND i.is_primary_key = 0
            AND i.is_unique_constraint = 0
            AND ISNULL(ius.user_seeks, 0) = 0
            AND ISNULL(ius.user_scans, 0) = 0
            AND ISNULL(ius.user_lookups, 0) = 0
            AND ius.user_updates > 0  -- 업데이트는 있지만 조회는 없음
        `);

        for (const row of result.recordset) {
            await this.createAlert({
                type: 'unused_index',
                level: 'info',
                message: `미사용 인덱스 감지: ${row.table_name}.${row.index_name}`,
                database: dbConfig.database,
                executionTimeMs: 0,
                queryText: `-- 미사용 인덱스 제거 고려\nDROP INDEX ${row.index_name} ON ${row.table_name};`,
                indexDetails: {
                    tableName: row.table_name,
                    indexName: row.index_name,
                    indexType: row.index_type,
                    userUpdates: row.user_updates
                }
            });
        }
    }

    /**
     * 버퍼 캐시 히트율 체크
     */
    async checkBufferCacheHit() {
        const result = await this.pool.request()
            .input('dbName', sql.NVarChar, dbConfig.database)
            .query(`
            SELECT
                COUNT(*) AS total_pages,
                SUM(CASE WHEN is_modified = 1 THEN 1 ELSE 0 END) AS dirty_pages,
                SUM(CASE WHEN is_modified = 0 THEN 1 ELSE 0 END) AS clean_pages,
                (CAST(SUM(CASE WHEN is_modified = 0 THEN 1 ELSE 0 END) AS FLOAT) /
                    NULLIF(COUNT(*), 0)) * 100 AS cache_hit_ratio
            FROM sys.dm_os_buffer_descriptors
            WHERE database_id = DB_ID(@dbName)
        `);

        if (result.recordset.length > 0) {
            const row = result.recordset[0];
            const hitRatio = row.cache_hit_ratio || 0;

            // 캐시 히트율이 90% 미만이면 경고
            if (hitRatio < 90) {
                await this.createAlert({
                    type: 'low_cache_hit',
                    level: 'warning',
                    message: `낮은 버퍼 캐시 히트율: ${hitRatio.toFixed(2)}%`,
                    database: dbConfig.database,
                    executionTimeMs: 0,
                    queryText: `-- 버퍼 캐시 상태\n-- 히트율: ${hitRatio.toFixed(2)}%\n-- 더티 페이지: ${row.dirty_pages}\n-- 클린 페이지: ${row.clean_pages}`,
                    cacheDetails: {
                        totalPages: row.total_pages,
                        dirtyPages: row.dirty_pages,
                        cleanPages: row.clean_pages,
                        cacheHitRatio: hitRatio
                    }
                });
            }
        }
    }

    /**
     * Lock 누적 추적 (장시간 유지되는 Lock 감지)
     */
    async checkLockAccumulation() {
        const conflicts = await this.lockMonitor.detectLockConflicts();
        const now = Date.now();

        // 현재 Lock 충돌 목록
        const currentBlockers = new Set();

        for (const conflict of conflicts) {
            const key = `${conflict.blockerSession}_${conflict.blockedSession}`;
            currentBlockers.add(key);

            if (!this.lockHistory.has(key)) {
                // 새로운 Lock 충돌 발견 → 추적 시작
                this.lockHistory.add(key, {
                    startTime: now,
                    lastSeen: now,
                    data: conflict
                });
            } else {
                // 기존 Lock 충돌 업데이트
                const history = this.lockHistory.get(key);
                history.lastSeen = now;
                history.data = conflict;

                // 누적 시간 계산
                const accumulatedMs = now - history.startTime;

                // 임계값 초과 시 알림 (10분 이상)
                if (accumulatedMs >= this.lockAccumulationThreshold) {
                    const accumulatedMinutes = Math.floor(accumulatedMs / 60000);

                    await this.createAlert({
                        type: 'lock_accumulation',
                        level: 'critical',
                        message: `Lock 장시간 유지: 세션 ${conflict.blockerSession}이(가) ${accumulatedMinutes}분 동안 계속 차단 중`,
                        sessionId: conflict.blockedSession,
                        database: conflict.database,
                        executionTimeMs: accumulatedMs,
                        blockingSessionId: conflict.blockerSession,
                        waitType: conflict.waitType,
                        queryText: `[차단된 쿼리]\n${conflict.blockedQuery}\n\n[차단 중인 쿼리]\n${conflict.blockerQuery}`,
                        lockDetails: {
                            accumulatedMinutes: accumulatedMinutes,
                            resourceType: conflict.resourceType,
                            objectName: conflict.objectName,
                            blockedLockMode: conflict.blockedLockMode,
                            blockerLockMode: conflict.blockerLockMode
                        }
                    });

                    // 알림 후 히스토리 갱신 (재알림 방지: 다시 10분 후)
                    history.startTime = now;
                }

                // 업데이트된 데이터 저장
                this.lockHistory.add(key, history);
            }
        }

        // 해결된 Lock 충돌 정리
        for (const [key, history] of this.lockHistory.entries()) {
            if (!currentBlockers.has(key)) {
                // 5초 이상 보이지 않으면 해결된 것으로 간주
                if (now - history.lastSeen > 5000) {
                    this.lockHistory.delete(key);
                }
            }
        }
    }

    /**
     * 요약 출력
     */
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 모니터링 요약');
        console.log('='.repeat(60));
        console.log(`🚨 Critical: ${this.alertCount.critical}건`);
        console.log(`⚠️  Warning:  ${this.alertCount.warning}건`);
        console.log(`ℹ️  Info:     ${this.alertCount.info}건`);
        console.log(`📝 총 알림:   ${this.alertCount.critical + this.alertCount.warning + this.alertCount.info}건`);
        console.log('='.repeat(60));

        // 일별 통계
        const stats = this.logger.generateDailyStats();
        if (stats) {
            console.log(`\n📅 오늘 통계 (${stats.date})`);
            console.log(`  총 알림: ${stats.totalAlerts}건`);
            console.log(`  평균 실행 시간: ${stats.avgExecutionTime}ms`);
            console.log(`  최대 실행 시간: ${stats.maxExecutionTime}ms`);
        }

        // Lock history 통계
        if (this.lockHistory) {
            const lockStats = this.lockHistory.getStats();
            console.log(`\n🔒 Lock History 통계`);
            console.log(`  추적 중인 Lock: ${lockStats.totalEntries}개`);
            console.log(`  메모리 사용률: ${lockStats.usagePercent}%`);
            console.log(`  평균 유지 시간: ${Math.floor(lockStats.avgDuration / 1000)}초`);
            console.log(`  최대 유지 시간: ${Math.floor(lockStats.maxDuration / 1000)}초`);
        }
    }
}

// 메인 실행
async function main() {
    console.log('📊 DB 알림 모니터링 시스템 v1.0');
    console.log('='.repeat(60));

    const monitor = new DBAlertMonitor();

    // DB 연결
    const connected = await monitor.connect();
    if (!connected) {
        console.error('DB 연결 실패. 환경변수를 확인하세요:');
        console.error('  DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME');
        process.exit(1);
    }

    // 모니터링 시작
    await monitor.startMonitoring();
}

// 실행
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DBAlertMonitor;
