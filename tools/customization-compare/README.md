# 고객사별 커스터마이징 비교 도구

솔루션 기반 프로젝트에서 Base 프로젝트와 고객사별 커스터마이징 버전을 비교하여 변경 사항을 자동 분석하는 도구입니다.

## 주요 기능

### 1. 구조 차이 분석
- 추가/삭제/수정된 파일 자동 감지
- 파일 타입별 분류 (Java, JS, Config 등)
- 변경 통계 제공

### 2. 코드 변경 분석
- 실제 코드 라인 변경 계산
- 추가/삭제된 메서드 자동 감지
- 설정 파일 변경 사항 추출

### 3. 인사이트 생성
- 신규 기능 자동 감지
- 보안 관련 변경 경고
- 대규모 변경 감지 및 권장사항 제공

### 4. 리포트 생성
- JSON 형식 (프로그램 활용)
- Markdown 형식 (사람이 읽기 편함)

## 설치

```bash
cd tools/customization-compare
npm install  # 현재는 외부 의존성 없음
```

## 사용법

### 기본 사용
```bash
node compare-projects.js <base-path> <customer-path> [output-dir]
```

### 예제
```bash
# 삼천리 커스터마이징 비교
node compare-projects.js test-data/base-project test-data/customer-samchully

# LG 커스터마이징 비교
node compare-projects.js test-data/base-project test-data/customer-lg

# npm 스크립트 사용
npm run test         # 삼천리 비교
npm run test-lg      # LG 비교
npm run test-all     # 모두 비교
```

### 실제 프로젝트 비교
```bash
# 실제 프로젝트 경로 사용
node compare-projects.js \
  /path/to/AutoCRM_Core \
  /path/to/AutoCRM_Samchully \
  ./reports/samchully
```

## 출력 결과

### 콘솔 출력 예시
```
================================================================================
🔍 고객사 커스터마이징 비교 분석
================================================================================
Base 프로젝트: /path/to/base-project
고객사 프로젝트: /path/to/customer-samchully (customer-samchully)

[ 1/3 ] 구조 차이 분석...
✓ 구조 차이 분석 완료
  추가: 2개, 삭제: 0개, 수정: 3개

[ 2/3 ] 코드 변경 분석...
📝 코드 차이 분석 중... (3개 파일)
✓ 코드 차이 분석 완료

[ 3/3 ] 신규 파일 분석...

✓ JSON 리포트 생성: ./reports/customization-samchully-2026-01-16.json
✓ Markdown 리포트 생성: ./reports/customization-samchully-2026-01-16.md

================================================================================
📋 분석 요약
================================================================================
고객사: customer-samchully
전체 변경: 5개 파일
  - 추가: 2개
  - 수정: 3개
  - 삭제: 0개
코드 변경: +150줄 / -10줄

신규 기능: InventoryService, OtpService

주요 인사이트:
  NEW_FEATURE: 2개의 신규 기능 추가됨
  SECURITY_CHANGES: 인증/보안 관련 코드 변경 감지
================================================================================
```

### 리포트 파일

#### JSON 리포트 (`reports/customization-*.json`)
```json
{
  "metadata": {
    "customerName": "customer-samchully",
    "analyzedAt": "2026-01-16T...",
    "executionTime": "245ms"
  },
  "overview": {
    "totalChanges": 5,
    "filesAdded": 2,
    "filesModified": 3,
    "linesAdded": 150,
    "linesRemoved": 10,
    "newFeatures": ["InventoryService", "OtpService"]
  },
  "insights": [...]
}
```

#### Markdown 리포트 (`reports/customization-*.md`)
- 한눈에 보기 쉬운 요약
- 파일별 상세 변경 사항
- 권장사항 포함

## 프로젝트 구조

```
customization-compare/
├── analyzers/
│   ├── structure-diff.js      # 파일 구조 비교
│   ├── code-diff.js            # 코드 변경 분석
│   └── config-diff.js          # 설정 파일 비교 (예정)
├── test-data/                  # Mock 테스트 데이터
│   ├── base-project/
│   ├── customer-samchully/
│   └── customer-lg/
├── reports/                    # 생성된 리포트
├── compare-projects.js         # 메인 스크립트
├── package.json
└── README.md
```

## 테스트 데이터

`test-data/` 디렉토리에 Mock 프로젝트가 포함되어 있습니다:

### Base Project
- 기본 CRM 솔루션
- DB 인증
- Spring Boot + MyBatis

### Customer: 삼천리 (Samchully)
**커스터마이징**:
- OTP 2단계 인증 추가
- 재고 관리 시스템 통합
- SMS 발송 기능
- ERP 연동

**변경 파일**:
- `LoginController.java` (+50줄)
- `login.js` (+35줄)
- `application.properties` (+10줄)
- `InventoryService.java` (신규, 60줄)
- `OtpService.java` (신규, 80줄)

### Customer: LG
**커스터마이징**:
- LDAP 통합 인증
- 전자결재 시스템 연동
- 조직도 연동
- Oracle DB 사용

**변경 파일**:
- `LoginController.java` (+30줄)
- `application.properties` (+7줄)
- `ApprovalService.java` (신규, 90줄)
- `LdapService.java` (신규, 70줄)

자세한 내용은 [`test-data/README.md`](test-data/README.md)를 참조하세요.

## 향후 개선 사항

- [ ] HTML 리포트 생성 (performance-test처럼)
- [ ] 설정 파일 상세 비교 (config-diff.js)
- [ ] Git diff 활용 (더 정확한 변경 추적)
- [ ] 데이터베이스 스키마 비교
- [ ] 의존성(pom.xml, package.json) 비교
- [ ] 여러 고객사 일괄 비교
- [ ] CI/CD 통합

## 사용 사례

### 1. 신규 고객사 온보딩
```bash
# Base와 비교하여 필요한 커스터마이징 파악
node compare-projects.js base-project new-customer
```

### 2. 고객사 버전 업그레이드
```bash
# Base 업데이트 시 고객사에 영향 분석
node compare-projects.js base-v1 base-v2
node compare-projects.js base-v2 customer-current
```

### 3. 코드 리뷰 자동화
```bash
# 커스터마이징 변경 사항 자동 리뷰
node compare-projects.js base customer-branch
```

### 4. 문서 자동 생성
```bash
# 고객사별 커스터마이징 문서 자동 생성
node compare-projects.js base customer ./docs/customization
```

## 라이선스

MIT

---

**생성일**: 2026-01-16
**버전**: 1.0.0
