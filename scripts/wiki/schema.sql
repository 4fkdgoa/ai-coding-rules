-- Wiki Database Schema
-- Version: 1.0
-- Updated: 2026-01-17
-- 정규화된 스키마 (JSON 컬럼 최소화)

-- ============================================================
-- 1. 프로젝트
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,              -- 'solution' or 'custom'
    base_project_id TEXT,   -- 솔루션 원본 ID
    tech_stack TEXT,        -- JSON: {"backend": "Spring", "db": "MSSQL"}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. 기능
-- ============================================================
CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,          -- '고객관리', '재고관리'
    description TEXT,
    status TEXT DEFAULT 'active',  -- 'active', 'deprecated', 'removed'
    doc_path TEXT,          -- 'docs/features/customer-mgmt.md'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_features_name ON features(name);
CREATE INDEX IF NOT EXISTS idx_features_category ON features(category);
CREATE INDEX IF NOT EXISTS idx_features_project ON features(project_id);

-- ============================================================
-- 3. API 엔드포인트
-- ============================================================
CREATE TABLE IF NOT EXISTS apis (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    feature_id TEXT,
    method TEXT,            -- 'GET', 'POST', 'PUT', 'DELETE'
    path TEXT NOT NULL,
    controller TEXT,        -- 'CustomerController'
    handler_method TEXT,    -- 'getCustomer'
    description TEXT,
    request_params TEXT,    -- JSON (내부 구조, 검색 불필요)
    response_schema TEXT,   -- JSON (내부 구조, 검색 불필요)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_apis_path ON apis(path);
CREATE INDEX IF NOT EXISTS idx_apis_method ON apis(method);
CREATE INDEX IF NOT EXISTS idx_apis_project ON apis(project_id);
CREATE INDEX IF NOT EXISTS idx_apis_feature ON apis(feature_id);

-- ============================================================
-- 4. 데이터베이스 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS db_tables (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    description TEXT,
    columns TEXT,           -- JSON (내부 구조, 검색 불필요)
    indexes TEXT,           -- JSON (내부 구조, 검색 불필요)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_db_tables_name ON db_tables(table_name);
CREATE INDEX IF NOT EXISTS idx_db_tables_project ON db_tables(project_id);

-- ============================================================
-- 5. 파일 메타데이터
-- ============================================================
CREATE TABLE IF NOT EXISTS source_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,         -- 'controller', 'service', 'repository', 'entity', 'mapper'
    feature_id TEXT,
    class_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_files_path ON source_files(file_path);
CREATE INDEX IF NOT EXISTS idx_source_files_type ON source_files(file_type);
CREATE INDEX IF NOT EXISTS idx_source_files_project ON source_files(project_id);

-- ============================================================
-- 6. 커스텀 vs 솔루션 차이
-- ============================================================
CREATE TABLE IF NOT EXISTS customizations (
    id TEXT PRIMARY KEY,
    custom_project_id TEXT NOT NULL,
    solution_project_id TEXT NOT NULL,
    entity_type TEXT,       -- 'feature', 'api', 'table', 'file'
    entity_id TEXT,
    change_type TEXT,       -- 'added', 'modified', 'removed'
    description TEXT,
    diff_data TEXT,         -- JSON: 차이점 상세
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (custom_project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (solution_project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customizations_custom ON customizations(custom_project_id);
CREATE INDEX IF NOT EXISTS idx_customizations_type ON customizations(entity_type);

-- ============================================================
-- 7. 관계 테이블 (Relation Tables)
-- ============================================================

-- 7.1 기능-파일 관계
CREATE TABLE IF NOT EXISTS feature_files (
    feature_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    relation_type TEXT DEFAULT 'primary',  -- 'primary', 'secondary', 'test'
    PRIMARY KEY (feature_id, file_id),
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES source_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ff_feature ON feature_files(feature_id);
CREATE INDEX IF NOT EXISTS idx_ff_file ON feature_files(file_id);

-- 7.2 기능-테이블 관계
CREATE TABLE IF NOT EXISTS feature_tables (
    feature_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    operation TEXT,         -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    PRIMARY KEY (feature_id, table_id),
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES db_tables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ft_feature ON feature_tables(feature_id);
CREATE INDEX IF NOT EXISTS idx_ft_table ON feature_tables(table_id);

-- 7.3 API-테이블 관계
CREATE TABLE IF NOT EXISTS api_tables (
    api_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    operation TEXT,         -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    PRIMARY KEY (api_id, table_id),
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES db_tables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_at_api ON api_tables(api_id);
CREATE INDEX IF NOT EXISTS idx_at_table ON api_tables(table_id);

-- 7.4 파일-메서드
CREATE TABLE IF NOT EXISTS file_methods (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    method_name TEXT NOT NULL,
    line_number INTEGER,
    return_type TEXT,
    parameters TEXT,        -- JSON (파라미터 목록)
    annotations TEXT,       -- JSON (어노테이션 목록)
    FOREIGN KEY (file_id) REFERENCES source_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fm_file ON file_methods(file_id);
CREATE INDEX IF NOT EXISTS idx_fm_name ON file_methods(method_name);

-- 7.5 파일 의존성
CREATE TABLE IF NOT EXISTS file_dependencies (
    source_file_id TEXT NOT NULL,
    target_file_id TEXT NOT NULL,
    dependency_type TEXT,   -- 'import', 'extends', 'implements', 'autowired'
    PRIMARY KEY (source_file_id, target_file_id),
    FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE CASCADE,
    FOREIGN KEY (target_file_id) REFERENCES source_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fd_source ON file_dependencies(source_file_id);
CREATE INDEX IF NOT EXISTS idx_fd_target ON file_dependencies(target_file_id);

-- ============================================================
-- 메타데이터
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES ('1.0', 'Initial schema with normalized relation tables');
