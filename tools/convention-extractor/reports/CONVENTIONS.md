# 프로젝트 코딩 컨벤션

> 자동 생성됨: 1/16/2026, 2:38:51 AM
> 프로젝트: `ai-coding-rules`

---

## 📁 파일 구조

- **총 파일**: 85개
- **총 디렉토리**: 57개
- **평균 깊이**: 2.4레벨

### 파일명 컨벤션

- **패턴**: kebab-case (소문자-하이픈)
- **사용률**: 40%

### 주요 파일 타입

| 확장자 | 개수 | 비율 |
|--------|------|------|
| `.md` | 39 | 46% |
| `.js` | 15 | 18% |
| `.sh` | 7 | 8% |
| `.ps1` | 6 | 7% |
| `.json` | 6 | 7% |

## 🎨 코딩 스타일

### 들여쓰기

- **타입**: 공백 4칸
- **신뢰도**: 50%

### 줄 길이

- **평균**: 35자
- **중간값**: 32자
- **95 백분위**: 75자
- **권장**: 80자 이하

### 따옴표

- **선호**: 작은따옴표 (')
- **신뢰도**: 72%

### 세미콜론

- **사용**: 필수 사용
- **신뢰도**: 71%

## 📝 네이밍 컨벤션

### 함수/메서드

- **패턴**: camelCase
- **신뢰도**: 100%
- **예시**: `getTables`, `getCommonCodes`, `executeQuery`, `getTables`, `getCommonCodes`

### 함수명 접두사 패턴

- `get*`: 28개
- `generate*`: 7개
- `find*`: 4개
- `check*`: 2개
- `handle*`: 2개

### 변수

- **패턴**: camelCase
- **신뢰도**: 96%

### 상수

- **패턴**: UPPER_SNAKE_CASE
- **개수**: 14개
- **예시**: `DEFAULT_LIMIT`, `DEFAULT_CODE_PATTERNS`, `DEFAULT_LIMIT`, `DEFAULT_CODE_PATTERNS`, `DEFAULT_LIMIT`

### 클래스

- **패턴**: PascalCase
- **개수**: 9개
- **예시**: `ON`, `CodingStyleAnalyzer`, `FileStructureAnalyzer`, `NamingConventionAnalyzer`, `TechStackDetector`

---

## 📋 권장 코딩 규칙 (추출 결과 기반)

### 일반 규칙

- **들여쓰기**: 공백 4칸 사용
- **줄 길이**: 80자 이하 권장
- **따옴표**: 작은따옴표 (') 사용
- **세미콜론**: 필수 사용

### 네이밍 규칙

- **함수/메서드**: camelCase
- **변수**: camelCase
- **상수**: UPPER_SNAKE_CASE
- **클래스**: PascalCase

---

**생성 도구**: Convention Extractor v1.0
**분석 시간**: 70ms
