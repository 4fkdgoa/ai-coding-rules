/**
 * 재고 목록 쿼리 상세 분석
 * 실제 DB에 연결해서 쿼리 실행 계획과 인덱스 사용 분석
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// MSSQL 연결 설정 (실제 정보 - context.xml에서 확인)
const config = {
    user: 'sfa',
    password: 'sfa',
    server: '211.217.11.17',
    database: 'SFA_Samchully_test2',
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 60000
    }
};

// listStock 쿼리 (간소화 버전 - 테스트용)
const STOCK_LIST_QUERY = `
WITH SSI AS  /* 재고 문제이력 */
(
    SELECT
        SI.ISSUE_ACT_GROUP, SI.ISSUE_ACT_SEQ , SI.ISSUE_DETAIL , SI.STOCK_SEQ ,
        SI.OCCURRENCE_DATE , SI.COMPLETE_YN , SI.CONFIRM_DATE
    FROM STOCK_ISSUE SI
    INNER JOIN (
        SELECT STOCK_SEQ , MAX(CREATE_DATE) CREATE_DATE
        FROM STOCK_ISSUE
        GROUP BY STOCK_SEQ
    ) SIS ON SIS.STOCK_SEQ = SI.STOCK_SEQ AND SIS.CREATE_DATE = SI.CREATE_DATE
)
SELECT TOP 100
    ST.STOCK_SEQ,
    ST.VIN_NO,
    ST.CREATE_DATE,
    AC.CLASS_NAME,
    AM.MODEL_NAME,
    AY.AUTO_YEAR,
    STE.CUSTOM_CLEARANCE_DATE,
    STE.BUYING_DATE,
    STE.PDI_STATUS,
    MC1.CODE_NAME AS STOCK_GUBUN_NAME,
    MC5.CODE_NAME AS AUTO_STATUS_NAME,
    KPS.KEEP_PLACE_NAME,
    SRC.SHOWROOM_NAME,
    SU.USER_NAME,
    SC.CUSTOMER_NAME,
    SC.CONTRACT_DATE
FROM STOCK ST
    LEFT JOIN STOCK_EXT STE ON STE.STOCK_SEQ = ST.STOCK_SEQ
    LEFT JOIN SALE_CONFER SC ON SC.STOCK_SEQ = ST.STOCK_SEQ AND SC.CONFER_GUBUN = '1'
    LEFT JOIN MASTER_CODES MC1 ON MC1.CODE_GROUP_SEQ = STE.STOCK_GUBUN_GROUP
        AND MC1.CODE_SEQ = STE.STOCK_GUBUN_SEQ
    LEFT JOIN MASTER_CODES MC5 ON ST.AUTO_STATUS_GROUP = MC5.CODE_GROUP_SEQ
        AND ST.AUTO_STATUS_SEQ = MC5.CODE_SEQ
    LEFT JOIN AUTO_MODELS AM ON ST.AUTO_MODEL = AM.AUTO_MODEL
    LEFT JOIN AUTO_CLASSES AC ON AC.AUTO_CLASS = AM.AUTO_CLASS
    LEFT JOIN AUTO_YEARS AY ON AY.AUTO_MODEL = ST.AUTO_MODEL AND AY.YEAR_SEQ = ST.YEAR_SEQ
    LEFT JOIN SALES_USERS SU ON SU.SALES_USER_SEQ = SC.SALES_USER_SEQ
    LEFT JOIN SHOWROOM_CODES SRC ON SRC.SHOWROOM_SEQ = SU.SHOWROOM_SEQ
    LEFT JOIN KEEP_PLACE_STOCK KPS ON KPS.KEEP_PLACE_SEQ = ST.KEEP_PLACE_SEQ
    LEFT JOIN SSI SI ON SI.STOCK_SEQ = ST.STOCK_SEQ
WHERE ST.DISABLE IS NULL
ORDER BY ST.CREATE_DATE DESC
`;

async function analyzeQuery() {
    console.log('🔍 SDMS 재고 목록 쿼리 상세 분석');
    console.log('='.repeat(80));

    let pool;
    try {
        // DB 연결
        console.log('\n📡 DB 연결 중...');
        console.log(`  서버: ${config.server}:${config.port}`);
        console.log(`  DB: ${config.database}`);

        pool = await sql.connect(config);
        console.log('✅ 연결 성공!\n');

        // ===== 1. 실행 계획 XML 가져오기 =====
        console.log('=' .repeat(80));
        console.log('📊 1단계: 실행 계획 분석 (실제 실행 안 함)');
        console.log('='.repeat(80));

        // 실행 계획 텍스트 형식으로 먼저 확인
        await pool.request().query('SET SHOWPLAN_TEXT ON');
        const planTextResult = await pool.request().query(STOCK_LIST_QUERY);
        await pool.request().query('SET SHOWPLAN_TEXT OFF');

        console.log(`\n📋 실행 계획 (텍스트):\n`);
        planTextResult.recordsets[0].forEach(row => {
            console.log(row['StmtText']);
        });

        // XML 형식은 나중에 (간단한 분석만 진행)
        const planXML = null;

        // ===== 2. 통계 수집하며 실제 실행 =====
        console.log('\n\n' + '='.repeat(80));
        console.log('⏱️  2단계: 실제 쿼리 실행 및 성능 측정');
        console.log('='.repeat(80));

        await pool.request().query('SET STATISTICS IO ON');
        await pool.request().query('SET STATISTICS TIME ON');

        const startTime = Date.now();
        const result = await pool.request().query(STOCK_LIST_QUERY);
        const endTime = Date.now();

        await pool.request().query('SET STATISTICS IO OFF');
        await pool.request().query('SET STATISTICS TIME OFF');

        console.log(`\n✅ 쿼리 실행 완료`);
        console.log(`  - 실행 시간: ${endTime - startTime}ms`);
        console.log(`  - 결과 행 수: ${result.recordset.length}개`);

        // ===== 3. 인덱스 사용 확인 =====
        console.log('\n\n' + '='.repeat(80));
        console.log('📑 3단계: 테이블별 인덱스 사용 분석');
        console.log('='.repeat(80));

        const tables = ['STOCK', 'STOCK_EXT', 'SALE_CONFER', 'STOCK_ISSUE'];

        for (const tableName of tables) {
            await analyzeTableIndexes(pool, tableName);
        }

        // ===== 4. 최적화 제안 =====
        console.log('\n\n' + '='.repeat(80));
        console.log('💡 4단계: 최적화 제안');
        console.log('='.repeat(80));

        suggestOptimizations(endTime - startTime, result.recordset.length);

        // 결과 저장
        const report = {
            timestamp: new Date().toISOString(),
            executionTime: endTime - startTime,
            rowCount: result.recordset.length,
            server: config.server,
            database: config.database,
            query: STOCK_LIST_QUERY
        };

        fs.writeFileSync('reports/stock-query-analysis.json', JSON.stringify(report, null, 2));
        console.log(`\n\n📁 분석 결과 저장: reports/stock-query-analysis.json`);

    } catch (error) {
        console.error('\n❌ 에러 발생:', error.message);
        if (error.code) console.error('   에러 코드:', error.code);
        if (error.number) console.error('   SQL 에러 번호:', error.number);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n✅ DB 연결 종료');
        }
    }
}

/**
 * 실행 계획 XML 분석
 */
function analyzeExecutionPlan(xmlPlan) {
    console.log('\n📋 실행 계획 요약:\n');

    // Table Scan (가장 느림)
    const tableScans = (xmlPlan.match(/<RelOp[^>]*PhysicalOp="Table Scan"[^>]*>/g) || []);
    const tableScanDetails = tableScans.map(match => {
        const tableMatch = match.match(/Table="\[([^\]]+)\]\.(\[([^\]]+)\])?\[([^\]]+)\]"/);
        return tableMatch ? `${tableMatch[1]}.${tableMatch[4]}` : '알 수 없음';
    });

    if (tableScans.length > 0) {
        console.log(`⚠️  Table Scan (전체 테이블 스캔): ${tableScans.length}개`);
        tableScanDetails.forEach((table, i) => {
            console.log(`   ${i + 1}. ${table} - 인덱스 미사용, 매우 느림!`);
        });
    }

    // Index Scan (중간)
    const indexScans = (xmlPlan.match(/<RelOp[^>]*PhysicalOp="Index Scan"[^>]*>/g) || []);
    if (indexScans.length > 0) {
        console.log(`\n⚠️  Index Scan (인덱스 전체 스캔): ${indexScans.length}개`);
        console.log(`   → 인덱스는 사용하지만 전체 스캔 (개선 가능)`);
    }

    // Index Seek (가장 빠름)
    const indexSeeks = (xmlPlan.match(/<RelOp[^>]*PhysicalOp="Index Seek"[^>]*>/g) || []);
    if (indexSeeks.length > 0) {
        console.log(`\n✅ Index Seek (인덱스로 특정 행 검색): ${indexSeeks.length}개`);
        console.log(`   → 효율적인 검색`);
    }

    // Clustered Index Scan
    const clusteredScans = (xmlPlan.match(/<RelOp[^>]*PhysicalOp="Clustered Index Scan"[^>]*>/g) || []);
    if (clusteredScans.length > 0) {
        console.log(`\n⚠️  Clustered Index Scan: ${clusteredScans.length}개`);
        console.log(`   → Primary Key로 전체 스캔 (WHERE 절 개선 필요)`);
    }

    // JOIN 방식
    const nestedLoops = (xmlPlan.match(/PhysicalOp="Nested Loops"/g) || []).length;
    const hashMatch = (xmlPlan.match(/PhysicalOp="Hash Match"/g) || []).length;
    const mergeJoin = (xmlPlan.match(/PhysicalOp="Merge Join"/g) || []).length;

    if (nestedLoops + hashMatch + mergeJoin > 0) {
        console.log(`\n🔗 JOIN 방식:`);
        if (nestedLoops > 0) console.log(`   - Nested Loops: ${nestedLoops}개 (작은 테이블에 적합)`);
        if (hashMatch > 0) console.log(`   - Hash Match: ${hashMatch}개 (큰 테이블에 적합)`);
        if (mergeJoin > 0) console.log(`   - Merge Join: ${mergeJoin}개 (정렬된 데이터에 적합)`);
    }

    // 예상 비용
    const costMatch = xmlPlan.match(/StatementSubTreeCost="([^"]+)"/);
    if (costMatch) {
        const cost = parseFloat(costMatch[1]);
        console.log(`\n💰 예상 비용 (Estimated Cost): ${cost.toFixed(4)}`);
        if (cost > 10) {
            console.log(`   ⚠️  비용이 높습니다 (10 이상은 최적화 필요)`);
        }
    }
}

/**
 * 테이블 인덱스 분석
 */
async function analyzeTableIndexes(pool, tableName) {
    console.log(`\n📊 ${tableName} 테이블:`);

    try {
        const result = await pool.request()
            .input('tableName', sql.VarChar, tableName)
            .query(`
                SELECT
                    i.name AS index_name,
                    i.type_desc AS index_type,
                    i.is_unique,
                    STUFF((
                        SELECT ', ' + c.name
                        FROM sys.index_columns ic
                        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                        AND ic.is_included_column = 0
                        ORDER BY ic.key_ordinal
                        FOR XML PATH('')
                    ), 1, 2, '') AS key_columns,
                    STUFF((
                        SELECT ', ' + c.name
                        FROM sys.index_columns ic
                        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                        AND ic.is_included_column = 1
                        ORDER BY ic.index_column_id
                        FOR XML PATH('')
                    ), 1, 2, '') AS included_columns,
                    ISNULL(s.user_seeks, 0) AS user_seeks,
                    ISNULL(s.user_scans, 0) AS user_scans,
                    ISNULL(s.user_lookups, 0) AS user_lookups,
                    ISNULL(s.user_updates, 0) AS user_updates,
                    s.last_user_seek,
                    s.last_user_scan
                FROM sys.indexes i
                LEFT JOIN sys.dm_db_index_usage_stats s
                    ON i.object_id = s.object_id
                    AND i.index_id = s.index_id
                    AND s.database_id = DB_ID()
                WHERE i.object_id = OBJECT_ID(@tableName)
                AND i.type > 0
                ORDER BY s.user_seeks DESC, s.user_scans DESC
            `);

        if (result.recordset.length === 0) {
            console.log(`   ⚠️  인덱스 없음!`);
            return;
        }

        result.recordset.forEach((idx, i) => {
            console.log(`\n   ${i + 1}. ${idx.index_name}`);
            console.log(`      타입: ${idx.index_type}${idx.is_unique ? ' (UNIQUE)' : ''}`);
            console.log(`      키 컬럼: ${idx.key_columns || '없음'}`);
            if (idx.included_columns) {
                console.log(`      포함 컬럼: ${idx.included_columns}`);
            }
            console.log(`      사용 통계:`);
            console.log(`        - Seek: ${idx.user_seeks}회 (효율적)`);
            console.log(`        - Scan: ${idx.user_scans}회 (비효율적)`);
            console.log(`        - Lookup: ${idx.user_lookups}회`);
            console.log(`        - Update: ${idx.user_updates}회`);

            if (idx.user_seeks === 0 && idx.user_scans === 0 && idx.user_lookups === 0) {
                console.log(`      ⚠️  미사용 인덱스 (삭제 고려)`);
            }
        });

    } catch (error) {
        console.log(`   ❌ 인덱스 조회 실패: ${error.message}`);
    }
}

/**
 * 병목 구간 찾기
 */
async function findBottlenecks(pool, planXML) {
    // EstimateRows가 큰 작업 찾기
    const operations = planXML.matchAll(/<RelOp[^>]*EstimateRows="([^"]+)"[^>]*PhysicalOp="([^"]+)"[^>]*>/g);

    const heavyOps = [];
    for (const match of operations) {
        const estimateRows = parseFloat(match[1]);
        const physicalOp = match[2];

        if (estimateRows > 1000) {
            heavyOps.push({ op: physicalOp, rows: estimateRows });
        }
    }

    if (heavyOps.length > 0) {
        console.log(`\n⚠️  대용량 작업 (EstimateRows > 1000):`);
        heavyOps.slice(0, 5).forEach((op, i) => {
            console.log(`   ${i + 1}. ${op.op}: 약 ${op.rows.toLocaleString()}행 처리`);
        });
    }
}

/**
 * 최적화 제안
 */
function suggestOptimizations(executionTime, rowCount) {
    const suggestions = [];

    // 실행 시간이 느리면
    if (executionTime > 1000) {
        suggestions.push({
            priority: '높음',
            issue: `실행 시간 ${executionTime}ms로 느림`,
            solution: '쿼리 최적화 필요',
            example: 'CREATE NONCLUSTERED INDEX IX_STOCK_CREATE_DATE ON STOCK(CREATE_DATE DESC);'
        });
    } else if (executionTime > 500) {
        suggestions.push({
            priority: '중간',
            issue: `실행 시간 ${executionTime}ms`,
            solution: '인덱스 추가 검토',
            example: 'CREATE INDEX IX_STOCK_EXT_STOCK_SEQ ON STOCK_EXT(STOCK_SEQ);'
        });
    }

    // 행 수가 많으면
    if (rowCount > 100) {
        suggestions.push({
            priority: '중간',
            issue: `결과 행 수 ${rowCount}개`,
            solution: '페이징 적용 또는 필터링 강화',
            example: 'OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY'
        });
    }

    console.log('\n');
    if (suggestions.length === 0) {
        console.log('✅ 현재 쿼리 성능은 양호합니다.');
    } else {
        suggestions.forEach((s, i) => {
            console.log(`${i + 1}. [${s.priority}] ${s.issue}`);
            console.log(`   해결책: ${s.solution}`);
            console.log(`   예시: ${s.example}`);
            console.log('');
        });
    }
}

// 실행
if (require.main === module) {
    analyzeQuery().catch(console.error);
}

module.exports = analyzeQuery;
