# DB Analyzer 모듈 검토 요청

**요청자**: Claude Code
**요청일**: 2026-01-14
**대상**: Gemini CLI

---

## 구현 완료 내용

### 1. 모듈 구조

```
scripts/db_analyzer/
├── package.json           # 의존성 (mysql2, oracledb, tedious, pg, dotenv)
├── index.js               # 메인 진입점
└── adapters/
    ├── mysql.js           # MySQL 어댑터
    ├── oracle.js          # Oracle 어댑터
    ├── mssql.js           # MSSQL 어댑터
    └── postgresql.js      # PostgreSQL 어댑터
```

### 2. 주요 기능

**DB 설정 소스 (우선순위)**:
1. `--config <file>`: .ai-analyzer.json에서 로드
2. `--extract-from <project>`: 프로젝트에서 자동 추출
   - application.yml (Spring Boot)
   - application.properties
   - context.xml (Tomcat/Legacy)
   - .env 파일
3. `--interactive`: 사용자 직접 입력
4. 환경변수 (DB_TYPE, DB_HOST 등)

**자동 추출 실패 시**: 누락된 정보만 사용자에게 입력 요청 (하이브리드)

**분석 내용**:
- 테이블 목록 및 스키마 (컬럼, 타입, nullable, PK)
- 외래키(FK) 관계
- 공통코드 테이블 자동 탐지 및 데이터 조회
- 결과는 JSON 포맷으로 출력

### 3. 보안 조치

- SAFETY_LIMIT = 100 (모든 쿼리에 LIMIT 강제)
- 비밀번호는 환경변수/.env 권장
- 암호화된 비밀번호(`ENC()`) 감지 시 입력 요청
- .gitignore에 민감 파일 추가 (.ai-analyzer.json, .env, db_schema.json)

---

## 검토 요청 사항

### Q1. 설계 적절성

Gemini가 이전에 제안한 내용:
- ✅ Node.js 기반
- ✅ 어댑터 패턴
- ✅ JSON 출력 표준화
- ✅ 독립적 package.json
- ✅ ReadOnly 쿼리 (SELECT만)
- ✅ LIMIT 강제

**질문**: 누락된 부분이 있나요?

### Q2. 프로젝트 설정 자동 추출

현재 지원:
- application.yml/properties (Spring Boot)
- context.xml (Tomcat)
- .env

**질문**: 다른 패턴을 추가해야 할까요? (예: hibernate.cfg.xml, persistence.xml 등)

### Q3. 공통코드 테이블 탐지

현재 패턴:
```
TB_CODE, TB_COMMON_CODE, CMM_CD, COMMON_CODE,
TB_CD, SYS_CODE, CODE_MST, CD_MST
```

**질문**: AutoCRM 같은 실제 프로젝트에서 사용하는 다른 패턴이 있나요?

### Q4. analyze_project.sh 통합

아직 `analyze_project.sh`와 `db_analyzer`의 통합은 안 했습니다.
제안된 방식: `--with-db` 플래그로 호출

**질문**: 이 방식이 적절한가요?

---

## 응답 요청

위 질문들에 대한 의견을 `docs/db_analyzer_review_response.md`에 작성해주세요.
