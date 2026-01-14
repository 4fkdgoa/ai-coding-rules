/**
 * MySQL 어댑터
 */

const DEFAULT_LIMIT = 100; // 기본 최대 조회 행 수

export async function getTables(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const mysql = await import('mysql2/promise');

    const connection = await mysql.createConnection({
        host: config.host,
        port: parseInt(config.port) || 3306,
        user: config.user,
        password: config.password,
        database: config.database
    });

    try {
        // 테이블 목록 조회
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_NAME
            LIMIT ${limit}
        `, [config.database]);

        const result = [];

        for (const table of tables) {
            // 컬럼 정보 조회
            const [columns] = await connection.execute(`
                SELECT
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    COLUMN_KEY,
                    COLUMN_COMMENT,
                    CHARACTER_MAXIMUM_LENGTH
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            `, [config.database, table.TABLE_NAME]);

            // FK 정보 조회
            const [fks] = await connection.execute(`
                SELECT
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = ?
                  AND TABLE_NAME = ?
                  AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [config.database, table.TABLE_NAME]);

            result.push({
                name: table.TABLE_NAME,
                comment: table.TABLE_COMMENT,
                row_count: table.TABLE_ROWS,
                columns: columns.map(col => ({
                    name: col.COLUMN_NAME,
                    type: col.DATA_TYPE,
                    length: col.CHARACTER_MAXIMUM_LENGTH,
                    nullable: col.IS_NULLABLE === 'YES',
                    key: col.COLUMN_KEY, // PRI, UNI, MUL
                    comment: col.COLUMN_COMMENT
                })),
                foreign_keys: fks.map(fk => ({
                    column: fk.COLUMN_NAME,
                    references: `${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`
                }))
            });
        }

        return result;

    } finally {
        await connection.end();
    }
}

// 기본 공통코드 패턴 (설정 파일 없을 때 폴백)
const DEFAULT_CODE_PATTERNS = [
    'TB_CODE', 'TB_COMMON_CODE', 'CMM_CD', 'COMMON_CODE',
    'TB_CD', 'SYS_CODE', 'CODE_MST', 'CD_MST',
    'GRP_CD', 'DTL_CD', 'COM_CD', 'CMMN_CODE',
    'CATEGORY', 'CAT_CODE',
    'CODES', 'CDS', '_CODE_', '_CD_'
];

export async function getCommonCodes(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const mysql = await import('mysql2/promise');

    const connection = await mysql.createConnection({
        host: config.host,
        port: parseInt(config.port) || 3306,
        user: config.user,
        password: config.password,
        database: config.database
    });

    try {
        // 설정 파일에서 전달된 패턴 사용, 없으면 기본값
        // 빈 배열이면 기본값 사용 (SQL 문법 오류 방지)
        const codeTablePatterns = (config.commonCodePatterns && config.commonCodePatterns.length > 0)
            ? config.commonCodePatterns
            : DEFAULT_CODE_PATTERNS;

        const [tables] = await connection.execute(`
            SELECT TABLE_NAME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
              AND (${codeTablePatterns.map(() => 'TABLE_NAME LIKE ?').join(' OR ')})
        `, [config.database, ...codeTablePatterns.map(p => `%${p}%`)]);

        const result = [];

        for (const table of tables) {
            // 코드 데이터 샘플 조회 (최대 limit 건)
            try {
                const [rows] = await connection.execute(`
                    SELECT * FROM ${connection.escapeId(table.TABLE_NAME)}
                    LIMIT ${limit}
                `);

                result.push({
                    table: table.TABLE_NAME,
                    sample_count: rows.length,
                    data: rows
                });
            } catch (e) {
                console.warn(`[WARN] 공통코드 테이블 조회 실패: ${table.TABLE_NAME}`);
            }
        }

        return result;

    } finally {
        await connection.end();
    }
}
