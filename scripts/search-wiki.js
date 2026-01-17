#!/usr/bin/env node
/**
 * Wiki 검색 CLI 도구
 * 사용법: node search-wiki.js <project-id> <keyword>
 */

const WikiDB = require('./wiki/wiki-db');
const path = require('path');

// 색상 코드
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(text) {
    console.log(colorize(`\n${'='.repeat(60)}`, 'cyan'));
    console.log(colorize(text, 'bright'));
    console.log(colorize('='.repeat(60), 'cyan'));
}

function printResult(type, item) {
    const typeColors = {
        feature: 'green',
        api: 'blue',
        table: 'yellow'
    };

    const typeIcons = {
        feature: '📦',
        api: '🔌',
        table: '📊'
    };

    const color = typeColors[type] || 'reset';
    const icon = typeIcons[type] || '📄';

    console.log(`\n${icon} ${colorize(item.title, color)}`);

    if (item.extra) {
        console.log(`   ${colorize(item.extra, 'cyan')}`);
    }

    if (item.description) {
        const desc = item.description.length > 80
            ? item.description.substring(0, 77) + '...'
            : item.description;
        console.log(`   ${desc}`);
    }

    console.log(`   ID: ${colorize(item.id, 'magenta')}`);
}

async function searchWiki(projectId, keyword, dbPath = '.ai-metadata/project.db') {
    const db = new WikiDB(dbPath).connect();

    try {
        // 프로젝트 확인
        const project = db.getProject(projectId);
        if (!project) {
            console.error(colorize(`❌ 프로젝트를 찾을 수 없습니다: ${projectId}`, 'red'));
            console.log('\n사용 가능한 프로젝트:');
            const projects = db.listProjects();
            projects.forEach(p => {
                console.log(`  - ${colorize(p.id, 'cyan')}: ${p.name} (${p.type})`);
            });
            process.exit(1);
        }

        printHeader(`🔍 검색 결과: "${keyword}" in ${project.name}`);

        // 전체 검색
        const results = db.globalSearch(projectId, keyword);

        if (results.length === 0) {
            console.log(colorize('\n결과 없음', 'yellow'));
            process.exit(0);
        }

        // 타입별 그룹화
        const grouped = {
            feature: results.filter(r => r.type === 'feature'),
            api: results.filter(r => r.type === 'api'),
            table: results.filter(r => r.type === 'table')
        };

        // 기능
        if (grouped.feature.length > 0) {
            printHeader(`📦 기능 (${grouped.feature.length}개)`);
            grouped.feature.forEach(item => printResult('feature', item));
        }

        // API
        if (grouped.api.length > 0) {
            printHeader(`🔌 API (${grouped.api.length}개)`);
            grouped.api.forEach(item => printResult('api', item));
        }

        // 테이블
        if (grouped.table.length > 0) {
            printHeader(`📊 DB 테이블 (${grouped.table.length}개)`);
            grouped.table.forEach(item => printResult('table', item));
        }

        // 요약
        console.log(colorize(`\n총 ${results.length}개 결과`, 'bright'));

    } finally {
        db.close();
    }
}

async function showStats(projectId, dbPath = '.ai-metadata/project.db') {
    const db = new WikiDB(dbPath).connect();

    try {
        const project = db.getProject(projectId);
        if (!project) {
            console.error(colorize(`❌ 프로젝트를 찾을 수 없습니다: ${projectId}`, 'red'));
            process.exit(1);
        }

        const stats = db.getStats(projectId);

        printHeader(`📊 프로젝트 통계: ${project.name}`);

        console.log(`\n📦 기능:      ${colorize(stats.features, 'green')}개`);
        console.log(`🔌 API:       ${colorize(stats.apis, 'blue')}개`);
        console.log(`📊 DB 테이블: ${colorize(stats.tables, 'yellow')}개`);
        console.log(`📄 파일:      ${colorize(stats.files, 'cyan')}개`);

    } finally {
        db.close();
    }
}

async function listProjects(dbPath = '.ai-metadata/project.db') {
    const db = new WikiDB(dbPath).connect();

    try {
        const projects = db.listProjects();

        if (projects.length === 0) {
            console.log(colorize('\n등록된 프로젝트가 없습니다.', 'yellow'));
            process.exit(0);
        }

        printHeader('📋 등록된 프로젝트');

        projects.forEach(p => {
            console.log(`\n${colorize(p.name, 'bright')}`);
            console.log(`  ID:   ${colorize(p.id, 'cyan')}`);
            console.log(`  타입: ${p.type}`);
            if (p.base_project_id) {
                console.log(`  원본: ${p.base_project_id}`);
            }
            console.log(`  생성: ${p.created_at}`);
        });

    } finally {
        db.close();
    }
}

async function showFeatureDetail(projectId, featureId, dbPath = '.ai-metadata/project.db') {
    const db = new WikiDB(dbPath).connect();

    try {
        const feature = db.getFeature(featureId);
        if (!feature) {
            console.error(colorize(`❌ 기능을 찾을 수 없습니다: ${featureId}`, 'red'));
            process.exit(1);
        }

        printHeader(`📦 기능 상세: ${feature.name}`);

        console.log(`\nID:       ${colorize(feature.id, 'magenta')}`);
        console.log(`카테고리: ${feature.category || 'N/A'}`);
        console.log(`상태:     ${feature.status}`);
        if (feature.description) {
            console.log(`\n설명:\n${feature.description}`);
        }

        // 관련 파일
        const files = db.getFeatureFiles(featureId);
        if (files.length > 0) {
            printHeader(`📄 관련 파일 (${files.length}개)`);
            files.forEach(f => {
                const typeLabel = f.relation_type === 'primary' ? '🔹' : '🔸';
                console.log(`  ${typeLabel} ${f.file_path} (${f.file_type || 'unknown'})`);
            });
        }

        // 관련 테이블
        const tables = db.getFeatureTables(featureId);
        if (tables.length > 0) {
            printHeader(`📊 사용 테이블 (${tables.length}개)`);
            tables.forEach(t => {
                console.log(`  📊 ${t.table_name} ${t.operation ? `[${t.operation}]` : ''}`);
            });
        }

    } finally {
        db.close();
    }
}

// ============================================================
// 메인
// ============================================================

function printUsage() {
    console.log(`
${colorize('사용법:', 'bright')}

  ${colorize('프로젝트 목록:', 'cyan')}
  node search-wiki.js --list

  ${colorize('프로젝트 통계:', 'cyan')}
  node search-wiki.js --stats <project-id>

  ${colorize('키워드 검색:', 'cyan')}
  node search-wiki.js <project-id> <keyword>

  ${colorize('기능 상세:', 'cyan')}
  node search-wiki.js <project-id> --feature <feature-id>

${colorize('예시:', 'bright')}
  node search-wiki.js --list
  node search-wiki.js project-abc123 고객
  node search-wiki.js project-abc123 --stats
  node search-wiki.js project-abc123 --feature feature-xyz789
    `);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printUsage();
        process.exit(0);
    }

    const dbPath = process.env.WIKI_DB_PATH || '.ai-metadata/project.db';

    try {
        // 프로젝트 목록
        if (args[0] === '--list' || args[0] === '-l') {
            await listProjects(dbPath);
        }
        // 프로젝트 통계
        else if (args.length === 2 && args[1] === '--stats') {
            await showStats(args[0], dbPath);
        }
        // 기능 상세
        else if (args.length === 3 && args[1] === '--feature') {
            await showFeatureDetail(args[0], args[2], dbPath);
        }
        // 키워드 검색
        else if (args.length === 2) {
            await searchWiki(args[0], args[1], dbPath);
        }
        else {
            printUsage();
            process.exit(1);
        }
    } catch (error) {
        console.error(colorize(`\n❌ 오류: ${error.message}`, 'red'));
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
