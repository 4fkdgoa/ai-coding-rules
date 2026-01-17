#!/usr/bin/env node
/**
 * 리팩토링 점검 도구 - 코드 품질 분석기
 *
 * 목적:
 * - 프로젝트의 코드 품질을 자동으로 분석
 * - 복잡도, 중복, 보안 취약점, 코드 스멜 감지
 * - HTML/Markdown 리포트 자동 생성
 *
 * 특징:
 * - 외부 도구 불필요 (SonarQube, PMD 등 없이 작동)
 * - JavaScript로 구현되어 Node.js만 있으면 실행 가능
 * - Java, JavaScript, JSP 파일 분석 지원
 *
 * 사용법:
 *   node check-quality.js <project-path> [--output report.html]
 *
 * @author AI Coding Rules Team
 * @date 2026-01-17
 */

const fs = require('fs');
const path = require('path');
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
 * @param {string} color - 색상 이름
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
 * 코드 스캐너 클래스
 *
 * 프로젝트를 스캔하여 분석 대상 파일을 수집합니다.
 */
class CodeScanner {
    /**
     * @param {string} projectPath - 스캔할 프로젝트 경로
     * @param {Object} options - 옵션
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
            /\.min\.js$/,
            /\.bundle\.js$/
        ];
        // 분석 대상 확장자
        this.extensions = ['.java', '.js', '.jsx', '.jsp', '.ts', '.tsx'];
    }

    /**
     * 프로젝트 스캔 실행
     *
     * @returns {Array} 파일 정보 배열
     */
    scan() {
        console.log(colorize(`  스캔 중: ${this.projectPath}`, 'cyan'));

        const files = [];
        this._scanDirectory(this.projectPath, '', files);

        console.log(colorize(`  완료: ${files.length}개 파일 발견`, 'green'));

        return files;
    }

    /**
     * 디렉토리 재귀 스캔 (내부 메서드)
     *
     * @private
     * @param {string} fullPath - 전체 경로
     * @param {string} relativePath - 상대 경로
     * @param {Array} files - 파일 배열 (누적)
     */
    _scanDirectory(fullPath, relativePath, files) {
        if (!fs.existsSync(fullPath)) {
            return;
        }

        const entries = fs.readdirSync(fullPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryRelPath = path.join(relativePath, entry.name);
            const entryFullPath = path.join(fullPath, entry.name);

            // 제외 패턴 확인
            if (this._shouldExclude(entryRelPath)) {
                continue;
            }

            if (entry.isDirectory()) {
                this._scanDirectory(entryFullPath, entryRelPath, files);
            } else if (entry.isFile()) {
                // 분석 대상 확장자 확인
                const ext = path.extname(entry.name);
                if (this.extensions.includes(ext)) {
                    const content = fs.readFileSync(entryFullPath, 'utf-8');
                    files.push({
                        path: entryRelPath,
                        fullPath: entryFullPath,
                        extension: ext,
                        content: content,
                        lines: content.split('\n')
                    });
                }
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
}

/**
 * 코드 분석기 클래스
 *
 * 코드 품질 관련 이슈를 분석합니다.
 */
class CodeAnalyzer {
    constructor() {
        // 이슈 저장소
        this.issues = [];
    }

    /**
     * 파일 분석 실행
     *
     * @param {Array} files - 파일 배열
     * @returns {Array} 발견된 이슈 배열
     */
    analyze(files) {
        printHeader('🔍 코드 분석 중...');

        for (const file of files) {
            // 1. 복잡도 분석
            this._analyzeComplexity(file);

            // 2. 보안 취약점 분석
            this._analyzeSecurity(file);

            // 3. 코드 스멜 분석
            this._analyzeCodeSmells(file);

            // 4. 하드코딩 감지
            this._analyzeHardcoding(file);
        }

        // 5. 중복 코드 분석 (전체 파일 대상)
        this._analyzeDuplicates(files);

        console.log(colorize(`  완료: ${this.issues.length}개 이슈 발견`, 'green'));

        return this.issues;
    }

    /**
     * 복잡도 분석
     *
     * McCabe Cyclomatic Complexity를 간단히 측정합니다.
     * if, else, for, while, case, catch, && , || 등의 개수를 세어 복잡도를 계산합니다.
     *
     * @private
     * @param {Object} file - 파일 정보
     */
    _analyzeComplexity(file) {
        const lines = file.lines;

        // 메서드/함수별 복잡도 계산
        let currentMethod = null;
        let braceDepth = 0;
        let complexity = 1; // 기본 복잡도 1

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 메서드 시작 감지 (간단한 패턴, Java/JavaScript)
            if (this._isMethodStart(line)) {
                currentMethod = {
                    name: this._extractMethodName(line),
                    startLine: i + 1,
                    complexity: 1
                };
                braceDepth = 0;
            }

            // 중괄호 추적
            if (line.includes('{')) braceDepth++;
            if (line.includes('}')) braceDepth--;

            // 복잡도 증가 키워드
            if (this._hasComplexityKeyword(line)) {
                complexity++;
                if (currentMethod) {
                    currentMethod.complexity++;
                }
            }

            // 메서드 끝 감지
            if (currentMethod && braceDepth === 0 && line.includes('}')) {
                // 복잡도가 10 이상이면 경고
                if (currentMethod.complexity >= 10) {
                    this.issues.push({
                        type: 'complexity',
                        severity: currentMethod.complexity >= 15 ? 'critical' : 'warning',
                        file: file.path,
                        line: currentMethod.startLine,
                        message: `메서드 '${currentMethod.name}'의 복잡도가 높습니다 (${currentMethod.complexity})`,
                        detail: '복잡도가 높은 메서드는 이해하기 어렵고 버그가 발생하기 쉽습니다. 메서드를 작은 단위로 분리하세요.'
                    });
                }
                currentMethod = null;
            }
        }
    }

    /**
     * 메서드 시작 여부 확인
     *
     * @private
     * @param {string} line - 코드 라인
     * @returns {boolean} 메서드 시작 여부
     */
    _isMethodStart(line) {
        // Java: public void methodName(
        // JavaScript: function methodName(
        // JavaScript: methodName(args) {
        return /\b(public|private|protected|static|function)\s+\w+.*\(/.test(line) ||
               /^\s*\w+\s*\([^)]*\)\s*\{/.test(line);
    }

    /**
     * 메서드 이름 추출
     *
     * @private
     * @param {string} line - 코드 라인
     * @returns {string} 메서드 이름
     */
    _extractMethodName(line) {
        const match = line.match(/\b(function\s+)?(\w+)\s*\(/);
        return match ? match[2] : 'unknown';
    }

    /**
     * 복잡도 증가 키워드 확인
     *
     * @private
     * @param {string} line - 코드 라인
     * @returns {boolean} 복잡도 증가 여부
     */
    _hasComplexityKeyword(line) {
        // 주석 제외
        if (line.startsWith('//') || line.startsWith('*')) {
            return false;
        }

        return /\b(if|else|for|while|case|catch)\b/.test(line) ||
               /&&|\|\|/.test(line);
    }

    /**
     * 보안 취약점 분석
     *
     * SQL Injection, XSS, 민감 정보 노출 등을 간단히 감지합니다.
     *
     * @private
     * @param {Object} file - 파일 정보
     */
    _analyzeSecurity(file) {
        const lines = file.lines;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // SQL Injection 패턴 (문자열 연결로 쿼리 생성)
            if (/["']\s*\+\s*\w+/.test(line) && /SELECT|INSERT|UPDATE|DELETE/i.test(line)) {
                this.issues.push({
                    type: 'security',
                    severity: 'critical',
                    file: file.path,
                    line: i + 1,
                    message: 'SQL Injection 취약점 가능성',
                    detail: '문자열 연결로 SQL 쿼리를 생성하면 SQL Injection 공격에 취약합니다. PreparedStatement를 사용하세요.'
                });
            }

            // innerHTML 사용 (XSS)
            if (/\.innerHTML\s*=/.test(line)) {
                this.issues.push({
                    type: 'security',
                    severity: 'warning',
                    file: file.path,
                    line: i + 1,
                    message: 'XSS 취약점 가능성',
                    detail: 'innerHTML은 XSS 공격에 취약합니다. textContent를 사용하거나 입력값을 sanitize하세요.'
                });
            }

            // eval 사용
            if (/\beval\s*\(/.test(line)) {
                this.issues.push({
                    type: 'security',
                    severity: 'critical',
                    file: file.path,
                    line: i + 1,
                    message: 'eval() 사용 금지',
                    detail: 'eval()은 심각한 보안 취약점입니다. 다른 방법을 사용하세요.'
                });
            }
        }
    }

    /**
     * 코드 스멜 분석
     *
     * Long Method, Large Class 등을 감지합니다.
     *
     * @private
     * @param {Object} file - 파일 정보
     */
    _analyzeCodeSmells(file) {
        const lines = file.lines;

        // Long Method (100줄 이상)
        let methodStartLine = null;
        let braceDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (this._isMethodStart(line)) {
                methodStartLine = i;
                braceDepth = 0;
            }

            if (line.includes('{')) braceDepth++;
            if (line.includes('}')) braceDepth--;

            if (methodStartLine !== null && braceDepth === 0 && line.includes('}')) {
                const methodLength = i - methodStartLine;
                if (methodLength > 100) {
                    this.issues.push({
                        type: 'code_smell',
                        severity: 'warning',
                        file: file.path,
                        line: methodStartLine + 1,
                        message: `메서드가 너무 깁니다 (${methodLength}줄)`,
                        detail: '긴 메서드는 이해하기 어렵습니다. 작은 메서드로 분리하세요.'
                    });
                }
                methodStartLine = null;
            }
        }

        // Large Class (500줄 이상)
        const totalLines = lines.filter(line => line.trim().length > 0).length;
        if (totalLines > 500) {
            this.issues.push({
                type: 'code_smell',
                severity: 'info',
                file: file.path,
                line: 1,
                message: `클래스가 너무 큽니다 (${totalLines}줄)`,
                detail: '큰 클래스는 여러 책임을 가지고 있을 가능성이 높습니다. 클래스를 분리하세요.'
            });
        }
    }

    /**
     * 하드코딩 감지
     *
     * 비밀번호, API 키 등의 하드코딩을 감지합니다.
     *
     * @private
     * @param {Object} file - 파일 정보
     */
    _analyzeHardcoding(file) {
        const lines = file.lines;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 비밀번호 하드코딩
            if (/password\s*=\s*["'][^"']{3,}["']/i.test(line) && !/123|test|demo/i.test(line)) {
                this.issues.push({
                    type: 'hardcoding',
                    severity: 'critical',
                    file: file.path,
                    line: i + 1,
                    message: '비밀번호가 하드코딩되어 있습니다',
                    detail: '비밀번호는 환경변수나 설정 파일에 저장하세요.'
                });
            }

            // API 키 패턴 (예: sk_live_..., AKIA...)
            if (/['"]?(sk_live_|sk_test_|AKIA)[A-Za-z0-9]{20,}['"]?/.test(line)) {
                this.issues.push({
                    type: 'hardcoding',
                    severity: 'critical',
                    file: file.path,
                    line: i + 1,
                    message: 'API 키가 하드코딩되어 있습니다',
                    detail: 'API 키는 환경변수나 시크릿 관리 시스템에 저장하세요.'
                });
            }
        }
    }

    /**
     * 중복 코드 분석
     *
     * 동일한 코드 블록이 여러 곳에 있는지 감지합니다.
     * 간단한 해시 기반 비교를 사용합니다.
     *
     * @private
     * @param {Array} files - 파일 배열
     */
    _analyzeDuplicates(files) {
        const blockSize = 6; // 6줄 단위로 비교
        const blockMap = new Map();

        for (const file of files) {
            const lines = file.lines;

            // 6줄씩 슬라이딩 윈도우로 해시 생성
            for (let i = 0; i <= lines.length - blockSize; i++) {
                const block = lines.slice(i, i + blockSize)
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('*'))
                    .join('\n');

                // 의미 있는 코드 블록만 (공백 제외 3줄 이상)
                if (block.split('\n').length < 3) {
                    continue;
                }

                const hash = crypto.createHash('md5').update(block).digest('hex');

                if (!blockMap.has(hash)) {
                    blockMap.set(hash, []);
                }

                blockMap.get(hash).push({
                    file: file.path,
                    line: i + 1
                });
            }
        }

        // 중복 발견 (2곳 이상에서 발견된 경우)
        for (const [hash, locations] of blockMap.entries()) {
            if (locations.length >= 2) {
                // 같은 파일 내 중복은 제외 (반복문 등)
                const uniqueFiles = new Set(locations.map(loc => loc.file));
                if (uniqueFiles.size >= 2) {
                    const firstLoc = locations[0];
                    this.issues.push({
                        type: 'duplicate',
                        severity: 'info',
                        file: firstLoc.file,
                        line: firstLoc.line,
                        message: `중복 코드가 ${locations.length}곳에서 발견되었습니다`,
                        detail: `동일한 코드: ${locations.map(loc => `${loc.file}:${loc.line}`).join(', ')}`
                    });
                }
            }
        }
    }
}

/**
 * 리포트 생성 클래스
 *
 * 분석 결과를 콘솔 및 파일로 출력합니다.
 */
class ReportGenerator {
    /**
     * @param {Array} issues - 이슈 배열
     * @param {string} projectPath - 프로젝트 경로
     */
    constructor(issues, projectPath) {
        this.issues = issues;
        this.projectPath = projectPath;
    }

    /**
     * 콘솔 출력
     */
    printToConsole() {
        printHeader('📋 분석 결과 요약');

        const stats = this._getStats();

        console.log(`프로젝트: ${colorize(this.projectPath, 'cyan')}`);
        console.log('');
        console.log(`🔴 Critical: ${colorize(stats.critical, 'red')}개`);
        console.log(`⚠️  Warning: ${colorize(stats.warning, 'yellow')}개`);
        console.log(`ℹ️  Info: ${colorize(stats.info, 'cyan')}개`);
        console.log('');
        console.log(`총 이슈: ${stats.total}개`);

        // 심각도별 상위 이슈 출력
        this._printTopIssues('critical', 5);
        this._printTopIssues('warning', 5);
    }

    /**
     * 통계 계산
     *
     * @private
     * @returns {Object} 통계 객체
     */
    _getStats() {
        const stats = {
            critical: 0,
            warning: 0,
            info: 0,
            total: this.issues.length
        };

        for (const issue of this.issues) {
            stats[issue.severity]++;
        }

        return stats;
    }

    /**
     * 상위 이슈 출력
     *
     * @private
     * @param {string} severity - 심각도
     * @param {number} limit - 출력 개수
     */
    _printTopIssues(severity, limit) {
        const filtered = this.issues.filter(issue => issue.severity === severity);

        if (filtered.length === 0) {
            return;
        }

        const icon = severity === 'critical' ? '🔴' : '⚠️';
        const color = severity === 'critical' ? 'red' : 'yellow';

        printHeader(`${icon} ${severity.toUpperCase()} 이슈`);

        filtered.slice(0, limit).forEach(issue => {
            console.log(colorize(`  ${issue.file}:${issue.line}`, color));
            console.log(`  ${issue.message}`);
            console.log(`  ${issue.detail}`);
            console.log('');
        });

        if (filtered.length > limit) {
            console.log(colorize(`  ... 외 ${filtered.length - limit}개`, 'cyan'));
        }
    }

    /**
     * HTML 리포트 생성
     *
     * @param {string} outputPath - 출력 파일 경로
     */
    generateHTML(outputPath) {
        const stats = this._getStats();

        const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>코드 품질 리포트</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-box { flex: 1; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-box.critical { background: #f44336; color: white; }
        .stat-box.warning { background: #ff9800; color: white; }
        .stat-box.info { background: #2196F3; color: white; }
        .stat-number { font-size: 48px; font-weight: bold; }
        .stat-label { font-size: 14px; margin-top: 5px; }
        .issue { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #ddd; border-radius: 4px; }
        .issue.critical { border-left-color: #f44336; }
        .issue.warning { border-left-color: #ff9800; }
        .issue.info { border-left-color: #2196F3; }
        .issue-header { font-weight: bold; color: #333; margin-bottom: 5px; }
        .issue-location { color: #666; font-size: 12px; margin-bottom: 5px; }
        .issue-detail { color: #555; font-size: 14px; }
        .severity-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; margin-right: 5px; }
        .severity-badge.critical { background: #f44336; color: white; }
        .severity-badge.warning { background: #ff9800; color: white; }
        .severity-badge.info { background: #2196F3; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 코드 품질 리포트</h1>
        <p><strong>프로젝트:</strong> ${this.projectPath}</p>
        <p><strong>생성일:</strong> ${new Date().toLocaleString('ko-KR')}</p>

        <div class="stats">
            <div class="stat-box critical">
                <div class="stat-number">${stats.critical}</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-box warning">
                <div class="stat-number">${stats.warning}</div>
                <div class="stat-label">Warning</div>
            </div>
            <div class="stat-box info">
                <div class="stat-number">${stats.info}</div>
                <div class="stat-label">Info</div>
            </div>
        </div>

        <h2>🔍 발견된 이슈</h2>
        ${this._generateIssueHTML()}
    </div>
</body>
</html>
        `;

        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(colorize(`\n✅ HTML 리포트 생성: ${outputPath}`, 'green'));
    }

    /**
     * 이슈 HTML 생성
     *
     * @private
     * @returns {string} HTML 문자열
     */
    _generateIssueHTML() {
        if (this.issues.length === 0) {
            return '<p>이슈가 발견되지 않았습니다. 👍</p>';
        }

        // 심각도순 정렬
        const sortedIssues = [...this.issues].sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        return sortedIssues.map(issue => `
            <div class="issue ${issue.severity}">
                <div class="issue-header">
                    <span class="severity-badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
                    ${issue.message}
                </div>
                <div class="issue-location">📁 ${issue.file}:${issue.line}</div>
                <div class="issue-detail">${issue.detail}</div>
            </div>
        `).join('');
    }
}

/**
 * 메인 함수
 */
async function main() {
    const args = process.argv.slice(2);

    // 인자 파싱
    let projectPath = args[0];
    let outputPath = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--output' || args[i] === '-o') {
            outputPath = args[i + 1];
        } else if (args[i] === '--help' || args[i] === '-h') {
            printUsage();
            process.exit(0);
        }
    }

    // 필수 인자 확인
    if (!projectPath) {
        console.error(colorize('\n❌ 오류: 프로젝트 경로가 필요합니다.', 'red'));
        printUsage();
        process.exit(1);
    }

    // 경로 존재 확인
    if (!fs.existsSync(projectPath)) {
        console.error(colorize(`\n❌ 오류: 프로젝트 경로를 찾을 수 없습니다: ${projectPath}`, 'red'));
        process.exit(1);
    }

    printHeader('🔍 리팩토링 점검 도구 - 코드 품질 분석');

    // 1. 프로젝트 스캔
    const scanner = new CodeScanner(projectPath);
    const files = scanner.scan();

    if (files.length === 0) {
        console.log(colorize('\n⚠️  분석 대상 파일이 없습니다.', 'yellow'));
        process.exit(0);
    }

    // 2. 코드 분석
    const analyzer = new CodeAnalyzer();
    const issues = analyzer.analyze(files);

    // 3. 결과 출력
    const reporter = new ReportGenerator(issues, projectPath);
    reporter.printToConsole();

    // 4. HTML 리포트 생성 (옵션)
    if (outputPath) {
        reporter.generateHTML(outputPath);
    }

    console.log(colorize('\n✅ 분석 완료!', 'bright'));
}

/**
 * 사용법 출력
 */
function printUsage() {
    console.log(`
${colorize('사용법:', 'bright')}

  node check-quality.js <project-path> [--output <file>]

${colorize('필수 인자:', 'bright')}
  <project-path>          분석할 프로젝트 경로

${colorize('선택 옵션:', 'bright')}
  --output, -o <file>     HTML 리포트 파일 경로
  --help, -h              도움말 표시

${colorize('예시:', 'bright')}
  node check-quality.js ~/AutoCRM_Samchully
  node check-quality.js ~/AutoCRM_Samchully -o quality-report.html
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

module.exports = { CodeScanner, CodeAnalyzer, ReportGenerator };
