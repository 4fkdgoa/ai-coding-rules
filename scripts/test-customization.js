#!/usr/bin/env node
/**
 * 통합 테스트 툴 - 솔루션 vs 커스텀 프로젝트 비교
 *
 * 목적:
 * - 솔루션 원본과 커스텀 프로젝트의 차이점을 자동으로 분석
 * - 추가/제거/변경된 파일 및 기능 감지
 * - 회귀 테스트용 리포트 생성
 *
 * 사용법:
 *   node test-customization.js --solution <path> --custom <path> [--output report.md]
 *
 * @author AI Coding Rules Team
 * @date 2026-01-17
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// 색상 코드 (터미널 출력용)
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

/**
 * 텍스트에 색상 적용
 * @param {string} text - 출력할 텍스트
 * @param {string} color - 색상 이름 (colors 객체의 키)
 * @returns {string} 색상이 적용된 텍스트
 */
function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

/**
 * 섹션 헤더 출력
 * @param {string} text - 헤더 텍스트
 */
function printHeader(text) {
    console.log(colorize(`\n${'='.repeat(60)}`, 'cyan'));
    console.log(colorize(text, 'bright'));
    console.log(colorize('='.repeat(60), 'cyan'));
}

/**
 * 프로젝트 스캔 클래스
 *
 * 프로젝트 폴더를 재귀적으로 스캔하여 파일 목록과 메타데이터를 수집합니다.
 */
class ProjectScanner {
    /**
     * @param {string} projectPath - 스캔할 프로젝트 경로
     * @param {Object} options - 옵션
     * @param {string[]} options.exclude - 제외할 패턴 (정규표현식)
     */
    constructor(projectPath, options = {}) {
        this.projectPath = projectPath;
        this.exclude = options.exclude || [
            /node_modules/,
            /\.git/,
            /\.svn/,
            /target/,
            /build/,
            /dist/,
            /\.idea/,
            /\.vscode/
        ];
    }

    /**
     * 프로젝트 스캔 실행
     *
     * @returns {Object} 스캔 결과
     * @returns {string[]} files - 파일 목록
     * @returns {Object} fileMap - 파일 경로 → 메타데이터 맵
     */
    scan() {
        console.log(colorize(`  스캔 중: ${this.projectPath}`, 'cyan'));

        const files = [];
        const fileMap = new Map();

        this._scanDirectory(this.projectPath, '', files, fileMap);

        console.log(colorize(`  완료: ${files.length}개 파일 발견`, 'green'));

        return {
            files,
            fileMap
        };
    }

    /**
     * 디렉토리 재귀 스캔 (내부 메서드)
     *
     * @private
     * @param {string} fullPath - 전체 경로
     * @param {string} relativePath - 상대 경로
     * @param {string[]} files - 파일 목록 (누적)
     * @param {Map} fileMap - 파일 메타데이터 맵 (누적)
     */
    _scanDirectory(fullPath, relativePath, files, fileMap) {
        // 디렉토리 존재 여부 확인
        if (!fs.existsSync(fullPath)) {
            return;
        }

        // 디렉토리 내용 읽기
        const entries = fs.readdirSync(fullPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryRelPath = path.join(relativePath, entry.name);
            const entryFullPath = path.join(fullPath, entry.name);

            // 제외 패턴 확인
            if (this._shouldExclude(entryRelPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                // 재귀적으로 하위 디렉토리 스캔
                this._scanDirectory(entryFullPath, entryRelPath, files, fileMap);
            } else if (entry.isFile()) {
                // 파일 메타데이터 수집
                const stats = fs.statSync(entryFullPath);
                const metadata = {
                    path: entryRelPath,
                    fullPath: entryFullPath,
                    size: stats.size,
                    modified: stats.mtime,
                    hash: this._calculateFileHash(entryFullPath)
                };

                files.push(entryRelPath);
                fileMap.set(entryRelPath, metadata);
            }
        }
    }

    /**
     * 제외 패턴 확인
     *
     * @private
     * @param {string} filePath - 확인할 파일 경로
     * @returns {boolean} 제외 여부
     */
    _shouldExclude(filePath) {
        return this.exclude.some(pattern => pattern.test(filePath));
    }

    /**
     * 파일 해시 계산 (MD5)
     *
     * 파일 내용이 동일한지 빠르게 비교하기 위해 사용됩니다.
     *
     * @private
     * @param {string} filePath - 파일 경로
     * @returns {string} MD5 해시 (16진수 문자열)
     */
    _calculateFileHash(filePath) {
        try {
            const content = fs.readFileSync(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch (error) {
            // 읽기 실패 시 빈 문자열 반환
            return '';
        }
    }
}

/**
 * 프로젝트 비교 클래스
 *
 * 두 프로젝트를 비교하여 차이점을 분석합니다.
 */
class ProjectComparator {
    /**
     * @param {Object} solutionScan - 솔루션 프로젝트 스캔 결과
     * @param {Object} customScan - 커스텀 프로젝트 스캔 결과
     */
    constructor(solutionScan, customScan) {
        this.solutionScan = solutionScan;
        this.customScan = customScan;
    }

    /**
     * 비교 실행
     *
     * @returns {Object} 비교 결과
     * @returns {string[]} added - 추가된 파일 목록
     * @returns {string[]} removed - 제거된 파일 목록
     * @returns {string[]} modified - 변경된 파일 목록
     * @returns {string[]} unchanged - 변경되지 않은 파일 목록
     */
    compare() {
        printHeader('📊 프로젝트 비교 중...');

        const added = [];
        const removed = [];
        const modified = [];
        const unchanged = [];

        // 솔루션에 있는 파일 기준으로 비교
        for (const file of this.solutionScan.files) {
            if (!this.customScan.fileMap.has(file)) {
                // 커스텀에 없음 = 제거됨
                removed.push(file);
            } else {
                // 둘 다 존재 = 해시 비교
                const solutionHash = this.solutionScan.fileMap.get(file).hash;
                const customHash = this.customScan.fileMap.get(file).hash;

                if (solutionHash !== customHash) {
                    modified.push(file);
                } else {
                    unchanged.push(file);
                }
            }
        }

        // 커스텀에만 있는 파일 = 추가됨
        for (const file of this.customScan.files) {
            if (!this.solutionScan.fileMap.has(file)) {
                added.push(file);
            }
        }

        return { added, removed, modified, unchanged };
    }

    /**
     * 파일 유형별 그룹화
     *
     * @param {string[]} files - 파일 목록
     * @returns {Object} 유형별로 그룹화된 파일
     */
    groupByType(files) {
        const groups = {
            java: [],
            jsp: [],
            xml: [],
            sql: [],
            properties: [],
            other: []
        };

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();

            if (ext === '.java') {
                groups.java.push(file);
            } else if (ext === '.jsp') {
                groups.jsp.push(file);
            } else if (ext === '.xml') {
                groups.xml.push(file);
            } else if (ext === '.sql') {
                groups.sql.push(file);
            } else if (ext === '.properties') {
                groups.properties.push(file);
            } else {
                groups.other.push(file);
            }
        }

        return groups;
    }
}

/**
 * 리포트 생성 클래스
 *
 * 비교 결과를 Markdown 형식으로 출력합니다.
 */
class ReportGenerator {
    /**
     * @param {Object} comparison - 비교 결과
     * @param {string} solutionPath - 솔루션 프로젝트 경로
     * @param {string} customPath - 커스텀 프로젝트 경로
     */
    constructor(comparison, solutionPath, customPath) {
        this.comparison = comparison;
        this.solutionPath = solutionPath;
        this.customPath = customPath;
    }

    /**
     * 콘솔 출력
     */
    printToConsole() {
        printHeader('📋 비교 결과 요약');

        console.log(`솔루션: ${colorize(this.solutionPath, 'cyan')}`);
        console.log(`커스텀: ${colorize(this.customPath, 'yellow')}`);
        console.log('');

        console.log(`추가됨: ${colorize(this.comparison.added.length, 'green')}개`);
        console.log(`제거됨: ${colorize(this.comparison.removed.length, 'red')}개`);
        console.log(`변경됨: ${colorize(this.comparison.modified.length, 'yellow')}개`);
        console.log(`동일함: ${this.comparison.unchanged.length}개`);

        // 추가된 파일 (처음 10개만)
        if (this.comparison.added.length > 0) {
            printHeader('✅ 추가된 파일');
            this.comparison.added.slice(0, 10).forEach(f => {
                console.log(`  + ${colorize(f, 'green')}`);
            });
            if (this.comparison.added.length > 10) {
                console.log(colorize(`  ... 외 ${this.comparison.added.length - 10}개`, 'cyan'));
            }
        }

        // 제거된 파일 (처음 10개만)
        if (this.comparison.removed.length > 0) {
            printHeader('❌ 제거된 파일');
            this.comparison.removed.slice(0, 10).forEach(f => {
                console.log(`  - ${colorize(f, 'red')}`);
            });
            if (this.comparison.removed.length > 10) {
                console.log(colorize(`  ... 외 ${this.comparison.removed.length - 10}개`, 'cyan'));
            }
        }

        // 변경된 파일 (처음 10개만)
        if (this.comparison.modified.length > 0) {
            printHeader('🔄 변경된 파일');
            this.comparison.modified.slice(0, 10).forEach(f => {
                console.log(`  ~ ${colorize(f, 'yellow')}`);
            });
            if (this.comparison.modified.length > 10) {
                console.log(colorize(`  ... 외 ${this.comparison.modified.length - 10}개`, 'cyan'));
            }
        }
    }

    /**
     * Markdown 리포트 생성
     *
     * @param {string} outputPath - 출력 파일 경로
     */
    generateMarkdown(outputPath) {
        const lines = [];

        // 헤더
        lines.push('# 통합 테스트 리포트');
        lines.push('');
        lines.push(`**생성일**: ${new Date().toISOString()}`);
        lines.push('');

        // 프로젝트 정보
        lines.push('## 프로젝트 정보');
        lines.push('');
        lines.push('| 구분 | 경로 |');
        lines.push('|------|------|');
        lines.push(`| 솔루션 | \`${this.solutionPath}\` |`);
        lines.push(`| 커스텀 | \`${this.customPath}\` |`);
        lines.push('');

        // 요약
        lines.push('## 변경 요약');
        lines.push('');
        lines.push('| 항목 | 개수 |');
        lines.push('|------|------|');
        lines.push(`| 추가됨 | ${this.comparison.added.length} |`);
        lines.push(`| 제거됨 | ${this.comparison.removed.length} |`);
        lines.push(`| 변경됨 | ${this.comparison.modified.length} |`);
        lines.push(`| 동일함 | ${this.comparison.unchanged.length} |`);
        lines.push('');

        // 유형별 통계
        const comparator = new ProjectComparator(null, null);

        if (this.comparison.added.length > 0) {
            lines.push('## ✅ 추가된 파일');
            lines.push('');
            const groups = comparator.groupByType(this.comparison.added);

            for (const [type, files] of Object.entries(groups)) {
                if (files.length > 0) {
                    lines.push(`### ${type.toUpperCase()} (${files.length}개)`);
                    lines.push('');
                    files.forEach(f => lines.push(`- \`${f}\``));
                    lines.push('');
                }
            }
        }

        if (this.comparison.removed.length > 0) {
            lines.push('## ❌ 제거된 파일');
            lines.push('');
            const groups = comparator.groupByType(this.comparison.removed);

            for (const [type, files] of Object.entries(groups)) {
                if (files.length > 0) {
                    lines.push(`### ${type.toUpperCase()} (${files.length}개)`);
                    lines.push('');
                    files.forEach(f => lines.push(`- \`${f}\``));
                    lines.push('');
                }
            }
        }

        if (this.comparison.modified.length > 0) {
            lines.push('## 🔄 변경된 파일');
            lines.push('');
            const groups = comparator.groupByType(this.comparison.modified);

            for (const [type, files] of Object.entries(groups)) {
                if (files.length > 0) {
                    lines.push(`### ${type.toUpperCase()} (${files.length}개)`);
                    lines.push('');
                    files.forEach(f => lines.push(`- \`${f}\``));
                    lines.push('');
                }
            }
        }

        // 파일 저장
        fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
        console.log(colorize(`\n✅ 리포트 생성: ${outputPath}`, 'green'));
    }
}

/**
 * 메인 함수
 */
async function main() {
    const args = process.argv.slice(2);

    // 인자 파싱
    let solutionPath = null;
    let customPath = null;
    let outputPath = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--solution' || args[i] === '-s') {
            solutionPath = args[i + 1];
        } else if (args[i] === '--custom' || args[i] === '-c') {
            customPath = args[i + 1];
        } else if (args[i] === '--output' || args[i] === '-o') {
            outputPath = args[i + 1];
        } else if (args[i] === '--help' || args[i] === '-h') {
            printUsage();
            process.exit(0);
        }
    }

    // 필수 인자 확인
    if (!solutionPath || !customPath) {
        console.error(colorize('\n❌ 오류: --solution 및 --custom 인자가 필요합니다.', 'red'));
        printUsage();
        process.exit(1);
    }

    // 경로 존재 확인
    if (!fs.existsSync(solutionPath)) {
        console.error(colorize(`\n❌ 오류: 솔루션 경로를 찾을 수 없습니다: ${solutionPath}`, 'red'));
        process.exit(1);
    }

    if (!fs.existsSync(customPath)) {
        console.error(colorize(`\n❌ 오류: 커스텀 경로를 찾을 수 없습니다: ${customPath}`, 'red'));
        process.exit(1);
    }

    printHeader('🔍 통합 테스트 툴 - 프로젝트 비교');

    // 1. 프로젝트 스캔
    const solutionScanner = new ProjectScanner(solutionPath);
    const solutionScan = solutionScanner.scan();

    const customScanner = new ProjectScanner(customPath);
    const customScan = customScanner.scan();

    // 2. 비교
    const comparator = new ProjectComparator(solutionScan, customScan);
    const comparison = comparator.compare();

    // 3. 결과 출력
    const reporter = new ReportGenerator(comparison, solutionPath, customPath);
    reporter.printToConsole();

    // 4. Markdown 리포트 생성 (옵션)
    if (outputPath) {
        reporter.generateMarkdown(outputPath);
    }

    console.log(colorize('\n✅ 비교 완료!', 'bright'));
}

/**
 * 사용법 출력
 */
function printUsage() {
    console.log(`
${colorize('사용법:', 'bright')}

  node test-customization.js --solution <path> --custom <path> [--output <file>]

${colorize('필수 옵션:', 'bright')}
  --solution, -s <path>   솔루션 원본 프로젝트 경로
  --custom, -c <path>     커스텀 프로젝트 경로

${colorize('선택 옵션:', 'bright')}
  --output, -o <file>     Markdown 리포트 파일 경로
  --help, -h              도움말 표시

${colorize('예시:', 'bright')}
  node test-customization.js --solution ~/AutoCRM_Core3 --custom ~/AutoCRM_Samchully
  node test-customization.js -s ~/AutoCRM_Core3 -c ~/AutoCRM_Samchully -o report.md
    `);
}

// 실행
if (require.main === module) {
    main().catch(error => {
        console.error(colorize(`\n❌ 오류: ${error.message}`, 'red'));
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        process.exit(1);
    });
}

module.exports = { ProjectScanner, ProjectComparator, ReportGenerator };
