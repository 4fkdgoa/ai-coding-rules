/**
 * 프로덕션 DB 성능 테스트
 * 실제 운영 데이터로 성능 측정
 */

const sql = require('mssql');

// 프로덕션 DB 설정
const config = {
    user: 'sfa',
    password: 'sfa',
    server: '211.217.11.17',
    database: 'SFA_Samchully',  // 프로덕션 DB
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 60000
    }
};

async function testProductionDB() {
    console.log('🔍 프로덕션 DB 성능 테스트\n');
    console.log('='.repeat(80));
    console.log('⚠️  주의: 실제 운영 DB에 연결합니다!');
    console.log('='.repeat(80));

    let pool;
    try {
        // DB 연결
        console.log('\n📡 프로덕션 DB 연결 중...');
        console.log(`  서버: ${config.server}:${config.port}`);
        console.log(`  DB: ${config.database}`);

        pool = await sql.connect(config);
        console.log('✅ 연결 성공!\n');

        // 1. 테이블 크기 먼저 확인
        console.log('='.repeat(80));
        console.log('📊 테이블 크기 확인 (프로덕션)');
        console.log('='.repeat(80));

        const statsResult = await pool.request().query(`
            SELECT
                t.NAME AS TableName,
                p.rows AS RowCounts,
                CAST(ROUND(((SUM(a.used_pages) * 8) / 1024.00), 2) AS NUMERIC(36, 2)) AS UsedSpaceMB
            FROM sys.tables t
            INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
            INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
            INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
            WHERE t.NAME IN ('STOCK', 'STOCK_EXT', 'SALE_CONFER', 'AUTO_MODELS', 'STOCK_ISSUE')
            AND t.is_ms_shipped = 0
            AND i.index_id <= 1
            GROUP BY t.NAME, p.Rows
            ORDER BY p.Rows DESC
        `);

        console.log('');
        let totalRows = 0;
        statsResult.recordset.forEach(row => {
            console.log(`  📦 ${row.TableName}:`);
            console.log(`     행 수: ${row.RowCounts.toLocaleString()}개`);
            console.log(`     크기: ${row.UsedSpaceMB} MB`);
            totalRows += row.RowCounts;
        });
        console.log(`\n  📊 총 행 수: ${totalRows.toLocaleString()}개`);

        // 2. 재고 목록 쿼리 실행 (실제 API와 동일하게)
        console.log('\n\n' + '='.repeat(80));
        console.log('⏱️  재고 목록 쿼리 실행 (/stock/stockList.json 시뮬레이션)');
        console.log('='.repeat(80));

        const startTime = Date.now();

        const result = await pool.request().query(`
            SELECT TOP 100
                ST.STOCK_SEQ,
                ST.VIN_NO,
                ST.CREATE_DATE,
                AM.MODEL_NAME,
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
                LEFT JOIN AUTO_MODELS AM ON ST.AUTO_MODEL = AM.AUTO_MODEL
                LEFT JOIN SALE_CONFER SC ON SC.STOCK_SEQ = ST.STOCK_SEQ AND SC.CONFER_GUBUN = '1'
                LEFT JOIN MASTER_CODES MC1 ON MC1.CODE_GROUP_SEQ = STE.STOCK_GUBUN_GROUP
                    AND MC1.CODE_SEQ = STE.STOCK_GUBUN_SEQ
                LEFT JOIN MASTER_CODES MC5 ON ST.AUTO_STATUS_GROUP = MC5.CODE_GROUP_SEQ
                    AND ST.AUTO_STATUS_SEQ = MC5.CODE_SEQ
                LEFT JOIN SALES_USERS SU ON SU.SALES_USER_SEQ = SC.SALES_USER_SEQ
                LEFT JOIN SHOWROOM_CODES SRC ON SRC.SHOWROOM_SEQ = SU.SHOWROOM_SEQ
                LEFT JOIN KEEP_PLACE_STOCK KPS ON KPS.KEEP_PLACE_SEQ = ST.KEEP_PLACE_SEQ
            WHERE ST.DISABLE IS NULL
            ORDER BY ST.CREATE_DATE DESC
        `);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        console.log(`\n✅ 쿼리 실행 완료`);
        console.log(`  ⏱️  실행 시간: ${executionTime}ms`);
        console.log(`  📦 결과 행 수: ${result.recordset.length}개`);

        // 샘플 데이터
        if (result.recordset.length > 0) {
            console.log(`\n  📋 최신 재고 (상위 5개):`);
            result.recordset.slice(0, 5).forEach((row, i) => {
                console.log(`\n  ${i + 1}. VIN: ${row.VIN_NO || '없음'}`);
                console.log(`     모델: ${row.MODEL_NAME || '없음'}`);
                console.log(`     상태: ${row.AUTO_STATUS_NAME || '없음'}`);
                console.log(`     생성일: ${row.CREATE_DATE ? row.CREATE_DATE.toISOString().split('T')[0] : '없음'}`);
                console.log(`     고객: ${row.CUSTOMER_NAME || '(미배정)'}`);
            });
        }

        // 3. 더 복잡한 쿼리 테스트 (실제 listStock과 유사)
        console.log('\n\n' + '='.repeat(80));
        console.log('⏱️  복잡한 쿼리 테스트 (WITH 절 포함)');
        console.log('='.repeat(80));

        const complexStartTime = Date.now();

        const complexResult = await pool.request().query(`
            WITH SSI AS (
                SELECT
                    SI.STOCK_SEQ,
                    SI.ISSUE_DETAIL,
                    SI.OCCURRENCE_DATE,
                    SI.COMPLETE_YN
                FROM STOCK_ISSUE SI
                INNER JOIN (
                    SELECT STOCK_SEQ, MAX(CREATE_DATE) CREATE_DATE
                    FROM STOCK_ISSUE
                    GROUP BY STOCK_SEQ
                ) SIS ON SIS.STOCK_SEQ = SI.STOCK_SEQ AND SIS.CREATE_DATE = SI.CREATE_DATE
            )
            SELECT TOP 100
                ST.STOCK_SEQ,
                ST.VIN_NO,
                ST.CREATE_DATE,
                AM.MODEL_NAME,
                STE.BUYING_DATE,
                STE.PDI_STATUS,
                SC.CUSTOMER_NAME,
                SSI.ISSUE_DETAIL,
                SSI.COMPLETE_YN,
                DATEDIFF(day, ST.CREATE_DATE, GETDATE()) AS DAYS_SINCE_CREATE
            FROM STOCK ST
                LEFT JOIN STOCK_EXT STE ON STE.STOCK_SEQ = ST.STOCK_SEQ
                LEFT JOIN AUTO_MODELS AM ON ST.AUTO_MODEL = AM.AUTO_MODEL
                LEFT JOIN SALE_CONFER SC ON SC.STOCK_SEQ = ST.STOCK_SEQ AND SC.CONFER_GUBUN = '1'
                LEFT JOIN SSI ON SSI.STOCK_SEQ = ST.STOCK_SEQ
            WHERE ST.DISABLE IS NULL
            ORDER BY ST.CREATE_DATE DESC
        `);

        const complexEndTime = Date.now();
        const complexExecutionTime = complexEndTime - complexStartTime;

        console.log(`\n✅ 복잡한 쿼리 실행 완료`);
        console.log(`  ⏱️  실행 시간: ${complexExecutionTime}ms`);
        console.log(`  📦 결과 행 수: ${complexResult.recordset.length}개`);

        // 4. 성능 분석
        console.log('\n\n' + '='.repeat(80));
        console.log('💡 성능 분석 결과');
        console.log('='.repeat(80));

        console.log('\n📊 비교:');
        console.log(`  - 간단한 쿼리: ${executionTime}ms`);
        console.log(`  - 복잡한 쿼리 (WITH 절): ${complexExecutionTime}ms`);
        console.log(`  - 차이: ${complexExecutionTime - executionTime}ms`);

        // 프론트엔드와 비교
        console.log('\n\n📈 프론트엔드 vs DB 직접 실행:');
        console.log(`  - 프론트엔드 측정 (Playwright): ~906ms`);
        console.log(`  - DB 직접 측정 (복잡한 쿼리): ${complexExecutionTime}ms`);

        const networkOverhead = 906 - complexExecutionTime;
        if (networkOverhead > 0) {
            console.log(`  - 네트워크 + 애플리케이션 오버헤드: ~${networkOverhead}ms`);
        }

        // 최적화 제안
        console.log('\n\n💡 최적화 제안:');
        if (complexExecutionTime > 1000) {
            console.log('\n⚠️  [높음] 쿼리가 1초 이상 걸립니다!');
            console.log('\n  권장 조치:');
            console.log('  1. STOCK.CREATE_DATE 인덱스 추가:');
            console.log('     CREATE NONCLUSTERED INDEX IX_STOCK_CREATE_DATE');
            console.log('     ON STOCK(CREATE_DATE DESC, DISABLE)');
            console.log('     INCLUDE (STOCK_SEQ, VIN_NO, AUTO_MODEL);');
            console.log('');
            console.log('  2. STOCK_EXT.STOCK_SEQ 인덱스 추가:');
            console.log('     CREATE NONCLUSTERED INDEX IX_STOCK_EXT_STOCK_SEQ');
            console.log('     ON STOCK_EXT(STOCK_SEQ)');
            console.log('     INCLUDE (BUYING_DATE, PDI_STATUS, STOCK_GUBUN_GROUP, STOCK_GUBUN_SEQ);');
            console.log('');
            console.log('  3. STOCK_ISSUE 최적화:');
            console.log('     CREATE NONCLUSTERED INDEX IX_STOCK_ISSUE_GROUPED');
            console.log('     ON STOCK_ISSUE(STOCK_SEQ, CREATE_DATE DESC)');
            console.log('     INCLUDE (ISSUE_DETAIL, OCCURRENCE_DATE, COMPLETE_YN);');
        } else if (complexExecutionTime > 500) {
            console.log('\n⚠️  [중간] 쿼리가 500ms 이상 걸립니다.');
            console.log('\n  개선 가능:');
            console.log('  - ORDER BY에 사용되는 CREATE_DATE 인덱스 확인');
            console.log('  - JOIN 되는 테이블들의 인덱스 확인');
        } else {
            console.log('\n✅ 쿼리 성능이 양호합니다!');
        }

        // 5. 현재 실행 중인 쿼리 확인 (참고용)
        console.log('\n\n' + '='.repeat(80));
        console.log('🔍 현재 실행 중인 쿼리 (참고)');
        console.log('='.repeat(80));

        const runningQueries = await pool.request().query(`
            SELECT TOP 5
                req.session_id,
                req.status,
                req.command,
                req.cpu_time,
                req.total_elapsed_time,
                req.logical_reads,
                DB_NAME(req.database_id) AS database_name
            FROM sys.dm_exec_requests req
            WHERE req.session_id != @@SPID
            AND DB_NAME(req.database_id) = '${config.database}'
            ORDER BY req.total_elapsed_time DESC
        `);

        if (runningQueries.recordset.length > 0) {
            console.log(`\n  실행 중인 쿼리: ${runningQueries.recordset.length}개`);
            runningQueries.recordset.forEach((q, i) => {
                console.log(`\n  ${i + 1}. 세션 ${q.session_id} (${q.status})`);
                console.log(`     실행 시간: ${q.total_elapsed_time}ms`);
                console.log(`     CPU: ${q.cpu_time}ms`);
                console.log(`     읽기: ${q.logical_reads}회`);
            });
        } else {
            console.log('\n  현재 다른 실행 중인 쿼리 없음');
        }

    } catch (error) {
        console.error('\n❌ 에러 발생:', error.message);
        if (error.code === 'ELOGIN') {
            console.error('\n💡 로그인 실패. 프로덕션 DB 비밀번호가 다를 수 있습니다.');
            console.error('   DBA에게 실제 비밀번호를 확인하세요.');
        }
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n\n✅ DB 연결 종료');
        }
    }
}

if (require.main === module) {
    testProductionDB().catch(console.error);
}

module.exports = testProductionDB;
