const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('로그인 페이지 접속 중...');
    await page.goto('https://sdms.sclmotors.co.kr');

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 스크린샷 저장
    await page.screenshot({ path: 'reports/login-page.png', fullPage: true });
    console.log('스크린샷 저장: reports/login-page.png');

    // 페이지 HTML 일부 출력
    const html = await page.content();
    console.log('\n페이지 HTML (처음 2000자):');
    console.log(html.substring(0, 2000));

    // 입력 필드 찾기
    console.log('\n\n입력 필드 검색 중...');

    // 모든 input 태그 찾기
    const inputs = await page.$$('input');
    console.log(`\n총 ${inputs.length}개의 input 태그 발견:`);

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const className = await input.getAttribute('class');

        console.log(`\nInput ${i + 1}:`);
        console.log(`  type: ${type}`);
        console.log(`  name: ${name}`);
        console.log(`  id: ${id}`);
        console.log(`  placeholder: ${placeholder}`);
        console.log(`  class: ${className}`);
    }

    // 버튼 찾기
    const buttons = await page.$$('button');
    console.log(`\n\n총 ${buttons.length}개의 button 태그 발견:`);

    for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const type = await button.getAttribute('type');
        const text = await button.textContent();
        const id = await button.getAttribute('id');
        const className = await button.getAttribute('class');

        console.log(`\nButton ${i + 1}:`);
        console.log(`  type: ${type}`);
        console.log(`  text: ${text?.trim()}`);
        console.log(`  id: ${id}`);
        console.log(`  class: ${className}`);
    }

    // submit input 찾기
    const submitInputs = await page.$$('input[type="submit"]');
    console.log(`\n\n총 ${submitInputs.length}개의 submit input 발견`);

    console.log('\n\n브라우저 열린 상태로 대기 중... (수동으로 닫아주세요)');
    console.log('로그인 폼을 확인하고 적절한 선택자를 찾아주세요.');

    // 1분 대기 (수동 확인용)
    await page.waitForTimeout(60000);

    await browser.close();
})();
