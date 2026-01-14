/**
 * MSSQL (SQL Server) 어댑터
 */

const DEFAULT_LIMIT = 100;

export async function getTables(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const tedious = await import('tedious');
    const { Connection } = tedious;

    return new Promise((resolve, reject) => {
        const connection = new Connection({
            server: config.host,
            authentication: {
                type: 'default',
                options: {
                    userName: config.user,
                    password: config.password
                }
            },
            options: {
                port: parseInt(config.port) || 1433,
                database: config.database,
                encrypt: false,
                trustServerCertificate: true
            }
        });

        connection.on('connect', async (err) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                const tables = await executeQuery(connection, `
                    SELECT TOP ${limit}
                        t.TABLE_NAME,
                        p.rows AS ROW_COUNT
                    FROM INFORMATION_SCHEMA.TABLES t
                    LEFT JOIN sys.partitions p ON OBJECT_ID(t.TABLE_SCHEMA + '.' + t.TABLE_NAME) = p.object_id
                    WHERE t.TABLE_TYPE = 'BASE TABLE'
                      AND (p.index_id IN (0, 1) OR p.index_id IS NULL)
                    ORDER BY t.TABLE_NAME
                `, tedious);

                const result = [];

                for (const table of tables) {
                    const columns = await executeQuery(connection, `
                        SELECT
                            c.COLUMN_NAME,
                            c.DATA_TYPE,
                            c.IS_NULLABLE,
                            c.CHARACTER_MAXIMUM_LENGTH,
                            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PRI' ELSE '' END AS COLUMN_KEY
                        FROM INFORMATION_SCHEMA.COLUMNS c
                        LEFT JOIN (
                            SELECT ku.TABLE_NAME, ku.COLUMN_NAME
                            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                            WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                        ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
                        WHERE c.TABLE_NAME = '${table.TABLE_NAME}'
                        ORDER BY c.ORDINAL_POSITION
                    `, tedious);

                    const fks = await executeQuery(connection, `
                        SELECT
                            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS COLUMN_NAME,
                            OBJECT_NAME(fkc.referenced_object_id) AS REFERENCED_TABLE,
                            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS REFERENCED_COLUMN
                        FROM sys.foreign_key_columns fkc
                        WHERE OBJECT_NAME(fkc.parent_object_id) = '${table.TABLE_NAME}'
                    `, tedious);

                    result.push({
                        name: table.TABLE_NAME,
                        row_count: table.ROW_COUNT,
                        columns: columns.map(col => ({
                            name: col.COLUMN_NAME,
                            type: col.DATA_TYPE,
                            length: col.CHARACTER_MAXIMUM_LENGTH,
                            nullable: col.IS_NULLABLE === 'YES',
                            key: col.COLUMN_KEY
                        })),
                        foreign_keys: fks.map(fk => ({
                            column: fk.COLUMN_NAME,
                            references: `${fk.REFERENCED_TABLE}.${fk.REFERENCED_COLUMN}`
                        }))
                    });
                }

                connection.close();
                resolve(result);

            } catch (e) {
                connection.close();
                reject(e);
            }
        });

        connection.connect();
    });
}

// 기본 공통코드 패턴
const DEFAULT_CODE_PATTERNS = [
    'TB_CODE', 'TB_COMMON_CODE', 'CMM_CD', 'COMMON_CODE',
    'TB_CD', 'SYS_CODE', 'CODE_MST', 'CD_MST',
    'GRP_CD', 'DTL_CD', 'COM_CD', 'CMMN_CODE',
    'CATEGORY', 'CAT_CODE', 'CODES', 'CDS', '_CODE_', '_CD_'
];

export async function getCommonCodes(config) {
    const limit = config.limit || DEFAULT_LIMIT;
    const tedious = await import('tedious');
    const { Connection } = tedious;

    return new Promise((resolve, reject) => {
        const connection = new Connection({
            server: config.host,
            authentication: {
                type: 'default',
                options: {
                    userName: config.user,
                    password: config.password
                }
            },
            options: {
                port: parseInt(config.port) || 1433,
                database: config.database,
                encrypt: false,
                trustServerCertificate: true
            }
        });

        connection.on('connect', async (err) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                // 빈 배열이면 기본값 사용 (SQL 문법 오류 방지)
                const codeTablePatterns = (config.commonCodePatterns && config.commonCodePatterns.length > 0)
                    ? config.commonCodePatterns
                    : DEFAULT_CODE_PATTERNS;

                const likeConditions = codeTablePatterns.map(p => `TABLE_NAME LIKE '%${p}%'`).join(' OR ');

                const tables = await executeQuery(connection, `
                    SELECT TABLE_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_TYPE = 'BASE TABLE'
                      AND (${likeConditions})
                `, tedious);

                const result = [];

                for (const table of tables) {
                    try {
                        const rows = await executeQuery(connection, `
                            SELECT TOP ${limit} * FROM [${table.TABLE_NAME}]
                        `, tedious);

                        result.push({
                            table: table.TABLE_NAME,
                            sample_count: rows.length,
                            data: rows
                        });
                    } catch (e) {
                        console.warn(`[WARN] 공통코드 테이블 조회 실패: ${table.TABLE_NAME}`);
                    }
                }

                connection.close();
                resolve(result);

            } catch (e) {
                connection.close();
                reject(e);
            }
        });

        connection.connect();
    });
}

// ES Module 환경에서 tedious Request 클래스 사용을 위한 헬퍼
async function executeQuery(connection, sqlText, tediousModule) {
    const { Request } = tediousModule;

    return new Promise((resolve, reject) => {
        const rows = [];
        const request = new Request(sqlText, (err, rowCount) => {
            if (err) reject(err);
            else resolve(rows);
        });

        request.on('row', (columns) => {
            const row = {};
            columns.forEach(col => {
                row[col.metadata.colName] = col.value;
            });
            rows.push(row);
        });

        connection.execSql(request);
    });
}
