# DB Analyzer 코드 리뷰 요청

## 리뷰 대상 파일

```
scripts/db_analyzer/
├── package.json          # 의존성 정의
├── index.js              # 메인 스크립트 (331줄)
└── adapters/
    ├── mysql.js          # MySQL 어댑터 (134줄)
    ├── oracle.js         # Oracle 어댑터 (172줄)
    ├── mssql.js          # MSSQL 어댑터 (200줄)
    └── postgresql.js     # PostgreSQL 어댑터 (151줄)
```

## 주요 기능

1. **설정 자동 추출**: application.yml, context.xml, .env에서 DB 정보 추출
2. **대화형 입력**: 설정 추출 실패 시 사용자에게 직접 입력 요청
3. **DB별 어댑터**: MySQL, Oracle, MSSQL, PostgreSQL 지원
4. **스키마 분석**: 테이블, 컬럼, PK/FK 관계 추출
5. **공통코드 조회**: 코드 테이블 패턴 자동 탐지 및 데이터 추출

## 리뷰 요청 항목

### 1. 보안
- SQL Injection 취약점 여부
- 암호 처리 (ENC() 패턴, 환경변수)
- 연결 정보 로깅 이슈

### 2. 코드 품질
- 에러 핸들링 적절성
- 리소스 정리 (connection close)
- 코드 중복 (어댑터 간)

### 3. 기능 완성도
- 설정 추출 로직 충분한지
- Oracle TNS 형식 지원 여부
- Windows 인증(MSSQL) 지원 여부

### 4. 개선점
- 추가해야 할 기능
- 리팩토링 필요한 부분
- 테스트 코드 필요성

## 파일 내용 요약

### index.js 핵심 로직
- `extractDbConfigFromProject()`: 설정 파일에서 DB 정보 추출
- `promptDbConfig()`: 사용자 대화형 입력
- `analyzeSchema()`: 어댑터 호출하여 스키마 분석
- 환경변수 fallback 지원

### 어댑터 공통 구조
```javascript
export async function getTables(config) {
    // 1. 연결
    // 2. 테이블 목록 조회 (LIMIT 100)
    // 3. 각 테이블별 컬럼, PK, FK 조회
    // 4. 연결 종료
}

export async function getCommonCodes(config) {
    // 1. 연결
    // 2. 코드 테이블 패턴 검색
    // 3. 데이터 샘플 조회 (LIMIT 100)
    // 4. 연결 종료
}
```

---
작성자: Claude
작성일: 2026-01-14
