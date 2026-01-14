# 프로젝트 분석기 설계서

**작성일**: 2026-01-14
**작성자**: Claude Code
**상태**: Gemini 검토 완료 (v1.1)
**검토일**: 2026-01-14

---

## 1. 목표

기존 프로젝트를 AI가 분석하여:
1. 프로젝트 구조 파악
2. 기능별 항목 분류
3. 문서/위키 자동 생성
4. (선택) DB에 메타데이터 저장

---

## 2. 문제 정의

### 현재 상황
- 레거시 프로젝트는 문서가 부족하거나 outdated
- 새로운 개발자(또는 AI)가 프로젝트 파악에 시간 소요
- 기능 목록, API 정리, 코드 구조가 머릿속에만 존재

### 해결하고자 하는 것
- AI가 코드를 읽고 자동으로 문서화
- 기능별 분류 및 위키 생성
- 지속적 업데이트 가능한 구조

---

## 3. 제안하는 접근 방식

### Option A: Markdown 기반 위키 (권장)
```
project/
├── docs/
│   ├── README.md              # 프로젝트 개요
│   ├── architecture.md        # 아키텍처
│   ├── features/              # 기능별 문서
│   │   ├── index.md           # 기능 목록
│   │   ├── customer-mgmt.md   # 고객 관리
│   │   ├── sales-mgmt.md      # 영업 관리
│   │   └── ...
│   ├── api/                   # API 문서
│   │   ├── index.md
│   │   ├── customer-api.md
│   │   └── ...
│   └── codes/                 # 공통코드 정리
│       ├── index.md
│       └── code-tables.md
```

**장점**:
- Git으로 버전 관리
- GitHub/GitLab 위키로 바로 사용
- AI가 읽고 쓰기 쉬움
- 추가 인프라 불필요

### Option B: 실제 위키 시스템 (Notion, Confluence 등)
- API 연동 필요
- 더 풍부한 UI
- 검색/태그 기능

### Option C: SQLite/JSON 기반 로컬 DB
```
project/
├── .ai-metadata/
│   ├── project.db            # SQLite
│   ├── features.json
│   ├── apis.json
│   └── codes.json
```

**장점**:
- 구조화된 쿼리 가능
- AI가 특정 정보 빠르게 조회
- Node.js 스크립트로 조회/업데이트

---

## 4. 분석 파이프라인

### Phase 1: 프로젝트 스캔
```
Input: 프로젝트 경로
Output: 기본 구조 파악

1. 빌드 파일 확인 (build.gradle, pom.xml, package.json)
2. 소스 폴더 구조 파악
3. 설정 파일 분석 (application.yml 등)
4. 의존성 목록 추출
```

### Phase 2: 기능 분류
```
Input: 소스 파일들
Output: 기능별 분류

1. Controller/Service/Repository 패턴 파악
2. 패키지 구조로 도메인 분류
3. 주요 비즈니스 로직 식별
4. API 엔드포인트 추출
```

### Phase 3: 문서 생성
```
Input: 분석 결과
Output: Markdown 문서들

1. README.md 생성 (프로젝트 개요)
2. 기능별 문서 생성
3. API 문서 생성
4. 코드값 문서 생성 (DB 연동 시)
```

### Phase 4: 검증 및 보완
```
Input: 생성된 문서
Output: 검증된 최종 문서

1. Gemini가 문서 리뷰
2. 누락된 부분 보완
3. 사용자 확인 요청
```

---

## 5. AI 역할 분담

| Phase | 담당 AI | 이유 |
|-------|---------|------|
| 1. 스캔 | Claude | 파일 시스템 접근, 빠른 파싱 |
| 2. 분류 | Gemini | 긴 컨텍스트, 패턴 인식 |
| 3. 문서 생성 | Claude | 구조화된 글쓰기 |
| 4. 검증 | Gemini | 전체 정합성 확인 |

---

## 6. 구현 계획

### Step 1: 기본 스크립트 (analyze_project.sh)
```bash
#!/bin/bash
# 프로젝트 분석 시작
PROJECT_PATH="$1"

# 1. 기본 정보 수집
# 2. Claude에게 분석 요청
# 3. 결과를 docs/에 저장
```

### Step 2: 프롬프트 템플릿
```
prompts/
├── scan_project.md      # Phase 1용
├── classify_features.md # Phase 2용
├── generate_docs.md     # Phase 3용
└── review_docs.md       # Phase 4용
```

### Step 3: 출력 템플릿
```
templates/
├── readme_template.md
├── feature_template.md
├── api_template.md
└── code_table_template.md
```

---

## 7. 예시: AutoCRM 프로젝트 분석 시

### 입력
```
프로젝트 세트:
- AutoCRM_Core3
- AutoCRM_Core3_eclipselink
- AutoCRM_Samchully_BPS
```

### 예상 출력
```
AutoCRM_Samchully_BPS/docs/
├── README.md
│   - 프로젝트 개요
│   - 의존성: Core3 → Core3_eclipselink → Samchully_BPS
│   - 빌드 방법
│
├── architecture.md
│   - 3-tier 구조 (Controller/Service/Repository)
│   - 공통 모듈 관계도
│
├── features/
│   ├── index.md (기능 목록)
│   ├── customer-management.md
│   │   - 고객 등록/수정/삭제
│   │   - 관련 테이블: TB_CUSTOMER
│   │   - 관련 API: /api/customer/*
│   ├── sales-management.md
│   └── statistics.md
│
├── api/
│   ├── index.md
│   └── customer-api.md
│       - GET /api/customer/list
│       - POST /api/customer/save
│
└── codes/
    ├── index.md
    └── common-codes.md
        - CG0001: 고객 유형
        - CG0019: 권한 레벨
```

---

## 8. DB 메타데이터 저장 (Option C 선택 시)

### 스키마 예시 (SQLite)
```sql
-- 기능 테이블
CREATE TABLE features (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    related_files TEXT,  -- JSON array
    related_apis TEXT,   -- JSON array
    updated_at DATETIME
);

-- API 테이블
CREATE TABLE apis (
    id TEXT PRIMARY KEY,
    method TEXT,
    path TEXT,
    controller TEXT,
    description TEXT,
    parameters TEXT,     -- JSON
    response TEXT        -- JSON
);

-- 코드값 테이블
CREATE TABLE code_values (
    group_code TEXT,
    code TEXT,
    name TEXT,
    description TEXT,
    PRIMARY KEY (group_code, code)
);
```

### 조회 예시
```javascript
// Node.js로 AI가 조회
const db = require('better-sqlite3')('.ai-metadata/project.db');

// 특정 기능 조회
const feature = db.prepare('SELECT * FROM features WHERE name LIKE ?').get('%고객%');

// 관련 API 조회
const apis = db.prepare('SELECT * FROM apis WHERE path LIKE ?').all('/api/customer%');
```

---

## 9. 장단점 비교

| 방식 | 장점 | 단점 |
|------|------|------|
| **Markdown 위키** | 간단, Git 연동, 바로 사용 | 구조화 쿼리 어려움 |
| **외부 위키** | 풍부한 UI, 검색 | API 연동 복잡, 비용 |
| **SQLite DB** | 빠른 쿼리, 구조화 | 초기 스키마 설계 필요 |
| **JSON 파일** | 간단, 가독성 | 대용량 시 느림 |

### 권장: Markdown 위키 + JSON 메타데이터

```
project/
├── docs/           # 사람이 읽는 문서 (Markdown)
└── .ai-metadata/   # AI가 빠르게 조회하는 데이터 (JSON)
    ├── project-info.json
    ├── features.json
    └── apis.json
```

---

## 10. 다음 단계

1. **Gemini 검토**: 이 설계의 실현 가능성 및 개선점
2. **프로토타입**: analyze_project.sh 기본 버전 작성
3. **테스트**: AutoCRM 프로젝트로 실제 테스트
4. **피드백 반영**: 결과물 품질 개선

---

## 11. Gemini 검토 결과 (2026-01-14)

### Q1. Markdown 위키 vs SQLite DB?

**결론: Markdown + JSON 하이브리드가 압도적으로 실용적**

- 개발자들은 IDE/Git을 떠나지 않고 싶어함
- `docs/` 폴더에 Markdown으로 존재해야 PR 리뷰 시 함께 검토 가능
- SQLite는 별도 뷰어 필요 → 가시성 떨어짐
- AI가 빠르게 참조할 정보만 JSON, 내용은 Markdown

### Q2. 기능 분류 자동화 정확도?

**예상 정확도: 70~85% (초기 실행 시)**

- **네이밍 컨벤션 준수 여부**에 따라 크게 좌우
- `CustomerController` → 90% 이상
- `C100Ctrl`, `Svc_01` → 50% 미만

**개선책**:
1. `import` 구문 + `public method` 시그니처 제공 시 정확도 상승
2. `mapping.json` 설정 파일로 사용자가 1회 교정 → 이후 100% 수렴

### Q3. DB 코드값 연동 시 보안 고려사항?

**가장 주의해야 할 부분**

- **소스 코드 내 enum/const**: 보안 문제 없음
- **실제 DB 조회**: 매우 위험
  - PII(개인정보)가 문서에 포함되어 Git에 올라갈 위험
  - DB 접속 정보가 설정 파일에 포함되어 커밋될 위험

**권고**: 문서화 대상은 **메타데이터(코드 정의, 컬럼 설명)**로 한정. 실제 데이터 값은 절대 포함 금지 또는 마스킹 필수.

### Q4. 문서 자동 업데이트 주기/트리거?

**On-Demand(수동 실행) 또는 Pre-push 추천**

- CI/CD마다 돌리면 토큰 비용 과다
- **추천 주기**:
  - Major/Minor 릴리즈 배포 전
  - 특정 기능 개발 완료 후 해당 모듈만
- `analyze_project.sh --diff` 옵션 필수 (변경된 파일 관련 문서만 갱신)

### Q5. 추가 고려사항

1. **Mermaid.js 다이어그램 자동 생성**
   - `architecture.md`에 ERD, Class Diagram, Sequence Diagram 포함
   - 텍스트 설명보다 다이어그램이 강력

2. **토큰 비용 견적 기능**
   - 분석 전 "약 $X.XX 비용이 예상됩니다. 진행하시겠습니까?" 표시
   - 레거시 프로젝트는 예상외로 방대할 수 있음

3. **.aiignore / .docignore 파일**
   - `node_modules`, `dist`, `test`, `generated` 등 제외
   - `.gitignore`와 별도로 관리

---

## 12. 설계 반영 사항 (v1.1)

Gemini 검토를 반영하여 다음 항목 추가:

### 12.1. .aiignore 파일 형식

```
# 분석 제외 대상
node_modules/
dist/
build/
.gradle/
target/
*.min.js
*.map
test/
__tests__/
generated/
```

### 12.2. analyze_project.sh 개선안

```bash
#!/bin/bash
# 프로젝트 분석 시작
PROJECT_PATH="$1"
MODE="${2:-full}"  # full | diff

# 0. 비용 견적 (토큰 계산)
estimate_cost() {
    TOTAL_SIZE=$(find "$PROJECT_PATH" -type f -name "*.java" -o -name "*.js" | xargs wc -c 2>/dev/null | tail -1 | awk '{print $1}')
    ESTIMATED_TOKENS=$((TOTAL_SIZE / 4))
    ESTIMATED_COST=$(echo "scale=2; $ESTIMATED_TOKENS * 0.00001" | bc)
    echo "예상 토큰: $ESTIMATED_TOKENS, 예상 비용: \$$ESTIMATED_COST"
    read -p "진행하시겠습니까? (y/n): " CONFIRM
    [ "$CONFIRM" != "y" ] && exit 0
}

# 1. .aiignore 적용
apply_ignore() {
    # .aiignore 파일 읽어서 제외 목록 생성
}

# 2. diff 모드 시 변경 파일만 분석
if [ "$MODE" = "diff" ]; then
    CHANGED_FILES=$(git diff --name-only HEAD~1)
fi

# 3. Claude에게 분석 요청
# 4. 결과를 docs/에 저장
```

### 12.3. architecture.md 템플릿 (Mermaid 포함)

```markdown
# 아키텍처

## 시스템 구조

\`\`\`mermaid
graph TD
    A[Client] --> B[Controller Layer]
    B --> C[Service Layer]
    C --> D[Repository Layer]
    D --> E[(Database)]
\`\`\`

## 엔티티 관계도

\`\`\`mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
\`\`\`
```

### 12.4. mapping.json (사용자 교정용)

```json
{
  "overrides": {
    "C100Ctrl.java": {
      "feature": "customer-management",
      "description": "고객 관리 컨트롤러"
    },
    "Svc_01.java": {
      "feature": "sales-management",
      "description": "영업 서비스"
    }
  },
  "exclude": [
    "LegacyHelper.java",
    "TestUtil.java"
  ]
}
```

---

## 13. 다음 단계 (수정)

1. ~~Gemini 검토~~ (완료)
2. **프로토타입**: analyze_project.sh 기본 버전 작성 (비용 견적 포함)
3. **.aiignore 템플릿** 생성
4. **Mermaid 템플릿** 추가
5. **테스트**: AutoCRM 프로젝트로 실제 테스트
6. **피드백 반영**: 결과물 품질 개선
