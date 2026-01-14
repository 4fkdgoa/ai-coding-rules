/**
 * Oracle 어댑터
 *
 * Note: Oracle은 USER_TABLES를 사용하므로 접속 사용자가 곧 스키마입니다.
 * 다른 스키마 조회 시 ALL_TABLES 사용이 필요하지만 권한 문제가 있을 수 있습니다.
 */

const DEFAULT_LIMIT = 100;

// 기본 공통코드 패턴 (설정 파일 없을 때 폴백)
const DEFAULT_CODE_PATTERNS = [
    'TB_CODE', 'TB_COMMON_CODE', 'CMM_CD', 'COMMON_CODE',
    'TB_CD', 'SYS_CODE', 'CODE_MST', 'CD_MST',
    'GRP_CD', 'DTL_CD', 'COM_CD', 'CMMN_CODE',
    'CATEGORY', 'CAT_CODE',
    'CODES', 'CDS', '_CODE_', '_CD_'
];

export async function getTables(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const oracledb = await import('oracledb');

    // Oracle 연결 문자열 생성
    const connectString = `${config.host}:${config.port || 1521}/${config.database}`;

    const connection = await oracledb.getConnection({
        user: config.user,
        password: config.password,
        connectString: connectString
    });

    try {
        // 테이블 목록 조회 (사용자 소유 테이블)
        const tablesResult = await connection.execute(`
            SELECT TABLE_NAME, NUM_ROWS
            FROM USER_TABLES
            WHERE ROWNUM <= :limit
            ORDER BY TABLE_NAME
        `, { limit });

        const result = [];

        for (const row of tablesResult.rows) {
            const tableName = row[0];
            const rowCount = row[1];

            // 컬럼 정보 조회
            const columnsResult = await connection.execute(`
                SELECT
                    COLUMN_NAME,
                    DATA_TYPE,
                    DATA_LENGTH,
                    NULLABLE,
                    DATA_DEFAULT
                FROM USER_TAB_COLUMNS
                WHERE TABLE_NAME = :tableName
                ORDER BY COLUMN_ID
            `, { tableName });

            // 코멘트 조회
            const commentsResult = await connection.execute(`
                SELECT COLUMN_NAME, COMMENTS
                FROM USER_COL_COMMENTS
                WHERE TABLE_NAME = :tableName
            `, { tableName });

            const commentMap = {};
            for (const c of commentsResult.rows) {
                commentMap[c[0]] = c[1];
            }

            // PK 조회
            const pkResult = await connection.execute(`
                SELECT cols.COLUMN_NAME
                FROM USER_CONSTRAINTS cons
                JOIN USER_CONS_COLUMNS cols ON cons.CONSTRAINT_NAME = cols.CONSTRAINT_NAME
                WHERE cons.TABLE_NAME = :tableName
                  AND cons.CONSTRAINT_TYPE = 'P'
            `, { tableName });

            const pkColumns = new Set(pkResult.rows.map(r => r[0]));

            // FK 조회
            const fkResult = await connection.execute(`
                SELECT
                    a.COLUMN_NAME,
                    c_pk.TABLE_NAME AS REFERENCED_TABLE,
                    b.COLUMN_NAME AS REFERENCED_COLUMN
                FROM USER_CONS_COLUMNS a
                JOIN USER_CONSTRAINTS c ON a.CONSTRAINT_NAME = c.CONSTRAINT_NAME
                JOIN USER_CONSTRAINTS c_pk ON c.R_CONSTRAINT_NAME = c_pk.CONSTRAINT_NAME
                JOIN USER_CONS_COLUMNS b ON c_pk.CONSTRAINT_NAME = b.CONSTRAINT_NAME
                WHERE c.TABLE_NAME = :tableName
                  AND c.CONSTRAINT_TYPE = 'R'
            `, { tableName });

            result.push({
                name: tableName,
                row_count: rowCount,
                columns: columnsResult.rows.map(col => ({
                    name: col[0],
                    type: col[1],
                    length: col[2],
                    nullable: col[3] === 'Y',
                    key: pkColumns.has(col[0]) ? 'PRI' : '',
                    comment: commentMap[col[0]] || ''
                })),
                foreign_keys: fkResult.rows.map(fk => ({
                    column: fk[0],
                    references: `${fk[1]}.${fk[2]}`
                }))
            });
        }

        return result;

    } finally {
        await connection.close();
    }
}

export async function getCommonCodes(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const oracledb = await import('oracledb');

    const connectString = `${config.host}:${config.port || 1521}/${config.database}`;

    const connection = await oracledb.getConnection({
        user: config.user,
        password: config.password,
        connectString: connectString
    });

    try {
        // 설정 파일에서 전달된 패턴 사용, 없으면 기본값
        // 빈 배열이면 기본값 사용 (SQL 문법 오류 방지)
        const codeTablePatterns = (config.commonCodePatterns && config.commonCodePatterns.length > 0)
            ? config.commonCodePatterns
            : DEFAULT_CODE_PATTERNS;

        const likeConditions = codeTablePatterns.map((_, i) => `TABLE_NAME LIKE :p${i}`).join(' OR ');
        const binds = {};
        codeTablePatterns.forEach((p, i) => binds[`p${i}`] = `%${p}%`);

        const tablesResult = await connection.execute(`
            SELECT TABLE_NAME
            FROM USER_TABLES
            WHERE ${likeConditions}
        `, binds);

        const result = [];

        for (const row of tablesResult.rows) {
            const tableName = row[0];

            try {
                const dataResult = await connection.execute(`
                    SELECT * FROM ${tableName}
                    WHERE ROWNUM <= :limit
                `, { limit });

                // 컬럼 메타데이터
                const columns = dataResult.metaData.map(m => m.name);

                result.push({
                    table: tableName,
                    sample_count: dataResult.rows.length,
                    columns: columns,
                    data: dataResult.rows.map(r => {
                        const obj = {};
                        columns.forEach((col, i) => obj[col] = r[i]);
                        return obj;
                    })
                });
            } catch (e) {
                console.warn(`[WARN] 공통코드 테이블 조회 실패: ${tableName}`);
            }
        }

        return result;

    } finally {
        await connection.close();
    }
}
