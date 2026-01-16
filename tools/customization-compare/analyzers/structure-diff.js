import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * 프로젝트 구조 비교 분석기
 * Base 프로젝트와 Customer 프로젝트의 파일 구조 차이를 분석
 */
export class StructureDiffAnalyzer {
    constructor(basePath, customerPath) {
        this.basePath = path.resolve(basePath);
        this.customerPath = path.resolve(customerPath);
        this.ignorePatterns = [
            'node_modules',
            '.git',
            'target',
            'build',
            'dist',
            '*.class',
            '*.jar',
            '*.war'
        ];
    }

    /**
     * 구조 차이 분석 메인 메서드
     */
    analyze() {
        console.log('🔍 구조 차이 분석 시작...');
        console.log(`  Base: ${this.basePath}`);
        console.log(`  Customer: ${this.customerPath}`);

        const baseFiles = this.getAllFiles(this.basePath);
        const customerFiles = this.getAllFiles(this.customerPath);

        // 상대 경로로 변환
        const baseRelative = this.toRelativePaths(baseFiles, this.basePath);
        const customerRelative = this.toRelativePaths(customerFiles, this.customerPath);

        // 차이 계산
        const added = customerRelative.filter(f => !baseRelative.includes(f));
        const deleted = baseRelative.filter(f => !customerRelative.includes(f));
        const common = baseRelative.filter(f => customerRelative.includes(f));

        // 수정된 파일 찾기 (파일 크기 또는 내용 비교)
        const modified = this.findModifiedFiles(common);

        const result = {
            summary: {
                baseFileCount: baseRelative.length,
                customerFileCount: customerRelative.length,
                addedCount: added.length,
                deletedCount: deleted.length,
                modifiedCount: modified.length,
                unchangedCount: common.length - modified.length
            },
            added: this.categorizeFiles(added),
            deleted: this.categorizeFiles(deleted),
            modified: this.categorizeFiles(modified),
            basePath: this.basePath,
            customerPath: this.customerPath
        };

        console.log('✓ 구조 차이 분석 완료');
        console.log(`  추가: ${added.length}개, 삭제: ${deleted.length}개, 수정: ${modified.length}개`);

        return result;
    }

    /**
     * 디렉토리에서 모든 파일 목록 가져오기
     */
    getAllFiles(dirPath, fileList = []) {
        if (!fs.existsSync(dirPath)) {
            console.warn(`⚠️  경로가 존재하지 않습니다: ${dirPath}`);
            return [];
        }

        const files = fs.readdirSync(dirPath);

        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            // Ignore 패턴 체크
            if (this.shouldIgnore(file)) {
                return;
            }

            if (stat.isDirectory()) {
                this.getAllFiles(filePath, fileList);
            } else {
                fileList.push(filePath);
            }
        });

        return fileList;
    }

    /**
     * 무시할 파일/디렉토리 체크
     */
    shouldIgnore(filename) {
        return this.ignorePatterns.some(pattern => {
            if (pattern.startsWith('*')) {
                return filename.endsWith(pattern.substring(1));
            }
            return filename === pattern;
        });
    }

    /**
     * 절대 경로를 상대 경로로 변환
     */
    toRelativePaths(files, basePath) {
        return files.map(f => path.relative(basePath, f));
    }

    /**
     * 수정된 파일 찾기 (파일 크기 비교)
     */
    findModifiedFiles(commonFiles) {
        const modified = [];

        commonFiles.forEach(relativePath => {
            const baseFile = path.join(this.basePath, relativePath);
            const customerFile = path.join(this.customerPath, relativePath);

            const baseStat = fs.statSync(baseFile);
            const customerStat = fs.statSync(customerFile);

            // 파일 크기가 다르면 수정된 것으로 간주
            if (baseStat.size !== customerStat.size) {
                modified.push(relativePath);
            } else {
                // 크기가 같으면 내용 비교
                const baseContent = fs.readFileSync(baseFile, 'utf8');
                const customerContent = fs.readFileSync(customerFile, 'utf8');

                if (baseContent !== customerContent) {
                    modified.push(relativePath);
                }
            }
        });

        return modified;
    }

    /**
     * 파일들을 타입별로 분류
     */
    categorizeFiles(files) {
        const categories = {
            java: [],
            javascript: [],
            config: [],
            resource: [],
            other: []
        };

        files.forEach(file => {
            const ext = path.extname(file).toLowerCase();

            if (ext === '.java') {
                categories.java.push(file);
            } else if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx') {
                categories.javascript.push(file);
            } else if (ext === '.properties' || ext === '.yml' || ext === '.yaml' || ext === '.xml' || ext === '.json') {
                categories.config.push(file);
            } else if (ext === '.html' || ext === '.css' || ext === '.jsp') {
                categories.resource.push(file);
            } else {
                categories.other.push(file);
            }
        });

        // 빈 카테고리 제거
        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) {
                delete categories[key];
            }
        });

        return categories;
    }

    /**
     * 파일 상세 정보 가져오기
     */
    getFileInfo(relativePath, isCustomer = false) {
        const fullPath = path.join(
            isCustomer ? this.customerPath : this.basePath,
            relativePath
        );

        if (!fs.existsSync(fullPath)) {
            return null;
        }

        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;

        return {
            path: relativePath,
            size: stat.size,
            lines: lines,
            lastModified: stat.mtime
        };
    }
}

// CLI 실행
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const basePath = process.argv[2];
    const customerPath = process.argv[3];

    if (!basePath || !customerPath) {
        console.error('Usage: node structure-diff.js <base-path> <customer-path>');
        process.exit(1);
    }

    const analyzer = new StructureDiffAnalyzer(basePath, customerPath);
    const result = analyzer.analyze();

    console.log('\n=== 분석 결과 ===');
    console.log(JSON.stringify(result, null, 2));
}
