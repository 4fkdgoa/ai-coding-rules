# DB 분석 도구 설계 요청

## 목표

프로젝트의 DB 설정을 감지하고, 실제 DB에 연결하여 스키마 정보를 추출하는 도구 개발

## 현재 상황

- `analyze_project.sh`는 정적 분석만 수행 (application.yml, Entity 클래스 읽기)
- 실제 DB 연결 없이는 정확한 테이블 구조, 관계를 알 수 없음

## 제안하는 접근 방식

### 1. DB 타입 자동 감지
프로젝트 설정 파일에서 DB 타입 추출:
- `application.yml`: `spring.datasource.url`에서 jdbc:mysql, jdbc:oracle 등
- `package.json`: mssql, mysql2, pg, oracledb 의존성
- `requirements.txt`: pymysql, psycopg2, cx_Oracle 등

### 2. Node.js 기반 DB 분석 스크립트
```
scripts/
├── db-analyzer/
│   ├── package.json        # 의존성 (mysql2, mssql, oracledb, pg)
│   ├── index.js            # 메인 스크립트
│   ├── drivers/
│   │   ├── mysql.js
│   │   ├── mssql.js
│   │   ├── oracle.js
│   │   └── postgres.js
│   └── output/
│       └── schema.json     # 추출된 스키마
```

### 3. 추출할 정보
- 테이블 목록
- 컬럼 정보 (이름, 타입, nullable, default)
- Primary Key
- Foreign Key 관계
- 인덱스
- 공통코드 테이블 값 (선택적)

### 4. 보안 고려사항
- DB credentials는 환경변수로만 받음 (.env)
- 추출된 스키마에 민감정보 포함 금지
- .gitignore에 output/ 추가

### 5. 사용 예시
```bash
# 프로젝트 분석 후 DB 타입 감지
./analyze_project.sh /path/to/project scan

# DB 분석 실행 (credentials는 환경변수)
DB_HOST=localhost DB_USER=app DB_PASS=xxx ./scripts/db-analyzer/index.js

# 또는 .env 파일 사용
./scripts/db-analyzer/index.js --env /path/to/.env
```

## 검토 요청 사항

1. 이 접근 방식이 적절한가?
2. Node.js vs Python 중 어떤 것이 나은가?
3. 보안상 추가로 고려할 점?
4. 다른 방법 (DDL 파일 분석 등)이 더 나은가?
5. 구현 우선순위?

---

## Gemini 검토 결과 (2026-01-14)

**판정: [승인]**

### 반영 사항
1. **읽기 전용 계정 권장** - DB 분석용 계정은 SELECT, SHOW VIEW 권한만
2. **데이터 추출 옵션화** - 공통코드 값 조회는 `--dump-data` 옵션으로만 (기본 비활성화)
3. **Output 포맷 정의** - schema.json 구조를 Prisma/TypeORM 형식 참고

### 우선순위
1. Core: MySQL/PostgreSQL 연결 및 테이블/컬럼 추출
2. Relation: PK/FK 관계 매핑
3. Driver: Oracle/MSSQL 확장
4. Advanced: 인덱스, View, SP

---

## 사용자 피드백 반영 (2026-01-14)

### 핵심 원칙: 자동화가 어려우면 사람에게 물어보기

**DB 정보 획득 순서**:
1. **자동 추출 시도**: context.xml, application.yml, .env 등에서 추출
2. **추출 실패 시**: 사용자에게 대화형으로 질문
   ```
   DB 연결 정보를 찾을 수 없습니다.
   다음 정보를 입력해주세요:
   - DB 타입 (mysql/oracle/mssql/postgres):
   - Host:
   - Port:
   - Database/Schema:
   - Username:
   ```
3. **입력받은 정보 저장**: `.db-analyzer.json` (credentials 제외)

### 설정 파일 탐색 순서
1. `src/main/resources/application.yml`
2. `src/main/resources/application.properties`
3. `src/main/webapp/META-INF/context.xml`
4. `.env`, `.env.local`
5. `config/database.yml`
6. **위 모두 실패 시 → 사용자에게 질문**

---
작성자: Claude
작성일: 2026-01-14
Gemini 검토일: 2026-01-14
