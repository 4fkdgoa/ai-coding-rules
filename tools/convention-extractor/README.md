# 컨벤션 자동 추출 도구 (Convention Extractor)

기존 코드베이스를 분석하여 실제 사용 중인 코딩 컨벤션을 자동으로 추출하고 문서화하는 도구입니다.

## 주요 기능

### 1. 파일 구조 분석
- 디렉토리 구조 패턴
- 파일명 규칙 (kebab-case, camelCase, PascalCase 등)
- 파일 타입 분포

### 2. 코딩 스타일 분석
- 들여쓰기 (탭 vs 공백, 공백 개수)
- 줄 길이 통계 (평균, 중간값, 권장)
- 따옴표 선호도 (single, double, backtick)
- 세미콜론 사용 여부
- 중괄호 스타일 (K&R vs Allman)

### 3. 네이밍 컨벤션 분석
- 함수/메서드명 패턴
- 변수명 패턴
- 상수명 패턴
- 클래스명 패턴
- 함수 접두사 패턴 (get*, set*, is* 등)

### 4. 기술 스택 감지
- package.json 분석
- 주요 프레임워크/라이브러리 식별
- 프로젝트 타입 추정 (Frontend, Backend, Full-stack)

## 설치

```bash
cd tools/convention-extractor
npm install  # 현재는 외부 의존성 없음
```

## 사용법

### 기본 사용
```bash
node extract-conventions.js <project-path> [output-file]
```

### 예제
```bash
# 현재 디렉토리 분석
node extract-conventions.js .

# 상위 디렉토리 분석 (ai-coding-rules 레포)
node extract-conventions.js ../..

# 출력 파일 지정
node extract-conventions.js ../.. ./reports/CONVENTIONS.md

# npm 스크립트 사용
npm test  # ai-coding-rules 레포 분석
```

## 출력 결과

### 1. Markdown 문서 (`CONVENTIONS.md`)
- 사람이 읽기 편한 형식
- 프로젝트 코딩 규칙 요약
- 권장 코딩 가이드라인

**예시**:
```markdown
# 프로젝트 코딩 컨벤션

## 코딩 스타일
- 들여쓰기: 공백 4칸
- 줄 길이: 80자 이하 권장
- 따옴표: 작은따옴표 (') 사용

## 네이밍 컨벤션
- 함수/메서드: camelCase
- 변수: camelCase
- 상수: UPPER_SNAKE_CASE
- 클래스: PascalCase
```

### 2. JSON 데이터 (`CONVENTIONS.json`)
- 프로그램이 파싱 가능
- 상세 통계 데이터
- CI/CD 통합용

### 3. 콘솔 요약
- 실시간 분석 진행 상황
- 주요 통계 요약

## 분석 결과 예시

### ai-coding-rules 레포 분석 결과
```
파일: 85개
디렉토리: 57개

코딩 스타일:
  - 들여쓰기: 공백 4칸 (50% 신뢰도)
  - 줄 길이: 평균 35자, 권장 80자
  - 따옴표: single (72%)

네이밍 컨벤션:
  - 함수: camelCase (142개, 100% 신뢰도)
  - 변수: camelCase (355개, 96% 신뢰도)
  - 클래스: PascalCase (9개)
  - 상수: UPPER_SNAKE_CASE (14개)

함수명 접두사:
  - get*: 28개
  - generate*: 7개
  - find*: 4개
```

## 프로젝트 구조

```
convention-extractor/
├── analyzers/
│   ├── file-structure-analyzer.js   # 파일 구조 분석
│   ├── coding-style-analyzer.js     # 코딩 스타일 분석
│   ├── naming-convention-analyzer.js # 네이밍 컨벤션 분석
│   └── tech-stack-detector.js       # 기술 스택 감지
├── extract-conventions.js           # 메인 스크립트
├── reports/                         # 생성된 리포트
│   ├── CONVENTIONS.md
│   └── CONVENTIONS.json
├── package.json
└── README.md
```

## 사용 사례

### 1. 신규 프로젝트 온보딩
```bash
# 프로젝트 코딩 규칙 자동 생성
node extract-conventions.js /path/to/project ./docs/CODING_RULES.md
# → 신규 팀원에게 제공
```

### 2. 레거시 코드베이스 문서화
```bash
# 문서화되지 않은 레거시 프로젝트 분석
node extract-conventions.js /path/to/legacy-project
# → 실제 사용 중인 컨벤션 파악
```

### 3. 코드 일관성 검증
```bash
# 정기적으로 컨벤션 추출하여 일관성 확인
node extract-conventions.js . ./reports/conventions-$(date +%Y%m%d).md
```

### 4. CI/CD 통합
```yaml
# GitHub Actions
- name: Extract conventions
  run: |
    node tools/convention-extractor/extract-conventions.js .
    git diff --exit-code CONVENTIONS.md || echo "Conventions changed!"
```

## 분석 대상 파일 타입

현재 지원:
- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`

향후 지원 예정:
- Java: `.java`
- Python: `.py`
- CSS/SCSS: `.css`, `.scss`

## 성능

- **소규모 프로젝트** (10-50 파일): ~50ms
- **중규모 프로젝트** (100-500 파일): ~200ms
- **대규모 프로젝트** (1000+ 파일): ~1초

**실제 테스트**:
- ai-coding-rules 레포 (85 파일): 70ms

## 한계 및 향후 개선

### 현재 한계
1. JavaScript/TypeScript만 상세 분석
2. 간단한 정규식 기반 파싱 (AST 미사용)
3. 컨텍스트 인식 부족 (주석 vs 실제 코드)

### 향후 개선
- [ ] Java, Python 지원
- [ ] AST 기반 정확한 파싱
- [ ] 주석 스타일 분석
- [ ] Git 히스토리 기반 트렌드 분석
- [ ] ESLint/Prettier 설정 자동 생성
- [ ] 웹 UI (시각화)

## 활용 팁

### 1. 신뢰도 확인
- 신뢰도 70% 이상: 강력한 패턴
- 신뢰도 50-70%: 일반적 패턴
- 신뢰도 50% 미만: 혼재된 스타일 (정리 필요)

### 2. 팀 컨벤션 정립
```bash
# 1. 현재 상태 분석
node extract-conventions.js .

# 2. 생성된 문서 리뷰
# 3. 팀 회의에서 공식 규칙 결정
# 4. ESLint/Prettier 설정에 반영
```

### 3. 리팩토링 가이드
- 낮은 신뢰도 항목부터 개선
- 함수명 접두사 패턴 활용
- 파일명 규칙 통일

## 관련 도구

| 도구 | 목적 | 차이점 |
|------|------|--------|
| ESLint | 린트 규칙 강제 | 컨벤션 추출 불가 |
| Prettier | 코드 포맷팅 | 스타일 통계 없음 |
| **convention-extractor** | **실제 사용 컨벤션 추출** | **통계 기반 분석** |

## 기여

버그 리포트, 기능 제안 환영합니다!

## 라이선스

MIT

---

**생성일**: 2026-01-16
**버전**: 1.0.0
**작성자**: Claude (AI Coding Assistant)
