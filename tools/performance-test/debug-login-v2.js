const { chromium } = require('@playwright/test');

const LOGIN_URL = 'https://sdms.sclmotors.co.kr';
const USERNAME = 'test';
const PASSWORD = 'jkl123**';

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const page = await browser.newPage();

    console.log('[1] 로그인 페이지 접속...');
    await page.goto(LOGIN_URL);
    await page.waitForLoadState('networkidle');

    console.log('[2] 입력 필드 입력...');
    await page.locator('input[name="p_userId"]').fill(USERNAME);
    await page.locator('input[name="p_userPw"]').fill(PASSWORD);

    console.log('[3] 로그인 버튼 클릭...');
    await page.locator('button[type="submit"]').click();

    console.log('[4] 대기 중...');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const url = page.url();
    console.log('[5] 현재 URL:', url);

    if (url.includes('/login.do')) {
        console.log('[실패] 여전히 로그인 페이지에 있음');

        // 에러 메시지 찾기
        const bodyText = await page.locator('body').textContent();
        console.log('페이지 텍스트:', bodyText.substring(0, 500));

        // alert 확인
        page.on('dialog', async dialog => {
            console.log('Alert 메시지:', dialog.message());
            await dialog.accept();
        });
    } else {
        console.log('[성공] 로그인 성공!');
        console.log('리다이렉트 URL:', url);
    }

    await page.screenshot({ path: 'reports/debug-after-login.png', fullPage: true });

    console.log('\n30초 대기... 수동으로 확인하세요.');
    await page.waitForTimeout(30000);

    await browser.close();
})();
