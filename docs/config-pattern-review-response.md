# 공통코드 패턴 설정 분리 및 --with-db 통합 검토 결과

**검토자**: Claude Code + Gemini CLI (Rate Limit 후 재시도 성공)
**검토일**: 2026-01-14
**참조**: docs/config-pattern-review-request.md

---

## 검토 결과

### Q1. 설정 파일 구조

**판단**: ✅ **적절함**

**의견**:
`common_code_detection` 섹션을 별도로 분리한 구조는 적절합니다.

- `db` 섹션과 분리되어 관심사가 명확히 구분됨
- `$comment` 필드로 용도 설명 제공
- 향후 다른 탐지 설정 (예: `api_detection`, `entity_detection`) 추가 시 일관된 패턴 유지 가능

**개선 제안**:
```json
{
  "common_code_detection": {
    "enabled": true,  // 탐지 자체를 비활성화하는 옵션 추가
    "table_patterns": [...]
  }
}
```

### Q2. 폴백 전략

**판단**: ⚠️ **개선 필요**

**의견**:
빈 배열 `[]` 지정 시 SQL 문법 오류가 발생할 수 있습니다.

**문제 코드** (mysql.js):
```javascript
const codeTablePatterns = config.commonCodePatterns || DEFAULT_CODE_PATTERNS;
// 빈 배열이면 아래 쿼리에서 WHERE ... AND () 가 되어 문법 오류
```

**수정 권장**:
```javascript
const codeTablePatterns = (config.commonCodePatterns && config.commonCodePatterns.length > 0)
    ? config.commonCodePatterns
    : DEFAULT_CODE_PATTERNS;

// 또는 빈 배열이면 공통코드 탐지 자체를 스킵
if (!codeTablePatterns || codeTablePatterns.length === 0) {
    console.log('[INFO] 공통코드 패턴이 없어 탐지를 건너뜁니다.');
    return [];
}
```

### Q3. --with-db 통합

**판단**: ✅ **적절함**

**의견**:
선택적 활성화 방식이 적절합니다.

- DB 연결이 필요하므로 기본 비활성화가 올바름
- `--db-config` 지정 시 자동 활성화는 편의성 좋음
- Node.js 미설치 시 graceful fallback 처리됨

**추가 제안**:
- `full` 모드에서도 `--with-db` 지원 필요 (현재 `scan` 모드만 지원)

### Q4. 사용 설명서 품질

**판단**: ✅ **양호**

**의견**:
`docs/db-analyzer-guide.md`가 충분히 상세합니다.

**보완 제안**:
1. **Quick Start** 섹션 추가 (3줄 이내 최소 실행 예시)
2. **환경변수 목록** 표로 정리 (DB_TYPE, DB_HOST 등)
3. **Oracle Instant Client** 설치 상세 가이드 (OS별)

### Q5. 패턴 추가 제안

**추가 패턴**:

| 패턴 | 설명 | 출처 |
|------|------|------|
| `SYS_CD` | 시스템 코드 | 정부/공공 SI |
| `BAS_CD` | 기본 코드 | 금융권 |
| `STD_CD` | 표준 코드 | 대기업 SI |
| `LOOKUP` | 참조 테이블 | 외국계 |
| `REF_` | Reference 접두사 | 범용 |
| `MST_CD` | 마스터 코드 | 제조업 |
| `_TYPE` | 유형 코드 | 범용 |
| `COMM_CD` | Common Code 변형 | 범용 |
| `CM_CD` | Common 약어 | 금융권 |
| `T_CODE` | Table Code | 공공 SI |
| `REF_CODE` | Reference Code | 외국계 |
| `CD_GRP` | 코드 그룹 테이블 | 범용 |
| `CD_DTL` | 코드 상세 테이블 | 범용 |

**권장 전체 패턴 목록**:
```json
"table_patterns": [
  "TB_CODE", "TB_COMMON_CODE", "CMM_CD", "COMMON_CODE",
  "TB_CD", "SYS_CODE", "CODE_MST", "CD_MST",
  "GRP_CD", "DTL_CD", "COM_CD", "CMMN_CODE",
  "CATEGORY", "CAT_CODE", "CODES", "CDS",
  "_CODE_", "_CD_",
  "SYS_CD", "BAS_CD", "STD_CD", "MST_CD",
  "LOOKUP", "REF_", "_TYPE",
  "COMM_CD", "CM_CD", "T_CODE", "REF_CODE",
  "CD_GRP", "CD_DTL"
]
```

---

## 종합 의견

구현이 전반적으로 잘 되어 있습니다. 핵심 수정 사항:

1. **빈 배열 처리**: 반드시 수정 필요 (SQL 오류 방지)
2. **enabled 옵션**: 선택적 추가 권장
3. **full 모드 지원**: `--with-db`를 full 모드에서도 사용 가능하게

위 사항 반영 후 운영 환경에 적용해도 무방합니다.
