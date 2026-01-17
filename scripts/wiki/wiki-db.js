/**
 * WikiDB - 프로젝트 위키 데이터베이스 관리
 * SQLite + 정규화된 스키마
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WikiDB {
    constructor(dbPath = '.ai-metadata/project.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.ensureDirectory();
    }

    /**
     * 디렉토리 생성
     */
    ensureDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * 데이터베이스 연결 및 초기화
     */
    connect() {
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        // 스키마 적용
        this.initializeSchema();

        console.log(`✅ Wiki DB 연결: ${this.dbPath}`);
        return this;
    }

    /**
     * 스키마 초기화
     */
    initializeSchema() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
        this.db.exec(schemaSql);
    }

    /**
     * 연결 종료
     */
    close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Wiki DB 연결 종료');
        }
    }

    /**
     * ID 생성 (UUID 대신 짧은 해시 사용)
     */
    generateId(type, name) {
        const hash = crypto.createHash('md5')
            .update(`${type}_${name}_${Date.now()}`)
            .digest('hex');
        return `${type}-${hash.substring(0, 8)}`;
    }

    // ============================================================
    // 프로젝트 관리
    // ============================================================

    /**
     * 프로젝트 저장
     */
    saveProject(project) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO projects (id, name, type, base_project_id, tech_stack, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        const id = project.id || this.generateId('project', project.name);

        stmt.run(
            id,
            project.name,
            project.type || 'custom',
            project.base_project_id || null,
            JSON.stringify(project.tech_stack || {})
        );

        return id;
    }

    /**
     * 프로젝트 조회
     */
    getProject(projectId) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
        const project = stmt.get(projectId);

        if (project && project.tech_stack) {
            project.tech_stack = JSON.parse(project.tech_stack);
        }

        return project;
    }

    /**
     * 프로젝트 목록
     */
    listProjects() {
        const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
        const projects = stmt.all();

        return projects.map(p => {
            if (p.tech_stack) {
                p.tech_stack = JSON.parse(p.tech_stack);
            }
            return p;
        });
    }

    // ============================================================
    // 기능 관리
    // ============================================================

    /**
     * 기능 저장
     */
    saveFeature(feature) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO features (id, project_id, name, category, description, status, doc_path, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        const id = feature.id || this.generateId('feature', feature.name);

        stmt.run(
            id,
            feature.project_id,
            feature.name,
            feature.category || null,
            feature.description || null,
            feature.status || 'active',
            feature.doc_path || null
        );

        return id;
    }

    /**
     * 기능 조회
     */
    getFeature(featureId) {
        const stmt = this.db.prepare('SELECT * FROM features WHERE id = ?');
        return stmt.get(featureId);
    }

    /**
     * 프로젝트의 기능 목록
     */
    listFeatures(projectId) {
        const stmt = this.db.prepare(`
            SELECT * FROM features
            WHERE project_id = ?
            ORDER BY category, name
        `);
        return stmt.all(projectId);
    }

    /**
     * 기능 검색
     */
    searchFeatures(projectId, keyword) {
        const stmt = this.db.prepare(`
            SELECT * FROM features
            WHERE project_id = ?
            AND (name LIKE ? OR description LIKE ? OR category LIKE ?)
            ORDER BY name
        `);
        const pattern = `%${keyword}%`;
        return stmt.all(projectId, pattern, pattern, pattern);
    }

    // ============================================================
    // API 관리
    // ============================================================

    /**
     * API 저장
     */
    saveApi(api) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO apis (id, project_id, feature_id, method, path, controller, handler_method, description, request_params, response_schema)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const id = api.id || this.generateId('api', `${api.method}_${api.path}`);

        stmt.run(
            id,
            api.project_id,
            api.feature_id || null,
            api.method,
            api.path,
            api.controller || null,
            api.handler_method || null,
            api.description || null,
            JSON.stringify(api.request_params || {}),
            JSON.stringify(api.response_schema || {})
        );

        return id;
    }

    /**
     * API 목록
     */
    listApis(projectId, featureId = null) {
        let stmt;
        let params;

        if (featureId) {
            stmt = this.db.prepare(`
                SELECT * FROM apis
                WHERE project_id = ? AND feature_id = ?
                ORDER BY method, path
            `);
            params = [projectId, featureId];
        } else {
            stmt = this.db.prepare(`
                SELECT * FROM apis
                WHERE project_id = ?
                ORDER BY method, path
            `);
            params = [projectId];
        }

        return stmt.all(...params);
    }

    /**
     * API 검색
     */
    searchApis(projectId, keyword) {
        const stmt = this.db.prepare(`
            SELECT * FROM apis
            WHERE project_id = ?
            AND (path LIKE ? OR description LIKE ? OR controller LIKE ?)
            ORDER BY method, path
        `);
        const pattern = `%${keyword}%`;
        return stmt.all(projectId, pattern, pattern, pattern);
    }

    // ============================================================
    // DB 테이블 관리
    // ============================================================

    /**
     * DB 테이블 저장
     */
    saveDbTable(table) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO db_tables (id, project_id, table_name, description, columns, indexes)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const id = table.id || this.generateId('table', table.table_name);

        stmt.run(
            id,
            table.project_id,
            table.table_name,
            table.description || null,
            JSON.stringify(table.columns || []),
            JSON.stringify(table.indexes || [])
        );

        return id;
    }

    /**
     * DB 테이블 목록
     */
    listDbTables(projectId) {
        const stmt = this.db.prepare(`
            SELECT * FROM db_tables
            WHERE project_id = ?
            ORDER BY table_name
        `);
        return stmt.all(projectId);
    }

    // ============================================================
    // 파일 관리
    // ============================================================

    /**
     * 파일 저장
     */
    saveFile(file) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO source_files (id, project_id, file_path, file_type, feature_id, class_name)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const id = file.id || this.generateId('file', file.file_path);

        stmt.run(
            id,
            file.project_id,
            file.file_path,
            file.file_type || null,
            file.feature_id || null,
            file.class_name || null
        );

        return id;
    }

    /**
     * 파일 목록
     */
    listFiles(projectId, fileType = null) {
        let stmt;
        let params;

        if (fileType) {
            stmt = this.db.prepare(`
                SELECT * FROM source_files
                WHERE project_id = ? AND file_type = ?
                ORDER BY file_path
            `);
            params = [projectId, fileType];
        } else {
            stmt = this.db.prepare(`
                SELECT * FROM source_files
                WHERE project_id = ?
                ORDER BY file_path
            `);
            params = [projectId];
        }

        return stmt.all(...params);
    }

    // ============================================================
    // 관계 관리
    // ============================================================

    /**
     * 기능-파일 관계 저장
     */
    addFeatureFile(featureId, fileId, relationType = 'primary') {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO feature_files (feature_id, file_id, relation_type)
            VALUES (?, ?, ?)
        `);
        stmt.run(featureId, fileId, relationType);
    }

    /**
     * 기능-테이블 관계 저장
     */
    addFeatureTable(featureId, tableId, operation = null) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO feature_tables (feature_id, table_id, operation)
            VALUES (?, ?, ?)
        `);
        stmt.run(featureId, tableId, operation);
    }

    /**
     * API-테이블 관계 저장
     */
    addApiTable(apiId, tableId, operation = null) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO api_tables (api_id, table_id, operation)
            VALUES (?, ?, ?)
        `);
        stmt.run(apiId, tableId, operation);
    }

    /**
     * 파일-메서드 저장
     */
    saveMethod(method) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO file_methods (id, file_id, method_name, line_number, return_type, parameters, annotations)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const id = method.id || this.generateId('method', `${method.file_id}_${method.method_name}`);

        stmt.run(
            id,
            method.file_id,
            method.method_name,
            method.line_number || null,
            method.return_type || null,
            JSON.stringify(method.parameters || []),
            JSON.stringify(method.annotations || [])
        );

        return id;
    }

    /**
     * 파일 의존성 저장
     */
    addFileDependency(sourceFileId, targetFileId, dependencyType = 'import') {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO file_dependencies (source_file_id, target_file_id, dependency_type)
            VALUES (?, ?, ?)
        `);
        stmt.run(sourceFileId, targetFileId, dependencyType);
    }

    // ============================================================
    // 복잡한 쿼리
    // ============================================================

    /**
     * 기능의 모든 파일 조회
     */
    getFeatureFiles(featureId) {
        const stmt = this.db.prepare(`
            SELECT sf.*, ff.relation_type
            FROM source_files sf
            JOIN feature_files ff ON sf.id = ff.file_id
            WHERE ff.feature_id = ?
            ORDER BY ff.relation_type, sf.file_path
        `);
        return stmt.all(featureId);
    }

    /**
     * 기능이 사용하는 테이블 조회
     */
    getFeatureTables(featureId) {
        const stmt = this.db.prepare(`
            SELECT dt.*, ft.operation
            FROM db_tables dt
            JOIN feature_tables ft ON dt.id = ft.table_id
            WHERE ft.feature_id = ?
            ORDER BY dt.table_name
        `);
        return stmt.all(featureId);
    }

    /**
     * API가 사용하는 테이블 조회
     */
    getApiTables(apiId) {
        const stmt = this.db.prepare(`
            SELECT dt.*, at.operation
            FROM db_tables dt
            JOIN api_tables at ON dt.id = at.table_id
            WHERE at.api_id = ?
            ORDER BY dt.table_name
        `);
        return stmt.all(apiId);
    }

    /**
     * 파일의 모든 메서드 조회
     */
    getFileMethods(fileId) {
        const stmt = this.db.prepare(`
            SELECT * FROM file_methods
            WHERE file_id = ?
            ORDER BY line_number
        `);
        return stmt.all(fileId);
    }

    /**
     * 파일의 의존성 조회
     */
    getFileDependencies(fileId) {
        const stmt = this.db.prepare(`
            SELECT target.*, fd.dependency_type
            FROM source_files target
            JOIN file_dependencies fd ON target.id = fd.target_file_id
            WHERE fd.source_file_id = ?
        `);
        return stmt.all(fileId);
    }

    /**
     * 전체 검색 (기능, API, 테이블)
     */
    globalSearch(projectId, keyword) {
        const pattern = `%${keyword}%`;

        const features = this.db.prepare(`
            SELECT 'feature' AS type, id, name AS title, description, category AS extra
            FROM features
            WHERE project_id = ? AND (name LIKE ? OR description LIKE ?)
        `).all(projectId, pattern, pattern);

        const apis = this.db.prepare(`
            SELECT 'api' AS type, id, path AS title, description, method AS extra
            FROM apis
            WHERE project_id = ? AND (path LIKE ? OR description LIKE ?)
        `).all(projectId, pattern, pattern);

        const tables = this.db.prepare(`
            SELECT 'table' AS type, id, table_name AS title, description, NULL AS extra
            FROM db_tables
            WHERE project_id = ? AND (table_name LIKE ? OR description LIKE ?)
        `).all(projectId, pattern, pattern);

        return [...features, ...apis, ...tables];
    }

    /**
     * 통계 조회
     */
    getStats(projectId) {
        const stats = {
            features: this.db.prepare('SELECT COUNT(*) AS count FROM features WHERE project_id = ?').get(projectId).count,
            apis: this.db.prepare('SELECT COUNT(*) AS count FROM apis WHERE project_id = ?').get(projectId).count,
            tables: this.db.prepare('SELECT COUNT(*) AS count FROM db_tables WHERE project_id = ?').get(projectId).count,
            files: this.db.prepare('SELECT COUNT(*) AS count FROM source_files WHERE project_id = ?').get(projectId).count
        };

        return stats;
    }
}

module.exports = WikiDB;
