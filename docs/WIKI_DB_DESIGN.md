# 위키 DB 설계 (TODO)

**우선순위**: 중간
**상태**: 설계 단계 (실제 프로젝트 테스트 후 구현)
**작성일**: 2026-01-16

---

## 📌 목적

Markdown만으로는 **검색과 관계 추적이 어려움**.
SQLite DB를 추가하여:
- ✅ 구조화된 검색 (기능, API, 테이블 관계)
- ✅ 솔루션 vs 커스텀 차이 추적
- ✅ 빠른 쿼리 (특정 API가 사용하는 테이블은?)

---

## 🏗️ 하이브리드 아키텍처

```
project/
├── .ai-metadata/
│   ├── project.db              # SQLite (메타데이터, 관계, 빠른 검색)
│   ├── solution.db             # 솔루션 원본 DB
│   └── backup/
│
└── docs/
    ├── features/               # Markdown (사람이 읽는 상세 설명)
    └── api/
```

### 역할 분담

| 저장소 | 역할 | 예시 |
|--------|------|------|
| **SQLite DB** | 메타데이터, 관계, 빠른 검색 | 기능 목록, API-테이블 매핑 |
| **Markdown** | 상세 설명, 예시 코드 | "고객 관리 기능 사용법" |

---

## 📊 DB 스키마

### 1. 프로젝트

```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,              -- 'solution' or 'custom'
    base_project_id TEXT,   -- 솔루션 원본 ID
    tech_stack TEXT,        -- JSON: {"backend": "Spring", "db": "MSSQL"}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. 기능

```sql
CREATE TABLE features (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,          -- '고객관리', '재고관리'
    description TEXT,
    status TEXT,            -- 'active', 'deprecated', 'removed'
    related_files TEXT,     -- JSON: ["CustomerController.java", ...]
    doc_path TEXT,          -- 'docs/features/customer-mgmt.md'
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_features_name ON features(name);
CREATE INDEX idx_features_category ON features(category);
```

### 3. API 엔드포인트

```sql
CREATE TABLE apis (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    feature_id TEXT,
    method TEXT,            -- 'GET', 'POST'
    path TEXT NOT NULL,
    controller TEXT,        -- 'CustomerController'
    handler_method TEXT,    -- 'getCustomer'
    description TEXT,
    request_params TEXT,    -- JSON
    response_schema TEXT,   -- JSON
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (feature_id) REFERENCES features(id)
);

CREATE INDEX idx_apis_path ON apis(path);
```

### 4. 데이터베이스 테이블

```sql
CREATE TABLE db_tables (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    description TEXT,
    columns TEXT,           -- JSON: [{"name": "id", "type": "BIGINT"}]
    indexes TEXT,           -- JSON
    related_features TEXT,  -- JSON: ["feature-1", "feature-2"]
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_db_tables_name ON db_tables(table_name);
```

### 5. 파일 메타데이터

```sql
CREATE TABLE source_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,         -- 'controller', 'service', 'repository'
    feature_id TEXT,
    class_name TEXT,
    methods TEXT,           -- JSON: [{"name": "getCustomer", "line": 42}]
    dependencies TEXT,      -- JSON: ["CustomerService", ...]
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (feature_id) REFERENCES features(id)
);

CREATE INDEX idx_source_files_path ON source_files(file_path);
```

### 6. 커스텀 vs 솔루션 차이

```sql
CREATE TABLE customizations (
    id TEXT PRIMARY KEY,
    custom_project_id TEXT NOT NULL,
    solution_project_id TEXT NOT NULL,
    entity_type TEXT,       -- 'feature', 'api', 'table', 'file'
    entity_id TEXT,
    change_type TEXT,       -- 'added', 'modified', 'removed'
    description TEXT,
    diff_data TEXT,         -- JSON: 차이점 상세
    created_at DATETIME,
    FOREIGN KEY (custom_project_id) REFERENCES projects(id),
    FOREIGN KEY (solution_project_id) REFERENCES projects(id)
);
```

---

## 🔍 실전 쿼리 예시

### 쿼리 1: "고객"과 관련된 모든 정보

```sql
SELECT
    'Feature' AS type, f.name, f.description
FROM features f
WHERE f.name LIKE '%고객%'

UNION ALL

SELECT
    'API' AS type, a.path, a.description
FROM apis a
WHERE a.path LIKE '%customer%' OR a.description LIKE '%고객%'

UNION ALL

SELECT
    'Table' AS type, t.table_name, t.description
FROM db_tables t
WHERE t.table_name LIKE '%CUSTOMER%';
```

### 쿼리 2: 특정 API가 사용하는 테이블

```sql
SELECT DISTINCT
    a.path AS api_path,
    t.table_name,
    t.description
FROM apis a
JOIN features f ON a.feature_id = f.id
JOIN db_tables t ON t.related_features LIKE '%' || f.id || '%'
WHERE a.path = '/api/stock/list';
```

### 쿼리 3: 솔루션 vs 커스텀 차이점

```sql
SELECT
    c.entity_type,
    c.change_type,
    c.description,
    json_extract(c.diff_data, '$.old_value') AS solution_value,
    json_extract(c.diff_data, '$.new_value') AS custom_value
FROM customizations c
WHERE c.custom_project_id = 'AutoCRM_Samchully'
ORDER BY c.created_at DESC
LIMIT 10;
```

---

## 💻 구현 계획

### Phase 1: DB 스키마 생성

```javascript
// scripts/wiki-db-setup.js
const Database = require('better-sqlite3');
const db = new Database('.ai-metadata/project.db');

// 스키마 생성
db.exec(fs.readFileSync('scripts/schema.sql', 'utf-8'));
```

### Phase 2: 분석 스크립트 DB 연동

```javascript
// scripts/analyze_project.sh에 추가

// 1. 프로젝트 스캔 (기존)
const projectInfo = scanProject(projectPath);

// 2. DB에 저장 (신규)
db.prepare(`
    INSERT INTO projects (id, name, type, tech_stack)
    VALUES (?, ?, ?, ?)
`).run(projectInfo.id, projectInfo.name, 'custom', JSON.stringify(projectInfo.techStack));

// 3. 기능 저장
for (const feature of features) {
    db.prepare(`
        INSERT INTO features (id, project_id, name, description)
        VALUES (?, ?, ?, ?)
    `).run(feature.id, projectInfo.id, feature.name, feature.desc);
}
```

### Phase 3: 검색 CLI

```bash
#!/bin/bash
# scripts/search-wiki.sh

QUERY="$1"

sqlite3 .ai-metadata/project.db << EOF
.mode column
.headers on

SELECT type, name, description
FROM (
    SELECT 'Feature' AS type, name, description FROM features WHERE name LIKE '%$QUERY%'
    UNION ALL
    SELECT 'API' AS type, path, description FROM apis WHERE path LIKE '%$QUERY%'
    UNION ALL
    SELECT 'Table' AS type, table_name, description FROM db_tables WHERE table_name LIKE '%$QUERY%'
)
ORDER BY type, name;
EOF
```

### Phase 4: 솔루션 vs 커스텀 비교

```javascript
// scripts/compare-solutions.js
const solutionDb = new Database('.ai-metadata/solution.db');
const customDb = new Database('.ai-metadata/custom.db');

// 기능 비교
const solutionFeatures = solutionDb.prepare('SELECT * FROM features').all();
const customFeatures = customDb.prepare('SELECT * FROM features').all();

for (const sf of solutionFeatures) {
    const cf = customFeatures.find(f => f.id === sf.id);

    if (!cf) {
        console.log(`❌ 제거됨: ${sf.name}`);
        insertCustomization('feature', sf.id, 'removed', ...);
    } else if (sf.description !== cf.description) {
        console.log(`🔄 변경됨: ${sf.name}`);
        insertCustomization('feature', sf.id, 'modified', ...);
    }
}
```

---

## 🎯 예상 효과

### Before (Markdown only)

```bash
# 검색
grep -r "고객" docs/              # ❌ 텍스트 검색만
grep -r "TB_CUSTOMER" docs/       # ❌ 관계 추적 불가

# 비교
diff solution/docs custom/docs    # ❌ 단순 파일 비교
```

### After (DB + Markdown)

```bash
# 검색 (관계 포함)
./search-wiki.sh 고객
# → Feature: 고객 관리
# → API: /api/customer/list, /api/customer/save
# → Table: TB_CUSTOMER, TB_CUSTOMER_DETAIL

# 비교 (의미론적)
./compare-solutions.js
# → 추가된 기능: 3개
# → 변경된 API: 5개
# → 삭제된 테이블: 1개
```

---

## 📝 다음 AI에게 요청할 프롬프트

### Claude Code에게 (구현 전문)

```markdown
# 프롬프트 1: DB 스키마 생성

위키 DB 시스템을 구축하려고 합니다.

파일: `docs/WIKI_DB_DESIGN.md` 참고

요청사항:
1. `scripts/wiki-db-setup.js` 작성
   - better-sqlite3 사용
   - schema.sql 실행하여 테이블 생성
   - 초기 데이터 삽입

2. `scripts/schema.sql` 작성
   - projects, features, apis, db_tables, source_files, customizations 테이블
   - 인덱스 생성

3. 테스트 스크립트 작성
   - 샘플 데이터 삽입
   - 쿼리 테스트

실행:
```bash
node scripts/wiki-db-setup.js
node scripts/test-wiki-db.js
```

확인:
- .ai-metadata/project.db 생성됨
- 테이블 6개 생성됨
- 인덱스 생성됨
```

---

### Gemini에게 (설계 검증)

```markdown
# 프롬프트 2: DB 스키마 검토

위키 DB 스키마를 설계했습니다. 검토해주세요.

파일: `docs/WIKI_DB_DESIGN.md` 참고

검토 요청사항:
1. 스키마 정규화 적절한가?
2. 인덱스 전략이 효율적인가?
3. JSON 컬럼 사용이 적절한가? (related_files, columns 등)
4. 쿼리 성능 병목 지점은?
5. 대안 제시

특히 고려 사항:
- AutoCRM 프로젝트: 500개 파일, 50개 기능, 200개 API
- 검색 빈도: 높음 (개발자가 자주 검색)
- 업데이트 빈도: 낮음 (프로젝트 분석 시에만)

응답 형식: Markdown (장단점, 개선안, 대안 스키마)
```

---

### Claude Code에게 (분석 스크립트 연동)

```markdown
# 프롬프트 3: 분석 스크립트 DB 연동

`scripts/analyze_project.sh`를 수정하여 DB에 저장하도록 개선해주세요.

현재:
- 프로젝트 스캔 → docs/.analysis-context.md 생성 (Markdown)

목표:
- 프로젝트 스캔 → DB 저장 + Markdown 생성

요청사항:
1. `analyze_project.sh` 수정
   - DB 저장 로직 추가
   - projects, features, apis, db_tables, source_files 테이블에 INSERT

2. 파일 분석 개선
   - Java 파일 → 클래스명, 메서드 추출
   - XML 파일 → SQL ID 추출
   - SQL 파일 → 테이블명 추출

3. 관계 추적
   - Controller → Service → Repository 관계
   - API → 사용 테이블 매핑

테스트:
```bash
./analyze_project.sh ~/AutoCRM_Samchully_BPS
sqlite3 .ai-metadata/project.db "SELECT COUNT(*) FROM features;"
```

예상 결과:
- features: 50개
- apis: 200개
- db_tables: 30개
```

---

### Gemini에게 (AI 자동 분류)

```markdown
# 프롬프트 4: 기능 자동 분류 프롬프트 작성

AI가 소스 코드를 읽고 자동으로 기능을 분류하도록 프롬프트를 작성해주세요.

입력:
- 파일 목록: ["CustomerController.java", "StockManagerImpl.java", ...]
- 간단한 코드 스니펫 (첫 50줄)

출력 (JSON):
```json
{
  "features": [
    {
      "id": "customer-management",
      "name": "고객 관리",
      "category": "CRM",
      "description": "고객 등록/수정/삭제/조회",
      "related_files": ["CustomerController.java", "CustomerService.java"],
      "apis": ["/api/customer/list", "/api/customer/save"],
      "tables": ["TB_CUSTOMER"]
    }
  ]
}
```

요구사항:
- 한글 기능명 자동 생성
- 비즈니스 로직 기반 분류 (파일명만으로 판단 X)
- 실제 AutoCRM 프로젝트에서 테스트
```

---

### Claude Code에게 (검색 CLI)

```markdown
# 프롬프트 5: 위키 검색 CLI 도구

위키 DB를 검색하는 CLI 도구를 만들어주세요.

요청사항:
1. `scripts/search-wiki.sh` 작성
   - 입력: 검색어 (예: "고객", "customer", "TB_STOCK")
   - 출력: 관련 기능, API, 테이블 목록

2. 검색 기능
   - 부분 일치 (LIKE)
   - 대소문자 무시
   - Feature, API, Table 통합 검색

3. 포맷팅
   - 표 형식으로 출력
   - 색상 (Feature: 파란색, API: 초록색, Table: 노란색)

사용 예시:
```bash
./search-wiki.sh 고객
./search-wiki.sh customer
./search-wiki.sh TB_CUSTOMER
```

예상 출력:
```
🔍 검색어: 고객

📦 Features (1건)
  - 고객 관리 (customer-management)
    └─ 고객 등록/수정/삭제/조회

🌐 APIs (2건)
  - GET /api/customer/list
  - POST /api/customer/save

🗄️  Tables (1건)
  - TB_CUSTOMER (고객 마스터)
```
```

---

### Claude Code에게 (솔루션 vs 커스텀 비교)

```markdown
# 프롬프트 6: 솔루션 vs 커스텀 비교 도구

솔루션 원본과 커스텀 프로젝트의 차이를 분석하는 도구를 만들어주세요.

요청사항:
1. `scripts/compare-solutions.js` 작성
   - 입력: solution.db, custom.db
   - 출력: 차이점 리포트 (Markdown)

2. 비교 항목
   - 추가된 기능
   - 변경된 API (파라미터, 응답 스키마)
   - 삭제된 테이블
   - 수정된 파일

3. customizations 테이블 자동 저장

사용 예시:
```bash
node scripts/compare-solutions.js \
  --solution .ai-metadata/AutoCRM_Core3.db \
  --custom .ai-metadata/AutoCRM_Samchully.db \
  --output docs/CUSTOMIZATION_REPORT.md
```

예상 출력 (docs/CUSTOMIZATION_REPORT.md):
```markdown
# 커스텀 리포트: AutoCRM_Samchully

## ✅ 추가된 기능 (3개)
- 삼천리 전용 재고 입고
- 삼천리 코드 관리
- ...

## 🔄 변경된 API (5개)
- GET /api/customer/list
  - 변경: pageSize 10 → 50

## ❌ 삭제된 기능 (1개)
- 구버전 통계 기능
```
```

---

## 📋 TODO 체크리스트

- [ ] **DB 스키마 생성** (wiki-db-setup.js, schema.sql)
- [ ] **분석 스크립트 DB 연동** (analyze_project.sh 수정)
- [ ] **검색 CLI 도구** (search-wiki.sh)
- [ ] **솔루션 비교 도구** (compare-solutions.js)
- [ ] **실제 프로젝트 테스트** (AutoCRM_Samchully_BPS)
- [ ] **성능 최적화** (인덱스 조정, 쿼리 최적화)
- [ ] **문서화** (사용 가이드, API 문서)

---

## 🔜 다음 단계

1. **실제 프로젝트로 테스트**
   - AutoCRM_Samchully_BPS 분석
   - DB에 저장 후 검색 테스트
   - 문제점 파악

2. **스키마 개선**
   - 성능 병목 지점 해결
   - 관계 추적 정확도 개선

3. **AI 자동 분류 정확도 개선**
   - 프롬프트 최적화
   - 예시 데이터 추가

---

**작성일**: 2026-01-16
**우선순위**: 중간
**예상 소요 시간**: 4-6시간 (DB 스키마 → 분석 연동 → 검색/비교 도구)
