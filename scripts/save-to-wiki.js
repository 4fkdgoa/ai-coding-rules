#!/usr/bin/env node
/**
 * 프로젝트 분석 결과를 Wiki DB에 저장
 * 사용법: node save-to-wiki.js <project-path> [--type solution|custom] [--base-id solution-id]
 */

const WikiDB = require('./wiki/wiki-db');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 색상 코드
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

/**
 * 프로젝트 분석 (간단한 버전)
 */
function analyzeProject(projectPath) {
    console.log(colorize(`\n📊 프로젝트 분석 중: ${projectPath}`, 'cyan'));

    const projectName = path.basename(projectPath);
    const analysis = {
        name: projectName,
        path: projectPath,
        features: [],
        apis: [],
        tables: [],
        files: []
    };

    // Java 파일 스캔
    if (fs.existsSync(path.join(projectPath, 'src'))) {
        console.log(colorize('  Java 프로젝트 감지', 'yellow'));

        // Controller 파일 찾기
        const findCmd = `find "${projectPath}" -name "*Controller.java" 2>/dev/null || true`;
        try {
            const controllers = execSync(findCmd, { encoding: 'utf-8' })
                .split('\n')
                .filter(f => f.trim());

            analysis.files = controllers.map(filePath => ({
                file_path: filePath.replace(projectPath + '/', ''),
                file_type: 'controller',
                class_name: path.basename(filePath, '.java')
            }));

            console.log(colorize(`  Controller 파일: ${controllers.length}개`, 'green'));
        } catch (error) {
            console.log(colorize(`  Controller 파일 스캔 실패: ${error.message}`, 'red'));
        }

        // MyBatis XML 찾기
        const xmlCmd = `find "${projectPath}" -name "*.xml" -path "*/mapper/*" 2>/dev/null || true`;
        try {
            const xmlFiles = execSync(xmlCmd, { encoding: 'utf-8' })
                .split('\n')
                .filter(f => f.trim());

            console.log(colorize(`  MyBatis XML: ${xmlFiles.length}개`, 'green'));
        } catch (error) {
            // 무시
        }
    }

    return analysis;
}

/**
 * Wiki DB에 저장
 */
function saveToWiki(analysis, options = {}) {
    const dbPath = options.dbPath || '.ai-metadata/project.db';
    const db = new WikiDB(dbPath).connect();

    try {
        console.log(colorize(`\n💾 Wiki DB에 저장 중...`, 'cyan'));

        // 프로젝트 저장
        const projectId = db.saveProject({
            name: analysis.name,
            type: options.type || 'custom',
            base_project_id: options.baseId || null,
            tech_stack: {
                backend: 'Java',
                framework: 'Spring'
            }
        });

        console.log(colorize(`  ✓ 프로젝트: ${projectId}`, 'green'));

        // 파일 저장
        analysis.files.forEach(file => {
            db.saveFile({
                project_id: projectId,
                ...file
            });
        });

        console.log(colorize(`  ✓ 파일: ${analysis.files.length}개`, 'green'));

        // 통계
        const stats = db.getStats(projectId);
        console.log(colorize(`\n📊 저장 완료`, 'bright'));
        console.log(`  프로젝트: ${colorize(analysis.name, 'cyan')} (${projectId})`);
        console.log(`  파일: ${stats.files}개`);

        return projectId;

    } finally {
        db.close();
    }
}

/**
 * 샘플 데이터 생성 (테스트용)
 */
function generateSampleData(projectId, db) {
    console.log(colorize(`\n🎲 샘플 데이터 생성 중...`, 'yellow'));

    // 기능 샘플
    const customerFeatureId = db.saveFeature({
        project_id: projectId,
        name: '고객 관리',
        category: 'CRM',
        description: '고객 정보 조회, 등록, 수정, 삭제 기능',
        status: 'active'
    });

    const stockFeatureId = db.saveFeature({
        project_id: projectId,
        name: '재고 관리',
        category: '재고',
        description: '재고 입고, 출고, 조회 기능',
        status: 'active'
    });

    console.log(colorize(`  ✓ 기능: 2개 생성`, 'green'));

    // API 샘플
    const api1 = db.saveApi({
        project_id: projectId,
        feature_id: customerFeatureId,
        method: 'GET',
        path: '/api/customer/list',
        controller: 'CustomerController',
        handler_method: 'getCustomerList',
        description: '고객 목록 조회'
    });

    const api2 = db.saveApi({
        project_id: projectId,
        feature_id: customerFeatureId,
        method: 'POST',
        path: '/api/customer',
        controller: 'CustomerController',
        handler_method: 'createCustomer',
        description: '고객 등록'
    });

    const api3 = db.saveApi({
        project_id: projectId,
        feature_id: stockFeatureId,
        method: 'GET',
        path: '/api/stock/list',
        controller: 'StockController',
        handler_method: 'getStockList',
        description: '재고 목록 조회'
    });

    console.log(colorize(`  ✓ API: 3개 생성`, 'green'));

    // DB 테이블 샘플
    const customerTableId = db.saveDbTable({
        project_id: projectId,
        table_name: 'CUSTOMER',
        description: '고객 정보',
        columns: [
            { name: 'CUSTOMER_ID', type: 'BIGINT', nullable: false },
            { name: 'CUSTOMER_NAME', type: 'VARCHAR(100)', nullable: false },
            { name: 'EMAIL', type: 'VARCHAR(255)', nullable: true }
        ]
    });

    const stockTableId = db.saveDbTable({
        project_id: projectId,
        table_name: 'STOCK',
        description: '재고 정보',
        columns: [
            { name: 'STOCK_ID', type: 'BIGINT', nullable: false },
            { name: 'PRODUCT_NAME', type: 'VARCHAR(200)', nullable: false },
            { name: 'QUANTITY', type: 'INT', nullable: false }
        ]
    });

    console.log(colorize(`  ✓ DB 테이블: 2개 생성`, 'green'));

    // 관계 설정
    db.addApiTable(api1, customerTableId, 'SELECT');
    db.addApiTable(api2, customerTableId, 'INSERT');
    db.addApiTable(api3, stockTableId, 'SELECT');

    db.addFeatureTable(customerFeatureId, customerTableId);
    db.addFeatureTable(stockFeatureId, stockTableId);

    console.log(colorize(`  ✓ 관계: API-테이블 연결 완료`, 'green'));
}

// ============================================================
// 메인
// ============================================================

function printUsage() {
    console.log(`
${colorize('사용법:', 'bright')}

  node save-to-wiki.js <project-path> [options]

${colorize('옵션:', 'bright')}
  --type <type>         프로젝트 타입 (solution | custom, 기본: custom)
  --base-id <id>        솔루션 원본 프로젝트 ID (커스텀인 경우)
  --sample              샘플 데이터 생성 (테스트용)

${colorize('예시:', 'bright')}
  # 커스텀 프로젝트 저장
  node save-to-wiki.js ~/AutoCRM_Samchully_BPS

  # 솔루션 프로젝트 저장
  node save-to-wiki.js ~/AutoCRM_Core3 --type solution

  # 샘플 데이터 생성 (테스트)
  node save-to-wiki.js ~/TestProject --sample
    `);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printUsage();
        process.exit(args.length === 0 ? 1 : 0);
    }

    const projectPath = args[0];

    if (!fs.existsSync(projectPath)) {
        console.error(colorize(`\n❌ 프로젝트 경로를 찾을 수 없습니다: ${projectPath}`, 'red'));
        process.exit(1);
    }

    const options = {
        type: 'custom',
        baseId: null,
        sample: false
    };

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--type') {
            options.type = args[i + 1];
        } else if (args[i] === '--base-id') {
            options.baseId = args[i + 1];
        } else if (args[i] === '--sample') {
            options.sample = true;
        }
    }

    try {
        const analysis = analyzeProject(projectPath);
        const projectId = saveToWiki(analysis, options);

        // 샘플 데이터 생성
        if (options.sample) {
            const db = new WikiDB(options.dbPath || '.ai-metadata/project.db').connect();
            try {
                generateSampleData(projectId, db);
            } finally {
                db.close();
            }
        }

        console.log(colorize(`\n✅ 완료!`, 'bright'));
        console.log(colorize(`\n다음 명령으로 검색 가능:`, 'cyan'));
        console.log(`  node scripts/search-wiki.js ${projectId} 고객`);
        console.log(`  node scripts/search-wiki.js ${projectId} --stats`);

    } catch (error) {
        console.error(colorize(`\n❌ 오류: ${error.message}`, 'red'));
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
