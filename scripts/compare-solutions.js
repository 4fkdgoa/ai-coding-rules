#!/usr/bin/env node
/**
 * 솔루션 vs 커스텀 프로젝트 비교 도구
 * 사용법: node compare-solutions.js <solution-project-id> <custom-project-id>
 */

const WikiDB = require('./wiki/wiki-db');
const fs = require('fs');

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

function printHeader(text, color = 'cyan') {
    console.log(colorize(`\n${'='.repeat(60)}`, color));
    console.log(colorize(text, 'bright'));
    console.log(colorize('='.repeat(60), color));
}

class SolutionComparator {
    constructor(db) {
        this.db = db;
    }

    /**
     * 두 프로젝트 비교
     */
    compare(solutionId, customId) {
        const solution = this.db.getProject(solutionId);
        const custom = this.db.getProject(customId);

        if (!solution) {
            throw new Error(`솔루션 프로젝트를 찾을 수 없습니다: ${solutionId}`);
        }

        if (!custom) {
            throw new Error(`커스텀 프로젝트를 찾을 수 없습니다: ${customId}`);
        }

        return {
            solution,
            custom,
            features: this.compareFeatures(solutionId, customId),
            apis: this.compareApis(solutionId, customId),
            tables: this.compareTables(solutionId, customId),
            files: this.compareFiles(solutionId, customId)
        };
    }

    /**
     * 기능 비교
     */
    compareFeatures(solutionId, customId) {
        const solutionFeatures = this.db.listFeatures(solutionId);
        const customFeatures = this.db.listFeatures(customId);

        const solutionMap = new Map(solutionFeatures.map(f => [f.name, f]));
        const customMap = new Map(customFeatures.map(f => [f.name, f]));

        const added = [];
        const removed = [];
        const modified = [];

        // 추가된 기능
        for (const [name, feature] of customMap) {
            if (!solutionMap.has(name)) {
                added.push(feature);
            }
        }

        // 제거된 기능
        for (const [name, feature] of solutionMap) {
            if (!customMap.has(name)) {
                removed.push(feature);
            }
        }

        // 변경된 기능
        for (const [name, customFeature] of customMap) {
            const solutionFeature = solutionMap.get(name);
            if (solutionFeature) {
                if (solutionFeature.description !== customFeature.description ||
                    solutionFeature.category !== customFeature.category) {
                    modified.push({
                        name,
                        solution: solutionFeature,
                        custom: customFeature
                    });
                }
            }
        }

        return { added, removed, modified };
    }

    /**
     * API 비교
     */
    compareApis(solutionId, customId) {
        const solutionApis = this.db.listApis(solutionId);
        const customApis = this.db.listApis(customId);

        const makeKey = (api) => `${api.method} ${api.path}`;

        const solutionMap = new Map(solutionApis.map(a => [makeKey(a), a]));
        const customMap = new Map(customApis.map(a => [makeKey(a), a]));

        const added = [];
        const removed = [];
        const modified = [];

        // 추가된 API
        for (const [key, api] of customMap) {
            if (!solutionMap.has(key)) {
                added.push(api);
            }
        }

        // 제거된 API
        for (const [key, api] of solutionMap) {
            if (!customMap.has(key)) {
                removed.push(api);
            }
        }

        // 변경된 API
        for (const [key, customApi] of customMap) {
            const solutionApi = solutionMap.get(key);
            if (solutionApi) {
                if (solutionApi.description !== customApi.description ||
                    solutionApi.controller !== customApi.controller ||
                    solutionApi.handler_method !== customApi.handler_method) {
                    modified.push({
                        key,
                        solution: solutionApi,
                        custom: customApi
                    });
                }
            }
        }

        return { added, removed, modified };
    }

    /**
     * 테이블 비교
     */
    compareTables(solutionId, customId) {
        const solutionTables = this.db.listDbTables(solutionId);
        const customTables = this.db.listDbTables(customId);

        const solutionMap = new Map(solutionTables.map(t => [t.table_name, t]));
        const customMap = new Map(customTables.map(t => [t.table_name, t]));

        const added = [];
        const removed = [];
        const modified = [];

        // 추가된 테이블
        for (const [name, table] of customMap) {
            if (!solutionMap.has(name)) {
                added.push(table);
            }
        }

        // 제거된 테이블
        for (const [name, table] of solutionMap) {
            if (!customMap.has(name)) {
                removed.push(table);
            }
        }

        // 변경된 테이블 (컬럼 변경)
        for (const [name, customTable] of customMap) {
            const solutionTable = solutionMap.get(name);
            if (solutionTable) {
                if (solutionTable.columns !== customTable.columns) {
                    modified.push({
                        name,
                        solution: solutionTable,
                        custom: customTable
                    });
                }
            }
        }

        return { added, removed, modified };
    }

    /**
     * 파일 비교
     */
    compareFiles(solutionId, customId) {
        const solutionFiles = this.db.listFiles(solutionId);
        const customFiles = this.db.listFiles(customId);

        const solutionMap = new Map(solutionFiles.map(f => [f.file_path, f]));
        const customMap = new Map(customFiles.map(f => [f.file_path, f]));

        const added = [];
        const removed = [];

        // 추가된 파일
        for (const [path, file] of customMap) {
            if (!solutionMap.has(path)) {
                added.push(file);
            }
        }

        // 제거된 파일
        for (const [path, file] of solutionMap) {
            if (!customMap.has(path)) {
                removed.push(file);
            }
        }

        return { added, removed };
    }
}

/**
 * 비교 결과 출력
 */
function printComparison(result) {
    printHeader(`📊 프로젝트 비교`, 'bright');
    console.log(`솔루션: ${colorize(result.solution.name, 'cyan')} (${result.solution.id})`);
    console.log(`커스텀: ${colorize(result.custom.name, 'yellow')} (${result.custom.id})`);

    // 요약
    printHeader('📋 변경 요약', 'cyan');
    console.log(`기능:      +${colorize(result.features.added.length, 'green')} / -${colorize(result.features.removed.length, 'red')} / ~${colorize(result.features.modified.length, 'yellow')}`);
    console.log(`API:       +${colorize(result.apis.added.length, 'green')} / -${colorize(result.apis.removed.length, 'red')} / ~${colorize(result.apis.modified.length, 'yellow')}`);
    console.log(`DB 테이블: +${colorize(result.tables.added.length, 'green')} / -${colorize(result.tables.removed.length, 'red')} / ~${colorize(result.tables.modified.length, 'yellow')}`);
    console.log(`파일:      +${colorize(result.files.added.length, 'green')} / -${colorize(result.files.removed.length, 'red')}`);

    // 기능 상세
    if (result.features.added.length > 0) {
        printHeader(`✅ 추가된 기능 (${result.features.added.length}개)`, 'green');
        result.features.added.forEach(f => {
            console.log(`  + ${colorize(f.name, 'green')} ${f.category ? `[${f.category}]` : ''}`);
            if (f.description) {
                console.log(`    ${f.description.substring(0, 60)}...`);
            }
        });
    }

    if (result.features.removed.length > 0) {
        printHeader(`❌ 제거된 기능 (${result.features.removed.length}개)`, 'red');
        result.features.removed.forEach(f => {
            console.log(`  - ${colorize(f.name, 'red')} ${f.category ? `[${f.category}]` : ''}`);
        });
    }

    if (result.features.modified.length > 0) {
        printHeader(`🔄 변경된 기능 (${result.features.modified.length}개)`, 'yellow');
        result.features.modified.forEach(m => {
            console.log(`  ~ ${colorize(m.name, 'yellow')}`);
            if (m.solution.description !== m.custom.description) {
                console.log(`    설명 변경:`);
                console.log(`      - ${m.solution.description}`);
                console.log(`      + ${m.custom.description}`);
            }
        });
    }

    // API 상세
    if (result.apis.added.length > 0) {
        printHeader(`✅ 추가된 API (${result.apis.added.length}개)`, 'green');
        result.apis.added.slice(0, 10).forEach(a => {
            console.log(`  + ${colorize(a.method, 'blue')} ${colorize(a.path, 'green')}`);
            if (a.description) {
                console.log(`    ${a.description.substring(0, 60)}...`);
            }
        });
        if (result.apis.added.length > 10) {
            console.log(colorize(`  ... ${result.apis.added.length - 10}개 더`, 'cyan'));
        }
    }

    if (result.apis.removed.length > 0) {
        printHeader(`❌ 제거된 API (${result.apis.removed.length}개)`, 'red');
        result.apis.removed.slice(0, 10).forEach(a => {
            console.log(`  - ${colorize(a.method, 'blue')} ${colorize(a.path, 'red')}`);
        });
        if (result.apis.removed.length > 10) {
            console.log(colorize(`  ... ${result.apis.removed.length - 10}개 더`, 'cyan'));
        }
    }

    // 테이블 상세
    if (result.tables.added.length > 0) {
        printHeader(`✅ 추가된 테이블 (${result.tables.added.length}개)`, 'green');
        result.tables.added.forEach(t => {
            console.log(`  + ${colorize(t.table_name, 'green')}`);
        });
    }

    if (result.tables.removed.length > 0) {
        printHeader(`❌ 제거된 테이블 (${result.tables.removed.length}개)`, 'red');
        result.tables.removed.forEach(t => {
            console.log(`  - ${colorize(t.table_name, 'red')}`);
        });
    }
}

/**
 * Markdown 리포트 생성
 */
function generateMarkdownReport(result, outputPath) {
    const lines = [];

    lines.push(`# 프로젝트 비교 리포트`);
    lines.push(``);
    lines.push(`**생성일**: ${new Date().toISOString()}`);
    lines.push(``);
    lines.push(`## 프로젝트 정보`);
    lines.push(``);
    lines.push(`| 구분 | 프로젝트명 | ID |`);
    lines.push(`|------|------------|------|`);
    lines.push(`| 솔루션 | ${result.solution.name} | ${result.solution.id} |`);
    lines.push(`| 커스텀 | ${result.custom.name} | ${result.custom.id} |`);
    lines.push(``);

    lines.push(`## 변경 요약`);
    lines.push(``);
    lines.push(`| 항목 | 추가 | 제거 | 변경 |`);
    lines.push(`|------|------|------|------|`);
    lines.push(`| 기능 | ${result.features.added.length} | ${result.features.removed.length} | ${result.features.modified.length} |`);
    lines.push(`| API | ${result.apis.added.length} | ${result.apis.removed.length} | ${result.apis.modified.length} |`);
    lines.push(`| DB 테이블 | ${result.tables.added.length} | ${result.tables.removed.length} | ${result.tables.modified.length} |`);
    lines.push(`| 파일 | ${result.files.added.length} | ${result.files.removed.length} | - |`);
    lines.push(``);

    // 추가된 기능
    if (result.features.added.length > 0) {
        lines.push(`## ✅ 추가된 기능 (${result.features.added.length}개)`);
        lines.push(``);
        result.features.added.forEach(f => {
            lines.push(`### ${f.name}`);
            if (f.category) lines.push(`**카테고리**: ${f.category}`);
            if (f.description) lines.push(f.description);
            lines.push(``);
        });
    }

    // 제거된 기능
    if (result.features.removed.length > 0) {
        lines.push(`## ❌ 제거된 기능 (${result.features.removed.length}개)`);
        lines.push(``);
        result.features.removed.forEach(f => {
            lines.push(`- ${f.name} ${f.category ? `[${f.category}]` : ''}`);
        });
        lines.push(``);
    }

    // 추가된 API
    if (result.apis.added.length > 0) {
        lines.push(`## ✅ 추가된 API (${result.apis.added.length}개)`);
        lines.push(``);
        lines.push(`| Method | Path | Description |`);
        lines.push(`|--------|------|-------------|`);
        result.apis.added.forEach(a => {
            lines.push(`| ${a.method} | ${a.path} | ${a.description || '-'} |`);
        });
        lines.push(``);
    }

    // 제거된 API
    if (result.apis.removed.length > 0) {
        lines.push(`## ❌ 제거된 API (${result.apis.removed.length}개)`);
        lines.push(``);
        lines.push(`| Method | Path |`);
        lines.push(`|--------|------|`);
        result.apis.removed.forEach(a => {
            lines.push(`| ${a.method} | ${a.path} |`);
        });
        lines.push(``);
    }

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    console.log(colorize(`\n✅ 리포트 생성: ${outputPath}`, 'green'));
}

// ============================================================
// 메인
// ============================================================

function printUsage() {
    console.log(`
${colorize('사용법:', 'bright')}

  node compare-solutions.js <solution-project-id> <custom-project-id> [--output report.md]

${colorize('옵션:', 'bright')}
  --output, -o <path>   Markdown 리포트 파일 생성

${colorize('예시:', 'bright')}
  node compare-solutions.js solution-abc custom-xyz
  node compare-solutions.js solution-abc custom-xyz --output report.md
    `);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
        printUsage();
        process.exit(args.length < 2 ? 1 : 0);
    }

    const solutionId = args[0];
    const customId = args[1];

    let outputPath = null;
    for (let i = 2; i < args.length; i++) {
        if (args[i] === '--output' || args[i] === '-o') {
            outputPath = args[i + 1];
            break;
        }
    }

    const dbPath = process.env.WIKI_DB_PATH || '.ai-metadata/project.db';

    try {
        const db = new WikiDB(dbPath).connect();

        try {
            const comparator = new SolutionComparator(db);
            const result = comparator.compare(solutionId, customId);

            printComparison(result);

            if (outputPath) {
                generateMarkdownReport(result, outputPath);
            }

        } finally {
            db.close();
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
