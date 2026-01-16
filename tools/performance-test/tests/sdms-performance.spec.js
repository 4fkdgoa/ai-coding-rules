const { test, expect } = require('@playwright/test');
const PerformanceAnalyzer = require('../utils/performance-analyzer');
const ReportGenerator = require('../utils/report-generator');

// 로그인 정보
const LOGIN_URL = 'https://sdms.sclmotors.co.kr';
const USERNAME = 'test';
const PASSWORD = 'jkl123**';

// 테스트 페이지 목록
const TEST_PAGES = [
    {
        name: '입고관리 (incm01~09)',
        url: '/sfa/in/cm/incm01.crm',
        description: '입고관리 페이지 성능 측정'
    },
    {
        name: '엑셀 관리 (smrm01)',
        url: '/sfa/sm/rm/smrm01.do',
        description: '엑셀 다운로드/업로드 페이지 성능 측정'
    }
];

test.describe('SDMS 성능 분석', () => {
    let allReports = [];
    let sharedContext;

    test.beforeAll(async ({ browser }) => {
        console.log('성능 분석 시작...');
        console.log('공통 로그인 세션 생성 중...');

        // 공통 컨텍스트 생성 (모든 테스트에서 공유)
        sharedContext = await browser.newContext();
        const page = await sharedContext.newPage();

        // 로그인 수행
        await page.goto(LOGIN_URL);
        await page.waitForLoadState('networkidle');

        const usernameInput = page.locator('input[name="p_userId"]');
        const passwordInput = page.locator('input[name="p_userPw"]');

        await usernameInput.fill(USERNAME);
        await passwordInput.fill(PASSWORD);

        const loginButton = page.locator('button[type="submit"]');
        await loginButton.click();
        await page.waitForLoadState('networkidle', { timeout: 15000 });

        console.log('로그인 완료. 세션 공유 시작.');

        await page.close();
    });

    test.afterAll(async () => {
        // 컨텍스트 정리
        if (sharedContext) {
            await sharedContext.close();
        }

        // 모든 테스트 완료 후 리포트 생성
        if (allReports.length > 0) {
            const files = ReportGenerator.save(allReports, 'reports');
            console.log('\n=== 성능 리포트 생성 완료 ===');
            console.log('HTML 리포트:', files.html);
            console.log('JSON 데이터:', files.json);
        }
    });

    test('대시보드 성능 측정', async () => {
        const page = await sharedContext.newPage();
        const analyzer = new PerformanceAnalyzer();
        analyzer.attachToPage(page);

        console.log('\n[대시보드] 페이지 접속 중...');
        const startTime = Date.now();
        await page.goto(`${LOGIN_URL}/sfa/mainManager.jsp`);
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        const endTime = Date.now();

        console.log(`[대시보드] 로딩 완료 (${endTime - startTime}ms)`);

        // 페이지가 완전히 로드될 때까지 추가 대기
        await page.waitForTimeout(2000);

        // 성능 리포트 생성
        const report = await analyzer.generateReport(page, '대시보드');
        allReports.push(report);

        // 콘솔 출력
        console.log(`[대시보드] 성능 메트릭:`);
        if (report.navigation) {
            console.log(`  - TTFB: ${report.navigation.ttfb}ms`);
            console.log(`  - DOM 로드: ${report.navigation.domContentLoaded}ms`);
            console.log(`  - 전체 로드: ${report.navigation.totalTime}ms`);
        }
        if (report.api.statistics) {
            console.log(`  - API 호출: ${report.api.statistics.count}개`);
            console.log(`  - 평균 응답: ${report.api.statistics.avgDuration}ms`);
            console.log(`  - 최대 응답: ${report.api.statistics.maxDuration}ms`);
        }

        // 스크린샷 저장
        await page.screenshot({
            path: 'reports/screenshots/dashboard.png',
            fullPage: true
        });

        await page.close();
    });

    // 각 페이지별 성능 테스트
    for (const testPage of TEST_PAGES) {
        test(`${testPage.name} 성능 측정`, async () => {
            const page = await sharedContext.newPage();
            const analyzer = new PerformanceAnalyzer();
            analyzer.attachToPage(page);

            console.log(`\n[${testPage.name}] 페이지 접속 중...`);
            console.log(`  URL: ${testPage.url}`);

            const startTime = Date.now();
            await page.goto(`${LOGIN_URL}${testPage.url}`);
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            const endTime = Date.now();

            console.log(`[${testPage.name}] 로딩 완료 (${endTime - startTime}ms)`);

            // 페이지가 완전히 로드될 때까지 추가 대기
            await page.waitForTimeout(2000);

            // 성능 리포트 생성
            const report = await analyzer.generateReport(page, testPage.name);
            allReports.push(report);

            // 콘솔 출력
            console.log(`[${testPage.name}] 성능 메트릭:`);
            if (report.navigation) {
                console.log(`  - TTFB: ${report.navigation.ttfb}ms`);
                console.log(`  - DOM 로드: ${report.navigation.domContentLoaded}ms`);
                console.log(`  - 전체 로드: ${report.navigation.totalTime}ms`);
            }
            if (report.api.statistics) {
                console.log(`  - API 호출: ${report.api.statistics.count}개`);
                console.log(`  - 평균 응답: ${report.api.statistics.avgDuration}ms`);
                console.log(`  - 최대 응답: ${report.api.statistics.maxDuration}ms`);
            }

            // 스크린샷 저장
            await page.screenshot({
                path: `reports/screenshots/${testPage.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                fullPage: true
            });

            await page.close();
        });
    }
});

