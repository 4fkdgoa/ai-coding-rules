# 웹 애플리케이션 성능 분석 가이드 v2.0

**업데이트:** 2026-01-15
**버전:** 2.0 (설정 기반 범용 도구)

---

## 개요

이 가이드는 웹 애플리케이션의 프론트엔드부터 데이터베이스까지 전체 성능을 측정하고 병목 지점을 찾는 방법을 설명합니다.

**v2.0 주요 개선사항:**
- 설정 파일 기반 구조로 재사용성 향상
- 하드코딩 제거 및 환경 변수 지원
- 다중 DB 타입 지원 (MSSQL, MySQL, Oracle, PostgreSQL)
- 보안 강화 (비밀번호 환경 변수 관리)
- CLI 도구화

**핵심 원칙:**
- 추측하지 말고 측정하라 (Measure, don't guess)
- 전체 흐름을 분석하라 (Frontend → Network → Backend → Database)
- 병목의 80%는 예상하지 못한 곳에 있다

---

## 1. 성능 분석 도구 스택

### Frontend 측정
- **Playwright** - 브라우저 자동화 + 성능 측정
- **Performance API** - 브라우저 내장 타이밍 API
- **Resource Timing API** - 리소스별 로딩 시간

### Backend 측정
- **MSSQL**: `mssql` npm 패키지
- **MySQL**: `mysql2` npm 패키지
- **Oracle**: `oracledb` npm 패키지
- **PostgreSQL**: `pg` npm 패키지

### 측정 지표
- **TTFB** (Time To First Byte): 서버 응답 속도
- **FCP** (First Contentful Paint): 첫 콘텐츠 표시
- **LCP** (Largest Contentful Paint): 최대 콘텐츠 표시
- **API Response Time**: API 응답 시간
- **DB Query Time**: 데이터베이스 쿼리 실행 시간

---

## 2. 프로젝트 구조

```
performance-test/
├── config/
│   ├── default.config.js        # 기본 설정
│   ├── dev.config.js            # 개발 환경
│   ├── production.config.js     # 프로덕션
│   └── .env.example             # 환경 변수 예제
├── playwright.config.js         # Playwright 설정
├── tests/
│   └── performance.spec.js      # 성능 테스트
├── utils/
│   ├── performance-analyzer.js  # 성능 분석 엔진 (개선됨)
│   └── report-generator.js      # HTML 리포트 (개선됨)
├── db-monitor/
│   ├── db-config-manager.js     # DB 설정 관리자 (신규)
│   ├── db-profiler.js           # 범용 DB 프로파일러 (신규)
│   ├── queries.config.js        # 쿼리 설정 (신규)
│   └── test-db.js               # DB 성능 테스트 (개선됨)
└── reports/                     # 생성된 리포트
```

---

## 3. 설치 및 설정

### 3.1. Node.js 패키지 설치

```bash
# 프로젝트 초기화
npm init -y

# Playwright 설치
npm install -D @playwright/test
npx playwright install chromium

# DB 클라이언트 (필요한 것만 설치)
npm install mssql      # SQL Server
npm install mysql2     # MySQL
npm install oracledb   # Oracle
npm install pg         # PostgreSQL

# 환경 변수 관리
npm install dotenv

# CLI 도구 (선택)
npm install commander
```

### 3.2. 환경 변수 설정

**.env 파일 생성:**
```bash
# Database Connection
DB_TYPE=mssql
DB_HOST=your-server.com
DB_PORT=1433
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true

# Performance Test
BASE_URL=https://your-app.com
LOGIN_USERNAME=test_user
LOGIN_PASSWORD=test_password

# Performance Thresholds (ms) - Optional
TTFB_GOOD=100
TTFB_WARNING=300
DOM_LOAD_GOOD=1000
DOM_LOAD_WARNING=2000
API_GOOD=100
API_WARNING=500
```

**.env.example (Git에 포함):**
```bash
# Database Connection
DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1433
DB_NAME=testdb
DB_USER=sa
DB_PASSWORD=YourStrongPassword123

# Performance Test
BASE_URL=http://localhost:3000
LOGIN_USERNAME=
LOGIN_PASSWORD=

# Thresholds (optional)
#TTFB_GOOD=100
#TTFB_WARNING=300
```

**.gitignore에 추가:**
```
.env
reports/
logs/
playwright/.auth/
```

### 3.3. 설정 파일 (config/default.config.js)

```javascript
import dotenv from 'dotenv';
dotenv.config();

export default {
    // Performance thresholds (ms)
    thresholds: {
        ttfb: {
            good: parseInt(process.env.TTFB_GOOD || '100'),
            warning: parseInt(process.env.TTFB_WARNING || '300')
        },
        domLoad: {
            good: parseInt(process.env.DOM_LOAD_GOOD || '1000'),
            warning: parseInt(process.env.DOM_LOAD_WARNING || '2000')
        },
        totalLoad: {
            good: parseInt(process.env.TOTAL_LOAD_GOOD || '2000'),
            warning: parseInt(process.env.TOTAL_LOAD_WARNING || '3000')
        },
        apiCall: {
            good: parseInt(process.env.API_GOOD || '100'),
            warning: parseInt(process.env.API_WARNING || '500')
        }
    },

    // API detection patterns (customize for your project)
    apiPatterns: [
        /\/api\//,              // REST API
        /\.json$/,              // JSON endpoints
        /\/graphql/,            // GraphQL
        /\/v\d+\//,             // Versioned API
        process.env.CUSTOM_API_PATTERN  // Custom pattern from env
    ].filter(Boolean),

    // Database config
    database: {
        type: process.env.DB_TYPE || 'mssql',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '1433'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true',
        pool: {
            min: 2,
            max: 10
        }
    },

    // Report settings
    report: {
        outputDir: process.env.REPORT_DIR || './reports',
        includeScreenshots: process.env.SCREENSHOTS !== 'false',
        includeNetworkTrace: process.env.NETWORK_TRACE === 'true',
        format: (process.env.REPORT_FORMAT || 'html,json').split(',')
    },

    // Monitoring settings
    monitoring: {
        sampleSize: parseInt(process.env.SAMPLE_SIZE || '100'),
        warmupRounds: parseInt(process.env.WARMUP_ROUNDS || '0'),
        timeout: parseInt(process.env.TIMEOUT || '60000')
    }
};
```

---

## 4. 성능 분석 유틸리티 (개선됨)

### 4.1. Performance Analyzer (utils/performance-analyzer.js)

```javascript
import config from '../config/default.config.js';

export class PerformanceAnalyzer {
    constructor(customConfig = {}) {
        this.config = { ...config, ...customConfig };
        this.apiCalls = [];
        this.resources = [];
    }

    // API 요청 여부 판별 (설정 기반)
    isApiRequest(url) {
        return this.config.apiPatterns.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(url);
            }
            return url.includes(pattern);
        });
    }

    // 페이지에 리스너 부착
    attachToPage(page) {
        page.on('request', request => {
            if (this.isApiRequest(request.url())) {
                this.apiCalls.push({
                    url: request.url(),
                    method: request.method(),
                    startTime: Date.now()
                });
            }
        });

        page.on('response', async response => {
            const apiCall = this.apiCalls.find(call =>
                call.url === response.url() && !call.endTime
            );
            if (apiCall) {
                apiCall.endTime = Date.now();
                apiCall.duration = apiCall.endTime - apiCall.startTime;
                apiCall.status = response.status();
                apiCall.size = parseInt(response.headers()['content-length'] || 0);
            }
        });
    }

    // Navigation Timing 메트릭 수집
    async getNavigationMetrics(page) {
        return await page.evaluate(() => {
            const timing = performance.timing;
            const navigation = performance.getEntriesByType('navigation')[0];

            return {
                ttfb: timing.responseStart - timing.requestStart,
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                loadComplete: timing.loadEventEnd - timing.navigationStart,
                dns: timing.domainLookupEnd - timing.domainLookupStart,
                tcp: timing.connectEnd - timing.connectStart,
                request: timing.responseStart - timing.requestStart,
                response: timing.responseEnd - timing.responseStart,
                domProcessing: timing.domComplete - timing.domLoading,
                transferSize: navigation?.transferSize || 0,
                encodedBodySize: navigation?.encodedBodySize || 0,
                decodedBodySize: navigation?.decodedBodySize || 0
            };
        });
    }

    // Web Vitals 수집
    async getWebVitals(page) {
        try {
            return await page.evaluate(() => {
                return new Promise((resolve) => {
                    const vitals = {};

                    new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (entry.name === 'first-contentful-paint') {
                                vitals.fcp = entry.startTime;
                            }
                            if (entry.entryType === 'largest-contentful-paint') {
                                vitals.lcp = entry.startTime;
                            }
                        }
                    }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });

                    setTimeout(() => resolve(vitals), 1000);
                });
            });
        } catch (error) {
            return {};
        }
    }

    // API 통계 계산
    getApiStatistics() {
        const completedCalls = this.apiCalls.filter(call => call.duration);
        if (completedCalls.length === 0) return null;

        const durations = completedCalls.map(call => call.duration).sort((a, b) => a - b);
        const totalSize = completedCalls.reduce((sum, call) => sum + (call.size || 0), 0);

        return {
            count: completedCalls.length,
            totalTime: durations.reduce((sum, d) => sum + d, 0),
            avgTime: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
            minTime: durations[0],
            maxTime: durations[durations.length - 1],
            p50: durations[Math.floor(durations.length * 0.5)],
            p95: durations[Math.floor(durations.length * 0.95)],
            p99: durations[Math.floor(durations.length * 0.99)],
            totalSize: totalSize,
            avgSize: Math.round(totalSize / completedCalls.length)
        };
    }

    // 설정 기반 색상 판정
    getColorClass(value, metricName) {
        const threshold = this.config.thresholds[metricName];
        if (!threshold) return 'normal';

        if (value <= threshold.good) return 'good';
        if (value <= threshold.warning) return 'warning';
        return 'bad';
    }

    // 종합 리포트 생성
    async generateReport(page, pageName) {
        const navMetrics = await this.getNavigationMetrics(page);
        const webVitals = await this.getWebVitals(page);
        const apiStats = this.getApiStatistics();

        return {
            pageName,
            timestamp: new Date().toISOString(),
            navigation: navMetrics,
            webVitals,
            apiCalls: this.apiCalls.filter(call => call.duration),
            apiStatistics: apiStats,
            config: {
                thresholds: this.config.thresholds,
                apiPatterns: this.config.apiPatterns.map(p => p.toString())
            }
        };
    }
}
```

### 4.2. Report Generator (utils/report-generator.js)

```javascript
import fs from 'fs';
import path from 'path';
import config from '../config/default.config.js';

export class ReportGenerator {
    constructor(customConfig = {}) {
        this.config = { ...config.report, ...customConfig };
    }

    generateHtmlReport(results, outputPath) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Performance Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; border-left: 4px solid #2196F3; padding-left: 10px; }
        .summary { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .metric { display: inline-block; margin: 10px 15px; padding: 15px 20px; background: white; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .metric-value { font-size: 28px; font-weight: bold; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; font-weight: 600; }
        tr:hover { background-color: #f5f5f5; }
        .good { color: #4CAF50; }
        .warning { color: #FF9800; }
        .bad { color: #f44336; }
        .config { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace; font-size: 12px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Performance Analysis Report</h1>
        <div class="summary">
            <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
            <strong>Total Pages Tested:</strong> ${results.length}<br>
            <strong>Configuration:</strong> Custom thresholds applied
        </div>

        ${results.map(result => this.generatePageSection(result)).join('')}

        <div class="config">
            <strong>Configuration Used:</strong><br>
            ${JSON.stringify(results[0]?.config?.thresholds || {}, null, 2)}
        </div>

        <div class="footer">
            Generated by Performance Analysis Tool v2.0<br>
            For more information, see <a href="https://github.com/your-repo">documentation</a>
        </div>
    </div>
</body>
</html>`;

        // Create output directory if not exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, html);
        console.log(`✓ HTML report generated: ${outputPath}`);
    }

    generatePageSection(result) {
        const nav = result.navigation;
        const api = result.apiStatistics;

        return `
        <h2>📄 ${result.pageName}</h2>
        <p><small>Tested at: ${new Date(result.timestamp).toLocaleString()}</small></p>

        <div>
            <div class="metric">
                <div class="metric-label">TTFB</div>
                <div class="metric-value ${this.getColorClass(nav.ttfb, 'ttfb')}">${nav.ttfb}ms</div>
            </div>
            <div class="metric">
                <div class="metric-label">DOM Load</div>
                <div class="metric-value ${this.getColorClass(nav.domContentLoaded, 'domLoad')}">${nav.domContentLoaded}ms</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Load</div>
                <div class="metric-value ${this.getColorClass(nav.loadComplete, 'totalLoad')}">${nav.loadComplete}ms</div>
            </div>
            ${api ? `
            <div class="metric">
                <div class="metric-label">API Calls</div>
                <div class="metric-value">${api.count}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Avg API Time</div>
                <div class="metric-value ${this.getColorClass(api.avgTime, 'apiCall')}">${api.avgTime}ms</div>
            </div>
            ` : ''}
        </div>

        ${api ? `
        <h3>API Calls Detail</h3>
        <table>
            <tr>
                <th>URL</th>
                <th>Method</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Size</th>
            </tr>
            ${result.apiCalls.map(call => `
            <tr>
                <td>${this.truncateUrl(call.url)}</td>
                <td>${call.method}</td>
                <td class="${this.getColorClass(call.duration, 'apiCall')}">${call.duration}ms</td>
                <td>${call.status}</td>
                <td>${this.formatBytes(call.size)}</td>
            </tr>
            `).join('')}
        </table>
        ` : ''}
        `;
    }

    getColorClass(value, metricName) {
        const threshold = this.config.thresholds?.[metricName] || config.thresholds[metricName];
        if (!threshold) return '';

        if (value <= threshold.good) return 'good';
        if (value <= threshold.warning) return 'warning';
        return 'bad';
    }

    truncateUrl(url) {
        const maxLength = 60;
        if (url.length <= maxLength) return url;
        return '...' + url.substring(url.length - maxLength);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // JSON 리포트 생성
    generateJsonReport(results, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`✓ JSON report generated: ${outputPath}`);
    }
}
```

---

## 5. 데이터베이스 성능 분석 (개선됨)

### 5.1. DB Config Manager (db-monitor/db-config-manager.js)

```javascript
import dotenv from 'dotenv';
dotenv.config();

export class DBConfigManager {
    constructor(environment = process.env.NODE_ENV || 'development') {
        this.environment = environment;
    }

    getConfig(dbType = process.env.DB_TYPE || 'mssql') {
        const baseConfig = {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_HOST,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT),
        };

        // Validate required fields
        if (!baseConfig.server || !baseConfig.database) {
            throw new Error('DB_HOST and DB_NAME are required in .env file');
        }

        // DB 타입별 설정
        switch (dbType.toLowerCase()) {
            case 'mssql':
            case 'sqlserver':
                return {
                    ...baseConfig,
                    options: {
                        encrypt: process.env.DB_SSL === 'true',
                        trustServerCertificate: true,
                        enableArithAbort: true,
                        requestTimeout: 60000
                    }
                };

            case 'mysql':
            case 'mariadb':
                return {
                    host: baseConfig.server,
                    user: baseConfig.user,
                    password: baseConfig.password,
                    database: baseConfig.database,
                    port: baseConfig.port,
                    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
                };

            case 'oracle':
                return {
                    user: baseConfig.user,
                    password: baseConfig.password,
                    connectString: `${baseConfig.server}:${baseConfig.port}/${baseConfig.database}`
                };

            case 'postgres':
            case 'postgresql':
                return {
                    host: baseConfig.server,
                    user: baseConfig.user,
                    password: baseConfig.password,
                    database: baseConfig.database,
                    port: baseConfig.port,
                    ssl: process.env.DB_SSL === 'true'
                };

            default:
                throw new Error(`Unsupported database type: ${dbType}`);
        }
    }

    // 연결 테스트
    async testConnection(dbType) {
        try {
            const config = this.getConfig(dbType);
            console.log(`Testing ${dbType} connection...`);
            console.log(`  Host: ${config.server || config.host}`);
            console.log(`  Database: ${config.database}`);

            // 실제 연결 테스트는 DBProfiler에서 수행
            return true;
        } catch (error) {
            console.error(`Connection test failed: ${error.message}`);
            return false;
        }
    }
}
```

### 5.2. DB Profiler (db-monitor/db-profiler.js)

```javascript
import { DBConfigManager } from './db-config-manager.js';
import config from '../config/default.config.js';

export class DBProfiler {
    constructor(dbType = process.env.DB_TYPE || 'mssql', customConfig = {}) {
        this.dbType = dbType.toLowerCase();
        this.configManager = new DBConfigManager();
        this.config = { ...config, ...customConfig };
        this.connection = null;
        this.client = null;
    }

    async connect() {
        const config = this.configManager.getConfig(this.dbType);

        try {
            switch (this.dbType) {
                case 'mssql':
                case 'sqlserver':
                    const sql = await import('mssql');
                    this.client = sql;
                    this.connection = await sql.connect(config);
                    break;

                case 'mysql':
                case 'mariadb':
                    const mysql = await import('mysql2/promise');
                    this.client = mysql;
                    this.connection = await mysql.createConnection(config);
                    break;

                case 'oracle':
                    const oracledb = await import('oracledb');
                    this.client = oracledb;
                    this.connection = await oracledb.getConnection(config);
                    break;

                case 'postgres':
                case 'postgresql':
                    const { Client } = await import('pg');
                    this.client = { Client };
                    this.connection = new Client(config);
                    await this.connection.connect();
                    break;

                default:
                    throw new Error(`Unsupported database: ${this.dbType}`);
            }

            console.log(`✓ Connected to ${this.dbType} database`);
            return true;
        } catch (error) {
            console.error(`✗ Connection failed: ${error.message}`);
            throw error;
        }
    }

    async executeQuery(query, params = {}) {
        if (!this.connection) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {
            switch (this.dbType) {
                case 'mssql':
                case 'sqlserver':
                    const request = this.connection.request();
                    Object.entries(params).forEach(([key, value]) => {
                        request.input(key, value);
                    });
                    const result = await request.query(query);
                    return result.recordset;

                case 'mysql':
                case 'mariadb':
                    const [rows] = await this.connection.execute(query, Object.values(params));
                    return rows;

                case 'oracle':
                    const oracleResult = await this.connection.execute(query, params);
                    return oracleResult.rows;

                case 'postgres':
                case 'postgresql':
                    const pgResult = await this.connection.query(query, Object.values(params));
                    return pgResult.rows;

                default:
                    throw new Error(`Unsupported database: ${this.dbType}`);
            }
        } catch (error) {
            console.error(`Query execution failed: ${error.message}`);
            throw error;
        }
    }

    async profileQuery(query, params = {}) {
        const startTime = Date.now();

        try {
            const result = await this.executeQuery(query, params);
            const executionTime = Date.now() - startTime;

            const analysis = {
                executionTime,
                rowCount: result.length,
                query,
                timestamp: new Date().toISOString(),
                database: this.dbType,
                performance: this.evaluatePerformance(executionTime)
            };

            return { success: true, ...analysis, data: result };
        } catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                success: false,
                executionTime,
                error: error.message,
                query,
                timestamp: new Date().toISOString()
            };
        }
    }

    evaluatePerformance(executionTime) {
        const threshold = this.config.thresholds.apiCall;

        if (executionTime <= threshold.good) {
            return { status: 'excellent', color: 'green', message: 'Query performance is excellent' };
        } else if (executionTime <= threshold.warning) {
            return { status: 'acceptable', color: 'yellow', message: 'Query performance is acceptable' };
        } else {
            return { status: 'poor', color: 'red', message: 'Query needs optimization' };
        }
    }

    async getTableStats(tableNames) {
        const query = this.getTableStatsQuery(tableNames);
        return await this.executeQuery(query);
    }

    getTableStatsQuery(tableNames) {
        const tableList = tableNames.map(t => `'${t}'`).join(',');

        switch (this.dbType) {
            case 'mssql':
            case 'sqlserver':
                return `
                    SELECT
                        t.NAME AS TableName,
                        p.rows AS RowCounts,
                        CAST(ROUND(((SUM(a.used_pages) * 8) / 1024.00), 2) AS NUMERIC(36, 2)) AS UsedSpaceMB
                    FROM sys.tables t
                    INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
                    INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
                    INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
                    WHERE t.NAME IN (${tableList})
                    AND t.is_ms_shipped = 0
                    AND i.index_id <= 1
                    GROUP BY t.NAME, p.Rows
                    ORDER BY p.Rows DESC
                `;

            case 'mysql':
            case 'mariadb':
                return `
                    SELECT
                        table_name AS TableName,
                        table_rows AS RowCounts,
                        ROUND((data_length + index_length) / 1024 / 1024, 2) AS UsedSpaceMB
                    FROM information_schema.tables
                    WHERE table_schema = DATABASE()
                    AND table_name IN (${tableList})
                `;

            case 'postgres':
            case 'postgresql':
                return `
                    SELECT
                        schemaname || '.' || tablename AS TableName,
                        n_live_tup AS RowCounts,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS UsedSpaceMB
                    FROM pg_stat_user_tables
                    WHERE tablename IN (${tableList})
                `;

            case 'oracle':
                return `
                    SELECT
                        table_name AS TableName,
                        num_rows AS RowCounts,
                        ROUND(blocks * 8192 / 1024 / 1024, 2) AS UsedSpaceMB
                    FROM user_tables
                    WHERE table_name IN (${tableList})
                `;

            default:
                throw new Error(`Table stats not supported for ${this.dbType}`);
        }
    }

    async close() {
        if (this.connection) {
            try {
                switch (this.dbType) {
                    case 'mssql':
                    case 'sqlserver':
                        await this.connection.close();
                        break;
                    case 'mysql':
                    case 'mariadb':
                    case 'oracle':
                        await this.connection.close();
                        break;
                    case 'postgres':
                    case 'postgresql':
                        await this.connection.end();
                        break;
                }
                console.log('✓ Database connection closed');
            } catch (error) {
                console.error(`Error closing connection: ${error.message}`);
            }
        }
    }
}
```

### 5.3. 개선된 DB 테스트 (db-monitor/test-db.js)

```javascript
import { DBProfiler } from './db-profiler.js';
import dotenv from 'dotenv';

dotenv.config();

async function testDatabase() {
    const dbType = process.env.DB_TYPE || 'mssql';
    const profiler = new DBProfiler(dbType);

    console.log('='.repeat(80));
    console.log(`Database Performance Test - ${dbType.toUpperCase()}`);
    console.log('='.repeat(80));

    try {
        // 연결
        await profiler.connect();

        // 1. 테이블 통계
        console.log('\n📊 Table Statistics:\n');
        const tables = (process.env.TEST_TABLES || 'users,products,orders').split(',');
        const stats = await profiler.getTableStats(tables);

        stats.forEach(row => {
            console.log(`  📦 ${row.TableName}:`);
            console.log(`     Rows: ${row.RowCounts.toLocaleString()}`);
            console.log(`     Size: ${row.UsedSpaceMB} MB\n`);
        });

        // 2. 커스텀 쿼리 프로파일링
        const customQuery = process.env.CUSTOM_QUERY || `SELECT TOP 100 * FROM ${tables[0]}`;

        console.log('='.repeat(80));
        console.log('⏱️  Query Performance Test\n');
        console.log(`Query: ${customQuery.substring(0, 60)}...\n`);

        const result = await profiler.profileQuery(customQuery);

        if (result.success) {
            console.log(`✓ Execution Time: ${result.executionTime}ms`);
            console.log(`  Rows Returned: ${result.rowCount}`);
            console.log(`  Performance: ${result.performance.status.toUpperCase()} (${result.performance.message})`);
        } else {
            console.error(`✗ Query Failed: ${result.error}`);
        }

        // 3. 성능 권장사항
        console.log('\n\n' + '='.repeat(80));
        console.log('💡 Recommendations:');
        console.log('='.repeat(80));

        if (result.executionTime > 1000) {
            console.log('\n⚠️  Query execution exceeds 1 second!');
            console.log('\n  Suggested optimizations:');
            console.log('  1. Add indexes on frequently queried columns');
            console.log('  2. Review execution plan for table scans');
            console.log('  3. Consider query result caching');
        } else if (result.executionTime > 500) {
            console.log('\n  Query performance is acceptable but can be improved.');
            console.log('  Consider adding indexes if this query is frequently executed.');
        } else {
            console.log('\n✓ Query performance is excellent! No immediate action needed.');
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    } finally {
        await profiler.close();
    }
}

// 실행
if (require.main === module) {
    testDatabase().catch(console.error);
}

export default testDatabase;
```

---

## 6. 사용 예제

### 6.1. 환경 설정

```bash
# .env 파일 생성
cp config/.env.example .env

# 환경 변수 수정
vi .env
```

### 6.2. 프론트엔드 성능 테스트

```bash
# 기본 실행
npx playwright test

# 특정 페이지만 테스트
npx playwright test --grep "Dashboard"

# UI 모드 (디버깅)
npx playwright test --ui

# 리포트 확인
npx playwright show-report
```

### 6.3. DB 성능 테스트

```bash
cd db-monitor

# MSSQL
DB_TYPE=mssql node test-db.js

# MySQL
DB_TYPE=mysql node test-db.js

# PostgreSQL
DB_TYPE=postgres node test-db.js

# 커스텀 쿼리 테스트
CUSTOM_QUERY="SELECT * FROM users WHERE active=1" node test-db.js
```

---

## 7. 자주 발견되는 병목 (변경 없음)

### 1. 과도한 SELECT 컬럼
**증상:** DB 쿼리는 빠른데 API 응답은 느림
**해결:** 필요한 컬럼만 SELECT

### 2. 압축 미적용
**증상:** 네트워크 전송이 느림
**해결:** GZIP 압축 활성화

### 3. 캐싱 없음
**증상:** 동일 요청도 매번 느림
**해결:** Spring Cache, Redis 도입

### 4. N+1 쿼리
**증상:** 1개 API에 수십 개 쿼리
**해결:** Eager Loading, JOIN FETCH

---

## 8. 마이그레이션 가이드 (v1 → v2)

### 기존 프로젝트 업그레이드

```bash
# 1. 새 패키지 설치
npm install dotenv commander

# 2. 설정 파일 생성
mkdir config
cp path/to/v2/config/default.config.js config/
cp path/to/v2/config/.env.example .env

# 3. 환경 변수 설정
vi .env

# 4. 코드 업데이트
# - performance-analyzer.js
# - report-generator.js
# - db-profiler.js 추가
# - test-db.js 업데이트

# 5. .gitignore 업데이트
echo ".env" >> .gitignore

# 6. 테스트
npx playwright test
node db-monitor/test-db.js
```

---

## 9. 참고 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [Web Vitals](https://web.dev/vitals/)
- [MSSQL Performance Tuning](https://docs.microsoft.com/sql/relational-databases/performance/)
- [MySQL Performance](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)

---

**버전:** 2.0
**작성일:** 2026-01-15
**주요 개선:** 설정 기반 구조, 다중 DB 지원, 보안 강화
