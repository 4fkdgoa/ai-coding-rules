/**
 * PostgreSQL 어댑터
 */

const DEFAULT_LIMIT = 100;
const DEFAULT_SCHEMA = 'public';

// 기본 공통코드 패턴 (설정 파일 없을 때 폴백)
// PostgreSQL은 대소문자 구분 없으므로 소문자로 정의
const DEFAULT_CODE_PATTERNS = [
    'tb_code', 'tb_common_code', 'cmm_cd', 'common_code',
    'tb_cd', 'sys_code', 'code_mst', 'cd_mst',
    'grp_cd', 'dtl_cd', 'com_cd', 'cmmn_code',
    'category', 'cat_code',
    'codes', 'cds', '_code_', '_cd_'
];

export async function getTables(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const schema = config.schema || DEFAULT_SCHEMA;
    const pg = await import('pg');

    const client = new pg.default.Client({
        host: config.host,
        port: parseInt(config.port) || 5432,
        user: config.user,
        password: config.password,
        database: config.database
    });

    await client.connect();

    try {
        // 테이블 목록 조회
        const tablesResult = await client.query(`
            SELECT
                t.tablename AS table_name,
                pg_stat_get_live_tuples(c.oid) AS row_count,
                obj_description(c.oid, 'pg_class') AS comment
            FROM pg_tables t
            JOIN pg_class c ON c.relname = t.tablename
            WHERE t.schemaname = $1
            ORDER BY t.tablename
            LIMIT $2
        `, [schema, limit]);

        const result = [];

        for (const table of tablesResult.rows) {
            // 컬럼 정보 조회
            const columnsResult = await client.query(`
                SELECT
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.character_maximum_length,
                    CASE WHEN pk.column_name IS NOT NULL THEN 'PRI' ELSE '' END AS column_key,
                    col_description(pg_class.oid, c.ordinal_position) AS comment
                FROM information_schema.columns c
                JOIN pg_class ON pg_class.relname = c.table_name
                LEFT JOIN (
                    SELECT kcu.table_name, kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
                WHERE c.table_schema = $1
                  AND c.table_name = $2
                ORDER BY c.ordinal_position
            `, [schema, table.table_name]);

            // FK 정보 조회
            const fksResult = await client.query(`
                SELECT
                    kcu.column_name,
                    ccu.table_name AS referenced_table,
                    ccu.column_name AS referenced_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_name = $1
            `, [table.table_name]);

            result.push({
                name: table.table_name,
                comment: table.comment,
                row_count: parseInt(table.row_count) || 0,
                columns: columnsResult.rows.map(col => ({
                    name: col.column_name,
                    type: col.data_type,
                    length: col.character_maximum_length,
                    nullable: col.is_nullable === 'YES',
                    key: col.column_key,
                    comment: col.comment || ''
                })),
                foreign_keys: fksResult.rows.map(fk => ({
                    column: fk.column_name,
                    references: `${fk.referenced_table}.${fk.referenced_column}`
                }))
            });
        }

        return result;

    } finally {
        await client.end();
    }
}

export async function getCommonCodes(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const schema = config.schema || DEFAULT_SCHEMA;
    const pg = await import('pg');

    const client = new pg.default.Client({
        host: config.host,
        port: parseInt(config.port) || 5432,
        user: config.user,
        password: config.password,
        database: config.database
    });

    await client.connect();

    try {
        // 설정 파일에서 전달된 패턴 사용, 없으면 기본값
        // 빈 배열이면 기본값 사용 (SQL 문법 오류 방지)
        // PostgreSQL은 ILIKE로 대소문자 무시 검색
        const codeTablePatterns = (config.commonCodePatterns && config.commonCodePatterns.length > 0)
            ? config.commonCodePatterns.map(p => p.toLowerCase())
            : DEFAULT_CODE_PATTERNS;

        const likeConditions = codeTablePatterns.map((_, i) => `tablename ILIKE $${i + 2}`).join(' OR ');

        const tablesResult = await client.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = $1
              AND (${likeConditions})
        `, [schema, ...codeTablePatterns.map(p => `%${p}%`)]);

        const result = [];

        for (const table of tablesResult.rows) {
            try {
                const dataResult = await client.query(`
                    SELECT * FROM "${schema}"."${table.tablename}"
                    LIMIT $1
                `, [limit]);

                result.push({
                    table: table.tablename,
                    sample_count: dataResult.rows.length,
                    data: dataResult.rows
                });
            } catch (e) {
                console.warn(`[WARN] 공통코드 테이블 조회 실패: ${table.tablename}`);
            }
        }

        return result;

    } finally {
        await client.end();
    }
}
