import fs from 'fs';
import path from 'path';

/**
 * 파일 구조 분석기
 * 프로젝트의 디렉토리 구조, 파일명 패턴 분석
 */
export class FileStructureAnalyzer {
    constructor(projectPath, options = {}) {
        this.projectPath = path.resolve(projectPath);
        this.options = {
            ignorePatterns: options.ignorePatterns || [
                'node_modules',
                '.git',
                'dist',
                'build',
                'target',
                '.next',
                'coverage',
                '*.log'
            ],
            maxDepth: options.maxDepth || 10
        };

        this.files = [];
        this.directories = [];
        this.extensions = new Map();
        this.fileNamePatterns = {
            kebabCase: 0,
            camelCase: 0,
            pascalCase: 0,
            snakeCase: 0,
            other: 0
        };
    }

    /**
     * 분석 실행
     */
    analyze() {
        console.log('📁 파일 구조 분석 중...');

        this.scanDirectory(this.projectPath, 0);
        this.analyzeFileNames();
        this.analyzeExtensions();

        const result = {
            summary: {
                totalFiles: this.files.length,
                totalDirectories: this.directories.length,
                avgDepth: this.calculateAvgDepth(),
                extensions: Object.fromEntries(this.extensions)
            },
            structure: this.buildStructureTree(),
            fileNamePatterns: this.fileNamePatterns,
            commonPatterns: this.findCommonPatterns()
        };

        console.log(`✓ 파일 ${this.files.length}개, 디렉토리 ${this.directories.length}개 분석 완료`);

        return result;
    }

    /**
     * 디렉토리 스캔 (재귀)
     */
    scanDirectory(dirPath, depth) {
        if (depth > this.options.maxDepth) return;

        if (!fs.existsSync(dirPath)) return;

        const items = fs.readdirSync(dirPath);

        items.forEach(item => {
            if (this.shouldIgnore(item)) return;

            const fullPath = path.join(dirPath, item);
            const relativePath = path.relative(this.projectPath, fullPath);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                this.directories.push({
                    path: relativePath,
                    name: item,
                    depth: depth
                });
                this.scanDirectory(fullPath, depth + 1);
            } else {
                const ext = path.extname(item);
                this.files.push({
                    path: relativePath,
                    name: item,
                    nameWithoutExt: path.basename(item, ext),
                    ext: ext,
                    depth: depth,
                    size: stat.size
                });
            }
        });
    }

    /**
     * 무시할 파일/디렉토리 체크
     */
    shouldIgnore(name) {
        return this.options.ignorePatterns.some(pattern => {
            if (pattern.startsWith('*.')) {
                return name.endsWith(pattern.substring(1));
            }
            return name === pattern || name.startsWith('.');
        });
    }

    /**
     * 파일명 패턴 분석
     */
    analyzeFileNames() {
        this.files.forEach(file => {
            const name = file.nameWithoutExt;
            const pattern = this.detectNamePattern(name);
            this.fileNamePatterns[pattern]++;
        });
    }

    /**
     * 파일명 패턴 감지
     */
    detectNamePattern(name) {
        // kebab-case: my-file-name
        if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(name)) {
            return 'kebabCase';
        }

        // camelCase: myFileName
        if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
            return 'camelCase';
        }

        // PascalCase: MyFileName
        if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            return 'pascalCase';
        }

        // snake_case: my_file_name
        if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(name)) {
            return 'snakeCase';
        }

        return 'other';
    }

    /**
     * 확장자 분석
     */
    analyzeExtensions() {
        this.files.forEach(file => {
            const ext = file.ext || 'no-extension';
            this.extensions.set(ext, (this.extensions.get(ext) || 0) + 1);
        });
    }

    /**
     * 평균 깊이 계산
     */
    calculateAvgDepth() {
        if (this.files.length === 0) return 0;
        const totalDepth = this.files.reduce((sum, f) => sum + f.depth, 0);
        return Math.round(totalDepth / this.files.length * 10) / 10;
    }

    /**
     * 구조 트리 생성
     */
    buildStructureTree() {
        const tree = {};

        // 디렉토리별 파일 수 계산
        this.files.forEach(file => {
            const dir = path.dirname(file.path) || '.';
            if (!tree[dir]) {
                tree[dir] = {
                    files: [],
                    count: 0,
                    extensions: {}
                };
            }
            tree[dir].files.push(file.name);
            tree[dir].count++;

            const ext = file.ext || 'no-extension';
            tree[dir].extensions[ext] = (tree[dir].extensions[ext] || 0) + 1;
        });

        return tree;
    }

    /**
     * 공통 패턴 찾기
     */
    findCommonPatterns() {
        const patterns = [];

        // 파일명 패턴
        const dominant = Object.entries(this.fileNamePatterns)
            .sort((a, b) => b[1] - a[1])[0];

        if (dominant && dominant[1] > 0) {
            const percentage = Math.round(dominant[1] / this.files.length * 100);
            patterns.push({
                type: 'fileNaming',
                pattern: dominant[0],
                percentage: percentage,
                description: this.getPatternDescription(dominant[0])
            });
        }

        // 디렉토리 구조 패턴
        const topLevelDirs = this.directories
            .filter(d => d.depth === 1)
            .map(d => d.name);

        if (topLevelDirs.length > 0) {
            patterns.push({
                type: 'directoryStructure',
                pattern: 'top-level',
                items: topLevelDirs,
                description: '최상위 디렉토리 구조'
            });
        }

        // 확장자 분포
        const topExtensions = Array.from(this.extensions.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        patterns.push({
            type: 'extensions',
            pattern: 'distribution',
            items: topExtensions.map(([ext, count]) => ({
                ext,
                count,
                percentage: Math.round(count / this.files.length * 100)
            })),
            description: '주요 파일 타입'
        });

        return patterns;
    }

    /**
     * 패턴 설명
     */
    getPatternDescription(pattern) {
        const descriptions = {
            kebabCase: 'kebab-case (소문자-하이픈)',
            camelCase: 'camelCase (카멜케이스)',
            pascalCase: 'PascalCase (파스칼케이스)',
            snakeCase: 'snake_case (스네이크케이스)'
        };
        return descriptions[pattern] || pattern;
    }
}

export default FileStructureAnalyzer;
