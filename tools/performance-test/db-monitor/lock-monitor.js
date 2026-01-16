/**
 * Lock 상세 모니터링
 * - Lock 타입 (S, X, U, IS, IX, SIX 등)
 * - 테이블/인덱스 레벨
 * - 대기 시간
 * - 데드락 감지
 */

const sql = require('mssql');

class LockMonitor {
    constructor(dbPool) {
        this.pool = dbPool;
        this.lockTypes = {
            'S': 'Shared (읽기)',
            'X': 'Exclusive (쓰기)',
            'U': 'Update (업데이트 대기)',
            'IS': 'Intent Shared (테이블 읽기 의도)',
            'IX': 'Intent Exclusive (테이블 쓰기 의도)',
            'SIX': 'Shared Intent Exclusive (읽기 + 쓰기 의도)',
            'Sch-S': 'Schema Stability (스키마 안정)',
            'Sch-M': 'Schema Modification (스키마 수정)',
            'BU': 'Bulk Update (대량 업데이트)'
        };
    }

    /**
     * 현재 Lock 목록 조회
     */
    async getCurrentLocks() {
        const result = await this.pool.request().query(`
            SELECT
                l.request_session_id AS session_id,
                l.resource_type,
                l.resource_database_id,
                DB_NAME(l.resource_database_id) AS database_name,
                l.resource_associated_entity_id,
                OBJECT_NAME(l.resource_associated_entity_id, l.resource_database_id) AS object_name,
                l.request_mode AS lock_mode,
                l.request_type,
                l.request_status,
                es.host_name,
                es.program_name,
                es.login_name,
                SUBSTRING(qt.text, (er.statement_start_offset/2)+1,
                    ((CASE er.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt.text)
                        ELSE er.statement_end_offset
                    END - er.statement_start_offset)/2)+1) AS query_text,
                er.wait_time,
                er.wait_type,
                er.blocking_session_id
            FROM sys.dm_tran_locks l
            LEFT JOIN sys.dm_exec_sessions es ON l.request_session_id = es.session_id
            LEFT JOIN sys.dm_exec_requests er ON l.request_session_id = er.session_id
            OUTER APPLY sys.dm_exec_sql_text(er.sql_handle) AS qt
            WHERE l.request_session_id != @@SPID
            AND l.resource_type IN ('OBJECT', 'PAGE', 'KEY', 'RID', 'HOBT')
            ORDER BY l.request_session_id, l.resource_type
        `);

        return result.recordset.map(row => ({
            sessionId: row.session_id,
            resourceType: row.resource_type,
            database: row.database_name,
            objectName: row.object_name || 'Unknown',
            lockMode: row.lock_mode,
            lockModeDescription: this.lockTypes[row.lock_mode] || row.lock_mode,
            status: row.request_status,
            hostName: row.host_name,
            programName: row.program_name,
            loginName: row.login_name,
            queryText: row.query_text,
            waitTime: row.wait_time || 0,
            waitType: row.wait_type,
            blockingSessionId: row.blocking_session_id || null
        }));
    }

    /**
     * Lock 충돌 감지 (차단 중인 세션)
     */
    async detectLockConflicts() {
        const result = await this.pool.request().query(`
            SELECT
                blocked.session_id AS blocked_session,
                blocker.session_id AS blocker_session,
                blocked_es.host_name AS blocked_host,
                blocker_es.host_name AS blocker_host,
                blocked_es.program_name AS blocked_program,
                blocker_es.program_name AS blocker_program,
                blocked_lock.resource_type,
                DB_NAME(blocked_lock.resource_database_id) AS database_name,
                OBJECT_NAME(blocked_lock.resource_associated_entity_id, blocked_lock.resource_database_id) AS object_name,
                blocked_lock.request_mode AS blocked_lock_mode,
                blocker_lock.request_mode AS blocker_lock_mode,
                blocked.wait_time AS wait_time_ms,
                blocked.wait_type,
                SUBSTRING(blocked_qt.text, (blocked.statement_start_offset/2)+1,
                    ((CASE blocked.statement_end_offset
                        WHEN -1 THEN DATALENGTH(blocked_qt.text)
                        ELSE blocked.statement_end_offset
                    END - blocked.statement_start_offset)/2)+1) AS blocked_query,
                SUBSTRING(blocker_qt.text, (blocker.statement_start_offset/2)+1,
                    ((CASE blocker.statement_end_offset
                        WHEN -1 THEN DATALENGTH(blocker_qt.text)
                        ELSE blocker.statement_end_offset
                    END - blocker.statement_start_offset)/2)+1) AS blocker_query
            FROM sys.dm_exec_requests blocked
            INNER JOIN sys.dm_exec_sessions blocked_es ON blocked.session_id = blocked_es.session_id
            LEFT JOIN sys.dm_exec_requests blocker ON blocked.blocking_session_id = blocker.session_id
            LEFT JOIN sys.dm_exec_sessions blocker_es ON blocker.session_id = blocker_es.session_id
            LEFT JOIN sys.dm_tran_locks blocked_lock ON blocked.session_id = blocked_lock.request_session_id
            LEFT JOIN sys.dm_tran_locks blocker_lock ON blocker.session_id = blocker_lock.request_session_id
                AND blocked_lock.resource_type = blocker_lock.resource_type
                AND blocked_lock.resource_associated_entity_id = blocker_lock.resource_associated_entity_id
            CROSS APPLY sys.dm_exec_sql_text(blocked.sql_handle) AS blocked_qt
            OUTER APPLY sys.dm_exec_sql_text(blocker.sql_handle) AS blocker_qt
            WHERE blocked.blocking_session_id != 0
        `);

        return result.recordset.map(row => ({
            blockedSession: row.blocked_session,
            blockerSession: row.blocker_session,
            blockedHost: row.blocked_host,
            blockerHost: row.blocker_host,
            blockedProgram: row.blocked_program,
            blockerProgram: row.blocker_program,
            resourceType: row.resource_type,
            database: row.database_name,
            objectName: row.object_name || 'Unknown',
            blockedLockMode: row.blocked_lock_mode,
            blockerLockMode: row.blocker_lock_mode,
            waitTimeMs: row.wait_time_ms,
            waitType: row.wait_type,
            blockedQuery: row.blocked_query,
            blockerQuery: row.blocker_query || 'Unknown'
        }));
    }

    /**
     * 데드락 감지 (Extended Events 기반)
     */
    async detectDeadlocks() {
        // 주의: Extended Events 세션이 활성화되어 있어야 함
        try {
            const result = await this.pool.request().query(`
                SELECT TOP 10
                    xed.event_data.value('(/event/@timestamp)[1]', 'datetime2') AS timestamp,
                    xed.event_data.value('(/event/data[@name="deadlock_id"]/value)[1]', 'int') AS deadlock_id,
                    xed.event_data.value('(/event/data[@name="database_id"]/value)[1]', 'int') AS database_id,
                    xed.event_data.query('.') AS deadlock_xml
                FROM (
                    SELECT CAST(event_data AS XML) AS event_data
                    FROM sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL)
                    WHERE object_name = 'xml_deadlock_report'
                ) AS xed
                ORDER BY timestamp DESC
            `);

            return result.recordset.map(row => ({
                timestamp: row.timestamp,
                deadlockId: row.deadlock_id,
                databaseId: row.database_id,
                deadlockXml: row.deadlock_xml
            }));

        } catch (error) {
            // Extended Events 없으면 시스템 헬스 세션 확인
            console.warn('⚠️  Extended Events 접근 불가. 데드락 감지 제한적.');
            return [];
        }
    }

    /**
     * Lock 대기 시간 통계
     */
    async getLockWaitStats() {
        const result = await this.pool.request().query(`
            SELECT
                wait_type,
                waiting_tasks_count,
                wait_time_ms,
                max_wait_time_ms,
                signal_wait_time_ms
            FROM sys.dm_os_wait_stats
            WHERE wait_type LIKE 'LCK%'
            ORDER BY wait_time_ms DESC
        `);

        return result.recordset.map(row => ({
            waitType: row.wait_type,
            waitingTasksCount: row.waiting_tasks_count,
            totalWaitTimeMs: row.wait_time_ms,
            maxWaitTimeMs: row.max_wait_time_ms,
            signalWaitTimeMs: row.signal_wait_time_ms,
            avgWaitTimeMs: Math.round(row.wait_time_ms / row.waiting_tasks_count)
        }));
    }

    /**
     * 테이블별 Lock 통계
     */
    async getTableLockStats(databaseName) {
        const result = await this.pool.request()
            .input('dbName', sql.VarChar, databaseName)
            .query(`
                USE [@dbName];

                SELECT
                    OBJECT_NAME(p.object_id) AS table_name,
                    l.request_mode AS lock_mode,
                    COUNT(*) AS lock_count
                FROM sys.dm_tran_locks l
                INNER JOIN sys.partitions p ON l.resource_associated_entity_id = p.hobt_id
                WHERE l.resource_type = 'HOBT'
                AND p.object_id > 100
                GROUP BY p.object_id, l.request_mode
                ORDER BY lock_count DESC
            `);

        return result.recordset.map(row => ({
            tableName: row.table_name,
            lockMode: row.lock_mode,
            lockModeDescription: this.lockTypes[row.lock_mode] || row.lock_mode,
            lockCount: row.lock_count
        }));
    }

    /**
     * Lock 충돌 알림 생성
     */
    createLockAlert(conflict, level = 'warning') {
        return {
            timestamp: new Date().toISOString(),
            type: 'lock_conflict',
            level: level,
            message: `Lock 충돌: 세션 ${conflict.blockerSession}이(가) 세션 ${conflict.blockedSession}을(를) ${conflict.waitTimeMs}ms 차단`,
            sessionId: conflict.blockedSession,
            database: conflict.database,
            executionTimeMs: conflict.waitTimeMs,
            blockingSessionId: conflict.blockerSession,
            waitType: conflict.waitType,
            queryText: `[차단된 쿼리]\n${conflict.blockedQuery}\n\n[차단 중인 쿼리]\n${conflict.blockerQuery}`,
            lockDetails: {
                resourceType: conflict.resourceType,
                objectName: conflict.objectName,
                blockedLockMode: conflict.blockedLockMode,
                blockerLockMode: conflict.blockerLockMode,
                blockedHost: conflict.blockedHost,
                blockerHost: conflict.blockerHost,
                blockedProgram: conflict.blockedProgram,
                blockerProgram: conflict.blockerProgram
            }
        };
    }

    /**
     * Lock 통계 출력
     */
    printLockStats(stats) {
        console.log('\n' + '='.repeat(80));
        console.log('🔒 Lock 대기 통계');
        console.log('='.repeat(80));
        console.log('%-30s %12s %15s %15s', 'Wait Type', 'Tasks', 'Total (ms)', 'Avg (ms)');
        console.log('-'.repeat(80));

        for (const stat of stats) {
            console.log('%-30s %12d %15d %15d',
                stat.waitType,
                stat.waitingTasksCount,
                stat.totalWaitTimeMs,
                stat.avgWaitTimeMs
            );
        }

        console.log('='.repeat(80));
    }

    /**
     * Lock 충돌 상세 출력
     */
    printLockConflicts(conflicts) {
        if (conflicts.length === 0) {
            console.log('✅ Lock 충돌 없음');
            return;
        }

        console.log('\n' + '='.repeat(80));
        console.log(`🚨 Lock 충돌 감지: ${conflicts.length}건`);
        console.log('='.repeat(80));

        for (const conflict of conflicts) {
            console.log(`
[차단 정보]
  차단된 세션: ${conflict.blockedSession} (${conflict.blockedHost} - ${conflict.blockedProgram})
  차단 중인 세션: ${conflict.blockerSession} (${conflict.blockerHost} - ${conflict.blockerProgram})
  대기 시간: ${conflict.waitTimeMs}ms
  대기 유형: ${conflict.waitType}

[Lock 상세]
  리소스 타입: ${conflict.resourceType}
  테이블: ${conflict.objectName}
  차단된 Lock 모드: ${conflict.blockedLockMode} (${this.lockTypes[conflict.blockedLockMode] || ''})
  차단 중인 Lock 모드: ${conflict.blockerLockMode} (${this.lockTypes[conflict.blockerLockMode] || ''})

[차단된 쿼리]
${conflict.blockedQuery.substring(0, 200)}...

[차단 중인 쿼리]
${conflict.blockerQuery.substring(0, 200)}...
            `);
            console.log('-'.repeat(80));
        }
    }
}

module.exports = LockMonitor;
