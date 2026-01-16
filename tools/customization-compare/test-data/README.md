# Mock 프로젝트 테스트 데이터

이 디렉토리는 고객사별 커스터마이징 비교 도구를 테스트하기 위한 Mock 프로젝트입니다.

## 프로젝트 구조

```
test-data/
├── base-project/           # 기본 AutoCRM 솔루션
├── customer-samchully/     # 삼천리 커스터마이징
└── customer-lg/            # LG 커스터마이징
```

## 시나리오

### Base Project (AutoCRM Core)
**기본 솔루션**: 범용 CRM 시스템

**주요 기능**:
- 기본 DB 인증 (ID/PW)
- 사용자 관리
- 세션 관리

**기술 스택**:
- Spring Boot 2.7.10
- MyBatis
- MySQL
- jQuery

---

### Customer: 삼천리 (Samchully)
**업종**: 에너지/제조업

**커스터마이징 내용**:

#### 1. OTP 2단계 인증 추가
- **파일**: `LoginController.java` (변경), `login.js` (변경)
- **변경사항**:
  - `/auth/verify-otp` 엔드포인트 추가
  - OTP 발송/검증 로직 추가
  - 프론트엔드 2단계 인증 UI 추가

#### 2. 재고 관리 시스템 통합
- **파일**: `InventoryService.java` (신규)
- **변경사항**:
  - 삼천리 ERP 시스템과 재고 동기화
  - 창고별 재고 조회
  - 5분 주기 자동 동기화

#### 3. 설정 변경
- **파일**: `application.properties`
- **변경사항**:
  - `auth.type=DATABASE_WITH_OTP`
  - `auth.otp.enabled=true`
  - SMS 발송 설정 추가
  - 재고 동기화 설정 추가

---

### Customer: LG
**업종**: 대기업/그룹

**커스터마이징 내용**:

#### 1. LDAP 통합 인증
- **파일**: `LoginController.java` (변경)
- **변경사항**:
  - LDAP 우선 인증 (LG 임직원)
  - DB 인증 폴백 (외부 파트너)
  - 부서/직급 정보 자동 동기화

#### 2. 전자결재 시스템 연동
- **파일**: `ApprovalService.java` (신규)
- **변경사항**:
  - LG 그룹웨어 API 연동
  - 결재 요청/조회/승인 프로세스
  - LDAP 조직도 기반 결재선 자동 생성

#### 3. 설정 변경
- **파일**: `application.properties`
- **변경사항**:
  - `auth.type=LDAP_PRIMARY`
  - LDAP 서버 연결 정보
  - 전자결재 API 설정
  - Oracle DB로 변경

---

## 차이점 요약

| 항목 | Base | 삼천리 | LG |
|------|------|--------|-----|
| **인증 방식** | DB | DB + OTP | LDAP + DB |
| **추가 기능** | - | 재고 관리 | 전자결재 |
| **데이터베이스** | MySQL | MySQL | Oracle |
| **신규 파일** | - | InventoryService.java | ApprovalService.java, LdapService.java |
| **JS 변경** | - | OTP UI 추가 | 인증 방식 선택 UI |

---

## 테스트 시나리오

### 1. 구조 차이 분석
```bash
node ../compare-structure.js base-project customer-samchully

예상 결과:
- 추가된 파일: InventoryService.java, OtpService.java
- 수정된 파일: LoginController.java, login.js, application.properties
```

### 2. 코드 변경 분석
```bash
node ../compare-code.js base-project customer-samchully LoginController.java

예상 결과:
- verify-otp 메서드 추가 (30줄)
- login 메서드 변경: OTP 발송 로직 추가 (15줄)
```

### 3. 설정 차이 분석
```bash
node ../compare-config.js base-project customer-samchully

예상 결과:
- auth.type: DATABASE → DATABASE_WITH_OTP
- 추가 설정: auth.otp.*, sms.*, inventory.*
```

---

## 파일 목록

### Base Project
```
src/main/java/com/autocrm/
├── controller/
│   └── LoginController.java       (100줄)
└── service/
    └── AuthService.java            (50줄)

src/main/resources/
└── static/js/
    └── login.js                    (35줄)

config/
└── application.properties          (15줄)
```

### 삼천리 커스터마이징
```
+ InventoryService.java             (60줄, 신규)
+ OtpService.java                   (80줄, 신규)
~ LoginController.java              (150줄, +50줄)
~ login.js                          (70줄, +35줄)
~ application.properties            (25줄, +10줄)
```

### LG 커스터마이징
```
+ ApprovalService.java              (90줄, 신규)
+ LdapService.java                  (70줄, 신규)
~ LoginController.java              (130줄, +30줄)
~ application.properties            (22줄, +7줄)
```

---

**생성일**: 2026-01-16
**목적**: 고객사별 커스터마이징 비교 도구 테스트
