import fs from 'fs';
import path from 'path';

/**
 * 기술 스택 감지기
 * package.json, import 문 분석
 */
export class TechStackDetector {
    constructor(projectPath) {
        this.projectPath = projectPath;

        this.dependencies = {};
        this.devDependencies = {};
        this.imports = new Map();
    }

    /**
     * 분석 실행
     */
    analyze() {
        console.log('🔧 기술 스택 분석 중...');

        // package.json 분석
        this.analyzePackageJson();

        const result = {
            hasPackageJson: Object.keys(this.dependencies).length > 0,
            dependencies: this.dependencies,
            devDependencies: this.devDependencies,
            mainLibraries: this.identifyMainLibraries(),
            techStack: this.identifyTechStack()
        };

        console.log('✓ 기술 스택 분석 완료');

        return result;
    }

    /**
     * package.json 분석
     */
    analyzePackageJson() {
        const packageJsonPath = path.join(this.projectPath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            return;
        }

        try {
            const content = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);

            this.dependencies = packageJson.dependencies || {};
            this.devDependencies = packageJson.devDependencies || {};

        } catch (error) {
            console.warn('  ⚠️  package.json 파싱 실패');
        }
    }

    /**
     * 주요 라이브러리 식별
     */
    identifyMainLibraries() {
        const allDeps = { ...this.dependencies, ...this.devDependencies };
        const libraries = [];

        // 주요 카테고리별 라이브러리
        const categories = {
            framework: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'fastify', 'koa', 'nest'],
            testing: ['jest', 'mocha', 'vitest', 'playwright', '@playwright/test', 'cypress', 'jasmine'],
            build: ['webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'turbo'],
            linting: ['eslint', 'prettier', 'stylelint', 'husky', 'lint-staged'],
            typescript: ['typescript', '@types/node', '@types/react'],
            database: ['mysql', 'mysql2', 'pg', 'mongodb', 'redis', 'prisma', 'typeorm', 'sequelize'],
            utility: ['lodash', 'axios', 'dayjs', 'moment', 'ramda', 'rxjs']
        };

        Object.entries(categories).forEach(([category, libs]) => {
            libs.forEach(lib => {
                if (allDeps[lib]) {
                    libraries.push({
                        name: lib,
                        version: allDeps[lib],
                        category,
                        type: this.dependencies[lib] ? 'dependency' : 'devDependency'
                    });
                }
            });
        });

        return libraries;
    }

    /**
     * 기술 스택 식별
     */
    identifyTechStack() {
        const stack = {
            language: 'JavaScript',
            runtime: 'Node.js',
            frameworks: [],
            testing: [],
            buildTools: [],
            databases: [],
            type: 'Unknown'
        };

        const allDeps = { ...this.dependencies, ...this.devDependencies };

        // TypeScript 사용 여부
        if (allDeps['typescript']) {
            stack.language = 'TypeScript';
        }

        // 프레임워크
        if (allDeps['react'] || allDeps['react-dom']) {
            stack.frameworks.push('React');
            stack.type = 'Frontend';
        }
        if (allDeps['next']) {
            stack.frameworks.push('Next.js');
            stack.type = 'Full-stack';
        }
        if (allDeps['vue']) {
            stack.frameworks.push('Vue.js');
            stack.type = 'Frontend';
        }
        if (allDeps['express']) {
            stack.frameworks.push('Express.js');
            stack.type = 'Backend';
        }
        if (allDeps['@nestjs/core']) {
            stack.frameworks.push('NestJS');
            stack.type = 'Backend';
        }

        // 테스트 도구
        if (allDeps['jest']) stack.testing.push('Jest');
        if (allDeps['@playwright/test']) stack.testing.push('Playwright');
        if (allDeps['vitest']) stack.testing.push('Vitest');
        if (allDeps['cypress']) stack.testing.push('Cypress');

        // 빌드 도구
        if (allDeps['webpack']) stack.buildTools.push('Webpack');
        if (allDeps['vite']) stack.buildTools.push('Vite');
        if (allDeps['rollup']) stack.buildTools.push('Rollup');

        // 데이터베이스
        if (allDeps['mysql'] || allDeps['mysql2']) stack.databases.push('MySQL');
        if (allDeps['pg']) stack.databases.push('PostgreSQL');
        if (allDeps['mongodb']) stack.databases.push('MongoDB');
        if (allDeps['mssql']) stack.databases.push('SQL Server');

        // 타입 추정
        if (stack.type === 'Unknown') {
            if (stack.frameworks.length === 0 && Object.keys(this.dependencies).length === 0) {
                stack.type = 'Utility/Library';
            } else if (stack.databases.length > 0) {
                stack.type = 'Backend';
            }
        }

        return stack;
    }
}

export default TechStackDetector;
