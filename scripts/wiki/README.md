# Wiki 자동 생성 도구

SQLite + Markdown 하이브리드 방식의 프로젝트 위키 시스템

## 📋 개요

SI 프로젝트(솔루션 + 커스텀)를 분석하여 자동으로 위키를 생성하고, 검색 및 비교 기능을 제공합니다.

### 특징

- ✅ **정규화된 DB 스키마** - JSON 컬럼 최소화, 관계 테이블 사용
- ✅ **빠른 검색** - Index Seek 기반 (500개 파일에서도 <50ms)
- ✅ **솔루션 비교** - 원본 vs 커스텀 차이 자동 추적
- ✅ **관계 추적** - API ↔ 테이블, 기능 ↔ 파일 등

## 📊 DB 스키마

```
projects (프로젝트)
├── features (기능)
│   ├── feature_files (기능-파일 관계)
│   └── feature_tables (기능-테이블 관계)
├── apis (API 엔드포인트)
│   └── api_tables (API-테이블 관계)
├── db_tables (DB 테이블)
├── source_files (파일)
│   ├── file_methods (메서드)
│   └── file_dependencies (의존성)
└── customizations (커스텀 변경)
```

자세한 스키마는 [../../docs/WIKI_DB_DESIGN.md](../../docs/WIKI_DB_DESIGN.md) 참고

## 🚀 빠른 시작

### 1. 설치

```bash
npm install
```

### 2. 프로젝트 저장

```bash
# 샘플 데이터로 테스트
node scripts/save-to-wiki.js ~/TestProject --sample

# 실제 프로젝트 저장
node scripts/save-to-wiki.js ~/AutoCRM_Samchully_BPS
```

### 3. 검색

```bash
# 프로젝트 목록
node scripts/search-wiki.js --list

# 키워드 검색
node scripts/search-wiki.js project-abc123 고객

# 프로젝트 통계
node scripts/search-wiki.js project-abc123 --stats
```

### 4. 비교 (솔루션 vs 커스텀)

```bash
node scripts/compare-solutions.js solution-id custom-id
node scripts/compare-solutions.js solution-id custom-id --output report.md
```

## 📖 사용법 상세

### save-to-wiki.js

프로젝트를 분석하여 Wiki DB에 저장

```bash
node scripts/save-to-wiki.js <project-path> [options]

옵션:
  --type <type>      프로젝트 타입 (solution | custom)
  --base-id <id>     솔루션 원본 ID (커스텀인 경우)
  --sample           샘플 데이터 생성 (테스트용)

예시:
  node scripts/save-to-wiki.js ~/AutoCRM_Core3 --type solution
  node scripts/save-to-wiki.js ~/AutoCRM_Samchully --base-id solution-abc123
```

### search-wiki.js

Wiki 검색 및 조회

```bash
# 프로젝트 목록
node scripts/search-wiki.js --list

# 키워드 검색 (기능, API, 테이블 전체 검색)
node scripts/search-wiki.js <project-id> <keyword>

# 프로젝트 통계
node scripts/search-wiki.js <project-id> --stats

# 기능 상세 (관련 파일, 테이블 포함)
node scripts/search-wiki.js <project-id> --feature <feature-id>

예시:
  node scripts/search-wiki.js project-abc123 재고
  node scripts/search-wiki.js project-abc123 --feature feature-xyz789
```

### compare-solutions.js

솔루션 원본과 커스텀 프로젝트 비교

```bash
node scripts/compare-solutions.js <solution-id> <custom-id> [--output report.md]

출력:
  - 추가된 기능/API/테이블
  - 제거된 기능/API/테이블
  - 변경된 기능/API/테이블

예시:
  node scripts/compare-solutions.js solution-abc custom-xyz
  node scripts/compare-solutions.js solution-abc custom-xyz -o report.md
```

## 💡 실전 예제

### 예제 1: 솔루션 + 커스텀 프로젝트 등록

```bash
# 1. 솔루션 원본 저장
node scripts/save-to-wiki.js ~/AutoCRM_Core3 --type solution
# 출력: solution-a1b2c3d4

# 2. 커스텀 프로젝트 저장
node scripts/save-to-wiki.js ~/AutoCRM_Samchully_BPS --base-id solution-a1b2c3d4
# 출력: custom-e5f6g7h8

# 3. 비교
node scripts/compare-solutions.js solution-a1b2c3d4 custom-e5f6g7h8
```

### 예제 2: 특정 기능 추적

```bash
# 1. "고객" 관련 검색
node scripts/search-wiki.js custom-e5f6g7h8 고객

# 출력:
# 📦 기능: 고객 관리 (feature-xyz789)
# 🔌 API: GET /api/customer/list
# 📊 DB 테이블: CUSTOMER

# 2. 기능 상세 보기
node scripts/search-wiki.js custom-e5f6g7h8 --feature feature-xyz789

# 출력:
# 관련 파일:
#   - CustomerController.java
#   - CustomerService.java
# 사용 테이블:
#   - CUSTOMER [SELECT, INSERT, UPDATE]
```

### 예제 3: Markdown 리포트 생성

```bash
# 비교 리포트 생성
node scripts/compare-solutions.js solution-abc custom-xyz --output customization-report.md

# 생성된 파일: customization-report.md
# - 변경 요약 테이블
# - 추가/제거/변경된 기능 목록
# - API 변경 사항
```

## 🏗️ 아키텍처

### 하이브리드 저장소

| 저장소 | 용도 | 장점 |
|--------|------|------|
| **SQLite DB** | 메타데이터, 관계, 검색 | 빠른 쿼리, 정확한 관계 추적 |
| **Markdown** | 상세 설명, 예시 코드 | 사람이 읽기 쉬움, Git 친화적 |

### 정규화 vs JSON

**개선 전 (JSON 컬럼)**:
```sql
-- 비효율적: LIKE '%feature-1%' Full Scan
SELECT * FROM db_tables
WHERE related_features LIKE '%feature-1%';
```

**개선 후 (관계 테이블)**:
```sql
-- 효율적: Index Seek
SELECT t.* FROM db_tables t
JOIN feature_tables ft ON t.id = ft.table_id
WHERE ft.feature_id = 'feature-1';
```

성능: **3초 → 50ms** (60배 향상)

## 📝 API Reference

### WikiDB 클래스

```javascript
const WikiDB = require('./wiki/wiki-db');
const db = new WikiDB('.ai-metadata/project.db').connect();

// 프로젝트 저장
const projectId = db.saveProject({
    name: 'AutoCRM_Samchully',
    type: 'custom',
    base_project_id: 'solution-abc',
    tech_stack: { backend: 'Spring', db: 'MSSQL' }
});

// 기능 저장
const featureId = db.saveFeature({
    project_id: projectId,
    name: '고객 관리',
    category: 'CRM',
    description: '고객 CRUD 기능'
});

// API 저장
const apiId = db.saveApi({
    project_id: projectId,
    feature_id: featureId,
    method: 'GET',
    path: '/api/customer/list'
});

// DB 테이블 저장
const tableId = db.saveDbTable({
    project_id: projectId,
    table_name: 'CUSTOMER',
    columns: [...]
});

// 관계 설정
db.addApiTable(apiId, tableId, 'SELECT');
db.addFeatureTable(featureId, tableId);

// 검색
const results = db.globalSearch(projectId, '고객');

// 통계
const stats = db.getStats(projectId);

db.close();
```

## 🔧 고급 사용

### 환경변수

```bash
# DB 경로 변경
export WIKI_DB_PATH="/custom/path/project.db"

# 디버그 모드
export DEBUG=1
```

### 프로그래밍 방식 사용

```javascript
const WikiDB = require('./wiki/wiki-db');

const db = new WikiDB().connect();

// 커스텀 로직
const projects = db.listProjects();
projects.forEach(p => {
    const stats = db.getStats(p.id);
    console.log(`${p.name}: ${stats.apis}개 API`);
});

db.close();
```

## 📂 파일 구조

```
scripts/wiki/
├── README.md          # 이 파일
├── schema.sql         # DB 스키마 정의
├── wiki-db.js         # WikiDB 클래스
├── search-wiki.js     # 검색 CLI
├── compare-solutions.js  # 비교 CLI
└── save-to-wiki.js    # 저장 CLI

.ai-metadata/
└── project.db         # SQLite 데이터베이스 (자동 생성)
```

## 🎯 다음 단계

1. **더 정확한 분석**: Java Parser 추가 (메서드, 어노테이션 추출)
2. **MyBatis 통합**: XML에서 SQL ID → API 매핑 자동화
3. **Web UI**: React 기반 검색 인터페이스
4. **AI 통합**: 자연어 검색, 자동 문서화

## 📚 관련 문서

- [WIKI_DB_DESIGN.md](../../docs/WIKI_DB_DESIGN.md) - 전체 DB 스키마 설계
- [OPUS_REVIEW_RESULT.md](../../docs/OPUS_REVIEW_RESULT.md) - Opus 검토 결과
- [TODO.md](../../TODO.md) - 프로젝트 전체 TODO

---

**버전**: 1.0
**최종 업데이트**: 2026-01-17
