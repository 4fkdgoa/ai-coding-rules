# DB Analyzer 사용 설명서

DB Analyzer는 프로젝트의 데이터베이스 스키마를 자동으로 분석하여 AI가 이해할 수 있는 JSON 형식으로 출력하는 도구입니다.

---

## 목차

1. [개요](#개요)
2. [설치](#설치)
3. [사용법](#사용법)
4. [비대화형 모드 (AI용)](#비대화형-모드-ai용)
5. [설정 파일](#설정-파일)
6. [지원 데이터베이스](#지원-데이터베이스)
7. [출력 형식](#출력-형식)
8. [analyze_project.sh 통합](#analyze_projectsh-통합)
9. [문제 해결](#문제-해결)

---

## 개요

### 주요 기능

- **DB 설정 자동 추출**: application.yml, context.xml, persistence.xml 등에서 연결 정보 추출
- **테이블 스키마 분석**: 테이블, 컬럼, PK, FK 정보 수집
- **공통코드 탐지**: 코드 테이블 자동 탐지 및 샘플 데이터 추출
- **다중 DB 지원**: MySQL, Oracle, MSSQL, PostgreSQL
- **설정 파일 분리**: 공통코드 패턴을 설정 파일로 관리

### 보안 고려사항

- ReadOnly 쿼리만 실행 (SELECT만 사용)
- 조회 제한 (기본 100행, `--limit` 옵션으로 조절)
- 연결 타임아웃 (5초)
- 비밀번호는 환경변수 사용 권장

---

## 설치

### 사전 요구사항

- Node.js 18 이상
- npm 또는 yarn

### 설치 방법

```bash
cd scripts/db_analyzer
npm install
```

### DB별 드라이버

| DB | 패키지 | 비고 |
| --- | --- | --- |
| MySQL | mysql2 | 자동 설치됨 |
| Oracle | oracledb | Oracle Instant Client 필요할 수 있음 |
| MSSQL | tedious | 자동 설치됨 |
| PostgreSQL | pg | 자동 설치됨 |

---

## 사용법

### 기본 사용법

```bash
# 프로젝트에서 DB 설정 자동 추출
node index.js --extract-from /path/to/project

# 설정 파일 사용
node index.js --config .ai-analyzer.json

# 대화형 입력
node index.js --interactive
```

### CLI 옵션

| 옵션 | 설명 | 예시 |
| --- | --- | --- |
| `--extract-from <path>` | 프로젝트에서 DB 설정 자동 추출 | `--extract-from /path/to/project` |
| `--config <file>` | 설정 파일 지정 | `--config .ai-analyzer.json` |
| `--interactive` | 대화형 DB 정보 입력 | `--interactive` |
| `--non-interactive` | AI용 비대화형 모드 | `--non-interactive` |
| `--output <file>` | 결과 저장 파일 | `--output db_schema.json` |
| `--limit <n>` | 최대 테이블/행 수 | `--limit 200` |
| `--schema <name>` | 스키마 지정 (PostgreSQL) | `--schema public` |
| `--help` | 도움말 | `--help` |

### 사용 예시

```bash
# 프로젝트에서 추출 후 결과 저장
node index.js --extract-from ../autocrm --output schema.json

# 설정 파일 + 제한 조절
node index.js --config .ai-analyzer.json --limit 500

# PostgreSQL 특정 스키마
node index.js --config config.json --schema myschema
```

---

## 비대화형 모드 (AI용)

AI 도구(Claude Code, Gemini CLI 등)는 readline 프롬프트를 사용할 수 없습니다. `--non-interactive` 옵션으로 이 문제를 해결합니다.

### 워크플로우

```
1. 비대화형으로 실행 (설정 불완전 시 템플릿 생성)
   → exit code 2 반환

2. AI가 템플릿 파일 읽고 사용자에게 DB 정보 질문

3. .ai-analyzer.json 작성 후 재실행
```

### 사용 예시

```bash
# Step 1: 비대화형으로 시도
node index.js --non-interactive --extract-from /path/to/project

# 출력 예시 (설정 불완전 시):
# {
#   "status": "incomplete",
#   "missing": ["host", "database", "user"],
#   "template_path": ".ai-analyzer-template.json"
# }
# Exit code: 2

# Step 2: 템플릿 수정 후 재실행
node index.js --config .ai-analyzer.json --output db_schema.json
```

### Exit Codes

| Code | 의미 | 설명 |
| --- | --- | --- |
| 0 | 성공 | DB 분석 완료 |
| 1 | 에러 | 연결 실패, 쿼리 오류 등 |
| 2 | 설정 필요 | 사용자 입력 필요 (템플릿 생성됨) |

### 환경변수 치환

설정 파일에서 `${VAR_NAME}` 형식으로 환경변수를 사용할 수 있습니다:

```json
{
  "db": {
    "password": "${DB_PASSWORD}"
  }
}
```

### 보안 경고

- `.ai-analyzer.json`을 `.gitignore`에 추가하세요
- 비밀번호는 환경변수 사용을 권장합니다
- 템플릿 파일 생성 시 `.gitignore` 미등록 경고가 출력됩니다

---

## 설정 파일

### 템플릿 위치

`templates/.ai-analyzer.json`

### 주요 섹션

```json
{
  "db": {
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "your_database",
    "user": "readonly_user",
    "password_env": "DB_PASSWORD"
  },

  "common_code_detection": {
    "table_patterns": [
      "TB_CODE", "TB_COMMON_CODE", "CMM_CD", "COMMON_CODE",
      "CODES", "CDS", "_CODE_", "_CD_"
    ],
    "required_columns": ["GRP_CD|GROUP_CODE", "CD|CODE", "CD_NM|CODE_NAME"],
    "use_column_heuristic": false
  }
}
```

### DB 설정

| 필드 | 설명 | 필수 |
| --- | --- | --- |
| `type` | DB 종류 (mysql, oracle, mssql, postgresql) | O |
| `host` | 호스트명 | O |
| `port` | 포트 (기본값 자동) | X |
| `database` | 데이터베이스명 | O |
| `user` | 사용자명 | O |
| `password` | 비밀번호 (직접 입력) | X |
| `password_env` | 비밀번호 환경변수명 | X |

### 공통코드 탐지 설정

| 필드 | 설명 |
| --- | --- |
| `table_patterns` | 공통코드 테이블명 패턴 배열 |
| `required_columns` | 컬럼 기반 휴리스틱용 필수 컬럼 |
| `use_column_heuristic` | 컬럼 기반 탐지 사용 여부 |

---

## 지원 데이터베이스

### MySQL

```json
{
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "database": "mydb"
}
```

### Oracle

```json
{
  "type": "oracle",
  "host": "localhost",
  "port": 1521,
  "database": "ORCL"
}
```

**참고**: Oracle은 접속 사용자가 곧 스키마입니다. `USER_TABLES` 뷰를 사용합니다.

### MSSQL (SQL Server)

```json
{
  "type": "mssql",
  "host": "localhost",
  "port": 1433,
  "database": "mydb"
}
```

### PostgreSQL

```json
{
  "type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "mydb"
}
```

**참고**: `--schema` 옵션으로 스키마 지정 가능 (기본값: public)

---

## 출력 형식

### 결과 JSON 구조

```json
{
  "status": "success",
  "meta": {
    "analyzed_at": "2026-01-14T12:00:00.000Z",
    "db_type": "mysql",
    "database": "mydb",
    "host": "localhost",
    "extracted_from": "application.yml"
  },
  "tables": [
    {
      "name": "users",
      "comment": "사용자 테이블",
      "row_count": 1500,
      "columns": [
        {
          "name": "id",
          "type": "bigint",
          "length": null,
          "nullable": false,
          "key": "PRI",
          "comment": "사용자 ID"
        }
      ],
      "foreign_keys": [
        {
          "column": "dept_id",
          "references": "departments.id"
        }
      ]
    }
  ],
  "common_codes": [
    {
      "table": "TB_CODE",
      "sample_count": 50,
      "data": [
        {"GRP_CD": "STATUS", "CD": "01", "CD_NM": "활성"}
      ]
    }
  ],
  "statistics": {
    "table_count": 25,
    "common_code_count": 3
  },
  "errors": []
}
```

### 상태 값

| status | 설명 |
| --- | --- |
| `success` | 모든 분석 성공 |
| `partial` | 일부 성공 (errors 배열 확인) |
| `failed` | 전체 실패 |

---

## analyze_project.sh 통합

### 사용법

```bash
# DB 분석 포함 스캔
./scripts/analyze_project.sh /path/to/project scan --with-db

# 설정 파일 지정
./scripts/analyze_project.sh /path/to/project scan --db-config .ai-analyzer.json
```

### 동작 방식

1. Node.js 존재 확인 (없으면 경고 후 스킵)
2. `node_modules` 없으면 자동 `npm install`
3. DB 분석 실행
4. 결과를 `docs/db_schema.json`에 저장

---

## 문제 해결

### 연결 실패

```
[ERROR] 연결 타임아웃 (5000ms)
```

- 호스트/포트 확인
- 방화벽 설정 확인
- DB 서버 실행 상태 확인

### 권한 오류

```
[ERROR] Access denied for user
```

- 사용자명/비밀번호 확인
- DB 접근 권한 확인 (SELECT 권한 필요)

### Oracle Instant Client

Oracle DB 연결 시 다음 오류가 발생하면:

```
DPI-1047: Cannot locate a 64-bit Oracle Client library
```

[Oracle Instant Client](https://www.oracle.com/database/technologies/instant-client.html)를 설치하세요.

### 공통코드 테이블 미탐지

설정 파일의 `common_code_detection.table_patterns`에 패턴 추가:

```json
{
  "common_code_detection": {
    "table_patterns": [
      "MY_CUSTOM_CODE_TABLE",
      "...기존 패턴..."
    ]
  }
}
```

---

## 관련 문서

- [프로젝트 분석기 설계서](./project-analyzer-design.md)
- [설정 파일 템플릿](../templates/.ai-analyzer.json)
- [진행 상황](../progress/2026-01-14_project-analyzer.md)
