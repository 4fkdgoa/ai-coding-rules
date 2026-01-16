/**
 * MSSQL DB 성능 프로파일러
 * URL별 쿼리 실행 계획 및 성능 분석
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// MSSQL 연결 설정 (실제 정보로 변경 필요)
const config = {
    user: 'your_username',
    password: 'your_password',
    server: '211.217.11.5',  // SDMS 서버
    database: 'AutoCRM_Samchully',
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

// URL별 쿼리 매핑 (소스 코드 분석 결과)
const QUERY_MAP = {
    '/stock/stockList.json': {
        name: '재고 목록 조회',
        queryFile: 'listStock.sql',
        description: '엑셀 관리 페이지의 재고 목록 조회 쿼리'
    },
    '/sfa/in/cm/incm01.crm': {
        name: '입고관리',
        queryFile: 'incm01.sql',
        description: '입고관리 페이지'
    }
};

class MSSQLProfiler {
    constructor() {
        this.pool = null;
        this.results = [];
    }

    /**
     * DB 연결
     */
    async connect() {
        try {
            this.pool = await sql.connect(config);
            console.log('✅ MSSQL 연결 성공');
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
        if (this.pool) {
            await this.pool.close();
            console.log('DB 연결 종료');
        }
    }

    /**
     * 쿼리 실행 계획 분석
     */
    async analyzeExecutionPlan(query, queryName) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 ${queryName} 실행 계획 분석`);
        console.log('='.repeat(60));

        try {
            // 실행 계획 활성화
            await this.pool.request().query('SET STATISTICS XML ON');
            await this.pool.request().query('SET STATISTICS IO ON');
            await this.pool.request().query('SET STATISTICS TIME ON');

            // 쿼리 실행
            const startTime = Date.now();
            const result = await this.pool.request().query(query);
            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // 실행 계획 가져오기
            const planResult = await this.pool.request()
                .query(`SELECT query_plan FROM sys.dm_exec_cached_plans AS cp
                        CROSS APPLY sys.dm_exec_query_plan(cp.plan_handle) AS qp
                        WHERE cp.plan_handle = (SELECT TOP 1 plan_handle FROM sys.dm_exec_query_stats ORDER BY last_execution_time DESC)`);

            const analysis = {
                queryName,
                executionTime: `${executionTime}ms`,
                rowCount: result.recordset.length,
                timestamp: new Date().toISOString()
            };

            console.log(`\n⏱️  실행 시간: ${executionTime}ms`);
            console.log(`📦 결과 행 수: ${result.recordset.length}개`);

            // 실행 계획 비활성화
            await this.pool.request().query('SET STATISTICS XML OFF');
            await this.pool.request().query('SET STATISTICS IO OFF');
            await this.pool.request().query('SET STATISTICS TIME OFF');

            return analysis;

        } catch (error) {
            console.error(`❌ 실행 계획 분석 실패:`, error.message);
            return null;
        }
    }

    /**
     * 실시간 쿼리 모니터링 (Extended Events 사용)
     */
    async startMonitoring() {
        console.log('\n🔍 실시간 쿼리 모니터링 시작...');
        console.log('(Ctrl+C로 중단)\n');

        // 현재 실행 중인 쿼리 감시
        const monitorInterval = setInterval(async () => {
            try {
                const result = await this.pool.request().query(`
                    SELECT TOP 10
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
                    AND DB_NAME(req.database_id) = '${config.database}'
                    ORDER BY req.total_elapsed_time DESC
                `);

                if (result.recordset.length > 0) {
                    console.log(`\n⏰ ${new Date().toLocaleTimeString()} - 실행 중인 쿼리:`);

                    result.recordset.forEach((row, index) => {
                        console.log(`\n[쿼리 ${index + 1}]`);
                        console.log(`  세션 ID: ${row.session_id}`);
                        console.log(`  실행 시간: ${row.total_elapsed_time}ms`);
                        console.log(`  CPU 시간: ${row.cpu_time}ms`);
                        console.log(`  읽기: ${row.logical_reads}회`);
                        console.log(`  대기: ${row.wait_type || '없음'}`);
                        console.log(`  쿼리: ${row.query_text.substring(0, 100)}...`);
                    });
                }
            } catch (error) {
                console.error('모니터링 에러:', error.message);
            }
        }, 2000); // 2초마다 확인

        // Ctrl+C 처리
        process.on('SIGINT', () => {
            clearInterval(monitorInterval);
            this.disconnect();
            process.exit();
        });
    }

    /**
     * 느린 쿼리 분석
     */
    async analyzeSlowQueries(thresholdMs = 1000) {
        console.log(`\n🐌 ${thresholdMs}ms 이상 느린 쿼리 분석...\n`);

        const result = await this.pool.request().query(`
            SELECT TOP 20
                qs.total_elapsed_time / qs.execution_count / 1000 AS avg_elapsed_time_ms,
                qs.execution_count,
                qs.total_logical_reads / qs.execution_count AS avg_logical_reads,
                qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_time_ms,
                qs.last_execution_time,
                SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
                    ((CASE qs.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt.text)
                        ELSE qs.statement_end_offset
                    END - qs.statement_start_offset)/2)+1) AS query_text,
                qp.query_plan
            FROM sys.dm_exec_query_stats qs
            CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS qt
            CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) AS qp
            WHERE qs.total_elapsed_time / qs.execution_count > ${thresholdMs * 1000}
            AND DB_NAME(qt.dbid) = '${config.database}'
            ORDER BY avg_elapsed_time_ms DESC
        `);

        result.recordset.forEach((row, index) => {
            console.log(`\n[느린 쿼리 ${index + 1}]`);
            console.log(`  평균 실행 시간: ${row.avg_elapsed_time_ms.toFixed(2)}ms`);
            console.log(`  실행 횟수: ${row.execution_count}회`);
            console.log(`  평균 CPU 시간: ${row.avg_cpu_time_ms.toFixed(2)}ms`);
            console.log(`  평균 읽기: ${row.avg_logical_reads.toFixed(0)}회`);
            console.log(`  마지막 실행: ${row.last_execution_time.toISOString()}`);
            console.log(`  쿼리: ${row.query_text.substring(0, 200)}...`);

            // 실행 계획 분석
            this.analyzeQueryPlan(row.query_plan);
        });

        return result.recordset;
    }

    /**
     * 실행 계획 분석 (간단한 버전)
     */
    analyzeQueryPlan(xmlPlan) {
        if (!xmlPlan) return;

        // XML을 파싱해서 주요 정보 추출 (간단한 버전)
        const plan = xmlPlan.toString();

        // Table Scan 찾기 (인덱스 사용 안 함)
        const tableScans = (plan.match(/PhysicalOp="Table Scan"/g) || []).length;
        // Index Scan vs Index Seek
        const indexScans = (plan.match(/PhysicalOp="Index Scan"/g) || []).length;
        const indexSeeks = (plan.match(/PhysicalOp="Index Seek"/g) || []).length;

        console.log(`\n  📋 실행 계획 요약:`);

        if (tableScans > 0) {
            console.log(`    ⚠️  Table Scan: ${tableScans}개 (인덱스 미사용 - 개선 필요!)`);
        }
        if (indexScans > 0) {
            console.log(`    ⚠️  Index Scan: ${indexScans}개 (전체 인덱스 스캔 - 개선 가능)`);
        }
        if (indexSeeks > 0) {
            console.log(`    ✅ Index Seek: ${indexSeeks}개 (효율적)`);
        }
    }

    /**
     * 테이블별 인덱스 정보 조회
     */
    async analyzeIndexes(tableName) {
        console.log(`\n📑 ${tableName} 테이블 인덱스 분석...\n`);

        const result = await this.pool.request()
            .input('tableName', sql.VarChar, tableName)
            .query(`
                SELECT
                    i.name AS index_name,
                    i.type_desc AS index_type,
                    STUFF((
                        SELECT ', ' + c.name
                        FROM sys.index_columns ic
                        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                        ORDER BY ic.key_ordinal
                        FOR XML PATH('')
                    ), 1, 2, '') AS columns,
                    s.user_seeks,
                    s.user_scans,
                    s.user_lookups,
                    s.user_updates,
                    s.last_user_seek,
                    s.last_user_scan
                FROM sys.indexes i
                LEFT JOIN sys.dm_db_index_usage_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id AND s.database_id = DB_ID()
                WHERE i.object_id = OBJECT_ID(@tableName)
                AND i.type > 0
                ORDER BY s.user_seeks DESC, s.user_scans DESC
            `);

        result.recordset.forEach(row => {
            console.log(`\n인덱스: ${row.index_name}`);
            console.log(`  타입: ${row.index_type}`);
            console.log(`  컬럼: ${row.columns || '정보 없음'}`);
            console.log(`  Seek: ${row.user_seeks || 0}회`);
            console.log(`  Scan: ${row.user_scans || 0}회`);
            console.log(`  Update: ${row.user_updates || 0}회`);
        });
    }

    /**
     * 쿼리 최적화 제안
     */
    suggestOptimizations(analysis) {
        console.log(`\n\n💡 최적화 제안:`);
        console.log('='.repeat(60));

        // 실행 시간 기반
        const execTimeMs = parseInt(analysis.executionTime);
        if (execTimeMs > 1000) {
            console.log(`\n⚠️  실행 시간이 ${execTimeMs}ms로 느립니다.`);
            console.log(`   제안:`);
            console.log(`   1. WHERE 절에 사용되는 컬럼에 인덱스 추가`);
            console.log(`   2. JOIN 순서 최적화`);
            console.log(`   3. 불필요한 LEFT JOIN → INNER JOIN 변경`);
            console.log(`   4. SELECT * → 필요한 컬럼만 SELECT`);
        }

        // 행 수 기반
        if (analysis.rowCount > 1000) {
            console.log(`\n⚠️  결과 행 수가 ${analysis.rowCount}개로 많습니다.`);
            console.log(`   제안:`);
            console.log(`   1. 페이징 적용 (OFFSET FETCH)`);
            console.log(`   2. WHERE 절로 필터링 강화`);
        }
    }
}

// 메인 실행
async function main() {
    const profiler = new MSSQLProfiler();

    // DB 연결
    const connected = await profiler.connect();
    if (!connected) {
        console.error('DB 연결 실패. 설정을 확인하세요.');
        return;
    }

    console.log('\n📊 MSSQL DB 성능 프로파일러');
    console.log('='.repeat(60));
    console.log('1. 실시간 모니터링');
    console.log('2. 느린 쿼리 분석');
    console.log('3. 특정 쿼리 실행 계획');
    console.log('4. 테이블 인덱스 분석');
    console.log('='.repeat(60));

    // 여기서는 느린 쿼리 분석 실행
    await profiler.analyzeSlowQueries(500); // 500ms 이상

    // STOCK 테이블 인덱스 분석
    await profiler.analyzeIndexes('STOCK');
    await profiler.analyzeIndexes('STOCK_EXT');

    // 실시간 모니터링 (선택사항 - 주석 해제하여 사용)
    // await profiler.startMonitoring();

    await profiler.disconnect();
}

// 실행
if (require.main === module) {
    main().catch(console.error);
}

module.exports = MSSQLProfiler;
