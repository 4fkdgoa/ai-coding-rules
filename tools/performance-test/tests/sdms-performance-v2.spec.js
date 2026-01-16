const { test, expect } = require('@playwright/test');
const PerformanceAnalyzer = require('../utils/performance-analyzer');
const ReportGenerator = require('../utils/report-generator');
const path = require('path');
const fs = require('fs');

// 로그인 정보
const LOGIN_URL = 'https://sdms.sclmotors.co.kr';
const USERNAME = 'test';
const PASSWORD = 'jkl123**';
const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

// 테스트 페이지 목록
const TEST_PAGES = [
    {
        name: '대시보드',
        url: '/sfa/mainManager.jsp',
        description: '메인 대시보드 페이지'
    },
    {
        name: '입고관리 (incm01)',
        url: '/sfa/in/cm/incm01.crm',
        description: '입고관리 페이지 성능 측정'
    },
    {
        name: '엑셀 관리 (smrm01)',
        url: '/sfa/sm/rm/smrm01.do',
        description: '엑셀 다운로드/업로드 페이지 성능 측정'
    }
];

// 로그인 설정 (모든 테스트 전에 한 번만 실행)
test.beforeAll(async ({ browser }) => {
    console.log('로그인 세션 생성 중...');

    // auth 디렉토리 생성
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const page = await browser.newPage();

    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    // 페이지가 완전히 로드될 때까지 대기
    await page.waitForTimeout(1000);

    const usernameInput = page.locator('input[name="p_userId"]');
    const passwordInput = page.locator('input[name="p_userPw"]');

    await usernameInput.fill(USERNAME);
    await passwordInput.fill(PASSWORD);

    // 입력 후 약간 대기
    await page.waitForTimeout(500);

    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    // 로그인 완료 대기
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 로그인 성공 확인
    const url = page.url();
    console.log('로그인 후 URL:', url);

    if (url.includes('mainManager.jsp') || !url.includes('/login.do')) {
        console.log('로그인 성공!');
        // 세션 저장
        await page.context().storageState({ path: AUTH_FILE });
        console.log('세션 저장 완료:', AUTH_FILE);
    } else {
        throw new Error('로그인 실패');
    }

    await page.close();
});

test.describe('SDMS 성능 분석 (v2)', () => {
    let allReports = [];

    test.afterAll(async () => {
        // 모든 테스트 완료 후 리포트 생성
        if (allReports.length > 0) {
            const files = ReportGenerator.save(allReports, 'reports');
            console.log('\n=== 성능 리포트 생성 완료 ===');
            console.log('HTML 리포트:', files.html);
            console.log('JSON 데이터:', files.json);
        }
    });

    // 각 페이지별 성능 테스트
    for (const testPage of TEST_PAGES) {
        test(`${testPage.name} 성능 측정`, async ({ browser }) => {
            // 저장된 세션으로 새 컨텍스트 생성
            const context = await browser.newContext({ storageState: AUTH_FILE });
            const page = await context.newPage();
            const analyzer = new PerformanceAnalyzer();
            analyzer.attachToPage(page);

            console.log(`\n[${testPage.name}] 페이지 접속 중...`);
            console.log(`  URL: ${testPage.url}`);

            const startTime = Date.now();
            await page.goto(`${LOGIN_URL}${testPage.url}`);
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            const endTime = Date.now();

            console.log(`[${testPage.name}] 로딩 완료 (${endTime - startTime}ms)`);

            // 로그인 페이지로 리다이렉트되지 않았는지 확인
            const currentUrl = page.url();
            if (currentUrl.includes('/login.do')) {
                throw new Error('로그인 세션이 만료되었습니다. 페이지가 로그인 화면으로 리다이렉트되었습니다.');
            }

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

            await context.close();
        });
    }
});
