# 웹 애플리케이션 성능 분석 가이드

## 개요

이 가이드는 웹 애플리케이션의 프론트엔드부터 데이터베이스까지 전체 성능을 측정하고 병목 지점을 찾는 방법을 설명합니다.

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
├── playwright.config.js          # Playwright 설정
├── tests/
│   └── performance.spec.js       # 성능 테스트 스크립트
├── utils/
│   ├── performance-analyzer.js   # 성능 분석 엔진
│   └── report-generator.js       # HTML 리포트 생성
├── db-monitor/
│   ├── test-db.js               # DB 성능 분석 (메인)
│   └── simple-query-test.js     # 간단한 쿼리 테스트
└── reports/                      # 생성된 리포트
```

---

## 3. 설치 및 설정

### 3.1. Node.js 패키지 설치

```bash
# 프로젝트 초기화
npm init -y

# Playwright 설치 (브라우저 포함)
npm install -D @playwright/test
npx playwright install chromium

# DB 클라이언트 설치 (사용하는 DB에 맞게)
npm install mssql      # SQL Server
npm install mysql2     # MySQL
npm install oracledb   # Oracle
npm install pg         # PostgreSQL
```

### 3.2. Playwright 설정 (playwright.config.js)

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 60000,

    use: {
        baseURL: 'https://your-website.com',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    reporter: [
        ['html', { outputFolder: 'reports' }],
        ['json', { outputFile: 'reports/results.json' }],
        ['list']
    ],
});
```

---

## 4. 성능 분석 유틸리티

### 4.1. Performance Analyzer (utils/performance-analyzer.js)

```javascript
export class PerformanceAnalyzer {
    constructor() {
        this.apiCalls = [];
        this.resources = [];
    }

    // 페이지에 리스너 부착
    attachToPage(page) {
        page.on('request', request => {
            if (request.url().includes('/api/') || request.url().includes('.json')) {
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
                // 기본 타이밍
                ttfb: timing.responseStart - timing.requestStart,
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                loadComplete: timing.loadEventEnd - timing.navigationStart,

                // 상세 타이밍
                dns: timing.domainLookupEnd - timing.domainLookupStart,
                tcp: timing.connectEnd - timing.connectStart,
                request: timing.responseStart - timing.requestStart,
                response: timing.responseEnd - timing.responseStart,
                domProcessing: timing.domComplete - timing.domLoading,

                // Resource Timing
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
            apiStatistics: apiStats
        };
    }
}
```

### 4.2. Report Generator (utils/report-generator.js)

```javascript
import fs from 'fs';
import path from 'path';

export class ReportGenerator {
    generateHtmlReport(results, outputPath) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; border-left: 4px solid #2196F3; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; }
        tr:hover { background-color: #f5f5f5; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #e3f2fd; border-radius: 5px; }
        .metric-label { font-size: 12px; color: #666; }
        .metric-value { font-size: 24px; font-weight: bold; color: #1976d2; }
        .good { color: #4CAF50; }
        .warning { color: #FF9800; }
        .bad { color: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Performance Analysis Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        ${results.map(result => this.generatePageSection(result)).join('')}
    </div>
</body>
</html>`;

        fs.writeFileSync(outputPath, html);
        console.log(`Report generated: ${outputPath}`);
    }

    generatePageSection(result) {
        const nav = result.navigation;
        const api = result.apiStatistics;

        return `
        <h2>${result.pageName}</h2>

        <div>
            <div class="metric">
                <div class="metric-label">TTFB</div>
                <div class="metric-value ${this.getColorClass(nav.ttfb, 100, 300)}">${nav.ttfb}ms</div>
            </div>
            <div class="metric">
                <div class="metric-label">DOM Load</div>
                <div class="metric-value ${this.getColorClass(nav.domContentLoaded, 1000, 2000)}">${nav.domContentLoaded}ms</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Load</div>
                <div class="metric-value ${this.getColorClass(nav.loadComplete, 2000, 3000)}">${nav.loadComplete}ms</div>
            </div>
            ${api ? `
            <div class="metric">
                <div class="metric-label">API Calls</div>
                <div class="metric-value">${api.count}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Avg API Time</div>
                <div class="metric-value ${this.getColorClass(api.avgTime, 100, 500)}">${api.avgTime}ms</div>
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
                <td>${call.url.substring(call.url.lastIndexOf('/') + 1)}</td>
                <td>${call.method}</td>
                <td class="${this.getColorClass(call.duration, 100, 500)}">${call.duration}ms</td>
                <td>${call.status}</td>
                <td>${this.formatBytes(call.size)}</td>
            </tr>
            `).join('')}
        </table>
        ` : ''}
        `;
    }

    getColorClass(value, goodThreshold, badThreshold) {
        if (value <= goodThreshold) return 'good';
        if (value <= badThreshold) return 'warning';
        return 'bad';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}
```

---

## 5. 성능 테스트 작성

### 5.1. 기본 테스트 (tests/performance.spec.js)

```javascript
import { test, expect } from '@playwright/test';
import { PerformanceAnalyzer } from '../utils/performance-analyzer.js';
import { ReportGenerator } from '../utils/report-generator.js';

const USERNAME = 'your_username';
const PASSWORD = 'your_password';
const LOGIN_URL = 'https://your-website.com/login';
const AUTH_FILE = 'playwright/.auth/user.json';

test.describe('Performance Tests', () => {
    let sharedContext;
    let results = [];

    test.beforeAll(async ({ browser }) => {
        // 로그인 세션 생성
        sharedContext = await browser.newContext();
        const page = await sharedContext.newPage();

        await page.goto(LOGIN_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // 로그인 폼 작성 (실제 셀렉터로 변경 필요)
        await page.locator('input[name="username"]').fill(USERNAME);
        await page.locator('input[name="password"]').fill(PASSWORD);
        await page.waitForTimeout(500);

        await page.locator('button[type="submit"]').click();
        await page.waitForLoadState('networkidle', { timeout: 15000 });

        // 세션 저장
        await page.context().storageState({ path: AUTH_FILE });
        await page.close();
    });

    test.afterAll(async ({ browser }) => {
        // HTML 리포트 생성
        const reportGenerator = new ReportGenerator();
        const reportPath = `reports/performance-report-${Date.now()}.html`;
        reportGenerator.generateHtmlReport(results, reportPath);
        console.log(`\nReport generated: ${reportPath}`);

        if (sharedContext) {
            await sharedContext.close();
        }
    });

    test('Dashboard Performance', async ({ browser }) => {
        const context = await browser.newContext({ storageState: AUTH_FILE });
        const page = await context.newPage();

        const analyzer = new PerformanceAnalyzer();
        analyzer.attachToPage(page);

        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const report = await analyzer.generateReport(page, 'Dashboard');
        results.push(report);

        // 성능 검증
        expect(report.navigation.ttfb).toBeLessThan(1000);
        expect(report.navigation.loadComplete).toBeLessThan(5000);

        await page.screenshot({ path: 'reports/screenshots/dashboard.png' });
        await context.close();
    });
});
```

---

## 6. 데이터베이스 성능 분석

### 6.1. MSSQL 분석 (db-monitor/test-db.js)

```javascript
const sql = require('mssql');

const config = {
    user: 'your_username',
    password: 'your_password',
    server: 'your_server',
    database: 'your_database',
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 60000
    }
};

async function testDatabase() {
    console.log('Database Performance Test\n');
    console.log('='.repeat(80));

    let pool;
    try {
        // DB 연결
        console.log('\nConnecting to database...');
        pool = await sql.connect(config);
        console.log('Connected!\n');

        // 1. 테이블 크기 확인
        console.log('='.repeat(80));
        console.log('Table Sizes');
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
            WHERE t.NAME IN ('YourTable1', 'YourTable2', 'YourTable3')
            AND t.is_ms_shipped = 0
            AND i.index_id <= 1
            GROUP BY t.NAME, p.Rows
            ORDER BY p.Rows DESC
        `);

        console.log('');
        let totalRows = 0;
        statsResult.recordset.forEach(row => {
            console.log(`  ${row.TableName}:`);
            console.log(`     Rows: ${row.RowCounts.toLocaleString()}`);
            console.log(`     Size: ${row.UsedSpaceMB} MB`);
            totalRows += row.RowCounts;
        });
        console.log(`\n  Total Rows: ${totalRows.toLocaleString()}`);

        // 2. 실제 쿼리 실행 (API와 동일한 쿼리)
        console.log('\n\n' + '='.repeat(80));
        console.log('Query Performance Test');
        console.log('='.repeat(80));

        const startTime = Date.now();

        const result = await pool.request().query(`
            -- 실제 애플리케이션에서 사용하는 쿼리를 여기에 붙여넣기
            SELECT TOP 100 * FROM YourTable
            WHERE condition = 'value'
            ORDER BY created_date DESC
        `);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        console.log(`\nQuery completed`);
        console.log(`  Execution Time: ${executionTime}ms`);
        console.log(`  Rows Returned: ${result.recordset.length}`);

        // 3. 성능 분석
        console.log('\n\n' + '='.repeat(80));
        console.log('Performance Analysis');
        console.log('='.repeat(80));

        if (executionTime > 1000) {
            console.log('\nWARNING: Query takes more than 1 second!');
            console.log('\nRecommended optimizations:');
            console.log('  1. Add index on ORDER BY columns');
            console.log('  2. Add index on WHERE clause columns');
            console.log('  3. Review JOIN conditions');
        } else if (executionTime > 500) {
            console.log('\nQuery performance is acceptable but can be improved');
        } else {
            console.log('\nQuery performance is good!');
        }

        // 4. 현재 실행 중인 쿼리 확인
        console.log('\n\n' + '='.repeat(80));
        console.log('Currently Running Queries');
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
            console.log(`\nRunning queries: ${runningQueries.recordset.length}`);
            runningQueries.recordset.forEach((q, i) => {
                console.log(`\n  ${i + 1}. Session ${q.session_id} (${q.status})`);
                console.log(`     Elapsed Time: ${q.total_elapsed_time}ms`);
                console.log(`     CPU: ${q.cpu_time}ms`);
                console.log(`     Reads: ${q.logical_reads}`);
            });
        } else {
            console.log('\nNo other queries running');
        }

    } catch (error) {
        console.error('\nError:', error.message);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n\nDatabase connection closed');
        }
    }
}

if (require.main === module) {
    testDatabase().catch(console.error);
}

module.exports = testDatabase;
```

---

## 7. 실행 방법

### 7.1. 프론트엔드 성능 테스트

```bash
cd performance-test

# 모든 테스트 실행
npx playwright test

# 특정 테스트만 실행
npx playwright test tests/performance.spec.js

# UI 모드로 실행 (디버깅)
npx playwright test --ui

# 리포트 확인
npx playwright show-report
```

### 7.2. 데이터베이스 성능 테스트

```bash
cd performance-test/db-monitor

# 프로덕션 DB 분석
node test-db.js

# 간단한 테스트
node simple-query-test.js
```

---

## 8. 성능 최적화 체크리스트

### Frontend
- [ ] 이미지 최적화 (WebP, lazy loading)
- [ ] JavaScript 번들 크기 확인 (< 200KB 권장)
- [ ] CSS 최적화 (unused CSS 제거)
- [ ] 폰트 최적화 (woff2, subset)
- [ ] CDN 사용 여부

### Network
- [ ] GZIP/Brotli 압축 활성화
- [ ] HTTP/2 사용
- [ ] API 응답 캐싱 (Cache-Control 헤더)
- [ ] 불필요한 쿠키 제거

### Backend
- [ ] API 응답 시간 (< 200ms 목표)
- [ ] 불필요한 데이터 전송 제거
- [ ] N+1 쿼리 문제 해결
- [ ] 캐싱 전략 (Redis, Memcached)
- [ ] Connection Pool 설정 최적화

### Database
- [ ] 인덱스 누락 확인
- [ ] 실행 계획 분석
- [ ] 불필요한 컬럼 SELECT 제거
- [ ] JOIN 최적화
- [ ] 쿼리 캐싱

---

## 9. 자주 발견되는 병목

### 1. 과도한 SELECT 컬럼 (가장 흔함)
**증상:** DB 쿼리는 빠른데 API 응답은 느림
**원인:** 145개 컬럼 같은 과도한 SELECT
**해결:** 필요한 20-30개 컬럼만 SELECT

### 2. 압축 미적용
**증상:** 네트워크 전송이 느림
**원인:** GZIP 압축 비활성화
**해결:** Tomcat/Nginx에서 압축 활성화

### 3. 캐싱 없음
**증상:** 동일한 요청도 매번 느림
**원인:** 캐싱 전략 부재
**해결:** Spring Cache, Redis 도입

### 4. N+1 쿼리
**증상:** 1개 API 호출에 수십 개 쿼리 실행
**원인:** Lazy Loading + 반복문
**해결:** Eager Loading, JOIN FETCH 사용

---

## 10. 참고 자료

- **Playwright 공식 문서:** https://playwright.dev/
- **Web Vitals:** https://web.dev/vitals/
- **MSSQL 성능 튜닝:** https://docs.microsoft.com/sql/relational-databases/performance/
- **Spring Cache:** https://docs.spring.io/spring-framework/reference/integration/cache.html

---

**작성일:** 2026-01-15
**마지막 업데이트:** 2026-01-15
