import fs from 'fs';
import path from 'path';

/**
 * 코딩 스타일 분석기
 * 들여쓰기, 줄 길이, 따옴표, 세미콜론 등 분석
 */
export class CodingStyleAnalyzer {
    constructor(files, projectPath) {
        this.files = files;
        this.projectPath = projectPath;

        // 분석 대상 확장자
        this.targetExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

        // 통계
        this.indentStats = {
            spaces: 0,
            tabs: 0,
            spaceCount: {}  // 2: 5개, 4: 10개
        };

        this.lineLengths = [];
        this.quoteStats = {
            single: 0,
            double: 0,
            backtick: 0
        };

        this.semicolonStats = {
            withSemicolon: 0,
            withoutSemicolon: 0
        };

        this.braceStyles = {
            sameLine: 0,    // K&R: function() {
            nextLine: 0     // Allman: function()\n{
        };
    }

    /**
     * 분석 실행
     */
    analyze() {
        console.log('🎨 코딩 스타일 분석 중...');

        const targetFiles = this.files.filter(f =>
            this.targetExtensions.includes(f.ext)
        );

        console.log(`  분석 대상: ${targetFiles.length}개 파일`);

        targetFiles.forEach(file => {
            this.analyzeFile(file);
        });

        const result = {
            indentation: this.getIndentationSummary(),
            lineLength: this.getLineLengthSummary(),
            quotes: this.getQuoteSummary(),
            semicolons: this.getSemicolonSummary(),
            braceStyle: this.getBraceStyleSummary()
        };

        console.log('✓ 코딩 스타일 분석 완료');

        return result;
    }

    /**
     * 파일 분석
     */
    analyzeFile(file) {
        const fullPath = path.join(this.projectPath, file.path);

        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                this.analyzeLine(line, content, index);
            });

        } catch (error) {
            // 읽을 수 없는 파일은 무시
        }
    }

    /**
     * 라인 분석
     */
    analyzeLine(line, fullContent, lineIndex) {
        // 1. 들여쓰기 분석
        if (line.length > 0 && /^\s/.test(line)) {
            const indent = line.match(/^(\s+)/)[1];

            if (indent.includes('\t')) {
                this.indentStats.tabs++;
            } else {
                this.indentStats.spaces++;
                const spaceCount = indent.length;

                // 4 또는 2 공백인 경우만 카운트
                if (spaceCount % 2 === 0 && spaceCount <= 8) {
                    const unit = this.detectIndentUnit(spaceCount);
                    this.indentStats.spaceCount[unit] =
                        (this.indentStats.spaceCount[unit] || 0) + 1;
                }
            }
        }

        // 2. 줄 길이
        if (line.trim().length > 0) {  // 빈 줄 제외
            this.lineLengths.push(line.length);
        }

        // 3. 따옴표 분석
        const singleQuotes = (line.match(/'/g) || []).length;
        const doubleQuotes = (line.match(/"/g) || []).length;
        const backticks = (line.match(/`/g) || []).length;

        this.quoteStats.single += singleQuotes;
        this.quoteStats.double += doubleQuotes;
        this.quoteStats.backtick += backticks;

        // 4. 세미콜론 분석 (문장 끝)
        const trimmed = line.trim();
        if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
            // 함수/조건문 등을 제외한 일반 문장
            if (/^(const|let|var|return|import|export|throw)/.test(trimmed)) {
                if (trimmed.endsWith(';')) {
                    this.semicolonStats.withSemicolon++;
                } else if (trimmed.endsWith('}') || trimmed.endsWith(',')) {
                    // 중괄호나 쉼표로 끝나면 카운트 제외
                } else {
                    this.semicolonStats.withoutSemicolon++;
                }
            }
        }

        // 5. 중괄호 스타일 (함수 선언 감지)
        if (/function\s*\w*\s*\([^)]*\)\s*\{/.test(line)) {
            this.braceStyles.sameLine++;
        } else if (/function\s*\w*\s*\([^)]*\)\s*$/.test(line)) {
            // 다음 줄이 { 로 시작하는지 확인 필요
            const nextLine = fullContent.split('\n')[lineIndex + 1];
            if (nextLine && nextLine.trim().startsWith('{')) {
                this.braceStyles.nextLine++;
            }
        }
    }

    /**
     * 들여쓰기 단위 감지
     */
    detectIndentUnit(spaceCount) {
        if (spaceCount === 2) return 2;
        if (spaceCount === 4) return 4;
        if (spaceCount % 4 === 0) return 4;
        if (spaceCount % 2 === 0) return 2;
        return spaceCount;
    }

    /**
     * 들여쓰기 요약
     */
    getIndentationSummary() {
        const total = this.indentStats.spaces + this.indentStats.tabs;

        if (total === 0) {
            return {
                type: 'unknown',
                confidence: 0
            };
        }

        // 탭 vs 공백
        const usesTabs = this.indentStats.tabs > this.indentStats.spaces;

        if (usesTabs) {
            return {
                type: 'tabs',
                confidence: Math.round(this.indentStats.tabs / total * 100)
            };
        }

        // 공백인 경우 몇 칸?
        const spaceCounts = Object.entries(this.indentStats.spaceCount)
            .sort((a, b) => b[1] - a[1]);

        if (spaceCounts.length > 0) {
            const dominant = spaceCounts[0];
            return {
                type: 'spaces',
                count: parseInt(dominant[0]),
                confidence: Math.round(
                    dominant[1] / this.indentStats.spaces * 100
                )
            };
        }

        return {
            type: 'spaces',
            count: 4,  // 기본값
            confidence: 0
        };
    }

    /**
     * 줄 길이 요약
     */
    getLineLengthSummary() {
        if (this.lineLengths.length === 0) {
            return {
                avg: 0,
                max: 0,
                recommended: 120
            };
        }

        const sorted = this.lineLengths.slice().sort((a, b) => a - b);
        const avg = Math.round(
            this.lineLengths.reduce((sum, len) => sum + len, 0) / this.lineLengths.length
        );
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const max = sorted[sorted.length - 1];

        // 권장 길이 추정 (P95 기준)
        let recommended = 120;
        if (p95 < 80) recommended = 80;
        else if (p95 < 100) recommended = 100;
        else if (p95 < 120) recommended = 120;
        else recommended = 150;

        return {
            avg,
            median,
            p95,
            max,
            recommended,
            distribution: {
                under80: sorted.filter(l => l <= 80).length,
                under120: sorted.filter(l => l <= 120).length,
                over120: sorted.filter(l => l > 120).length
            }
        };
    }

    /**
     * 따옴표 요약
     */
    getQuoteSummary() {
        const total =
            this.quoteStats.single +
            this.quoteStats.double +
            this.quoteStats.backtick;

        if (total === 0) {
            return {
                preferred: 'single',
                confidence: 0
            };
        }

        const percentages = {
            single: Math.round(this.quoteStats.single / total * 100),
            double: Math.round(this.quoteStats.double / total * 100),
            backtick: Math.round(this.quoteStats.backtick / total * 100)
        };

        const preferred = Object.entries(percentages)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            preferred: preferred[0],
            confidence: preferred[1],
            distribution: percentages
        };
    }

    /**
     * 세미콜론 요약
     */
    getSemicolonSummary() {
        const total =
            this.semicolonStats.withSemicolon +
            this.semicolonStats.withoutSemicolon;

        if (total === 0) {
            return {
                usage: 'unknown',
                confidence: 0
            };
        }

        const withPercentage = Math.round(
            this.semicolonStats.withSemicolon / total * 100
        );

        return {
            usage: withPercentage > 50 ? 'required' : 'optional',
            confidence: Math.max(withPercentage, 100 - withPercentage),
            withSemicolon: this.semicolonStats.withSemicolon,
            withoutSemicolon: this.semicolonStats.withoutSemicolon
        };
    }

    /**
     * 중괄호 스타일 요약
     */
    getBraceStyleSummary() {
        const total = this.braceStyles.sameLine + this.braceStyles.nextLine;

        if (total === 0) {
            return {
                style: 'K&R',  // 기본값
                confidence: 0
            };
        }

        const sameLinePercentage = Math.round(
            this.braceStyles.sameLine / total * 100
        );

        return {
            style: sameLinePercentage > 50 ? 'K&R' : 'Allman',
            confidence: Math.max(sameLinePercentage, 100 - sameLinePercentage),
            description: sameLinePercentage > 50
                ? 'Same line (K&R): function() {'
                : 'Next line (Allman): function()\\n{'
        };
    }
}

export default CodingStyleAnalyzer;
