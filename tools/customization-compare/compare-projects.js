#!/usr/bin/env node

import { StructureDiffAnalyzer } from './analyzers/structure-diff.js';
import { CodeDiffAnalyzer } from './analyzers/code-diff.js';
import fs from 'fs';
import path from 'path';

/**
 * 고객사별 커스터마이징 비교 도구
 *
 * Usage:
 *   node compare-projects.js <base-path> <customer-path> [output-dir]
 *   node compare-projects.js test-data/base-project test-data/customer-samchully
 */
class CustomizationComparer {
    constructor(basePath, customerPath, outputDir = './reports') {
        this.basePath = path.resolve(basePath);
        this.customerPath = path.resolve(customerPath);
        this.outputDir = path.resolve(outputDir);

        this.customerName = path.basename(this.customerPath);
    }

    /**
     * 전체 비교 실행
     */
    async compare() {
        console.log('='.repeat(80));
        console.log('🔍 고객사 커스터마이징 비교 분석');
        console.log('='.repeat(80));
        console.log(`Base 프로젝트: ${this.basePath}`);
        console.log(`고객사 프로젝트: ${this.customerPath} (${this.customerName})`);
        console.log('');

        const startTime = Date.now();

        // 1. 구조 차이 분석
        console.log('[ 1/3 ] 구조 차이 분석...');
        const structureAnalyzer = new StructureDiffAnalyzer(this.basePath, this.customerPath);
        const structureDiff = structureAnalyzer.analyze();
        console.log('');

        // 2. 코드 차이 분석
        console.log('[ 2/3 ] 코드 변경 분석...');
        const codeAnalyzer = new CodeDiffAnalyzer(this.basePath, this.customerPath);

        // 수정된 파일들만 상세 분석
        const modifiedFiles = this.flattenFileList(structureDiff.modified);
        const codeDiff = codeAnalyzer.analyzeFiles(modifiedFiles);
        console.log('');

        // 3. 추가된 파일 분석
        console.log('[ 3/3 ] 신규 파일 분석...');
        const addedFiles = this.flattenFileList(structureDiff.added);
        const addedAnalysis = this.analyzeAddedFiles(addedFiles);
        console.log('');

        // 종합 리포트 생성
        const report = this.generateReport({
            structureDiff,
            codeDiff,
            addedAnalysis,
            executionTime: Date.now() - startTime
        });

        // 결과 저장
        this.saveReport(report);

        // 콘솔 요약 출력
        this.printSummary(report);

        return report;
    }

    /**
     * 파일 목록 평탄화 (카테고리별 파일을 하나의 배열로)
     */
    flattenFileList(categorized) {
        const files = [];
        Object.values(categorized).forEach(categoryFiles => {
            files.push(...categoryFiles);
        });
        return files;
    }

    /**
     * 추가된 파일 분석
     */
    analyzeAddedFiles(files) {
        const analysis = {
            totalFiles: files.length,
            byType: {},
            newFeatures: []
        };

        files.forEach(file => {
            const ext = path.extname(file);
            if (!analysis.byType[ext]) {
                analysis.byType[ext] = [];
            }
            analysis.byType[ext].push(file);

            // 서비스 파일이면 신규 기능으로 간주
            if (file.includes('Service.java') && !file.includes('AuthService')) {
                const feature = path.basename(file, '.java');
                analysis.newFeatures.push(feature);
            }
        });

        return analysis;
    }

    /**
     * 종합 리포트 생성
     */
    generateReport(data) {
        const { structureDiff, codeDiff, addedAnalysis, executionTime } = data;

        return {
            metadata: {
                customerName: this.customerName,
                basePath: this.basePath,
                customerPath: this.customerPath,
                analyzedAt: new Date().toISOString(),
                executionTime: `${executionTime}ms`
            },
            overview: {
                totalChanges:
                    structureDiff.summary.addedCount +
                    structureDiff.summary.modifiedCount +
                    structureDiff.summary.deletedCount,
                filesAdded: structureDiff.summary.addedCount,
                filesModified: structureDiff.summary.modifiedCount,
                filesDeleted: structureDiff.summary.deletedCount,
                linesAdded: codeDiff.summary.totalAddedLines,
                linesRemoved: codeDiff.summary.totalRemovedLines,
                newFeatures: addedAnalysis.newFeatures
            },
            details: {
                structure: structureDiff,
                code: codeDiff,
                added: addedAnalysis
            },
            insights: this.generateInsights(data)
        };
    }

    /**
     * 인사이트 생성 (AI 분석 대신 규칙 기반)
     */
    generateInsights(data) {
        const insights = [];
        const { structureDiff, codeDiff, addedAnalysis } = data;

        // 1. 새로운 기능 감지
        if (addedAnalysis.newFeatures.length > 0) {
            insights.push({
                type: 'NEW_FEATURE',
                severity: 'info',
                message: `${addedAnalysis.newFeatures.length}개의 신규 기능 추가됨`,
                details: addedAnalysis.newFeatures
            });
        }

        // 2. 대규모 변경 감지
        if (codeDiff.summary.totalAddedLines > 200) {
            insights.push({
                type: 'MAJOR_CHANGES',
                severity: 'warning',
                message: `대규모 코드 변경 감지 (${codeDiff.summary.totalAddedLines}줄 추가)`,
                recommendation: '변경 사항을 단위별로 검토하세요'
            });
        }

        // 3. 설정 변경 감지
        if (codeDiff.summary.configChangesCount > 0) {
            insights.push({
                type: 'CONFIG_CHANGES',
                severity: 'info',
                message: `${codeDiff.summary.configChangesCount}개의 설정 항목 변경됨`,
                recommendation: '설정 변경 사항을 배포 전에 확인하세요'
            });
        }

        // 4. 삭제된 파일 경고
        if (structureDiff.summary.deletedCount > 0) {
            insights.push({
                type: 'DELETED_FILES',
                severity: 'warning',
                message: `${structureDiff.summary.deletedCount}개 파일이 삭제됨`,
                recommendation: '삭제된 파일의 의존성을 확인하세요'
            });
        }

        // 5. 인증 관련 변경 감지
        const authFiles = codeDiff.files.filter(f =>
            f.file.includes('Login') || f.file.includes('Auth')
        );
        if (authFiles.length > 0) {
            insights.push({
                type: 'SECURITY_CHANGES',
                severity: 'critical',
                message: '인증/보안 관련 코드 변경 감지',
                recommendation: '보안 검토 필수',
                files: authFiles.map(f => f.file)
            });
        }

        return insights;
    }

    /**
     * 리포트 저장
     */
    saveReport(report) {
        // 출력 디렉토리 생성
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `customization-${this.customerName}-${timestamp}`;

        // JSON 리포트
        const jsonPath = path.join(this.outputDir, `${filename}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
        console.log(`✓ JSON 리포트 생성: ${jsonPath}`);

        // 마크다운 리포트
        const mdPath = path.join(this.outputDir, `${filename}.md`);
        const markdown = this.generateMarkdown(report);
        fs.writeFileSync(mdPath, markdown);
        console.log(`✓ Markdown 리포트 생성: ${mdPath}`);

        return { jsonPath, mdPath };
    }

    /**
     * 마크다운 리포트 생성
     */
    generateMarkdown(report) {
        let md = `# 커스터마이징 비교 리포트: ${report.metadata.customerName}\n\n`;

        md += `**생성 시간**: ${new Date(report.metadata.analyzedAt).toLocaleString()}\n`;
        md += `**실행 시간**: ${report.metadata.executionTime}\n\n`;

        md += `---\n\n`;

        // 개요
        md += `## 📊 개요\n\n`;
        md += `- **전체 변경**: ${report.overview.totalChanges}개 파일\n`;
        md += `- **추가**: ${report.overview.filesAdded}개\n`;
        md += `- **수정**: ${report.overview.filesModified}개\n`;
        md += `- **삭제**: ${report.overview.filesDeleted}개\n`;
        md += `- **코드 변경**: +${report.overview.linesAdded}줄 / -${report.overview.linesRemoved}줄\n\n`;

        if (report.overview.newFeatures.length > 0) {
            md += `### 🆕 신규 기능\n\n`;
            report.overview.newFeatures.forEach(feature => {
                md += `- ${feature}\n`;
            });
            md += `\n`;
        }

        // 인사이트
        if (report.insights.length > 0) {
            md += `## 💡 주요 인사이트\n\n`;
            report.insights.forEach(insight => {
                const icon = insight.severity === 'critical' ? '🚨' :
                             insight.severity === 'warning' ? '⚠️' : 'ℹ️';
                md += `${icon} **${insight.message}**\n`;
                if (insight.recommendation) {
                    md += `  - 권장사항: ${insight.recommendation}\n`;
                }
                md += `\n`;
            });
        }

        // 상세 변경 사항
        md += `## 📝 상세 변경 사항\n\n`;

        // 추가된 파일
        if (report.overview.filesAdded > 0) {
            md += `### ➕ 추가된 파일 (${report.overview.filesAdded}개)\n\n`;
            Object.entries(report.details.structure.added).forEach(([category, files]) => {
                md += `#### ${category}\n`;
                files.forEach(file => {
                    md += `- \`${file}\`\n`;
                });
                md += `\n`;
            });
        }

        // 수정된 파일
        if (report.overview.filesModified > 0) {
            md += `### ✏️ 수정된 파일 (${report.overview.filesModified}개)\n\n`;
            report.details.code.files.forEach(file => {
                md += `#### ${file.file}\n`;
                md += `- 변경: +${file.addedLines}줄 / -${file.removedLines}줄\n`;

                if (file.methods && file.methods.added.length > 0) {
                    md += `- 추가된 메서드: ${file.methods.added.join(', ')}\n`;
                }

                md += `\n`;
            });
        }

        return md;
    }

    /**
     * 콘솔 요약 출력
     */
    printSummary(report) {
        console.log('='.repeat(80));
        console.log('📋 분석 요약');
        console.log('='.repeat(80));
        console.log(`고객사: ${report.metadata.customerName}`);
        console.log(`전체 변경: ${report.overview.totalChanges}개 파일`);
        console.log(`  - 추가: ${report.overview.filesAdded}개`);
        console.log(`  - 수정: ${report.overview.filesModified}개`);
        console.log(`  - 삭제: ${report.overview.filesDeleted}개`);
        console.log(`코드 변경: +${report.overview.linesAdded}줄 / -${report.overview.linesRemoved}줄`);

        if (report.overview.newFeatures.length > 0) {
            console.log(`\n신규 기능: ${report.overview.newFeatures.join(', ')}`);
        }

        if (report.insights.length > 0) {
            console.log(`\n주요 인사이트:`);
            report.insights.forEach(insight => {
                console.log(`  ${insight.type}: ${insight.message}`);
            });
        }

        console.log('='.repeat(80));
    }
}

// CLI 실행
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const basePath = process.argv[2];
    const customerPath = process.argv[3];
    const outputDir = process.argv[4] || './reports';

    if (!basePath || !customerPath) {
        console.error('Usage: node compare-projects.js <base-path> <customer-path> [output-dir]');
        console.error('\nExample:');
        console.error('  node compare-projects.js test-data/base-project test-data/customer-samchully');
        process.exit(1);
    }

    const comparer = new CustomizationComparer(basePath, customerPath, outputDir);
    comparer.compare().catch(error => {
        console.error('❌ 분석 실패:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
}

export default CustomizationComparer;
