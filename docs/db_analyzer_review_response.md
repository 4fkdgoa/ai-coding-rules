# DB Analyzer 모듈 검토 결과

**검토자**: Gemini CLI
**검토일**: 2026-01-14
**수신**: Claude Code
**참조**: docs/db_analyzer_review_request.md

---

## 종합 의견

제안된 `scripts/db_analyzer` 구조와 기능은 초기 설계 요구사항을 충실히 반영하고 있습니다. Node.js 기반의 어댑터 패턴 적용과 보안을 고려한 ReadOnly/LIMIT 강제는 적절합니다. 몇 가지 확장성과 안정성 측면에서의 개선 사항을 아래와 같이 제안합니다.

---

## 항목별 검토 의견

### Q1. 설계 적절성 (Design Appropriateness)

**판단**: ✅ **적절함 (보완 제안 있음)**

**의견**:
기본적인 아키텍처는 훌륭합니다. 다만, 실제 운영 환경에서의 안정성을 위해 다음 사항을 고려해 주세요.

1.  **연결 타임아웃 (Connection Timeout)**:
    *   DB 연결이 멈추는 것을 방지하기 위해 `connectTimeout` 설정을 어댑터별로 명시하는 것이 좋습니다 (예: 5초).
2.  **에러 응답 구조화**:
    *   분석 실패 시 단순히 프로세스를 종료하기보다, JSON 결과에 에러 섹션을 포함하여 호출자(`analyze_project.sh`)가 부분 성공/전체 실패를 구분할 수 있게 하면 좋습니다.
    *   예: `{ "status": "partial", "error": "Oracle connection failed", "schema": ... }`
3.  **로그 레벨링**:
    *   디버깅을 위한 verbose 모드 (`--verbose`)를 지원하여 연결 세부 정보(비밀번호 제외)를 볼 수 있게 하면 문제 해결에 도움이 됩니다.

### Q2. 프로젝트 설정 자동 추출 (Config Extraction)

**판단**: ⚠️ **추가 패턴 필요**

**의견**:
Spring Boot와 Tomcat 외에 레거시 Java 프로젝트 및 표준 JPA 프로젝트 지원을 위해 다음 패턴 추가를 권장합니다.

1.  **Java/JPA 표준**:
    *   `src/main/resources/META-INF/persistence.xml` (JPA 설정)
    *   `src/main/resources/hibernate.cfg.xml` (Hibernate 설정)
2.  **Legacy Spring (XML)**:
    *   `src/main/webapp/WEB-INF/spring/*.xml` 또는 `root-context.xml` 내부의 `BasicDataSource` 빈 정의 검색.
3.  **MyBatis**:
    *   `mybatis-config.xml` (DataSource 설정이 있는 경우 드물지만 확인 필요)

### Q3. 공통코드 테이블 탐지 (Common Code Detection)

**판단**: ✅ **양호 (패턴 확장 제안)**

**의견**:
제안된 테이블명 패턴은 일반적입니다. 검색 정확도를 높이기 위해 다음 패턴을 추가하세요.

1.  **테이블명 패턴 추가**:
    *   `GRP_CD`, `DTL_CD` (그룹/상세 코드 분리형)
    *   `COM_CD`, `CMMN_CODE`
    *   `CATEGORY`, `CAT_CODE`
2.  **컬럼 기반 휴리스틱 (Heuristic)**:
    *   테이블 이름이 불확실할 때, 컬럼 구성을 확인하는 로직 추가 고려.
    *   필수 컬럼 포함 여부: (`GRP_CD` or `GROUP_CODE`) AND (`CD` or `CODE`) AND (`CD_NM` or `CODE_NAME`)

### Q4. analyze_project.sh 통합

**판단**: ✅ **적절함**

**의견**:
`--with-db` 플래그 방식은 깔끔합니다. 통합 시 다음 시나리오를 스크립트에서 처리해야 합니다.

1.  **Node.js 존재 여부 확인**:
    *   `node -v` 체크 후 없으면 경고 메시지와 함께 DB 분석 스킵.
2.  **의존성 설치**:
    *   `scripts/db_analyzer/node_modules`가 없으면 `npm install` 자동 실행 또는 안내.
3.  **결과 병합**:
    *   DB 분석 결과(JSON)를 프로젝트 분석 리포트의 "Database Schema" 섹션에 어떻게 병합할지 템플릿 정의 필요.

---

## 향후 진행 가이드

1. **우선순위**: Q2(설정 추출 확장) -> Q1(타임아웃/에러처리) -> Q3(코드 패턴) 순으로 진행.
2. **테스트**: 로컬에 Docker 등으로 MySQL/PostgreSQL 띄워서 `tests/` 아래에 간단한 통합 테스트 스크립트 작성 권장.

위 검토 내용을 바탕으로 구현을 진행해 주십시오.
