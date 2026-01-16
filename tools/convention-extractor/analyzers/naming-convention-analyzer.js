import fs from 'fs';
import path from 'path';

/**
 * 네이밍 컨벤션 분석기
 * 함수, 변수, 상수, 클래스명 패턴 분석
 */
export class NamingConventionAnalyzer {
    constructor(files, projectPath) {
        this.files = files;
        this.projectPath = projectPath;

        this.targetExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

        this.functionNames = [];
        this.variableNames = [];
        this.constantNames = [];
        this.classNames = [];
    }

    /**
     * 분석 실행
     */
    analyze() {
        console.log('📝 네이밍 컨벤션 분석 중...');

        const targetFiles = this.files.filter(f =>
            this.targetExtensions.includes(f.ext)
        );

        targetFiles.forEach(file => {
            this.analyzeFile(file);
        });

        const result = {
            functions: this.analyzeFunctionNames(),
            variables: this.analyzeVariableNames(),
            constants: this.analyzeConstantNames(),
            classes: this.analyzeClassNames(),
            commonPatterns: this.findCommonNamingPatterns()
        };

        console.log(`✓ 네이밍 분석 완료: 함수 ${this.functionNames.length}개, 변수 ${this.variableNames.length}개`);

        return result;
    }

    /**
     * 파일 분석
     */
    analyzeFile(file) {
        const fullPath = path.join(this.projectPath, file.path);

        try {
            const content = fs.readFileSync(fullPath, 'utf8');

            // 함수 선언 찾기
            this.extractFunctionNames(content);

            // 변수 선언 찾기
            this.extractVariableNames(content);

            // 상수 찾기
            this.extractConstantNames(content);

            // 클래스 선언 찾기
            this.extractClassNames(content);

        } catch (error) {
            // 읽을 수 없는 파일은 무시
        }
    }

    /**
     * 함수명 추출
     */
    extractFunctionNames(content) {
        // function 선언
        const functionPattern = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            this.functionNames.push(match[1]);
        }

        // const/let 함수 선언
        const arrowFunctionPattern = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
        while ((match = arrowFunctionPattern.exec(content)) !== null) {
            this.functionNames.push(match[1]);
        }

        // 메서드 선언 (객체 내부)
        const methodPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g;
        while ((match = methodPattern.exec(content)) !== null) {
            const name = match[1];
            // if, for, while 등 키워드 제외
            if (!['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
                this.functionNames.push(name);
            }
        }
    }

    /**
     * 변수명 추출
     */
    extractVariableNames(content) {
        // const/let/var 선언
        const variablePattern = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
        let match;
        while ((match = variablePattern.exec(content)) !== null) {
            const name = match[1];
            // 함수가 아닌 변수만 (이미 함수로 수집된 것 제외)
            if (!this.functionNames.includes(name)) {
                this.variableNames.push(name);
            }
        }
    }

    /**
     * 상수명 추출
     */
    extractConstantNames(content) {
        // 대문자로 된 const 선언
        const constantPattern = /const\s+([A-Z][A-Z0-9_]*)\s*=/g;
        let match;
        while ((match = constantPattern.exec(content)) !== null) {
            this.constantNames.push(match[1]);
        }
    }

    /**
     * 클래스명 추출
     */
    extractClassNames(content) {
        // class 선언
        const classPattern = /class\s+([A-Z][a-zA-Z0-9]*)/g;
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            this.classNames.push(match[1]);
        }

        // export class
        const exportClassPattern = /export\s+class\s+([A-Z][a-zA-Z0-9]*)/g;
        while ((match = exportClassPattern.exec(content)) !== null) {
            if (!this.classNames.includes(match[1])) {
                this.classNames.push(match[1]);
            }
        }
    }

    /**
     * 함수명 분석
     */
    analyzeFunctionNames() {
        if (this.functionNames.length === 0) {
            return {
                count: 0,
                pattern: 'camelCase',
                confidence: 0
            };
        }

        const patterns = this.categorizeNames(this.functionNames);

        return {
            count: this.functionNames.length,
            pattern: patterns.dominant,
            confidence: patterns.confidence,
            distribution: patterns.distribution,
            examples: this.functionNames.slice(0, 10)
        };
    }

    /**
     * 변수명 분석
     */
    analyzeVariableNames() {
        if (this.variableNames.length === 0) {
            return {
                count: 0,
                pattern: 'camelCase',
                confidence: 0
            };
        }

        const patterns = this.categorizeNames(this.variableNames);

        return {
            count: this.variableNames.length,
            pattern: patterns.dominant,
            confidence: patterns.confidence,
            distribution: patterns.distribution,
            examples: this.variableNames.slice(0, 10)
        };
    }

    /**
     * 상수명 분석
     */
    analyzeConstantNames() {
        if (this.constantNames.length === 0) {
            return {
                count: 0,
                pattern: 'UPPER_SNAKE_CASE',
                confidence: 0
            };
        }

        const patterns = this.categorizeNames(this.constantNames);

        return {
            count: this.constantNames.length,
            pattern: patterns.dominant,
            confidence: patterns.confidence,
            examples: this.constantNames.slice(0, 10)
        };
    }

    /**
     * 클래스명 분석
     */
    analyzeClassNames() {
        if (this.classNames.length === 0) {
            return {
                count: 0,
                pattern: 'PascalCase',
                confidence: 0
            };
        }

        const patterns = this.categorizeNames(this.classNames);

        return {
            count: this.classNames.length,
            pattern: patterns.dominant,
            confidence: patterns.confidence,
            examples: this.classNames
        };
    }

    /**
     * 이름 패턴 분류
     */
    categorizeNames(names) {
        const patterns = {
            camelCase: 0,
            PascalCase: 0,
            snake_case: 0,
            UPPER_SNAKE_CASE: 0,
            'kebab-case': 0,
            other: 0
        };

        names.forEach(name => {
            const pattern = this.detectNamingPattern(name);
            patterns[pattern]++;
        });

        const entries = Object.entries(patterns).filter(([_, count]) => count > 0);
        entries.sort((a, b) => b[1] - a[1]);

        const dominant = entries[0];
        const total = names.length;

        return {
            dominant: dominant ? dominant[0] : 'camelCase',
            confidence: dominant ? Math.round(dominant[1] / total * 100) : 0,
            distribution: patterns
        };
    }

    /**
     * 네이밍 패턴 감지
     */
    detectNamingPattern(name) {
        // UPPER_SNAKE_CASE
        if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
            return 'UPPER_SNAKE_CASE';
        }

        // PascalCase
        if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            return 'PascalCase';
        }

        // snake_case
        if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) {
            return 'snake_case';
        }

        // camelCase
        if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
            return 'camelCase';
        }

        // kebab-case (거의 없지만)
        if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) {
            return 'kebab-case';
        }

        return 'other';
    }

    /**
     * 공통 네이밍 패턴 찾기
     */
    findCommonNamingPatterns() {
        const patterns = [];

        // 함수명 패턴 (get*, set*, is*, has* 등)
        const functionPrefixes = this.findCommonPrefixes(this.functionNames);
        if (functionPrefixes.length > 0) {
            patterns.push({
                type: 'functionPrefixes',
                items: functionPrefixes,
                description: '자주 사용되는 함수명 접두사'
            });
        }

        // 변수명 길이 평균
        if (this.variableNames.length > 0) {
            const avgLength = Math.round(
                this.variableNames.reduce((sum, name) => sum + name.length, 0) /
                this.variableNames.length
            );
            patterns.push({
                type: 'variableLength',
                avgLength,
                description: '평균 변수명 길이'
            });
        }

        return patterns;
    }

    /**
     * 공통 접두사 찾기
     */
    findCommonPrefixes(names) {
        const prefixes = {};

        const commonPrefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'create', 'update', 'delete', 'fetch', 'load', 'save', 'handle', 'on', 'generate', 'calculate', 'validate', 'check', 'find', 'search'];

        names.forEach(name => {
            commonPrefixes.forEach(prefix => {
                const pattern = new RegExp(`^${prefix}[A-Z]`);
                if (pattern.test(name)) {
                    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
                }
            });
        });

        return Object.entries(prefixes)
            .filter(([_, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([prefix, count]) => ({ prefix, count }));
    }
}

export default NamingConventionAnalyzer;
