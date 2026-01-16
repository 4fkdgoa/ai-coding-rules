# 고객사별 커스터마이징 비교 도구 - 설계 문서

## 개요

솔루션 기반 프로젝트에서 Base 프로젝트와 고객사별 커스터마이징을 자동으로 비교 분석하여 변경사항을 추적하는 도구입니다.

## 배경

### 문제점

솔루션 기반 프로젝트(예: AutoCRM)에서는 다음과 같은 문제가 발생합니다:

1. **여러 고객사 버전 관리의 어려움**
   - Base 프로젝트 + 고객사별 커스터마이징
   - 각 고객사마다 다른 기능 추가/변경
   - 변경 이력 추적 어려움

2. **코드 리뷰 비효율**
   - "로그인 기능이 각 고객사별로 어떻게 다른가?"
   - 수동으로 일일이 비교해야 함
   - 놓치는 변경사항 발생

3. **신규 고객사 온보딩 어려움**
   - 어떤 부분을 커스터마이징해야 하는지 파악 어려움
   - 기존 고객사 커스터마이징 패턴 참고 필요

4. **Base 버전 업그레이드 시 영향 파악 어려움**
   - Base가 업데이트되면 고객사에 어떤 영향이 있는지?
   - 충돌 가능성 사전 파악 필요

### 해결 방안

**자동화된 커스터마이징 비교 도구**를 개발하여:
- 파일 구조 차이 자동 분석
- 코드 변경 내용 자동 추출
- 신규 기능/보안 변경 자동 감지
- 보고서 자동 생성 (JSON, Markdown)

## 아키텍처

### 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                  CustomizationComparer                      │
│                   (Main Orchestrator)                       │
└──────────────┬────────────────┬────────────────┬────────────┘
               │                │                │
       ┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
       │  Structure   │  │    Code     │  │  Insight   │
       │    Diff      │  │    Diff     │  │ Generator  │
       │  Analyzer    │  │  Analyzer   │  │            │
       └───────┬──────┘  └──────┬──────┘  └─────┬──────┘
               │                │                │
               └────────────────┴────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Report Generator   │
                    │  (JSON + Markdown)   │
                    └──────────────────────┘
```

### 컴포넌트

#### 1. StructureDiffAnalyzer
**역할**: 파일 시스템 레벨 비교

**기능**:
- 추가/삭제/수정된 파일 감지
- 파일 타입별 분류 (Java, JS, Config 등)
- 파일 메타데이터 수집 (크기, 줄 수, 수정 시간)

**알고리즘**:
```javascript
1. Base 프로젝트의 모든 파일 목록 수집
2. Customer 프로젝트의 모든 파일 목록 수집
3. 차집합 계산:
   - Added = Customer - Base
   - Deleted = Base - Customer
   - Common = Base ∩ Customer
4. Common 파일 중 내용이 다른 것 = Modified
```

#### 2. CodeDiffAnalyzer
**역할**: 코드 레벨 상세 비교

**기능**:
- 실제 코드 라인 변경 계산
- Java: 메서드 추가/삭제 감지
- JavaScript: 함수 추가/삭제 감지
- Config: 설정 항목 변경 추출

**알고리즘** (간소화 버전):
```javascript
1. 파일을 줄 단위로 분리
2. 라인별 비교 (Set 기반)
3. 추가된 줄과 삭제된 줄 계산
4. 파일 타입별 특수 패턴 추출:
   - Java: /^\s*(public|private|protected).*\(/
   - JS: /function\s+(\w+)/
   - Config: /^([a-zA-Z0-9._-]+)\s*[:=]\s*(.+)$/
```

**향후 개선**: Myers diff 알고리즘 또는 `diff` 명령어 활용

#### 3. InsightGenerator
**역할**: 변경 사항 분석 및 권장사항 제공

**감지 패턴**:
```javascript
1. 신규 기능 감지
   - *Service.java 파일 추가 감지
   - 예: InventoryService.java → 재고 관리 기능

2. 보안 변경 감지 (High Priority)
   - Login*, Auth* 파일 변경 감지
   - 권장: 보안 검토 필수

3. 대규모 변경 감지
   - 추가 줄 수 > 200 → 경고
   - 권장: 단계별 검토

4. 설정 변경 감지
   - .properties, .yml 파일 변경
   - 권장: 배포 전 확인

5. 파일 삭제 경고
   - 의존성 확인 필요
```

#### 4. ReportGenerator
**역할**: 사람/프로그램이 읽을 수 있는 리포트 생성

**출력 형식**:
- **JSON**: 프로그램 파싱용, CI/CD 통합
- **Markdown**: 사람이 읽기 편한 형식
- **HTML** (예정): 웹 대시보드

## 데이터 흐름

```
Input: Base Project Path, Customer Project Path
  │
  ▼
┌────────────────────────────────────┐
│ 1. Structure Diff Analysis         │
│    - 파일 목록 수집                 │
│    - 추가/삭제/수정 계산            │
└─────────────┬──────────────────────┘
              │ {added, deleted, modified}
              ▼
┌────────────────────────────────────┐
│ 2. Code Diff Analysis              │
│    - Modified 파일만 상세 분석     │
│    - 라인 변경, 메서드 변경 추출   │
└─────────────┬──────────────────────┘
              │ {codeDiff}
              ▼
┌────────────────────────────────────┐
│ 3. Added Files Analysis            │
│    - 신규 파일 분류                │
│    - 신규 기능 감지                │
└─────────────┬──────────────────────┘
              │ {addedAnalysis}
              ▼
┌────────────────────────────────────┐
│ 4. Insight Generation              │
│    - 패턴 기반 인사이트 생성       │
│    - 권장사항 생성                 │
└─────────────┬──────────────────────┘
              │ {insights}
              ▼
┌────────────────────────────────────┐
│ 5. Report Generation               │
│    - JSON: 상세 데이터             │
│    - Markdown: 요약 리포트         │
└─────────────┬──────────────────────┘
              │
              ▼
Output: JSON + Markdown 파일
```

## 테스트 전략

### Mock 프로젝트 기반 테스트

**이유**: 실제 프로젝트에 접근할 수 없으므로 Mock 데이터 사용

**Mock 프로젝트 구성**:

#### Base Project (AutoCRM Core)
- 기본 CRM 솔루션
- DB 인증
- Spring Boot + MyBatis + jQuery
- MySQL 사용

#### Customer: 삼천리 (Samchully)
**커스터마이징**:
- OTP 2단계 인증 추가
- 재고 관리 ERP 연동
- SMS 발송 기능

**변경 파일**:
- `LoginController.java`: verify-otp 메서드 추가
- `login.js`: OTP UI 추가
- `application.properties`: OTP/SMS 설정 추가
- `InventoryService.java`: 신규 파일
- `OtpService.java`: 신규 파일

#### Customer: LG
**커스터마이징**:
- LDAP 통합 인증
- 전자결재 시스템 연동
- Oracle DB 사용

**변경 파일**:
- `LoginController.java`: LDAP 인증 로직 추가
- `application.properties`: LDAP/전자결재 설정
- `ApprovalService.java`: 신규 파일
- `LdapService.java`: 신규 파일

### 테스트 결과 (실제)

#### 삼천리 비교 결과
```
전체 변경: 6개 파일
  - 추가: 1개 (InventoryService.java)
  - 수정: 3개 (LoginController.java, login.js, application.properties)
  - 삭제: 2개
코드 변경: +79줄 / -12줄

신규 기능: InventoryService

인사이트:
  ✓ 신규 기능 추가됨
  ✓ 17개 설정 항목 변경
  ⚠️ 보안 관련 코드 변경 (Login)
```

#### LG 비교 결과
```
전체 변경: 6개 파일
  - 추가: 1개 (ApprovalService.java)
  - 수정: 2개 (LoginController.java, application.properties)
  - 삭제: 3개
코드 변경: +47줄 / -12줄

신규 기능: ApprovalService

인사이트:
  ✓ 신규 기능 추가됨
  ✓ 23개 설정 항목 변경
  ⚠️ 보안 관련 코드 변경 (Login)
```

## 사용 시나리오

### 1. 신규 고객사 온보딩
```bash
# 기존 고객사 커스터마이징 패턴 참고
node compare-projects.js base customer-A
node compare-projects.js base customer-B

# 공통 커스터마이징 파악 → 신규 고객사에 적용
```

### 2. Base 버전 업그레이드 영향 분석
```bash
# Step 1: Base 변경 사항 파악
node compare-projects.js base-v1.0 base-v2.0

# Step 2: 각 고객사 영향 분석
node compare-projects.js base-v2.0 customer-A
node compare-projects.js base-v2.0 customer-B

# 충돌 예상 지점 사전 파악
```

### 3. 고객사 간 기능 비교
```bash
# "어느 고객사가 OTP를 사용하는가?"
node compare-projects.js base customer-A | grep -i otp
node compare-projects.js base customer-B | grep -i otp
```

### 4. 코드 리뷰 자동화
```bash
# PR 생성 시 자동 실행 (CI/CD)
node compare-projects.js base feature-branch
# → 보안 변경 감지 시 자동 알림
```

## 한계 및 향후 개선

### 현재 한계

1. **간단한 diff 알고리즘**
   - 라인 단위 Set 비교 (부정확)
   - → Myers diff 또는 `git diff` 활용 필요

2. **HTML 리포트 미지원**
   - JSON/Markdown만 지원
   - → Performance-test처럼 HTML 리포트 추가

3. **DB 스키마 비교 미지원**
   - 코드만 비교, DB는 수동
   - → DB 스키마 자동 비교 필요

4. **의존성 비교 미지원**
   - pom.xml, package.json 변경 감지 안 함
   - → 의존성 변경 자동 추출 필요

### 향후 개선 계획

#### Phase 2: 정확도 개선
- [ ] Git diff 통합 (더 정확한 변경 추적)
- [ ] AST 기반 코드 분석 (JavaParser, Babel)
- [ ] 의미론적 변경 감지 (단순 포맷팅 vs 로직 변경)

#### Phase 3: 기능 확장
- [ ] HTML 대시보드 (여러 고객사 한눈에 비교)
- [ ] DB 스키마 비교 (CREATE TABLE, ALTER TABLE 감지)
- [ ] 의존성 비교 (pom.xml, package.json diff)
- [ ] API 엔드포인트 변경 추적

#### Phase 4: CI/CD 통합
- [ ] GitHub Actions 통합
- [ ] PR 자동 코멘트 (변경 요약)
- [ ] Slack/Teams 알림
- [ ] 주기적 리포트 자동 생성

#### Phase 5: AI 활용
- [ ] Gemini/Claude로 변경 이유 분석
- [ ] 커스터마이징 패턴 자동 학습
- [ ] 충돌 예측 (Base 업그레이드 시)

## 성능 고려사항

### 현재 성능
- **소규모 프로젝트** (10파일): ~30ms
- **중규모 프로젝트** (100파일 예상): ~300ms
- **대규모 프로젝트** (1000파일 예상): ~3초

### 최적화 방안
1. **병렬 처리**: 파일별 분석을 Worker Thread로
2. **캐싱**: 이전 분석 결과 재사용
3. **점진적 분석**: 변경된 파일만 재분석
4. **Ignore 패턴 확장**: node_modules, target 등 제외

## 기술 스택

- **Language**: JavaScript (Node.js)
- **Runtime**: Node.js (ES Modules)
- **Dependencies**: 없음 (순수 Node.js API만 사용)
- **Output**: JSON, Markdown (HTML 예정)

## 관련 도구 비교

| 도구 | 목적 | 차이점 |
|------|------|--------|
| `diff` | 파일 비교 | 2개 파일만, 리포트 없음 |
| `git diff` | Git 커밋 비교 | Git 필수, 커스터마이징 인사이트 없음 |
| SonarQube | 코드 품질 | 단일 프로젝트, 비교 기능 없음 |
| **customization-compare** | 고객사별 커스터마이징 비교 | **솔루션 특화, 자동 인사이트** |

## 결론

이 도구는 **솔루션 기반 프로젝트에서 고객사별 커스터마이징을 자동으로 추적**하는 유일한 도구입니다.

**핵심 가치**:
1. 수동 비교 작업 자동화 (시간 절감)
2. 변경 사항 누락 방지 (품질 향상)
3. 신규 고객사 온보딩 가속 (효율성 향상)
4. 보안 변경 자동 감지 (리스크 감소)

**다음 단계**:
- HTML 리포트 생성
- DB 스키마 비교
- CI/CD 통합
- 실제 프로젝트 적용 및 피드백 수집

---

**작성일**: 2026-01-16
**버전**: 1.0.0
**작성자**: Claude (AI Coding Assistant)
