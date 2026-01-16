import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * 코드 차이 분석기
 * 수정된 파일의 실제 코드 변경 내용을 분석
 */
export class CodeDiffAnalyzer {
    constructor(basePath, customerPath) {
        this.basePath = path.resolve(basePath);
        this.customerPath = path.resolve(customerPath);
    }

    /**
     * 특정 파일의 diff 분석
     */
    analyzeFile(relativePath) {
        const baseFile = path.join(this.basePath, relativePath);
        const customerFile = path.join(this.customerPath, relativePath);

        if (!fs.existsSync(baseFile)) {
            return {
                type: 'added',
                file: relativePath,
                customerLines: this.countLines(customerFile)
            };
        }

        if (!fs.existsSync(customerFile)) {
            return {
                type: 'deleted',
                file: relativePath,
                baseLines: this.countLines(baseFile)
            };
        }

        // 실제 diff 계산
        const baseContent = fs.readFileSync(baseFile, 'utf8');
        const customerContent = fs.readFileSync(customerFile, 'utf8');

        const diff = this.calculateDiff(baseContent, customerContent);
        const changes = this.extractChanges(diff, relativePath);

        return {
            type: 'modified',
            file: relativePath,
            baseLines: this.countLines(baseFile),
            customerLines: this.countLines(customerFile),
            ...changes
        };
    }

    /**
     * 여러 파일 일괄 분석
     */
    analyzeFiles(files) {
        console.log(`📝 코드 차이 분석 중... (${files.length}개 파일)`);

        const results = files.map(file => this.analyzeFile(file));

        console.log('✓ 코드 차이 분석 완료');

        return {
            files: results,
            summary: this.summarizeChanges(results)
        };
    }

    /**
     * diff 계산 (간단한 라인 단위 비교)
     */
    calculateDiff(baseContent, customerContent) {
        const baseLines = baseContent.split('\n');
        const customerLines = customerContent.split('\n');

        const diff = {
            added: [],
            removed: [],
            unchanged: []
        };

        // 간단한 라인 비교 (실제로는 Myers diff 알고리즘 사용)
        const baseSet = new Set(baseLines);
        const customerSet = new Set(customerLines);

        customerLines.forEach((line, index) => {
            if (!baseSet.has(line)) {
                diff.added.push({ line: index + 1, content: line });
            }
        });

        baseLines.forEach((line, index) => {
            if (!customerSet.has(line)) {
                diff.removed.push({ line: index + 1, content: line });
            }
        });

        return diff;
    }

    /**
     * 변경 사항 추출 (의미 있는 변경만)
     */
    extractChanges(diff, filePath) {
        const ext = path.extname(filePath);

        // Java 파일 분석
        if (ext === '.java') {
            return this.extractJavaChanges(diff);
        }

        // JavaScript 파일 분석
        if (ext === '.js' || ext === '.jsx') {
            return this.extractJsChanges(diff);
        }

        // 설정 파일 분석
        if (ext === '.properties' || ext === '.yml' || ext === '.yaml') {
            return this.extractConfigChanges(diff);
        }

        // 기본 분석
        return {
            addedLines: diff.added.length,
            removedLines: diff.removed.length,
            changes: [...diff.added, ...diff.removed]
        };
    }

    /**
     * Java 코드 변경 분석
     */
    extractJavaChanges(diff) {
        const methods = {
            added: [],
            removed: [],
            modified: []
        };

        // 추가된 메서드 찾기
        diff.added.forEach(item => {
            const line = item.content.trim();

            // 메서드 시그니처 패턴
            if (line.match(/^\s*(public|private|protected).*\(.*\)\s*\{?\s*$/)) {
                const methodName = this.extractMethodName(line);
                if (methodName) {
                    methods.added.push(methodName);
                }
            }
        });

        // 제거된 메서드 찾기
        diff.removed.forEach(item => {
            const line = item.content.trim();

            if (line.match(/^\s*(public|private|protected).*\(.*\)\s*\{?\s*$/)) {
                const methodName = this.extractMethodName(line);
                if (methodName) {
                    methods.removed.push(methodName);
                }
            }
        });

        return {
            addedLines: diff.added.length,
            removedLines: diff.removed.length,
            methods: methods,
            hasNewMethods: methods.added.length > 0,
            hasRemovedMethods: methods.removed.length > 0
        };
    }

    /**
     * JavaScript 코드 변경 분석
     */
    extractJsChanges(diff) {
        const functions = {
            added: [],
            removed: []
        };

        // 함수 선언 패턴
        const functionPattern = /function\s+(\w+)\s*\(|(\w+)\s*[:=]\s*function|(\w+)\s*[:=]\s*\(/;

        diff.added.forEach(item => {
            const match = item.content.match(functionPattern);
            if (match) {
                const funcName = match[1] || match[2] || match[3];
                functions.added.push(funcName);
            }
        });

        diff.removed.forEach(item => {
            const match = item.content.match(functionPattern);
            if (match) {
                const funcName = match[1] || match[2] || match[3];
                functions.removed.push(funcName);
            }
        });

        return {
            addedLines: diff.added.length,
            removedLines: diff.removed.length,
            functions: functions
        };
    }

    /**
     * 설정 파일 변경 분석
     */
    extractConfigChanges(diff) {
        const configChanges = {
            added: [],
            removed: [],
            modified: []
        };

        // 설정 항목 패턴 (key=value 또는 key: value)
        const configPattern = /^([a-zA-Z0-9._-]+)\s*[:=]\s*(.+)$/;

        diff.added.forEach(item => {
            const match = item.content.match(configPattern);
            if (match) {
                configChanges.added.push({
                    key: match[1],
                    value: match[2].trim()
                });
            }
        });

        diff.removed.forEach(item => {
            const match = item.content.match(configPattern);
            if (match) {
                configChanges.removed.push({
                    key: match[1],
                    value: match[2].trim()
                });
            }
        });

        return {
            addedLines: diff.added.length,
            removedLines: diff.removed.length,
            configChanges: configChanges
        };
    }

    /**
     * 메서드명 추출
     */
    extractMethodName(line) {
        const match = line.match(/\s+(\w+)\s*\(/);
        return match ? match[1] : null;
    }

    /**
     * 파일 줄 수 계산
     */
    countLines(filePath) {
        if (!fs.existsSync(filePath)) {
            return 0;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').length;
    }

    /**
     * 변경 사항 요약
     */
    summarizeChanges(results) {
        const summary = {
            totalFiles: results.length,
            totalAddedLines: 0,
            totalRemovedLines: 0,
            filesWithNewMethods: 0,
            filesWithRemovedMethods: 0,
            configChangesCount: 0
        };

        results.forEach(result => {
            summary.totalAddedLines += result.addedLines || 0;
            summary.totalRemovedLines += result.removedLines || 0;

            if (result.hasNewMethods) {
                summary.filesWithNewMethods++;
            }

            if (result.hasRemovedMethods) {
                summary.filesWithRemovedMethods++;
            }

            if (result.configChanges) {
                summary.configChangesCount +=
                    result.configChanges.added.length +
                    result.configChanges.removed.length;
            }
        });

        return summary;
    }
}

// CLI 실행
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const basePath = process.argv[2];
    const customerPath = process.argv[3];
    const file = process.argv[4];

    if (!basePath || !customerPath) {
        console.error('Usage: node code-diff.js <base-path> <customer-path> [file]');
        process.exit(1);
    }

    const analyzer = new CodeDiffAnalyzer(basePath, customerPath);

    if (file) {
        const result = analyzer.analyzeFile(file);
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log('파일 경로를 지정하지 않으면 구조 분석기를 먼저 실행하세요.');
    }
}

export default CodeDiffAnalyzer;
