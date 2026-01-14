# Phase 1 스캔 기능 검토 응답

**검토자**: Gemini CLI
**검토일**: 2026-01-14
**참조**: docs/phase1_review_request.md

---

## 종합 의견

현재 구현된 `analyze_project.sh`의 정적 분석 기능은 프로젝트의 코드 레벨 구조를 파악하는 데 유용합니다. 그러나 실제 레거시 시스템 분석 시 **코드와 실제 DB 스키마 간의 불일치(Drift)**가 흔하므로, DB 연결을 통한 검증 기능 추가는 **필수적**이라고 판단됩니다.

제안하신 `db_analyzer` 모듈 분리 및 설정 파일 기반 접근 방식은 합리적이며, 보안을 최우선으로 고려한 설계가 필요합니다.

---

## 상세 답변

### A1. 실제 DB 연결 필요성 및 방식

**답변**: **필요합니다.**
정적 분석만으로는 `@Transient` 필드, DB 트리거, 실제 사용되지 않는 엔티티 등을 식별할 수 없습니다.

**구현 방식 권장**:
- **Node.js (제안하신 방식)**: 프로젝트가 이미 Node.js 환경이거나 JS 친화적이라면 적합합니다. 비동기 I/O 처리에 강점이 있어 다수의 테이블 스캔 시 유리합니다.
- **Python (대안)**: 데이터 분석 라이브러리(Pandas, SQLAlchemy)가 강력하여 복잡한 데이터 샘플링이나 통계가 필요하다면 더 나을 수 있습니다.

*결론*: 현재 제안하신 **Node.js 기반의 `db_analyzer` 모듈** 방식에 동의합니다. 단, 의존성 관리(package.json)가 `scripts/db_analyzer/` 내에 독립적으로 존재해야 합니다.

### A2. 분석 항목 우선순위

다음 순서로 구현을 권장합니다:

1.  **Priority 1: 실제 DB 스키마 조회 (Metadata)**
    - 목적: 엔티티 코드와 실제 테이블 매핑 검증 (`cross_check`의 핵심)
    - 내용: 테이블 명, 컬럼 명, 데이터 타입, Nullable 여부, PK/FK 정보

2.  **Priority 2: 코드값 테이블 데이터**
    - 목적: 소스 코드 내 하드코딩된 값(Magic String)과 실제 DB 내 공통코드 매핑
    - 내용: 공통코드 테이블(예: `TB_CODE`, `CMM_CD`)의 실제 데이터 조회

3.  **Priority 3: 데이터 샘플**
    - 목적: 실제 데이터 형식을 통한 비즈니스 로직 유추
    - *주의*: 개인정보 이슈로 인해 가장 마지막에 구현하거나, **엄격한 마스킹/제외 처리**가 선행되어야 함.

### A3. 아키텍처 제안 검토

제안하신 구조는 적절합니다.

```
scripts/
├── analyze_project.sh      # Orchestrator 역할로 격상
├── db_analyzer/            # [신규] DB 전용 분석기 (Node.js)
│   ├── package.json        # 독립적 의존성 관리
│   ├── index.js
│   └── adapters/           # DB별 어댑터 패턴 적용 권장
│       ├── mysql.js
│       └── ...
└── cross_check.sh
```

**추가 제안**:
- **출력 표준화**: `db_analyzer`의 실행 결과는 반드시 `analyze_project.sh`가 소비할 수 있는 표준 **JSON 포맷**이어야 합니다. (예: `db_schema.json`)
- **Orchestration**: `analyze_project.sh`가 `--with-db` 플래그를 받을 때만 `db_analyzer`를 호출하도록 구성하세요.

### A4. 보안 고려사항

현재 대책에 더해 다음 사항을 추가해야 합니다:

1.  **ReadOnly 계정 강제/검증**:
    - 기술적으로 가능하다면 연결 초기화 시점에 쓰기 권한이 없는지(또는 `READ ONLY` 트랜잭션 모드) 확인하는 로직 추가.
2.  **쿼리 제한 (Safety Limit)**:
    - 모든 `SELECT` 쿼리에 `LIMIT` 절 강제 적용 (예: 샘플 데이터 조회 시 최대 10건).
3.  **연결 정보 관리 (.env)**:
    - 환경변수 외에도 로컬 개발 편의를 위해 `.env` 파일 지원 (단, `.gitignore` 필수 포함).
4.  **IP 제한 안내**:
    - 클라우드 DB의 경우, 스크립트 실행 환경의 IP가 화이트리스트에 있어야 함을 문서화.

---

## 향후 진행 가이드

1. `scripts/db_analyzer/` 디렉토리 생성 및 `package.json` 초기화
2. 가장 범용적인 **MySQL** 또는 **PostgreSQL** 어댑터부터 프로토타입 구현
3. `.ai-analyzer.json` 템플릿 작성 및 `.gitignore` 추가
