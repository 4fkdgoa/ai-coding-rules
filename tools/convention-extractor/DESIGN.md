# Convention Extractor - 설계 문서

## 개요

기존 코드베이스를 분석하여 실제 사용 중인 코딩 컨벤션을 자동으로 추출하고 문서화하는 도구.

## 배경 및 문제점

### 문제점
1. **문서화되지 않은 프로젝트**: 레거시 코드에 코딩 규칙이 없음
2. **신규 팀원 온보딩 어려움**: 암묵적 컨벤션 파악에 시간 소요
3. **코드 일관성 부족**: 팀원마다 다른 스타일 사용
4. **수동 문서 작성 부담**: 컨벤션 문서를 일일이 작성해야 함

### 해결 방안
실제 코드를 분석하여 **통계 기반으로 컨벤션을 자동 추출**하고 문서 생성

---

## 아키텍처

### 시스템 구조
```
ConventionExtractor (Main)
    │
    ├─> FileStructureAnalyzer    (파일 구조 분석)
    ├─> CodingStyleAnalyzer       (코딩 스타일 분석)
    ├─> NamingConventionAnalyzer  (네이밍 컨벤션 분석)
    └─> TechStackDetector         (기술 스택 감지)
          │
          └─> DocumentGenerator (Markdown + JSON)
```

### 컴포넌트 설명

#### 1. FileStructureAnalyzer
**역할**: 프로젝트 파일 시스템 구조 분석

**입력**:
- 프로젝트 경로
- Ignore 패턴 (node_modules, .git 등)

**출력**:
```javascript
{
  summary: {
    totalFiles: 85,
    totalDirectories: 57,
    avgDepth: 2.4,
    extensions: { '.md': 39, '.js': 15, ... }
  },
  fileNamePatterns: {
    kebabCase: 40%,
    camelCase: 30%,
    pascalCase: 20%,
    other: 10%
  },
  structure: { /* 디렉토리별 파일 분포 */ }
}
```

**알고리즘**:
```
1. 재귀적으로 디렉토리 스캔
2. 각 파일명을 패턴별로 분류:
   - kebab-case: /^[a-z0-9]+(-[a-z0-9]+)+$/
   - camelCase: /^[a-z][a-zA-Z0-9]*$/
   - PascalCase: /^[A-Z][a-zA-Z0-9]*$/
   - snake_case: /^[a-z0-9]+(_[a-z0-9]+)+$/
3. 통계 계산 및 주요 패턴 감지
```

#### 2. CodingStyleAnalyzer
**역할**: 코드 작성 스타일 분석 (JS/TS 파일 대상)

**분석 항목**:
```javascript
{
  indentation: {
    type: 'spaces',      // 'tabs' | 'spaces'
    count: 4,            // 공백 개수
    confidence: 50%      // 신뢰도
  },
  lineLength: {
    avg: 35,
    median: 32,
    p95: 75,
    max: 150,
    recommended: 80
  },
  quotes: {
    preferred: 'single',  // 'single' | 'double' | 'backtick'
    confidence: 72%,
    distribution: { single: 72%, double: 20%, backtick: 8% }
  },
  semicolons: {
    usage: 'required',   // 'required' | 'optional'
    confidence: 71%
  },
  braceStyle: {
    style: 'K&R',        // 'K&R' (same line) | 'Allman' (next line)
    confidence: 90%
  }
}
```

**알고리즘 (라인별 분석)**:
```javascript
forEach line in file:
  // 1. 들여쓰기
  if (line starts with whitespace):
    if (contains tab): tabCount++
    else:
      spaceCount++
      detectIndentUnit(spaceLength)  // 2, 4, 8 등

  // 2. 줄 길이
  lineLengths.push(line.length)

  // 3. 따옴표
  singleQuotes += count(')
  doubleQuotes += count(")
  backticks += count(`)

  // 4. 세미콜론 (문장 끝)
  if (line matches /^(const|let|var|return|import)/):
    if (ends with ';'): withSemicolon++
    else: withoutSemicolon++

  // 5. 중괄호 (함수 선언)
  if (line matches /function.*\{/): sameLineBrace++
  if (line matches /function.*$/): nextLineBrace++
```

**한계점**:
- 정규식 기반 (AST 미사용)
- 주석 vs 실제 코드 구분 안 함
- 문자열 내부 따옴표 오판 가능

#### 3. NamingConventionAnalyzer
**역할**: 함수, 변수, 클래스명 패턴 분석

**분석 대상**:
```javascript
{
  functions: {
    count: 142,
    pattern: 'camelCase',
    confidence: 100%,
    examples: ['getTables', 'executeQuery', ...]
  },
  variables: {
    count: 355,
    pattern: 'camelCase',
    confidence: 96%
  },
  constants: {
    count: 14,
    pattern: 'UPPER_SNAKE_CASE',
    examples: ['DEFAULT_LIMIT', 'MAX_RETRIES']
  },
  classes: {
    count: 9,
    pattern: 'PascalCase',
    examples: ['FileStructureAnalyzer', ...]
  },
  functionPrefixes: [
    { prefix: 'get', count: 28 },
    { prefix: 'generate', count: 7 },
    { prefix: 'find', count: 4 }
  ]
}
```

**추출 패턴 (정규식)**:
```javascript
// 함수명
/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g          // function foo()
/(?:const|let|var)\s+([a-z][a-zA-Z0-9]*)\s*=\s*\(/g  // const foo = () =>
/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g   // foo() { (메서드)

// 변수명
/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g

// 상수명
/const\s+([A-Z][A-Z0-9_]*)\s*=/g

// 클래스명
/class\s+([A-Z][a-zA-Z0-9]*)/g
```

**함수 접두사 패턴**:
```javascript
const commonPrefixes = [
  'get', 'set', 'is', 'has', 'can', 'should',
  'create', 'update', 'delete', 'fetch', 'load',
  'save', 'handle', 'on', 'generate', 'calculate',
  'validate', 'check', 'find', 'search'
];

// 각 접두사별 출현 빈도 계산
// 2개 이상인 접두사만 보고
```

#### 4. TechStackDetector
**역할**: package.json 분석하여 기술 스택 식별

**분석 결과**:
```javascript
{
  hasPackageJson: true,
  dependencies: { 'react': '^18.0.0', ... },
  devDependencies: { 'jest': '^29.0.0', ... },
  mainLibraries: [
    { name: 'react', version: '^18.0.0', category: 'framework' },
    { name: 'jest', version: '^29.0.0', category: 'testing' }
  ],
  techStack: {
    language: 'TypeScript',
    runtime: 'Node.js',
    frameworks: ['React', 'Next.js'],
    testing: ['Jest', 'Playwright'],
    buildTools: ['Vite'],
    databases: ['MySQL'],
    type: 'Full-stack'
  }
}
```

**프로젝트 타입 추정 로직**:
```javascript
if (has 'react' or 'vue') → Frontend
if (has 'next' or 'nuxt') → Full-stack
if (has 'express' or '@nestjs/core') → Backend
if (has database libs) → Backend
if (no frameworks && no deps) → Utility/Library
```

---

## 데이터 흐름

```
1. Input: 프로젝트 경로
         ↓
2. FileStructureAnalyzer
   - 모든 파일 스캔 (재귀)
   - 파일명 패턴 분류
   - 확장자 통계
         ↓ {files[]}
3. CodingStyleAnalyzer
   - JS/TS 파일만 필터링
   - 각 파일의 모든 라인 분석
   - 통계 집계
         ↓ {style}
4. NamingConventionAnalyzer
   - JS/TS 파일만 필터링
   - 정규식으로 이름 추출
   - 패턴별 분류
         ↓ {naming}
5. TechStackDetector
   - package.json 읽기
   - 의존성 분석
   - 기술 스택 추정
         ↓ {techStack}
6. ConventionExtractor (통합)
   - 모든 분석 결과 결합
   - 문서 생성 (Markdown + JSON)
         ↓
7. Output:
   - CONVENTIONS.md (사람용)
   - CONVENTIONS.json (프로그램용)
   - 콘솔 요약
```

---

## 실제 테스트 결과

### 테스트 대상: ai-coding-rules 레포
- **파일**: 85개
- **디렉토리**: 57개
- **실행 시간**: 70ms

### 분석 결과
```
코딩 스타일:
  - 들여쓰기: 공백 4칸 (50% 신뢰도)
  - 줄 길이: 평균 35자, 권장 80자
  - 따옴표: single (72%)
  - 세미콜론: 필수 사용 (71%)

네이밍 컨벤션:
  - 함수: camelCase (142개, 100% 신뢰도)
  - 변수: camelCase (355개, 96% 신뢰도)
  - 클래스: PascalCase (9개)
  - 상수: UPPER_SNAKE_CASE (14개)

함수 접두사:
  - get*: 28개
  - generate*: 7개
  - find*: 4개
```

---

## 현재 한계점 및 문제

### 1. 에러 핸들링 부족 ⚠️
**문제**:
- 존재하지 않는 경로 → 에러 없이 "0개 파일"
- 빈 디렉토리 → 의미 없는 문서 생성
- 경고 메시지 없음

**개선 필요**:
```javascript
// 경로 검증
if (!fs.existsSync(projectPath)) {
  throw new Error(`프로젝트 경로가 존재하지 않습니다: ${projectPath}`);
}

// 최소 파일 수 체크
if (files.length < 5) {
  console.warn(`⚠️  파일이 ${files.length}개뿐입니다. 결과가 부정확할 수 있습니다.`);
}

// JS/TS 파일 없음
if (jsFiles.length === 0) {
  console.warn('⚠️  JavaScript/TypeScript 파일이 없어 코딩 스타일 분석을 건너뜁니다.');
}
```

### 2. 정규식 기반 파싱의 한계
**문제**:
- 주석 안의 코드도 분석
- 문자열 내부 따옴표 오판
- 중첩 구조 파악 불가

**예시**:
```javascript
// 이 주석도 분석됨: const wrong = 'test';
const real = "actual code";  // double quote로 카운트
```

**개선 필요**:
- AST(Abstract Syntax Tree) 파서 사용
  - JavaScript: `@babel/parser`, `acorn`
  - TypeScript: `typescript` 컴파일러 API

### 3. 제한된 파일 타입 지원
**현재**: JavaScript/TypeScript만 상세 분석
**필요**: Java, Python, CSS 등 지원

### 4. 컨텍스트 인식 부족
**문제**:
- 테스트 코드 vs 프로덕션 코드 구분 안 함
- 생성된 코드 vs 수동 작성 코드 구분 안 함

**개선 필요**:
```javascript
// 디렉토리별 분리 분석
analyzeDirectory('src/')      // 프로덕션
analyzeDirectory('test/')     // 테스트
analyzeDirectory('__generated__/')  // 제외
```

### 5. 신뢰도 기준 불명확
**현재**: 단순 퍼센트만 표시
**개선**: 신뢰도 해석 가이드 필요

```
90% 이상: 매우 강력한 패턴 (공식 규칙으로 채택 가능)
70-90%: 일반적 패턴 (팀 논의 필요)
50-70%: 혼재된 스타일 (정리 필요)
50% 미만: 명확한 패턴 없음 (새로 정립)
```

---

## 향후 개선 계획

### Phase 2: 정확도 개선
- [ ] 경로 검증 및 에러 핸들링 추가
- [ ] 최소 파일 수 체크 및 경고
- [ ] AST 기반 파싱 (Babel, TypeScript API)
- [ ] 주석 제거 후 분석
- [ ] 신뢰도 해석 가이드 추가

### Phase 3: 기능 확장
- [ ] Java 지원 (JavaParser)
- [ ] Python 지원 (ast 모듈)
- [ ] CSS/SCSS 지원
- [ ] Git 히스토리 기반 트렌드 분석
- [ ] ESLint 설정 자동 생성
- [ ] Prettier 설정 자동 생성

### Phase 4: 사용성 개선
- [ ] 웹 UI (시각화)
- [ ] CI/CD 통합 (GitHub Actions)
- [ ] 여러 프로젝트 비교
- [ ] 시간별 컨벤션 변화 추적
- [ ] 팀 컨벤션 투표 기능

---

## 성능 고려사항

### 현재 성능
- **소규모** (10-50 파일): ~50ms
- **중규모** (100-500 파일): ~200ms
- **대규모** (1000+ 파일): ~1초 (예상)

### 최적화 방안
1. **병렬 처리**: Worker Thread로 파일별 분석
2. **증분 분석**: 변경된 파일만 재분석
3. **캐싱**: 이전 분석 결과 재사용
4. **스트리밍**: 파일을 한 번에 메모리에 로드하지 않음

---

## 사용 사례

### 1. 신규 프로젝트 온보딩
```bash
node extract-conventions.js /path/to/project
# → CONVENTIONS.md를 신규 팀원에게 제공
```

### 2. 레거시 코드 문서화
```bash
node extract-conventions.js /legacy-project
# → 실제 사용 중인 컨벤션 파악
```

### 3. 팀 컨벤션 정립
```bash
# 1. 현재 상태 분석
node extract-conventions.js .
# 2. 팀 회의에서 공식 규칙 결정
# 3. ESLint/Prettier 설정에 반영
```

### 4. CI/CD 통합
```yaml
# .github/workflows/check-conventions.yml
- name: Extract conventions
  run: node tools/convention-extractor/extract-conventions.js .
- name: Check changes
  run: git diff --exit-code CONVENTIONS.md
```

---

## 비교: 유사 도구

| 도구 | 목적 | 차이점 |
|------|------|--------|
| ESLint | 코드 품질 검사 | 규칙 강제 (추출 아님) |
| Prettier | 코드 포맷팅 | 일관성 강제 (통계 없음) |
| SonarQube | 코드 품질 분석 | 컨벤션 추출 불가 |
| **Convention Extractor** | **실제 컨벤션 추출** | **통계 기반 자동 문서화** |

---

## 결론

### 강점
- ✅ 빠른 분석 (70ms for 85 files)
- ✅ 외부 의존성 없음 (순수 Node.js)
- ✅ 통계 기반 신뢰도 제공
- ✅ Markdown + JSON 출력
- ✅ 즉시 사용 가능 (ai-coding-rules 레포에서 검증됨)

### 약점
- ❌ 에러 핸들링 부족
- ❌ 정규식 기반 (AST 미사용)
- ❌ JavaScript/TypeScript만 지원
- ❌ 테스트 코드 없음
- ❌ Edge case 미처리

### 권장 사항
1. **즉시 개선**: 경로 검증, 에러 핸들링, 경고 메시지
2. **단기 개선**: AST 파싱, Java/Python 지원
3. **장기 개선**: 웹 UI, CI/CD 통합, ESLint 설정 생성

---

**작성일**: 2026-01-16
**버전**: 1.0.0
**작성자**: Claude (AI Coding Assistant)
**검토 필요**: 에러 핸들링, 정확도, 확장성
