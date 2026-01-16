#!/usr/bin/env node

import { FileStructureAnalyzer } from './analyzers/file-structure-analyzer.js';
import { CodingStyleAnalyzer } from './analyzers/coding-style-analyzer.js';
import { NamingConventionAnalyzer } from './analyzers/naming-convention-analyzer.js';
import { TechStackDetector } from './analyzers/tech-stack-detector.js';
import fs from 'fs';
import path from 'path';

/**
 * 컨벤션 자동 추출 도구
 *
 * 사용법:
 *   node extract-conventions.js [project-path] [output-file]
 *   node extract-conventions.js ../..  (현재 레포 분석)
 */
class ConventionExtractor {
    constructor(projectPath, outputPath = './EXTRACTED_CONVENTIONS.md') {
        this.projectPath = path.resolve(projectPath);
        this.outputPath = path.resolve(outputPath);
    }

    /**
     * 경로 검증
     */
    validatePath() {
        // 경로 존재 확인
        if (!fs.existsSync(this.projectPath)) {
            throw new Error(`프로젝트 경로를 찾을 수 없습니다: ${this.projectPath}`);
        }

        // 디렉토리 확인
        const stats = fs.statSync(this.projectPath);
        if (!stats.isDirectory()) {
            throw new Error(`프로젝트 경로가 디렉토리가 아닙니다: ${this.projectPath}`);
        }

        // 파일 개수 확인
        const fileCount = this.countAnalyzableFiles();
        if (fileCount === 0) {
            throw new Error(
                `분석할 파일이 없습니다: ${this.projectPath}\n` +
                `  지원 확장자: .js, .ts, .jsx, .tsx, .java, .py, .go, .rs`
            );
        }

        console.log(`✓ 경로 검증 완료 (분석 대상: ${fileCount}개 파일)`);
        return fileCount;
    }

    /**
     * 분석 가능한 파일 개수 세기
     */
    countAnalyzableFiles() {
        const supportedExts = ['.js', '.ts', '.jsx', '.tsx', '.java', '.py', '.go', '.rs'];
        let count = 0;

        const scanDir = (dir) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);

                    // 제외 디렉토리
                    if (entry.name === 'node_modules' ||
                        entry.name === '.git' ||
                        entry.name === 'dist' ||
                        entry.name === 'build' ||
                        entry.name === 'coverage' ||
                        entry.name === '__pycache__') {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        scanDir(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (supportedExts.includes(ext)) {
                            count++;
                        }
                    }
                }
            } catch (err) {
                // 권한 없는 디렉토리는 건너뛰기
            }
        };

        scanDir(this.projectPath);
        return count;
    }

    /**
     * 전체 분석 실행
     */
    async extract() {
        console.log('='.repeat(80));
        console.log('🔍 컨벤션 자동 추출 도구');
        console.log('='.repeat(80));
        console.log(`프로젝트: ${this.projectPath}`);
        console.log('');

        // 경로 검증
        const fileCount = this.validatePath();
        console.log('');

        const startTime = Date.now();

        // 1. 파일 구조 분석
        console.log('[ 1/4 ] 파일 구조 분석...');
        const structureAnalyzer = new FileStructureAnalyzer(this.projectPath);
        const structure = structureAnalyzer.analyze();
        console.log('');

        // 2. 코딩 스타일 분석
        console.log('[ 2/4 ] 코딩 스타일 분석...');
        const styleAnalyzer = new CodingStyleAnalyzer(
            structureAnalyzer.files,
            this.projectPath
        );
        const style = styleAnalyzer.analyze();
        console.log('');

        // 3. 네이밍 컨벤션 분석
        console.log('[ 3/4 ] 네이밍 컨벤션 분석...');
        const namingAnalyzer = new NamingConventionAnalyzer(
            structureAnalyzer.files,
            this.projectPath
        );
        const naming = namingAnalyzer.analyze();
        console.log('');

        // 4. 기술 스택 분석
        console.log('[ 4/4 ] 기술 스택 분석...');
        const techDetector = new TechStackDetector(this.projectPath);
        const techStack = techDetector.analyze();
        console.log('');

        // 결과 통합
        const result = {
            metadata: {
                projectPath: this.projectPath,
                analyzedAt: new Date().toISOString(),
                executionTime: `${Date.now() - startTime}ms`
            },
            structure,
            style,
            naming,
            techStack
        };

        // 문서 생성
        this.generateMarkdown(result);

        // JSON 저장
        this.saveJson(result);

        // 요약 출력
        this.printSummary(result);

        return result;
    }

    /**
     * Markdown 문서 생성
     */
    generateMarkdown(data) {
        let md = `# 프로젝트 코딩 컨벤션\n\n`;
        md += `> 자동 생성됨: ${new Date(data.metadata.analyzedAt).toLocaleString()}\n`;
        md += `> 프로젝트: \`${path.basename(this.projectPath)}\`\n\n`;

        md += `---\n\n`;

        // 기술 스택
        if (data.techStack.hasPackageJson) {
            md += `## 🔧 기술 스택\n\n`;
            md += `- **언어**: ${data.techStack.techStack.language}\n`;
            md += `- **런타임**: ${data.techStack.techStack.runtime}\n`;

            if (data.techStack.techStack.frameworks.length > 0) {
                md += `- **프레임워크**: ${data.techStack.techStack.frameworks.join(', ')}\n`;
            }

            if (data.techStack.techStack.testing.length > 0) {
                md += `- **테스트**: ${data.techStack.techStack.testing.join(', ')}\n`;
            }

            md += `- **프로젝트 타입**: ${data.techStack.techStack.type}\n\n`;
        }

        // 파일 구조
        md += `## 📁 파일 구조\n\n`;
        md += `- **총 파일**: ${data.structure.summary.totalFiles}개\n`;
        md += `- **총 디렉토리**: ${data.structure.summary.totalDirectories}개\n`;
        md += `- **평균 깊이**: ${data.structure.summary.avgDepth}레벨\n\n`;

        md += `### 파일명 컨벤션\n\n`;
        const fileNaming = data.structure.commonPatterns.find(p => p.type === 'fileNaming');
        if (fileNaming) {
            md += `- **패턴**: ${fileNaming.description}\n`;
            md += `- **사용률**: ${fileNaming.percentage}%\n\n`;
        }

        md += `### 주요 파일 타입\n\n`;
        const extensions = data.structure.commonPatterns.find(p => p.type === 'extensions');
        if (extensions) {
            md += `| 확장자 | 개수 | 비율 |\n`;
            md += `|--------|------|------|\n`;
            extensions.items.forEach(item => {
                md += `| \`${item.ext}\` | ${item.count} | ${item.percentage}% |\n`;
            });
            md += `\n`;
        }

        // 코딩 스타일
        md += `## 🎨 코딩 스타일\n\n`;

        md += `### 들여쓰기\n\n`;
        if (data.style.indentation.type === 'tabs') {
            md += `- **타입**: 탭 (Tab)\n`;
        } else if (data.style.indentation.type === 'spaces') {
            md += `- **타입**: 공백 ${data.style.indentation.count}칸\n`;
        } else {
            md += `- **타입**: 감지 실패\n`;
        }
        md += `- **신뢰도**: ${data.style.indentation.confidence}%\n\n`;

        md += `### 줄 길이\n\n`;
        md += `- **평균**: ${data.style.lineLength.avg}자\n`;
        md += `- **중간값**: ${data.style.lineLength.median}자\n`;
        md += `- **95 백분위**: ${data.style.lineLength.p95}자\n`;
        md += `- **권장**: ${data.style.lineLength.recommended}자 이하\n\n`;

        md += `### 따옴표\n\n`;
        const quoteMap = {
            single: "작은따옴표 (')",
            double: '큰따옴표 (")',
            backtick: '백틱 (`)'
        };
        md += `- **선호**: ${quoteMap[data.style.quotes.preferred]}\n`;
        md += `- **신뢰도**: ${data.style.quotes.confidence}%\n\n`;

        md += `### 세미콜론\n\n`;
        md += `- **사용**: ${data.style.semicolons.usage === 'required' ? '필수 사용' : '선택 사용'}\n`;
        md += `- **신뢰도**: ${data.style.semicolons.confidence}%\n\n`;

        // 네이밍 컨벤션
        md += `## 📝 네이밍 컨벤션\n\n`;

        md += `### 함수/메서드\n\n`;
        md += `- **패턴**: ${data.naming.functions.pattern}\n`;
        md += `- **신뢰도**: ${data.naming.functions.confidence}%\n`;
        if (data.naming.functions.examples && data.naming.functions.examples.length > 0) {
            md += `- **예시**: \`${data.naming.functions.examples.slice(0, 5).join('`, `')}\`\n`;
        }
        md += `\n`;

        // 함수 접두사 패턴
        if (data.naming.commonPatterns && data.naming.commonPatterns.length > 0) {
            const prefixPattern = data.naming.commonPatterns.find(p => p.type === 'functionPrefixes');
            if (prefixPattern && prefixPattern.items.length > 0) {
                md += `### 함수명 접두사 패턴\n\n`;
                prefixPattern.items.forEach(item => {
                    md += `- \`${item.prefix}*\`: ${item.count}개\n`;
                });
                md += `\n`;
            }
        }

        md += `### 변수\n\n`;
        md += `- **패턴**: ${data.naming.variables.pattern}\n`;
        md += `- **신뢰도**: ${data.naming.variables.confidence}%\n\n`;

        if (data.naming.constants.count > 0) {
            md += `### 상수\n\n`;
            md += `- **패턴**: ${data.naming.constants.pattern}\n`;
            md += `- **개수**: ${data.naming.constants.count}개\n`;
            if (data.naming.constants.examples && data.naming.constants.examples.length > 0) {
                md += `- **예시**: \`${data.naming.constants.examples.slice(0, 5).join('`, `')}\`\n`;
            }
            md += `\n`;
        }

        if (data.naming.classes.count > 0) {
            md += `### 클래스\n\n`;
            md += `- **패턴**: ${data.naming.classes.pattern}\n`;
            md += `- **개수**: ${data.naming.classes.count}개\n`;
            if (data.naming.classes.examples && data.naming.classes.examples.length > 0) {
                md += `- **예시**: \`${data.naming.classes.examples.slice(0, 5).join('`, `')}\`\n`;
            }
            md += `\n`;
        }

        // 추천 규칙
        md += `---\n\n`;
        md += `## 📋 권장 코딩 규칙 (추출 결과 기반)\n\n`;
        md += this.generateRecommendations(data);

        // 푸터
        md += `---\n\n`;
        md += `**생성 도구**: Convention Extractor v1.0\n`;
        md += `**분석 시간**: ${data.metadata.executionTime}\n`;

        // 저장
        fs.writeFileSync(this.outputPath, md);
        console.log(`✓ Markdown 문서 생성: ${this.outputPath}`);
    }

    /**
     * 권장 규칙 생성
     */
    generateRecommendations(data) {
        let rec = '';

        rec += `### 일반 규칙\n\n`;

        // 들여쓰기
        if (data.style.indentation.type === 'spaces') {
            rec += `- **들여쓰기**: 공백 ${data.style.indentation.count}칸 사용\n`;
        } else if (data.style.indentation.type === 'tabs') {
            rec += `- **들여쓰기**: 탭(Tab) 사용\n`;
        }

        // 줄 길이
        rec += `- **줄 길이**: ${data.style.lineLength.recommended}자 이하 권장\n`;

        // 따옴표
        const quoteMap = {
            single: "작은따옴표 (')",
            double: '큰따옴표 (")',
            backtick: '백틱 (`)'
        };
        rec += `- **따옴표**: ${quoteMap[data.style.quotes.preferred]} 사용\n`;

        // 세미콜론
        if (data.style.semicolons.usage === 'required') {
            rec += `- **세미콜론**: 필수 사용\n`;
        } else {
            rec += `- **세미콜론**: 선택 사용 (일관성 유지)\n`;
        }

        rec += `\n`;

        rec += `### 네이밍 규칙\n\n`;
        rec += `- **함수/메서드**: ${data.naming.functions.pattern}\n`;
        rec += `- **변수**: ${data.naming.variables.pattern}\n`;

        if (data.naming.constants.count > 0) {
            rec += `- **상수**: ${data.naming.constants.pattern}\n`;
        }

        if (data.naming.classes.count > 0) {
            rec += `- **클래스**: ${data.naming.classes.pattern}\n`;
        }

        rec += `\n`;

        return rec;
    }

    /**
     * JSON 저장
     */
    saveJson(data) {
        const jsonPath = this.outputPath.replace('.md', '.json');
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        console.log(`✓ JSON 데이터 저장: ${jsonPath}`);
    }

    /**
     * 요약 출력
     */
    printSummary(data) {
        console.log('');
        console.log('='.repeat(80));
        console.log('📋 분석 요약');
        console.log('='.repeat(80));
        console.log(`프로젝트: ${path.basename(this.projectPath)}`);
        console.log(`파일: ${data.structure.summary.totalFiles}개`);
        console.log(`디렉토리: ${data.structure.summary.totalDirectories}개`);
        console.log('');
        console.log('코딩 스타일:');
        console.log(`  - 들여쓰기: ${data.style.indentation.type === 'spaces' ? `공백 ${data.style.indentation.count}칸` : '탭'}`);
        console.log(`  - 줄 길이: 평균 ${data.style.lineLength.avg}자, 권장 ${data.style.lineLength.recommended}자`);
        console.log(`  - 따옴표: ${data.style.quotes.preferred} (${data.style.quotes.confidence}%)`);
        console.log('');
        console.log('네이밍 컨벤션:');
        console.log(`  - 함수: ${data.naming.functions.pattern} (${data.naming.functions.count}개)`);
        console.log(`  - 변수: ${data.naming.variables.pattern} (${data.naming.variables.count}개)`);
        if (data.naming.classes.count > 0) {
            console.log(`  - 클래스: ${data.naming.classes.pattern} (${data.naming.classes.count}개)`);
        }
        console.log('');
        console.log('='.repeat(80));
    }
}

// CLI 실행
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const projectPath = process.argv[2] || '.';
    const outputPath = process.argv[3] || './EXTRACTED_CONVENTIONS.md';

    const extractor = new ConventionExtractor(projectPath, outputPath);
    extractor.extract().catch(error => {
        console.error('❌ 분석 실패:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
}

export default ConventionExtractor;
