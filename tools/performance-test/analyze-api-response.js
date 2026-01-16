/**
 * API 응답 데이터 분석 도구
 * 소스 코드 없이 API 응답만으로 DB 성능 추론
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const LOGIN_URL = 'https://sdms.sclmotors.co.kr';
const USERNAME = 'test';
const PASSWORD = 'jkl123**';
const AUTH_FILE = path.join(__dirname, '.auth/user.json');

// 분석할 API 목록
const API_ENDPOINTS = [
    {
        name: '재고 목록',
        url: '/sfa/stock/stockList.json',
        method: 'POST',
        payload: {}  // 실제 페이로드는 네트워크 탭에서 확인 필요
    }
];

async function analyzeAPI(page, apiConfig) {
    console.log(`\n=== ${apiConfig.name} 분석 ===`);

    const startTime = Date.now();
    let responseData;
    let responseSize;
    let responseStatus;

    // 응답 가로채기
    page.on('response', async (response) => {
        if (response.url().includes(apiConfig.url.split('?')[0])) {
            responseStatus = response.status();

            try {
                const body = await response.body();
                responseSize = body.length;

                // JSON 파싱
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    responseData = JSON.parse(body.toString());
                }
            } catch (e) {
                console.error('응답 파싱 실패:', e.message);
            }
        }
    });

    // API 호출 (페이지 이동 또는 직접 fetch)
    // 여기서는 페이지를 열어서 API가 자동으로 호출되도록 함
    // 실제로는 fetch나 XHR로 직접 호출 가능

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
        name: apiConfig.name,
        url: apiConfig.url,
        duration,
        status: responseStatus,
        size: responseSize,
        data: responseData
    };
}

async function analyzeResponseData(data, name) {
    console.log(`\n📊 ${name} 데이터 분석:`);

    if (!data) {
        console.log('❌ 데이터 없음');
        return;
    }

    // 배열인 경우
    if (Array.isArray(data)) {
        console.log(`  - 총 레코드 수: ${data.length}개`);

        if (data.length > 0) {
            const firstRecord = data[0];
            const fields = Object.keys(firstRecord);

            console.log(`  - 필드 수: ${fields.length}개`);
            console.log(`  - 필드 목록:`, fields.slice(0, 10));

            // 평균 레코드 크기
            const jsonString = JSON.stringify(data);
            const avgSize = jsonString.length / data.length;
            console.log(`  - 평균 레코드 크기: ${Math.round(avgSize)} bytes`);

            // 데이터 타입 분석
            const fieldTypes = {};
            for (const field of fields) {
                const value = firstRecord[field];
                fieldTypes[field] = typeof value;
            }
            console.log(`  - 데이터 타입:`, fieldTypes);

            // 샘플 데이터
            console.log(`\n  샘플 레코드 (첫 번째):`);
            console.log(JSON.stringify(firstRecord, null, 2).substring(0, 500));
        }
    } else if (typeof data === 'object') {
        console.log(`  - 객체 타입`);
        console.log(`  - 키:`, Object.keys(data));

        // list, data, result 등의 키를 찾아서 배열 분석
        for (const key of ['list', 'data', 'result', 'rows', 'items']) {
            if (data[key] && Array.isArray(data[key])) {
                await analyzeResponseData(data[key], `${name}.${key}`);
            }
        }
    }
}

async function estimateDBPerformance(apiResults) {
    console.log('\n\n🔍 DB 성능 추정:');

    for (const result of apiResults) {
        console.log(`\n${result.name}:`);
        console.log(`  - 총 응답 시간: ${result.duration}ms`);
        console.log(`  - 응답 크기: ${(result.size / 1024).toFixed(2)}KB`);

        // 네트워크 시간 추정 (응답 크기 기반)
        const networkTime = (result.size / 1024 / 1024) * 100; // 1MB당 100ms 가정
        console.log(`  - 추정 네트워크 시간: ${Math.round(networkTime)}ms`);

        // DB 쿼리 시간 추정
        const estimatedDBTime = result.duration - networkTime - 50; // 50ms는 애플리케이션 처리 시간
        console.log(`  - 추정 DB 쿼리 시간: ${Math.round(estimatedDBTime)}ms`);

        // 레코드 수 기반 분석
        if (result.data && Array.isArray(result.data)) {
            const recordCount = result.data.length;
            const timePerRecord = estimatedDBTime / recordCount;

            console.log(`  - 레코드당 처리 시간: ${timePerRecord.toFixed(2)}ms`);

            // 성능 등급 판정
            if (timePerRecord < 1) {
                console.log(`  - ✅ 성능: 우수 (인덱스 사용 추정)`);
            } else if (timePerRecord < 5) {
                console.log(`  - ⚠️  성능: 보통 (개선 가능)`);
            } else {
                console.log(`  - ❌ 성능: 나쁨 (Full Table Scan 추정)`);
            }

            // 최적화 제안
            console.log(`\n  💡 최적화 제안:`);

            if (recordCount > 100) {
                console.log(`    - 페이징 적용 (한 번에 ${recordCount}개는 너무 많음)`);
            }

            if (estimatedDBTime > 500) {
                console.log(`    - 인덱스 추가 또는 쿼리 최적화 필요`);
            }

            if (result.size > 100000) {
                console.log(`    - 필요한 컬럼만 SELECT (SELECT * 지양)`);
            }
        }
    }
}

(async () => {
    console.log('📡 API 응답 데이터 분석 시작...\n');

    const browser = await chromium.launch({ headless: false });

    // 로그인된 세션 로드
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();

    console.log('✅ 로그인 세션 로드 완료');

    // 엑셀 관리 페이지로 이동 (재고 API가 자동 호출됨)
    console.log('\n📄 엑셀 관리 페이지 접속...');

    const apiResults = [];

    // 응답 캡처
    page.on('response', async (response) => {
        const url = response.url();

        if (url.includes('/stock/stockList.json')) {
            console.log(`\n🎯 재고 API 호출 감지: ${url}`);

            const startTime = Date.now();

            try {
                const body = await response.body();
                const endTime = Date.now();

                const data = JSON.parse(body.toString());

                const result = {
                    name: '재고 목록 API',
                    url: url,
                    duration: response.request().timing().responseEnd || (endTime - startTime),
                    status: response.status(),
                    size: body.length,
                    data: data.list || data.data || data
                };

                apiResults.push(result);

                await analyzeResponseData(result.data, '재고 목록');
            } catch (e) {
                console.error('응답 분석 실패:', e.message);
            }
        }
    });

    await page.goto('https://sdms.sclmotors.co.kr/sfa/sm/rm/smrm01.do');
    await page.waitForLoadState('networkidle');

    // 추가 대기 (비동기 API 호출 대기)
    await page.waitForTimeout(3000);

    console.log('\n' + '='.repeat(60));
    await estimateDBPerformance(apiResults);

    // 결과 저장
    const reportPath = 'reports/api-analysis.json';
    fs.writeFileSync(reportPath, JSON.stringify(apiResults, null, 2));
    console.log(`\n\n📁 분석 결과 저장: ${reportPath}`);

    await page.waitForTimeout(5000);
    await browser.close();
})();
