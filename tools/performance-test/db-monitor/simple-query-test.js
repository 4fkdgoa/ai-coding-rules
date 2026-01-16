/**
 * 간단한 쿼리 성능 테스트
 * STATISTICS IO/TIME으로 실제 DB 접근 횟수와 시간 측정
 */

const sql = require('mssql');

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

async function testQuery() {
    console.log('🔍 SDMS 재고 목록 쿼리 성능 테스트\n');

    let pool;
    try {
        pool = await sql.connect(config);
        console.log('✅ DB 연결 성공\n');

        // STATISTICS 활성화
        console.log('='.repeat(80));
        console.log('⏱️  쿼리 실행 (STATISTICS IO/TIME 포함)\n');

        const request = pool.request();

        // 메시지 이벤트 리스너 (STATISTICS 출력 캡처)
        request.on('info', (info) => {
            console.log('💬 DB 메시지:', info.message);
        });

        // STATISTICS 활성화
        await request.batch(`
            SET STATISTICS IO ON;
            SET STATISTICS TIME ON;
        `);

        // 실제 쿼리 실행
        const startTime = Date.now();

        const result = await pool.request().query(`
            SELECT TOP 100
                ST.STOCK_SEQ,
                ST.VIN_NO,
                ST.CREATE_DATE,
                AM.MODEL_NAME,
                STE.CUSTOM_CLEARANCE_DATE,
                STE.BUYING_DATE,
                SC.CUSTOMER_NAME
            FROM STOCK ST
                LEFT JOIN STOCK_EXT STE ON STE.STOCK_SEQ = ST.STOCK_SEQ
                LEFT JOIN AUTO_MODELS AM ON ST.AUTO_MODEL = AM.AUTO_MODEL
                LEFT JOIN SALE_CONFER SC ON SC.STOCK_SEQ = ST.STOCK_SEQ
                    AND SC.CONFER_GUBUN = '1'
            WHERE ST.DISABLE IS NULL
            ORDER BY ST.CREATE_DATE DESC
        `);

        const endTime = Date.now();

        console.log('\n' + '='.repeat(80));
        console.log('📊 실행 결과:');
        console.log('='.repeat(80));
        console.log(`  ⏱️  실행 시간: ${endTime - startTime}ms`);
        console.log(`  📦 결과 행 수: ${result.recordset.length}개`);

        // 샘플 데이터 출력
        if (result.recordset.length > 0) {
            console.log(`\n  📋 샘플 데이터 (첫 3개):`);
            result.recordset.slice(0, 3).forEach((row, i) => {
                console.log(`\n  ${i + 1}. ${row.VIN_NO || '(VIN_NO 없음)'}`);
                console.log(`     모델: ${row.MODEL_NAME || '(모델명 없음)'}`);
                console.log(`     생성일: ${row.CREATE_DATE ? row.CREATE_DATE.toISOString().split('T')[0] : '없음'}`);
                console.log(`     고객: ${row.CUSTOMER_NAME || '(미배정)'}`);
            });
        }

        // STATISTICS 비활성화
        await pool.request().batch(`
            SET STATISTICS IO OFF;
            SET STATISTICS TIME OFF;
        `);

        // 성능 분석
        console.log('\n\n' + '='.repeat(80));
        console.log('💡 성능 분석 및 최적화 제안');
        console.log('='.repeat(80));

        if (endTime - startTime > 1000) {
            console.log('\n⚠️  쿼리가 1초 이상 걸립니다!');
            console.log('\n추천 최적화:');
            console.log('  1. STOCK.CREATE_DATE 인덱스 추가:');
            console.log('     CREATE NONCLUSTERED INDEX IX_STOCK_CREATE_DATE');
            console.log('     ON STOCK(CREATE_DATE DESC)');
            console.log('     INCLUDE (STOCK_SEQ, VIN_NO, AUTO_MODEL, DISABLE);');
            console.log('');
            console.log('  2. STOCK_EXT.STOCK_SEQ 인덱스 추가:');
            console.log('     CREATE NONCLUSTERED INDEX IX_STOCK_EXT_STOCK_SEQ');
            console.log('     ON STOCK_EXT(STOCK_SEQ)');
            console.log('     INCLUDE (CUSTOM_CLEARANCE_DATE, BUYING_DATE);');
        } else if (endTime - startTime > 500) {
            console.log('\n⚠️  쿼리가 500ms 이상 걸립니다.');
            console.log('\n추천:');
            console.log('  - ORDER BY에 사용되는 CREATE_DATE 인덱스 확인');
            console.log('  - JOIN 되는 테이블들의 인덱스 확인');
        } else if (endTime - startTime > 100) {
            console.log('\n✅ 쿼리 성능이 양호합니다 (100~500ms).');
            console.log('\n개선 가능:');
            console.log('  - 필요하다면 인덱스 추가로 더 빠르게 할 수 있습니다');
        } else {
            console.log('\n✅ 쿼리 성능이 매우 좋습니다! (< 100ms)');
        }

        // 테이블 통계 확인
        console.log('\n\n' + '='.repeat(80));
        console.log('📊 테이블 크기 확인');
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
            WHERE t.NAME IN ('STOCK', 'STOCK_EXT', 'SALE_CONFER', 'AUTO_MODELS')
            AND t.is_ms_shipped = 0
            AND i.index_id <= 1
            GROUP BY t.NAME, p.Rows
            ORDER BY UsedSpaceMB DESC
        `);

        console.log('');
        statsResult.recordset.forEach(row => {
            console.log(`  📦 ${row.TableName}:`);
            console.log(`     행 수: ${row.RowCounts.toLocaleString()}개`);
            console.log(`     크기: ${row.UsedSpaceMB} MB`);
        });

    } catch (error) {
        console.error('\n❌ 에러:', error.message);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n\n✅ DB 연결 종료');
        }
    }
}

if (require.main === module) {
    testQuery().catch(console.error);
}

module.exports = testQuery;
