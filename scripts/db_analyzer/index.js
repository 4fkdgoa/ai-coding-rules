#!/usr/bin/env node
/**
 * DB Analyzer - 프로젝트 DB 스키마 분석기
 *
 * 사용법:
 *   node index.js --config <config_file>
 *   node index.js --extract-from <project_path>
 *   node index.js --interactive
 *   node index.js --non-interactive          (AI용: 템플릿 생성 후 종료)
 *
 * 설정 소스 우선순위:
 *   1. --config 파일 (.ai-analyzer.json)
 *   2. --extract-from 으로 프로젝트에서 자동 추출 (application.yml, context.xml 등)
 *   3. --interactive 로 사용자에게 직접 입력 받기
 *   4. 환경변수 (DB_TYPE, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 *
 * Exit Codes:
 *   0 - 성공
 *   1 - 에러 (연결 실패, 쿼리 오류 등)
 *   2 - 설정 필요 (--non-interactive 모드에서 템플릿 생성됨)
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Exit Codes
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_CONFIG_NEEDED = 2;

// Error Codes (상세 에러 분류)
const ERROR_CODES = {
    AUTH_FAILED: { code: 'AUTH_FAILED', message: '인증 실패: 사용자명 또는 비밀번호 확인' },
    HOST_NOT_FOUND: { code: 'HOST_NOT_FOUND', message: '호스트를 찾을 수 없음' },
    CONNECTION_REFUSED: { code: 'CONNECTION_REFUSED', message: '연결 거부됨: 포트 또는 방화벽 확인' },
    TIMEOUT: { code: 'TIMEOUT', message: '연결 타임아웃' },
    DATABASE_NOT_FOUND: { code: 'DATABASE_NOT_FOUND', message: '데이터베이스를 찾을 수 없음' },
    PERMISSION_DENIED: { code: 'PERMISSION_DENIED', message: '권한 없음' },
    UNKNOWN: { code: 'UNKNOWN', message: '알 수 없는 오류' }
};

const __dirname = dirname(fileURLToPath(import.meta.url));

// DB 어댑터 동적 로드
const adapters = {
    mysql: () => import('./adapters/mysql.js'),
    oracle: () => import('./adapters/oracle.js'),
    mssql: () => import('./adapters/mssql.js'),
    postgresql: () => import('./adapters/postgresql.js'),
    postgres: () => import('./adapters/postgresql.js'),
};

/**
 * 프로젝트 설정 파일에서 DB 정보 자동 추출
 */
async function extractDbConfigFromProject(projectPath) {
    const config = {
        type: null,
        host: null,
        port: null,
        database: null,
        user: null,
        password: null,
        extracted_from: null
    };

    // 1. application.yml / application.properties (Spring Boot)
    const appYml = join(projectPath, 'src/main/resources/application.yml');
    const appProps = join(projectPath, 'src/main/resources/application.properties');

    if (existsSync(appYml)) {
        console.log('[INFO] application.yml 분석 중...');
        const content = readFileSync(appYml, 'utf-8');

        // JDBC URL 파싱
        const urlMatch = content.match(/url:\s*jdbc:(\w+):\/\/([^:/]+):?(\d+)?\/(\w+)/);
        if (urlMatch) {
            config.type = urlMatch[1];
            config.host = urlMatch[2];
            config.port = urlMatch[3] || getDefaultPort(urlMatch[1]);
            config.database = urlMatch[4];
            config.extracted_from = 'application.yml';
        }

        // username
        const userMatch = content.match(/username:\s*(\S+)/);
        if (userMatch) config.user = userMatch[1];

        // password (보통 암호화되어 있음)
        const pwdMatch = content.match(/password:\s*(\S+)/);
        if (pwdMatch) {
            config.password = pwdMatch[1];
            // ENC() 패턴 감지
            if (config.password.startsWith('ENC(')) {
                config.password = null;
                config.password_encrypted = true;
            }
        }
    }

    if (existsSync(appProps) && !config.type) {
        console.log('[INFO] application.properties 분석 중...');
        const content = readFileSync(appProps, 'utf-8');

        const urlMatch = content.match(/spring\.datasource\.url=jdbc:(\w+):\/\/([^:/]+):?(\d+)?\/(\w+)/);
        if (urlMatch) {
            config.type = urlMatch[1];
            config.host = urlMatch[2];
            config.port = urlMatch[3] || getDefaultPort(urlMatch[1]);
            config.database = urlMatch[4];
            config.extracted_from = 'application.properties';
        }
    }

    // 2. context.xml (Tomcat/Legacy)
    const contextXml = join(projectPath, 'src/main/webapp/META-INF/context.xml');
    if (existsSync(contextXml) && !config.type) {
        console.log('[INFO] context.xml 분석 중...');
        const content = readFileSync(contextXml, 'utf-8');

        // Resource driverClassName, url 추출
        const urlMatch = content.match(/url="jdbc:(\w+):\/\/([^:/]+):?(\d+)?\/([^"]+)"/);
        if (urlMatch) {
            config.type = urlMatch[1];
            config.host = urlMatch[2];
            config.port = urlMatch[3] || getDefaultPort(urlMatch[1]);
            config.database = urlMatch[4];
            config.extracted_from = 'context.xml';
        }

        const userMatch = content.match(/username="([^"]+)"/);
        if (userMatch) config.user = userMatch[1];
    }

    // 3. persistence.xml (JPA 표준)
    const persistenceXml = join(projectPath, 'src/main/resources/META-INF/persistence.xml');
    if (existsSync(persistenceXml) && !config.type) {
        console.log('[INFO] persistence.xml 분석 중...');
        const content = readFileSync(persistenceXml, 'utf-8');

        const urlMatch = content.match(/javax\.persistence\.jdbc\.url.*value="jdbc:(\w+):\/\/([^:/]+):?(\d+)?\/([^"]+)"/);
        if (urlMatch) {
            config.type = urlMatch[1];
            config.host = urlMatch[2];
            config.port = urlMatch[3] || getDefaultPort(urlMatch[1]);
            config.database = urlMatch[4];
            config.extracted_from = 'persistence.xml';
        }

        const userMatch = content.match(/javax\.persistence\.jdbc\.user.*value="([^"]+)"/);
        if (userMatch) config.user = userMatch[1];
    }

    // 4. hibernate.cfg.xml (Hibernate)
    const hibernateCfg = join(projectPath, 'src/main/resources/hibernate.cfg.xml');
    if (existsSync(hibernateCfg) && !config.type) {
        console.log('[INFO] hibernate.cfg.xml 분석 중...');
        const content = readFileSync(hibernateCfg, 'utf-8');

        const urlMatch = content.match(/connection\.url.*>jdbc:(\w+):\/\/([^:/]+):?(\d+)?\/([^<]+)</);
        if (urlMatch) {
            config.type = urlMatch[1];
            config.host = urlMatch[2];
            config.port = urlMatch[3] || getDefaultPort(urlMatch[1]);
            config.database = urlMatch[4];
            config.extracted_from = 'hibernate.cfg.xml';
        }

        const userMatch = content.match(/connection\.username.*>([^<]+)</);
        if (userMatch) config.user = userMatch[1];
    }

    // 5. Spring XML (Legacy)
    const springContextFiles = [
        join(projectPath, 'src/main/webapp/WEB-INF/spring/root-context.xml'),
        join(projectPath, 'src/main/resources/applicationContext.xml'),
        join(projectPath, 'src/main/resources/spring/datasource.xml')
    ];

    for (const springXml of springContextFiles) {
        if (existsSync(springXml) && !config.type) {
            console.log(`[INFO] ${springXml} 분석 중...`);
            const content = readFileSync(springXml, 'utf-8');

            // BasicDataSource 또는 DriverManagerDataSource
            const urlMatch = content.match(/p:url="jdbc:(\w+):\/\/([^:/]+):?(\d+)?\/([^"]+)"/) ||
                             content.match(/value="jdbc:(\w+):\/\/([^:/]+):?(\d+)?\/([^"]+)"/);
            if (urlMatch) {
                config.type = urlMatch[1];
                config.host = urlMatch[2];
                config.port = urlMatch[3] || getDefaultPort(urlMatch[1]);
                config.database = urlMatch[4];
                config.extracted_from = springXml.split('/').pop();
            }

            const userMatch = content.match(/p:username="([^"]+)"/) ||
                              content.match(/username.*value="([^"]+)"/);
            if (userMatch) config.user = userMatch[1];

            if (config.type) break;
        }
    }

    // 6. .env 파일
    const envFile = join(projectPath, '.env');
    if (existsSync(envFile)) {
        console.log('[INFO] .env 파일 분석 중...');
        const content = readFileSync(envFile, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            const [key, value] = line.split('=').map(s => s.trim());
            if (key === 'DB_TYPE' && !config.type) config.type = value;
            if (key === 'DB_HOST' && !config.host) config.host = value;
            if (key === 'DB_PORT' && !config.port) config.port = value;
            if (key === 'DB_NAME' && !config.database) config.database = value;
            if (key === 'DB_USER' && !config.user) config.user = value;
            if (key === 'DB_PASSWORD' && !config.password) config.password = value;
        }
        if (!config.extracted_from && config.type) config.extracted_from = '.env';
    }

    return config;
}

function getDefaultPort(dbType) {
    if (!dbType) return null;

    const ports = {
        mysql: '3306',
        oracle: '1521',
        sqlserver: '1433',
        mssql: '1433',
        postgresql: '5432',
        postgres: '5432'
    };
    return ports[dbType.toLowerCase()] || null;
}

/**
 * 환경변수 치환 (${VAR_NAME} 형식 지원)
 */
function resolveEnvVariables(value) {
    if (typeof value !== 'string') return value;

    // ${VAR_NAME} 패턴 찾기
    const envPattern = /\$\{([^}]+)\}/g;
    return value.replace(envPattern, (match, varName) => {
        const envValue = process.env[varName];
        if (envValue === undefined) {
            console.warn(`[WARN] 환경변수 없음: ${varName}`);
            return match; // 치환 실패 시 원본 유지
        }
        return envValue;
    });
}

/**
 * 설정 객체의 모든 값에 환경변수 치환 적용
 */
function resolveConfigEnvVars(config) {
    const resolved = { ...config };
    for (const key of Object.keys(resolved)) {
        if (typeof resolved[key] === 'string') {
            resolved[key] = resolveEnvVariables(resolved[key]);
        }
    }
    return resolved;
}

/**
 * 에러 메시지에서 에러 코드 추출
 */
function classifyError(errorMessage) {
    const msg = errorMessage.toLowerCase();

    if (msg.includes('login failed') || msg.includes('access denied') || msg.includes('authentication')) {
        return ERROR_CODES.AUTH_FAILED;
    }
    if (msg.includes('getaddrinfo') || msg.includes('enotfound') || msg.includes('host not found')) {
        return ERROR_CODES.HOST_NOT_FOUND;
    }
    if (msg.includes('econnrefused') || msg.includes('connection refused')) {
        return ERROR_CODES.CONNECTION_REFUSED;
    }
    if (msg.includes('timeout') || msg.includes('etimedout')) {
        return ERROR_CODES.TIMEOUT;
    }
    if (msg.includes('database') && (msg.includes('not exist') || msg.includes('not found'))) {
        return ERROR_CODES.DATABASE_NOT_FOUND;
    }
    if (msg.includes('permission') || msg.includes('denied')) {
        return ERROR_CODES.PERMISSION_DENIED;
    }

    return { code: 'UNKNOWN', message: errorMessage };
}

/**
 * 누락된 필드 목록 반환
 */
function getMissingFields(config) {
    const required = ['type', 'host', 'database', 'user', 'password'];
    return required.filter(field => !config[field]);
}

/**
 * 템플릿 파일 생성 (비대화형 모드용)
 */
function generateTemplate(projectPath, detectedConfig) {
    const templatePath = join(projectPath, '.ai-analyzer-template.json');

    const template = {
        _meta: {
            description: "DB 분석기 설정 템플릿. 값을 채운 후 .ai-analyzer.json으로 저장하세요.",
            generated_at: new Date().toISOString(),
            warning: "이 파일에 비밀번호를 직접 저장하지 마세요. 환경변수(${DB_PASSWORD})를 사용하세요."
        },
        db: {
            type: detectedConfig.type || "<mysql|oracle|mssql|postgresql>",
            host: detectedConfig.host || "<DB 서버 주소>",
            port: detectedConfig.port || getDefaultPort(detectedConfig.type) || "<포트>",
            database: detectedConfig.database || "<데이터베이스명>",
            user: detectedConfig.user || "<사용자명>",
            password: "${DB_PASSWORD}"
        },
        options: {
            limit: 100,
            schema: null,
            timeout: 5000
        },
        common_code_detection: {
            table_patterns: ["TB_CODE", "COMMON_CODE", "CMM_CD", "CODE_MST"],
            required_columns: null,
            use_column_heuristic: false
        }
    };

    writeFileSync(templatePath, JSON.stringify(template, null, 2));
    return templatePath;
}

/**
 * .gitignore에 설정 파일 추가 확인/경고
 */
function checkGitIgnore(projectPath) {
    const gitignorePath = join(projectPath, '.gitignore');
    const filesToIgnore = ['.ai-analyzer.json', '.ai-analyzer-template.json'];
    const warnings = [];

    if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, 'utf-8');

        for (const file of filesToIgnore) {
            if (!content.includes(file)) {
                warnings.push(file);
            }
        }

        if (warnings.length > 0) {
            console.warn(`[WARN] .gitignore에 다음 파일 추가를 권장합니다: ${warnings.join(', ')}`);
            console.warn(`[WARN] 민감한 DB 정보가 Git에 커밋될 수 있습니다.`);

            // 자동 추가 제안
            return { missing: warnings, gitignorePath };
        }
    }

    return { missing: [], gitignorePath };
}

/**
 * 비대화형 모드: 설정 불완전 시 JSON 출력 및 템플릿 생성
 */
function handleNonInteractiveIncomplete(projectPath, config) {
    const missing = getMissingFields(config);
    const templatePath = generateTemplate(projectPath, config);

    // .gitignore 확인
    checkGitIgnore(projectPath);

    const result = {
        status: 'incomplete',
        detected: {
            type: config.type || null,
            host: config.host || null,
            port: config.port || null,
            database: config.database || null,
            user: config.user || null,
            password_set: !!config.password,
            extracted_from: config.extracted_from || null
        },
        missing: missing,
        template_path: templatePath,
        next_steps: [
            `1. 템플릿 파일 수정: ${templatePath}`,
            `2. .ai-analyzer.json으로 저장`,
            `3. 다시 실행: node index.js --config .ai-analyzer.json`
        ]
    };

    // JSON 출력 (AI가 파싱 가능)
    console.log(JSON.stringify(result, null, 2));

    return result;
}

/**
 * 사용자에게 DB 정보 입력 요청 (CLI 인터랙티브)
 */
async function promptDbConfig() {
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

    console.log('\n========================================');
    console.log('  DB 연결 정보 입력');
    console.log('========================================\n');

    const config = {
        type: await question('DB 타입 (mysql/oracle/mssql/postgresql): '),
        host: await question('호스트 (예: localhost): '),
        port: await question(`포트 (기본값 자동): `),
        database: await question('데이터베이스명: '),
        user: await question('사용자명: '),
        password: await question('비밀번호 (입력하지 않으면 환경변수 사용): ')
    };

    rl.close();

    // 기본값 처리
    if (!config.port) config.port = getDefaultPort(config.type);
    if (!config.password) config.password = process.env.DB_PASSWORD;

    return config;
}

// 설정
const CONNECTION_TIMEOUT = 5000; // 5초

/**
 * 타임아웃 프로미스 래퍼
 */
function withTimeout(promise, ms, operation) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} 타임아웃 (${ms}ms)`)), ms)
        )
    ]);
}

/**
 * DB 스키마 분석 실행
 */
async function analyzeSchema(config, options = {}) {
    const timeout = options.timeout || CONNECTION_TIMEOUT;
    const verbose = options.verbose || false;

    const adapterLoader = adapters[config.type.toLowerCase()];
    if (!adapterLoader) {
        return {
            status: 'failed',
            error: `지원하지 않는 DB 타입: ${config.type}`,
            meta: { db_type: config.type }
        };
    }

    if (verbose) console.log(`\n[INFO] ${config.type} 어댑터 로딩...`);
    const adapter = await adapterLoader();

    if (verbose) console.log(`[INFO] ${config.host}:${config.port}/${config.database} 연결 중... (타임아웃: ${timeout}ms)`);

    const result = {
        status: 'success',
        meta: {
            analyzed_at: new Date().toISOString(),
            db_type: config.type,
            database: config.database,
            host: config.host,
            extracted_from: config.extracted_from || 'manual'
        },
        tables: [],
        common_codes: [],
        statistics: {},
        errors: []
    };

    // 1. 테이블 목록 및 스키마 조회
    try {
        result.tables = await withTimeout(
            adapter.getTables({ ...config, connectTimeout: timeout }),
            timeout * 2,
            'getTables'
        );
        result.statistics.table_count = result.tables.length;
        console.log(`[SUCCESS] 테이블 조회 완료: ${result.tables.length}개`);
    } catch (err) {
        console.error(`[ERROR] 테이블 조회 실패: ${err.message}`);
        result.errors.push({ operation: 'getTables', message: err.message });
        result.status = 'partial';
    }

    // 2. 공통코드 테이블 조회 (있으면)
    try {
        result.common_codes = await withTimeout(
            adapter.getCommonCodes({ ...config, connectTimeout: timeout }),
            timeout * 2,
            'getCommonCodes'
        );
        result.statistics.common_code_count = result.common_codes.length;
        console.log(`[SUCCESS] 공통코드 조회 완료: ${result.common_codes.length}개`);
    } catch (err) {
        console.error(`[ERROR] 공통코드 조회 실패: ${err.message}`);
        result.errors.push({ operation: 'getCommonCodes', message: err.message });
        if (result.status === 'success') result.status = 'partial';
    }

    // 최종 상태 결정
    if (result.errors.length > 0 && result.tables.length === 0) {
        result.status = 'failed';
    }

    if (result.status === 'success') {
        console.log(`[SUCCESS] 분석 완료: ${result.tables.length}개 테이블, ${result.common_codes.length}개 공통코드`);
    } else if (result.status === 'partial') {
        console.log(`[WARN] 부분 성공: ${result.errors.length}개 오류 발생`);
    }

    return result;
}

/**
 * 메인 실행
 */
async function main() {
    const args = process.argv.slice(2);
    let config = null;
    let outputFile = 'db_schema.json';
    let limit = 100;  // 기본값 (Gemini 피드백: 옵션화)
    let schema = null; // PostgreSQL/Oracle용 스키마 지정 (Gemini 피드백)
    let nonInteractive = false; // AI용 비대화형 모드 (Gemini 피드백)
    let projectPath = null; // --extract-from 경로 저장

    // 인자 파싱
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--non-interactive') {
            nonInteractive = true;
        } else if (args[i] === '--limit' && args[i + 1]) {
            limit = parseInt(args[++i], 10);
            if (isNaN(limit) || limit < 1) {
                console.error('[ERROR] --limit 값은 1 이상의 정수여야 합니다.');
                process.exit(EXIT_ERROR);
            }
        } else if (args[i] === '--schema' && args[i + 1]) {
            schema = args[++i];
        } else if (args[i] === '--config' && args[i + 1]) {
            const configPath = args[++i];
            if (existsSync(configPath)) {
                const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
                config = fileConfig.db;
                // 공통코드 탐지 패턴 설정 로드
                if (fileConfig.common_code_detection) {
                    config.commonCodePatterns = fileConfig.common_code_detection.table_patterns;
                    config.commonCodeColumns = fileConfig.common_code_detection.required_columns;
                    config.useColumnHeuristic = fileConfig.common_code_detection.use_column_heuristic;
                }
            } else {
                console.error(`[ERROR] 설정 파일 없음: ${configPath}`);
                process.exit(1);
            }
        } else if (args[i] === '--extract-from' && args[i + 1]) {
            projectPath = args[++i];
            config = await extractDbConfigFromProject(projectPath);
        } else if (args[i] === '--interactive') {
            config = await promptDbConfig();
        } else if (args[i] === '--output' && args[i + 1]) {
            outputFile = args[++i];
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
DB Analyzer - 프로젝트 DB 스키마 분석기

사용법:
  node index.js --config <config.json>     설정 파일에서 DB 정보 로드
  node index.js --extract-from <path>      프로젝트에서 DB 설정 자동 추출
  node index.js --interactive              대화형으로 DB 정보 입력
  node index.js --non-interactive          AI용: 설정 불완전 시 템플릿 생성 후 종료
  node index.js --output <file.json>       결과 저장 파일 지정
  node index.js --limit <number>           최대 테이블/행 수 (기본값: 100)
  node index.js --schema <name>            스키마 지정 (PostgreSQL: public, Oracle: 사용자명)

Exit Codes:
  0 - 성공
  1 - 에러 (연결 실패 등)
  2 - 설정 필요 (--non-interactive 모드에서 템플릿 생성됨)

예시:
  node index.js --extract-from /path/to/project --output schema.json
  node index.js --config .ai-analyzer.json --limit 500
  node index.js --non-interactive --extract-from /path/to/project
`);
            process.exit(EXIT_SUCCESS);
        }
    }

    // 설정이 없으면 환경변수에서
    if (!config) {
        config = {
            type: process.env.DB_TYPE,
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        };
    }

    // 환경변수 치환 적용
    config = resolveConfigEnvVars(config);

    // 필수 항목 체크
    if (!config.type || !config.host || !config.database) {
        // 비대화형 모드: 템플릿 생성 후 종료
        if (nonInteractive) {
            const targetPath = projectPath || process.cwd();
            handleNonInteractiveIncomplete(targetPath, config);
            process.exit(EXIT_CONFIG_NEEDED);
        }

        // 대화형 모드: 사용자 입력 요청
        console.log('\n[INFO] DB 설정이 불완전합니다.');

        if (config.extracted_from) {
            console.log(`[INFO] ${config.extracted_from}에서 일부 추출됨:`);
            console.log(`  - type: ${config.type || '(없음)'}`);
            console.log(`  - host: ${config.host || '(없음)'}`);
            console.log(`  - database: ${config.database || '(없음)'}`);
            console.log(`  - user: ${config.user || '(없음)'}`);
            console.log(`  - password: ${config.password ? '(있음)' : config.password_encrypted ? '(암호화됨 - 직접 입력 필요)' : '(없음)'}`);
        }

        console.log('\n[INFO] 누락된 정보를 입력해주세요:');
        const additional = await promptDbConfig();

        // 병합 (추출된 값 우선, 없으면 입력값)
        config = {
            type: config.type || additional.type,
            host: config.host || additional.host,
            port: config.port || additional.port,
            database: config.database || additional.database,
            user: config.user || additional.user,
            password: config.password || additional.password,
            extracted_from: config.extracted_from
        };

        // 병합된 설정에도 환경변수 치환 적용
        config = resolveConfigEnvVars(config);
    }

    // limit, schema 설정 추가
    config.limit = limit;
    config.schema = schema;

    console.log('\n========================================');
    console.log('  DB 분석 시작');
    console.log('========================================');
    console.log(`DB 타입: ${config.type}`);
    console.log(`호스트: ${config.host}:${config.port}`);
    console.log(`데이터베이스: ${config.database}`);
    console.log(`사용자: ${config.user}`);
    console.log(`조회 제한: ${config.limit}개`);
    if (config.schema) console.log(`스키마: ${config.schema}`);
    console.log('========================================\n');

    const result = await analyzeSchema(config);

    // 결과 저장
    writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n[INFO] 결과 저장됨: ${outputFile}`);
}

main().catch(err => {
    const classified = classifyError(err.message);
    console.error(JSON.stringify({
        status: 'failed',
        error: {
            code: classified.code,
            message: classified.message,
            original: err.message
        }
    }, null, 2));
    process.exit(EXIT_ERROR);
});
