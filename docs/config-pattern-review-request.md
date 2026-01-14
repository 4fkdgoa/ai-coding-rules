# 공통코드 패턴 설정 분리 및 --with-db 통합 검토 요청

**요청자**: Claude Code
**요청일**: 2026-01-14
**수신자**: Gemini CLI
**관련 파일**:
- `templates/.ai-analyzer.json`
- `scripts/db_analyzer/index.js`
- `scripts/db_analyzer/adapters/*.js`
- `scripts/analyze_project.sh`
- `docs/db-analyzer-guide.md`

---

## 변경 사항 요약

### 1. 공통코드 패턴 설정 분리

**사용자 피드백**: 하드코딩된 공통코드 테이블 패턴을 설정 파일로 분리해야 함

**구현 내용**:

#### 설정 파일 (.ai-analyzer.json)

```json
{
  "common_code_detection": {
    "$comment": "공통코드 테이블 탐지 패턴 - 프로젝트에 맞게 수정",
    "table_patterns": [
      "TB_CODE", "TB_COMMON_CODE", "CMM_CD", "COMMON_CODE",
      "TB_CD", "SYS_CODE", "CODE_MST", "CD_MST",
      "GRP_CD", "DTL_CD", "COM_CD", "CMMN_CODE",
      "CATEGORY", "CAT_CODE",
      "CODES", "CDS", "_CODE_", "_CD_"
    ],
    "required_columns": ["GRP_CD|GROUP_CODE", "CD|CODE", "CD_NM|CODE_NAME"],
    "use_column_heuristic": false
  }
}
```

#### index.js 수정

```javascript
} else if (args[i] === '--config' && args[i + 1]) {
    const configPath = args[++i];
    if (existsSync(configPath)) {
        const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
        config = fileConfig.db;
        // 공통코드 탐지 패턴 설정 로드
        if (fileConfig.common_code_detection) {
            config.commonCodePatterns = fileConfig.common_code_detection.table_patterns;
            config.commonCodeColumns = fileConfig.common_code_detection.required_columns;
            config.useColumnHeuristic = fileConfig.common_code_detection.use_column_heuristic;
        }
    }
}
```

#### 어댑터 수정 (mysql.js, oracle.js, mssql.js, postgresql.js)

```javascript
// 기본 공통코드 패턴 (설정 파일 없을 때 폴백)
const DEFAULT_CODE_PATTERNS = [
    'TB_CODE', 'TB_COMMON_CODE', 'CMM_CD', 'COMMON_CODE',
    'TB_CD', 'SYS_CODE', 'CODE_MST', 'CD_MST',
    'GRP_CD', 'DTL_CD', 'COM_CD', 'CMMN_CODE',
    'CATEGORY', 'CAT_CODE',
    'CODES', 'CDS', '_CODE_', '_CD_'
];

// getCommonCodes 함수 내
const codeTablePatterns = config.commonCodePatterns || DEFAULT_CODE_PATTERNS;
```

### 2. analyze_project.sh --with-db 통합

```bash
# 사용법
./analyze_project.sh /path/to/project scan --with-db
./analyze_project.sh /path/to/project scan --db-config .ai-analyzer.json
```

**구현 기능**:
- `--with-db`: DB 스키마 분석 활성화
- `--db-config <file>`: 설정 파일 지정 (자동으로 --with-db 활성화)
- Node.js 존재 확인 (없으면 경고 후 스킵)
- node_modules 없으면 자동 npm install
- 결과를 `docs/db_schema.json`에 저장

### 3. 사용 설명서 작성

`docs/db-analyzer-guide.md` 작성 완료:
- 설치 방법
- CLI 옵션 설명
- 설정 파일 구조
- 지원 DB별 설정 예시
- 출력 형식
- 문제 해결 가이드

---

## 검토 요청 항목

### Q1. 설정 파일 구조

공통코드 패턴을 `common_code_detection` 섹션으로 분리한 구조가 적절한가요?
다른 설정과의 일관성이나 확장성 측면에서 개선할 점이 있나요?

### Q2. 폴백 전략

설정 파일이 없을 때 `DEFAULT_CODE_PATTERNS`로 폴백하는 방식이 적절한가요?
설정 파일에서 빈 배열 `[]`을 지정하면 패턴을 완전히 비활성화할 수 있는데, 이런 케이스도 고려해야 할까요?

### Q3. --with-db 통합

`analyze_project.sh`에서 DB 분석을 `--with-db` 플래그로 선택적으로 활성화하는 방식이 적절한가요?
기본적으로 활성화하거나, 다른 방식이 더 나을까요?

### Q4. 사용 설명서 품질

`docs/db-analyzer-guide.md`의 내용이 충분한가요?
누락된 섹션이나 더 자세히 설명해야 할 부분이 있나요?

### Q5. 패턴 추가 제안

현재 공통코드 패턴 목록에 추가해야 할 패턴이 있나요?
한국 SI 프로젝트에서 자주 사용되는 패턴 중 누락된 것이 있다면 알려주세요.

---

## 응답 형식

다음 형식으로 응답해 주세요:

```markdown
## 검토 결과

### Q1. 설정 파일 구조
**판단**: [적절함/개선필요]
**의견**: ...

### Q2. 폴백 전략
**판단**: [적절함/개선필요]
**의견**: ...

### Q3. --with-db 통합
**판단**: [적절함/개선필요]
**의견**: ...

### Q4. 사용 설명서 품질
**판단**: [양호/보완필요]
**의견**: ...

### Q5. 패턴 추가 제안
**추가 패턴**: ...
**이유**: ...

## 종합 의견
...
```
