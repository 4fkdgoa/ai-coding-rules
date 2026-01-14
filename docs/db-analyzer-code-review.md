# DB Analyzer 코드 리뷰 리포트

**일자**: 2026-01-14
**리뷰 대상**: `scripts/db_analyzer` (index.js 및 adapters)
**리뷰어**: Gemini AI

## 1. 개요
이 도구는 다양한 데이터베이스(MySQL, Oracle, MSSQL, PostgreSQL)의 스키마 정보를 추출하여 분석하는 CLI 유틸리티입니다. 프로젝트 설정 파일(Spring application.yml, Tomcat context.xml 등)에서 접속 정보를 자동 추출하는 기능이 포함되어 있습니다.

## 2. 코드 품질 및 보안 검토

### 2.1 보안 (Security)
*   **SQL Injection**:
    *   **양호**: 대부분의 어댑터(`mysql.js`, `postgresql.js`, `oracle.js`)가 파라미터 바인딩(Parameterized Query)을 사용하여 값을 전달합니다.
    *   **주의**: 테이블 이름을 동적으로 쿼리에 넣는 부분(예: `SELECT * FROM ${tableName}`)이 존재하나, 이는 사용자 입력이 아닌 DB 메타데이터(`INFORMATION_SCHEMA` 등)에서 가져온 값이므로 보안 위험은 낮습니다. 다만, `mysql.js`의 `connection.escapeId`와 같이 식별자 이스케이프 처리를 일관되게 적용하는 것이 권장됩니다.
*   **민감 정보 처리**:
    *   비밀번호가 로그에 직접 출력되지 않도록 처리된 점은 양호합니다 (`(암호화됨)` 또는 `(있음)`으로 표시).
    *   `.env` 파일을 읽거나 설정 파일에서 비밀번호를 추출하여 메모리에 담고 DB 연결에만 사용하므로 일반적인 CLI 도구 수준의 보안성을 갖추고 있습니다.

### 2.2 코드 품질 (Code Quality)
*   **구조 및 모듈화**:
    *   어댑터 패턴을 사용하여 DB 별 구현을 분리한 구조는 확장성이 좋습니다.
    *   동적 `import`를 사용하여 필요한 드라이버만 로드하는 방식은 효율적입니다.
*   **에러 처리**:
    *   `main` 함수와 각 어댑터에서 `try-catch-finally` 블록을 통해 리소스 해제(Connection Close)를 보장하려 노력한 흔적이 보입니다.
    *   MySQL, Oracle, PostgreSQL 어댑터는 `finally` 블록에서 연결을 종료하여 안정적입니다.
*   **버그 발견 (Critical)**:
    *   **`adapters/mssql.js`**: ES Module 환경(`type: "module"`)에서 `require('tedious')`를 사용하고 있습니다. 이는 런타임 에러(`ReferenceError: require is not defined`)를 발생시킵니다. 상단 `import`를 재사용하거나 `createRequire`를 사용해야 합니다.

### 2.3 기능 완성도 (Functional Completeness)
*   **설정 자동 추출**: Spring Boot(`application.yml`, `.properties`), Legacy(`context.xml`), `.env` 등 다양한 소스를 지원하여 편의성이 높습니다.
*   **제약 사항**:
    *   **하드코딩된 제한**: 모든 어댑터에 `SAFETY_LIMIT = 100`이 하드코딩되어 있습니다. 대규모 DB 분석 시 전체 테이블을 가져오지 못할 수 있습니다. 옵션으로 처리해야 합니다.
    *   **스키마 제한**: PostgreSQL 어댑터가 `public` 스키마만 조회하도록 하드코딩(`WHERE t.schemaname = 'public'`)되어 있습니다. 다른 스키마를 사용하는 프로젝트에서는 테이블을 찾지 못합니다.

## 3. 상세 개선 제안

### 3.1 버그 수정 (Urgent)
*   `scripts/db_analyzer/adapters/mssql.js`의 `executeQuery` 함수 내부 `require` 제거.

### 3.2 기능 개선
1.  **LIMIT 설정화**: `--limit` 옵션을 추가하거나 설정 파일에서 `limit` 값을 받아 `SAFETY_LIMIT` 상수를 대체.
2.  **스키마(Schema) 선택**: PostgreSQL, Oracle, MSSQL 등에서 특정 스키마(사용자)만 분석할 수 있도록 설정에 `schema` 옵션 추가.
3.  **포트 처리**: `application.yml` 파싱 정규식에서 포트가 없는 경우(기본 포트 사용 시)에 대한 처리가 일부 되어있으나(`getDefaultPort`), JDBC URL 파싱 로직을 좀 더 견고하게(URL 파서 사용 등) 개선 권장.

## 4. 결론

전반적으로 구조가 잘 잡혀있고 유용한 도구이나, **MSSQL 어댑터의 런타임 버그**는 즉시 수정이 필요합니다. 또한 대규모 프로젝트 적용을 위해 **LIMIT 제한 해제** 옵션이 필요합니다.

**판정**: [수정 필요]
