# Phase 1 스캔 기능 검토 요청

**요청자**: Claude Code
**요청일**: 2026-01-14
**대상**: Gemini CLI

---

## 현재 구현 상태

### 1. analyze_project.sh scan 모드

**구현된 기능**:
- 프로젝트 타입 감지 (Gradle/Maven/Node.js/Python)
- 의존성 추출 (build.gradle, pom.xml, package.json, requirements.txt)
- 컴포넌트 분류 (Controller/Service/Repository/Entity/Config)
- 설정 파일 분석 (application.yml/properties)
- API 엔드포인트 스캔 (@RequestMapping 등)
- 엔티티/테이블 분석 (@Entity, @Table)
- 연관관계 분석 (@OneToMany, @ManyToOne 등)
- 공통코드 분석 (Enum, CG코드 패턴)
- DB 스키마 힌트 (@Column, @JoinColumn)

**AutoCRM 테스트 결과**:
```
컴포넌트 분류:
  - Controllers: 12 개
  - Services: 73 개
  - Repositories/DAOs: 63 개
  - Entities/DTOs: 243 개
  - Configs: 263 개

엔티티/테이블 분석:
  주요 테이블:
    - CRICKET_WORLD_CUP (CricketWorldCup)
    - ClientDetails

공통코드 분석:
  공통코드 관련 파일: 6 개
  Enum 클래스: 15개 (Action, QueryType, ClientType 등)
  코드 그룹: CG0019, CODE_EXECUTION 등

DB 스키마 힌트:
  주요 컬럼: _id, APIKEY, content, SEQ 등
```

### 2. cross_check.sh 크로스체크 자동화

**구현된 기능**:
- `design` 모드: Claude 설계 → Gemini 검토 → 피드백 반영
- `implement` 모드: Claude 구현 → Gemini 코드리뷰 (git diff 자동 감지)
- `test` 모드: Claude 테스트 → Gemini 검토
- `full` 모드: 설계→구현→테스트 전체 파이프라인
- 무한루프 방지: MAX_ROUNDS=2, 초과시 사용자 개입 요청
- 승인/반려 자동 판정

---

## 검토 요청 사항

### Q1. Phase 1 스캔의 한계점

현재 스캔은 **파일 기반 정적 분석**만 수행합니다.
- 실제 DB에 연결하지 않음
- 런타임 정보 없음

**질문**:
1. 실제 DB 연결 기능이 필요한가요?
2. 필요하다면 어떤 방식이 좋을까요? (Node.js 스크립트, Python 스크립트, 별도 설정 파일?)

### Q2. 누락된 분석 항목

다음 항목들이 아직 구현되지 않았습니다:
- 실제 DB 스키마 조회 (테이블 목록, 컬럼 정보, 인덱스)
- 데이터 샘플 (개인정보 마스킹 필요)
- 코드값 테이블의 실제 값들

**질문**: 어떤 항목을 우선 구현해야 할까요?

### Q3. 아키텍처 제안

DB 연결 기능 추가 시 아키텍처 제안:

```
scripts/
├── analyze_project.sh      # 정적 분석 (현재)
├── db_analyzer/            # DB 분석 모듈 (신규)
│   ├── index.js            # 메인 진입점
│   ├── mysql.js            # MySQL 연결
│   ├── oracle.js           # Oracle 연결
│   ├── mssql.js            # MSSQL 연결
│   └── postgres.js         # PostgreSQL 연결
└── cross_check.sh          # 크로스체크
```

설정 파일:
```json
// .ai-analyzer.json
{
  "db": {
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "autocrm",
    "user": "readonly_user"
    // password는 환경변수로
  }
}
```

**질문**: 이 구조가 적절한가요? 다른 제안이 있나요?

### Q4. 보안 고려사항

DB 연결 시 보안 위험:
- 접속 정보 노출
- 개인정보 포함 가능성
- 실수로 Git에 커밋

**현재 대책**:
- password는 환경변수 사용
- 데이터 샘플 시 마스킹 필수
- .gitignore에 설정 파일 추가

**질문**: 추가 보안 조치가 필요한가요?

---

## 응답 요청

위 질문들에 대한 의견을 `docs/phase1_review_response.md`에 작성해주세요.
