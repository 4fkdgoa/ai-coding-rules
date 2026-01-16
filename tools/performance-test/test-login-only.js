const { chromium } = require('@playwright/test');

const LOGIN_URL = 'https://sdms.sclmotors.co.kr';
const USERNAME = 'test';
const PASSWORD = 'jkl123**';

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('[1] 로그인 페이지 접속 중...');
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'reports/step1-before-login.png' });

    console.log('[2] 로그인 정보 입력...');
    console.log(`    Username: ${USERNAME}`);
    console.log(`    Password: ${PASSWORD}`);

    const usernameInput = page.locator('input[name="p_userId"]');
    const passwordInput = page.locator('input[name="p_userPw"]');

    await usernameInput.fill(USERNAME);
    await passwordInput.fill(PASSWORD);

    await page.screenshot({ path: 'reports/step2-filled.png' });

    console.log('[3] 로그인 버튼 클릭...');
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    console.log('[4] 로그인 완료 대기...');

    try {
        // 페이지 이동 대기
        await page.waitForLoadState('networkidle', { timeout: 10000 });

        const currentUrl = page.url();
        console.log(`[5] 현재 URL: ${currentUrl}`);

        // 로그인 성공 여부 확인
        if (currentUrl.includes('/login.do')) {
            console.log('[실패] 로그인 실패 - 여전히 로그인 페이지에 있습니다.');

            // 에러 메시지 확인
            const errorMsg = await page.locator('.error, .alert, [class*="error"], [class*="alert"]').first().textContent().catch(() => '에러 메시지 없음');
            console.log(`에러 메시지: ${errorMsg}`);
        } else {
            console.log('[성공] 로그인 성공!');
            console.log(`리다이렉트된 페이지: ${currentUrl}`);
        }

        await page.screenshot({ path: 'reports/step3-after-login.png', fullPage: true });

        // 페이지 타이틀 확인
        const title = await page.title();
        console.log(`페이지 타이틀: ${title}`);

        // 사용자 정보가 있는지 확인 (로그인 성공 시 보통 상단에 사용자명 표시)
        const bodyText = await page.locator('body').textContent();
        console.log('\n페이지 텍스트 일부:');
        console.log(bodyText.substring(0, 500));

    } catch (error) {
        console.error('[에러]', error.message);
        await page.screenshot({ path: 'reports/error.png' });
    }

    console.log('\n\n브라우저를 30초간 열어둡니다. 수동으로 확인해주세요.');
    await page.waitForTimeout(30000);

    await browser.close();
})();
