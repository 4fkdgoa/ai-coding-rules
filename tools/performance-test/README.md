# SDMS 성능 분석 도구

Playwright 기반 웹사이트 성능 측정 및 분석 도구

## 기능

- 로그인 자동화
- 페이지 로딩 성능 측정 (TTFB, DOM Load, Total Load)
- Web Vitals 측정 (LCP, FCP, CLS)
- API 호출 성능 분석 (응답 시간, P50/P95/P99)
- 리소스 타입별 통계
- HTML 리포트 자동 생성

## 설치

```bash
# 의존성 설치 (이미 완료됨)
npm install

# 브라우저 설치 (이미 완료됨)
npx playwright install chromium
```

## 실행

### 1. 기본 실행 (헤드리스 모드)
```bash
cd performance-test
npm test
```

### 2. 브라우저 UI로 실행 (디버깅용)
```bash
npm run test:headed
```

### 3. Playwright UI 모드
```bash
npm run test:ui
```

### 4. 리포트 보기
```bash
npm run report
```

## 측정 페이지

현재 다음 페이지들의 성능을 측정합니다:

1. **로그인 페이지**
   - URL: https://sdms.sclmotors.co.kr
   - 로그인 성능 측정

2. **입고관리 (incm01)**
   - URL: https://sdms.sclmotors.co.kr/sfa/in/cm/incm01.crm
   - 입고관리 페이지 성능

3. **엑셀 관리 (smrm01)**
   - URL: https://sdms.sclmotors.co.kr/sfa/sm/rm/smrm01.do
   - 엑셀 관리 페이지 성능

## 리포트

테스트 실행 후 다음 파일들이 생성됩니다:

- `reports/performance-report-*.html` - 시각화된 HTML 리포트
- `reports/performance-data-*.json` - 원본 JSON 데이터
- `reports/screenshots/*.png` - 페이지 스크린샷

## 측정 메트릭

### 페이지 로딩 성능
- **TTFB** (Time to First Byte): 서버 응답 시간
- **DNS**: DNS 조회 시간
- **TCP**: TCP 연결 시간
- **요청 시간**: 서버까지 요청 전송 시간
- **응답 시간**: 서버로부터 응답 수신 시간
- **DOM 로드**: DOM 로딩 시간
- **전체 로드**: 페이지 전체 로딩 시간

### Web Vitals
- **LCP** (Largest Contentful Paint): 가장 큰 콘텐츠 렌더링 시간
  - 좋음: < 2.5초
  - 개선 필요: 2.5~4초
  - 나쁨: > 4초

- **FCP** (First Contentful Paint): 첫 콘텐츠 렌더링 시간
  - 좋음: < 1.8초
  - 개선 필요: 1.8~3초
  - 나쁨: > 3초

- **CLS** (Cumulative Layout Shift): 레이아웃 이동 점수
  - 좋음: < 0.1
  - 개선 필요: 0.1~0.25
  - 나쁨: > 0.25

### API 성능
- **총 API 호출**: API 요청 개수
- **평균 응답**: 평균 응답 시간
- **P50**: 50번째 백분위수 (중앙값)
- **P95**: 95번째 백분위수
- **P99**: 99번째 백분위수

## 설정 변경

### 다른 페이지 추가

`tests/sdms-performance.spec.js` 파일의 `TEST_PAGES` 배열에 추가:

```javascript
const TEST_PAGES = [
    {
        name: '새 페이지',
        url: '/path/to/page',
        description: '설명'
    }
];
```

### 로그인 정보 변경

`tests/sdms-performance.spec.js` 파일의 상수 수정:

```javascript
const USERNAME = 'your-username';
const PASSWORD = 'your-password';
```

### 타임아웃 조정

`playwright.config.js` 파일 수정:

```javascript
timeout: 60 * 1000,  // 전체 테스트 타임아웃
actionTimeout: 15000, // 액션 타임아웃
```

## 문제 해결

### 로그인 실패
- `reports/login-error.png` 스크린샷 확인
- 로그인 폼 선택자가 실제 페이지와 맞는지 확인
- `tests/sdms-performance.spec.js`의 선택자 수정

### 페이지 로딩 타임아웃
- 네트워크가 느릴 수 있음
- `playwright.config.js`의 타임아웃 증가
- `waitForLoadState` 대신 특정 요소 대기로 변경

### API 통계가 0
- API 호출 판별 로직 확인
- `utils/performance-analyzer.js`의 `isApiCall()` 메서드 수정
