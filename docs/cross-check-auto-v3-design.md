# AI 크로스체크 자동화 시스템 v3.0 설계

**작성일**: 2026-01-17
**버전**: 3.0 (설계)
**이전 버전**: v2.0 (구현 완료, 9/10 승인)

---

## 목차

1. [개요](#1-개요)
2. [v2.0 문제점 분석](#2-v20-문제점-분석)
3. [v3.0 설계 목표](#3-v30-설계-목표)
4. [아키텍처 설계](#4-아키텍처-설계)
5. [보안 강화 방안](#5-보안-강화-방안)
6. [품질 보증 전략](#6-품질-보증-전략)
7. [구현 계획](#7-구현-계획)
8. [예상 위험 및 대응](#8-예상-위험-및-대응)

---

## 1. 개요

### 1.1 배경

AI 크로스체크 시스템 v2.0은 Opus 4.5로부터 9/10 승인을 받았으나, **Grok의 보안 감사 결과 다수의 치명적 취약점**이 발견되었습니다.

**근본 원인**:
- AI 리뷰어가 Maker(Claude)가 작성한 결과물에 갇혀 독립적 관점 부족
- 보안 취약점을 발견하지 못하는 "Confirmation Bias"
- 체크리스트 기반 리뷰로 인한 스코프 제한

### 1.2 v2.0에서 발견된 주요 문제

#### P0 (Critical) - 즉시 수정 필요

| ID | 문제 | 영향 | 발견자 |
|----|------|------|--------|
| **P0-1** | **Path Traversal 취약점** | 프로젝트 외부 파일 덮어쓰기 가능 | Grok |
| **P0-2** | **Command Injection** | 악의적 명령어 실행 가능 | Grok |

#### P1 (High) - 우선 수정

| ID | 문제 | 영향 | 발견자 |
|----|------|------|--------|
| P1-1 | CLI 가용성 사전 체크 없음 | 실행 중 실패 | Grok |
| P1-2 | 모델 유효성 검사 없음 | 잘못된 모델 ID로 실패 | Grok |
| P1-3 | 로그 파일 이름 충돌 가능 | 동시 실행 시 덮어쓰기 | Grok |

#### P2 (Medium) - 권장 수정

| ID | 문제 | 영향 | 발견자 |
|----|------|------|--------|
| P2-1 | .gitignore 자동 생성 없음 | 로그 파일 커밋 가능 | Grok |
| P2-2 | PowerShell 스크립트 인코딩 | 한글 깨짐 | Grok, 사용자 |
| P2-3 | 로그 파일 크기 관리 없음 | 디스크 공간 증가 | Grok |

#### P3 (Design Issue) - 아키텍처 문제

| ID | 문제 | 영향 | 발견자 |
|----|------|------|--------|
| **P3-1** | **Reviewer가 Maker 결과에 의존** | 새로운 취약점 발견 불가 | 사용자, 분석 |
| **P3-2** | **단일 리뷰 관점 (Gemini만)** | 다양한 관점 부족 | 사용자 |

---

## 2. v2.0 문제점 분석

### 2.1 보안 취약점 (Grok 발견)

#### 문제 1: Path Traversal

**현재 코드 (v2.0):**
```bash
# Line 766
output_dir="${output_dir:-output/cross_check_auto_$(get_timestamp)}"

# 검증 없음!
mkdir -p "$output_dir"
```

**공격 시나리오:**
```bash
./cross_check_auto.sh design request.md "../../../etc/passwd"
# → /etc/passwd 디렉토리에 파일 생성 시도
```

**해결 방안:**
```bash
validate_output_dir() {
    local dir="$1"

    # 절대 경로 변환
    dir=$(realpath -m "$dir" 2>/dev/null || readlink -f "$dir")

    # 현재 프로젝트 내부인지 확인
    local project_root=$(pwd)
    if [[ "$dir" != "$project_root"* ]]; then
        log_error "출력 디렉토리는 현재 프로젝트 내부여야 합니다"
        return 1
    fi

    # .. 포함 여부
    if [[ "$dir" == *".."* ]]; then
        log_error "상위 디렉토리 참조(..)는 허용되지 않습니다"
        return 1
    fi

    echo "$dir"
}
```

#### 문제 2: Command Injection

**현재 코드 (v2.0):**
```bash
# Line 123
claude -m "$CLAUDE_MODEL_ID" "$prompt" > "$temp_response" 2>&1
```

**공격 시나리오:**
```bash
# 프롬프트에 악의적 명령어 주입
prompt="hello; rm -rf /"
claude -m "model" "hello; rm -rf /" > file
```

**해결 방안:**
```bash
sanitize_input() {
    local input="$1"

    # 위험한 문자 제거
    input="${input//;/}"   # 세미콜론
    input="${input//|/}"   # 파이프
    input="${input//\`/}"  # 백틱
    input="${input//\$/}"  # 달러 (변수 확장)
    input="${input//&/}"   # 앰퍼샌드

    printf '%s' "$input"
}

# 사용
local safe_prompt=$(sanitize_input "$prompt")
claude -m "$CLAUDE_MODEL_ID" -- "$safe_prompt" > "$temp_response" 2>&1
```

### 2.2 아키텍처 문제 (Confirmation Bias)

**현재 워크플로우:**
```
사용자 요청 → Claude 설계 → Gemini 리뷰(Claude 결과 기반)
                    ↓
            [승인] or [수정 필요]
```

**문제점:**
1. Gemini가 Claude의 결과물을 "주어진 것"으로 받아들임
2. Claude가 고려하지 않은 대안은 Gemini도 제안 안 함
3. 둘 다 놓친 보안 이슈는 발견 불가

**예시:**
```
요청: "사용자 인증 구현"
Claude: JWT 방식 설계
Gemini: "JWT 설계가 적절합니다 [승인]"

누락: OAuth2, Session-based, 토큰 갱신 전략, XSS 대비 등
→ Claude가 JWT만 제안했기 때문에
→ Gemini도 JWT 기준으로만 리뷰
```

---

## 3. v3.0 설계 목표

### 3.1 핵심 목표

1. **보안 우선**: P0~P1 취약점 완전 제거
2. **독립적 리뷰**: Reviewer가 Maker 결과에 의존하지 않음
3. **다중 관점**: 여러 AI가 독립적으로 검토
4. **품질 보증**: Human-in-the-loop 강화

### 3.2 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Defense in Depth** | 다중 방어층 (입력 검증, 경로 정규화, sanitization) |
| **Fail-Safe** | 불확실하면 반려 (안전 우선) |
| **Separation of Concerns** | Maker와 Reviewer 완전 분리 |
| **Adversarial Testing** | 공격자 관점 리뷰 |
| **Multi-Agent Consensus** | 다수결 또는 합의 |

---

## 4. 아키텍처 설계

### 4.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     사용자 요청                              │
│                  (request.md)                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Phase 1: Independent Design                      │
│  (각 AI가 독립적으로 설계서 작성)                             │
├─────────────────────────────────────────────────────────────┤
│  Claude Opus 4.5    │  Gemini 3 Pro      │  [옵션] GPT-4   │
│  → design_claude.md │ → design_gemini.md │ → design_gpt.md │
└─────────────────────┴────────────────────┴─────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Phase 2: Comparative Analysis                   │
│  (설계안 비교 및 장단점 분석)                                 │
├─────────────────────────────────────────────────────────────┤
│  → 공통점 / 차이점 분석                                       │
│  → 각 설계의 장단점                                           │
│  → 보안 취약점 비교                                           │
│  → 추천 설계 선택 또는 하이브리드                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Phase 3: Adversarial Security Review            │
│  (공격자 관점에서 보안 검토)                                  │
├─────────────────────────────────────────────────────────────┤
│  Grok (Security)    │  Gemini (General)   │  Claude (Deep)  │
│  → 취약점 스캔      │  → 체크리스트       │  → 논리 분석    │
└─────────────────────┴─────────────────────┴─────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Phase 4: Human Review                           │
│  (사용자 최종 검토 및 승인)                                   │
├─────────────────────────────────────────────────────────────┤
│  → 설계 비교 리포트 제공                                      │
│  → 보안 리뷰 요약                                             │
│  → 사용자 선택: 설계 A / B / 하이브리드                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Phase 5: Implementation                         │
│  (선택된 설계로 구현)                                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 새로운 모드

#### 모드 1: Independent (독립 설계)

```bash
./cross_check_auto.sh design request.md --mode independent

# 동작:
# 1. Claude: request.md 읽고 독립적으로 설계
# 2. Gemini: request.md 읽고 독립적으로 설계
# 3. 비교: 두 설계 비교 분석
# 4. 사용자: 선택 또는 하이브리드
```

**장점:**
- 다양한 접근 방식 발견
- Claude가 놓친 대안을 Gemini가 제시 가능

**단점:**
- 비용 2배
- 시간 2배

#### 모드 2: Adversarial (적대적 리뷰)

```bash
./cross_check_auto.sh design request.md --mode adversarial

# 동작:
# 1. Claude: 설계 작성
# 2. Gemini: 비판적 리뷰 (최소 3가지 문제점 찾기)
# 3. Grok: 보안 취약점 스캔
# 4. 종합: 모든 피드백 통합
```

**Gemini 프롬프트:**
```
절대 쉽게 승인하지 말 것!

다음 관점에서 비판적으로 검토:
1. 보안 취약점 (SQL Injection, XSS, CSRF 등)
2. 누락된 고려사항 (인증, 로깅, 에러 처리 등)
3. 더 나은 대안 (다른 아키텍처, 패턴)
4. Edge Cases (경계 조건, 예외 상황)
5. 성능 이슈 (병목, N+1 쿼리 등)

최소 3가지 이상 구체적 개선점 제시 필수!
```

#### 모드 3: Consensus (다중 합의)

```bash
./cross_check_auto.sh design request.md --mode consensus

# 동작:
# 1. Claude Opus: 리뷰 A
# 2. Gemini: 리뷰 B
# 3. Grok: 리뷰 C
# 4. 합의 알고리즘:
#    - 3명 모두 승인: ✅ 통과
#    - 2명 승인: ⚠️ 조건부 (반대 의견 검토)
#    - 1명 이하: ❌ 수정 필요
```

#### 모드 4: Standard (현재 v2.0, 기본값)

```bash
./cross_check_auto.sh design request.md

# 동작: v2.0과 동일
# 1. Claude: 설계
# 2. Gemini: 리뷰
```

---

## 5. 보안 강화 방안

### 5.1 입력 검증 계층

```bash
# Layer 1: 파일 경로 검증
validate_file_path() {
    local file="$1"

    # 1. 존재 확인
    [ ! -f "$file" ] && return 1

    # 2. 읽기 권한
    [ ! -r "$file" ] && return 1

    # 3. 심볼릭 링크 체크
    if [ -L "$file" ]; then
        log_warn "심볼릭 링크는 권장하지 않습니다: $file"
    fi

    # 4. 절대 경로 변환
    file=$(realpath "$file")

    # 5. 프로젝트 내부인지 확인
    local project_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
    if [[ "$file" != "$project_root"* ]]; then
        log_error "파일은 프로젝트 내부여야 합니다"
        return 1
    fi

    echo "$file"
}

# Layer 2: 출력 디렉토리 검증
validate_output_dir() {
    # (위에서 정의한 함수)
}

# Layer 3: 프롬프트 sanitization
sanitize_prompt() {
    # (위에서 정의한 함수)
}

# Layer 4: 모델 ID 검증
VALID_MODELS=(
    "claude-opus-4-5"
    "claude-sonnet-4-5"
    "gemini-3-pro-preview"
)

validate_model() {
    local model="$1"
    for valid in "${VALID_MODELS[@]}"; do
        [ "$model" = "$valid" ] && return 0
    done
    log_error "지원되지 않는 모델: $model"
    return 1
}
```

### 5.2 CLI 가용성 체크

```bash
check_prerequisites() {
    local required_tools=()

    # 필수 CLI 도구
    command -v claude &> /dev/null || required_tools+=("Claude CLI")
    command -v gemini &> /dev/null || required_tools+=("Gemini CLI")
    command -v git &> /dev/null || required_tools+=("Git")
    command -v realpath &> /dev/null || required_tools+=("realpath")

    if [ ${#required_tools[@]} -gt 0 ]; then
        log_error "다음 도구가 설치되지 않았습니다:"
        printf '  - %s\n' "${required_tools[@]}"
        log_info "설치 가이드: docs/ai-cli-setup.md"
        return 1
    fi

    # CLI 도구 버전 확인 (선택)
    log_info "CLI 도구 버전:"
    claude --version 2>/dev/null || log_warn "Claude 버전 확인 실패"
    gemini --version 2>/dev/null || log_warn "Gemini 버전 확인 실패"

    return 0
}
```

### 5.3 보안 체크리스트 강제

```bash
# docs/security-checklist.md 생성
SECURITY_CHECKLIST="docs/security-checklist.md"

# Gemini 리뷰 시 체크리스트 포함
review_prompt="...

필수 보안 체크리스트:
$(cat "$SECURITY_CHECKLIST")

각 항목을 확인하고 결과를 명시하라:
- [✅] 확인 완료
- [❌] 문제 발견
- [⚠️] 주의 필요
- [N/A] 해당 없음
"
```

**security-checklist.md 내용:**
```markdown
# 보안 체크리스트

## 인증 & 인가
- [ ] 인증 메커니즘 구현 (JWT, OAuth2, Session 등)
- [ ] 권한 검증 (RBAC, ABAC)
- [ ] 세션 관리 (타임아웃, 갱신)

## 입력 검증
- [ ] SQL Injection 방지 (Prepared Statement)
- [ ] XSS 방지 (입력 sanitization, CSP)
- [ ] Path Traversal 방지 (경로 정규화)
- [ ] Command Injection 방지

## 데이터 보호
- [ ] 민감 정보 암호화 (저장 시)
- [ ] HTTPS 사용 (전송 시)
- [ ] 비밀번호 해싱 (bcrypt, Argon2)

## 에러 처리
- [ ] 에러 메시지에 민감 정보 미포함
- [ ] 적절한 로깅 (감사 추적)

## 성능 & DoS
- [ ] Rate Limiting
- [ ] 입력 크기 제한
- [ ] 타임아웃 설정
```

---

## 6. 품질 보증 전략

### 6.1 다중 리뷰 전략

#### 전략 1: Role-Based Review (역할 기반)

| AI | 역할 | 초점 |
|----|------|------|
| **Claude Opus 4.5** | Architect | 설계, 아키텍처, 로직 |
| **Gemini 3 Pro** | Security Expert | 보안 취약점, 체크리스트 |
| **Grok** | Penetration Tester | 공격 시나리오, 취약점 스캔 |
| **GPT-4** (선택) | Code Reviewer | 코드 품질, 베스트 프랙티스 |

#### 전략 2: Round-Robin Review (순환 리뷰)

```
Round 1: Claude 설계 → Gemini 리뷰
Round 2: Gemini 수정 → Grok 보안 검토
Round 3: Grok 피드백 → Claude 최종 검토
```

### 6.2 Human-in-the-Loop 강화

```bash
# 각 단계마다 사용자 확인
confirm_and_proceed() {
    local phase="$1"
    local result_file="$2"

    echo ""
    log_success "=== $phase 단계 완료 ==="
    log_info "결과 파일: $result_file"
    echo ""

    # 요약 출력
    if [ -f "$result_file" ]; then
        echo "요약:"
        head -20 "$result_file"
        echo "..."
        echo ""
    fi

    # 사용자 확인
    read -p "다음 단계로 진행하시겠습니까? (y/n/view): " choice

    case "$choice" in
        y|Y)
            return 0
            ;;
        v|view)
            less "$result_file"
            confirm_and_proceed "$phase" "$result_file"
            ;;
        *)
            log_info "사용자가 중단했습니다"
            exit 0
            ;;
    esac
}
```

### 6.3 로그 및 감사 추적

```bash
# 모든 중요 이벤트 로깅
audit_log() {
    local event="$1"
    local details="$2"
    local log_file="logs/audit.log"

    mkdir -p "$(dirname "$log_file")"

    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local user=$(whoami)

    echo "[$timestamp] $user | $event | $details" >> "$log_file"
}

# 사용 예시
audit_log "DESIGN_START" "request_file=$request_file, mode=$mode"
audit_log "APPROVAL" "phase=design, reviewer=Gemini, round=$round"
audit_log "SECURITY_ISSUE" "type=Path_Traversal, severity=P0"
```

---

## 7. 구현 계획

### 7.1 Phase 1: 보안 패치 (v3.0-alpha)

**목표**: P0~P1 취약점 완전 제거

**작업 항목**:
1. ✅ Path Traversal 방지 (`validate_output_dir`)
2. ✅ Command Injection 방지 (`sanitize_prompt`)
3. ✅ CLI 가용성 체크 (`check_prerequisites`)
4. ✅ 모델 유효성 검사 (`validate_model`)
5. ✅ 로그 파일 충돌 방지 (PID 추가)
6. ✅ .gitignore 자동 생성

**예상 시간**: 2-3시간
**우선순위**: P0 (즉시)

### 7.2 Phase 2: Adversarial Review 추가 (v3.0-beta)

**목표**: 비판적 리뷰 강화

**작업 항목**:
1. ✅ 보안 체크리스트 작성 (`security-checklist.md`)
2. ✅ Adversarial 프롬프트 강화
3. ✅ 최소 개선점 개수 강제 (3개 이상)
4. ✅ 사용자 확인 단계 추가

**예상 시간**: 3-4시간
**우선순위**: P1

### 7.3 Phase 3: Independent Review 구현 (v3.0-rc)

**목표**: 독립적 설계 비교

**작업 항목**:
1. ⏳ `--mode independent` 구현
2. ⏳ 설계 비교 분석 로직
3. ⏳ 하이브리드 설계 지원
4. ⏳ 사용자 선택 UI

**예상 시간**: 6-8시간
**우선순위**: P2

### 7.4 Phase 4: Multi-Agent Consensus (v3.0)

**목표**: 다중 AI 합의

**작업 항목**:
1. ⏳ `--mode consensus` 구현
2. ⏳ 합의 알고리즘
3. ⏳ Grok, GPT 통합
4. ⏳ 투표 결과 시각화

**예상 시간**: 8-10시간
**우선순위**: P3 (선택)

---

## 8. 예상 위험 및 대응

### 8.1 기술적 위험

| 위험 | 가능성 | 영향 | 대응 방안 |
|------|--------|------|-----------|
| **sanitization 우회** | 중 | 높음 | 화이트리스트 방식으로 전환 |
| **API 호출 실패** | 높음 | 중 | 재시도 + 우아한 실패 |
| **비용 폭발** | 중 | 중 | 사용자에게 예상 비용 안내 |
| **성능 저하** | 낮음 | 낮음 | 병렬 처리 (선택) |

### 8.2 사용성 위험

| 위험 | 가능성 | 영향 | 대응 방안 |
|------|--------|------|-----------|
| **너무 복잡함** | 높음 | 중 | 기본 모드 제공 (v2.0 호환) |
| **시간 너무 오래 걸림** | 중 | 중 | 빠른 모드 옵션 |
| **AI 응답 불일치** | 높음 | 낮음 | 사용자가 최종 선택 |

### 8.3 보안 위험

| 위험 | 가능성 | 영향 | 대응 방안 |
|------|--------|------|-----------|
| **새로운 취약점** | 중 | 높음 | 정기 보안 감사 |
| **민감 정보 로그** | 낮음 | 높음 | 로그 필터링, 암호화 |
| **권한 상승** | 낮음 | 높음 | 최소 권한 원칙 |

---

## 9. 비용 분석

### 9.1 API 호출 비용

#### 기본 모드 (v2.0 호환)
```
설계: Claude (1회) + Gemini (1회) = 2 호출
구현: Claude (1회) + Gemini (1회) = 2 호출
테스트: Claude (1회) + Gemini (1회) = 2 호출
---
총: 6 호출 × $0.05 = $0.30
```

#### Independent 모드
```
설계: Claude (1회) + Gemini (1회) = 2 호출 (설계)
비교: Claude (1회) = 1 호출
---
총: 설계당 3 호출 → 전체 9 호출 = $0.45
```

#### Consensus 모드
```
설계: Claude (1회) + Gemini (1회) + Grok (1회) = 3 호출
---
총: 전체 9 호출 = $0.45
```

**권장**: 기본 모드로 시작, 중요한 프로젝트만 Independent/Consensus

---

## 10. 성공 지표

### 10.1 정량적 지표

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| **보안 취약점 발견율** | 90% 이상 | 의도적 취약점 주입 후 탐지율 |
| **False Positive** | 20% 이하 | 반려된 것 중 실제 문제 없는 비율 |
| **실행 시간** | 10분 이내 (기본 모드) | 전체 파이프라인 소요 시간 |
| **사용자 만족도** | 4.0/5.0 이상 | 설문 조사 |

### 10.2 정성적 지표

- ✅ P0 취약점 0건
- ✅ 사용자가 수동 커밋 전 반드시 검토
- ✅ 다양한 설계 대안 제시
- ✅ 명확한 에러 메시지

---

## 11. 결론

### 11.1 v2.0 vs v3.0 비교

| 항목 | v2.0 | v3.0 |
|------|------|------|
| **보안** | ⚠️ P0 취약점 2개 | ✅ 완전 패치 |
| **리뷰 방식** | 단일 (Gemini) | 다중 (Opus/Gemini/Grok/GPT) |
| **독립성** | ❌ Maker 의존 | ✅ 독립적 설계 가능 |
| **비용** | $0.30 | $0.30~$0.45 (모드별) |
| **시간** | 5-10분 | 10-20분 (모드별) |
| **품질** | 7-9/10 | 9-10/10 (목표) |

### 11.2 권장 사용법

| 프로젝트 유형 | 권장 모드 | 이유 |
|--------------|----------|------|
| **프로토타입** | Standard | 빠른 검증 |
| **프로덕션** | Adversarial | 보안 중요 |
| **미션 크리티컬** | Consensus | 최고 품질 |
| **레거시 개선** | Independent | 다양한 대안 필요 |

### 11.3 다음 단계

1. **즉시**: Phase 1 구현 (보안 패치)
2. **1주 내**: Phase 2 구현 (Adversarial Review)
3. **2주 내**: Phase 3 구현 (Independent Review)
4. **선택**: Phase 4 구현 (Consensus)

---

## 부록

### A. 용어 정리

- **Maker**: 설계/구현을 작성하는 AI (주로 Claude)
- **Reviewer**: 검토하는 AI (주로 Gemini)
- **Confirmation Bias**: 주어진 것을 받아들이고 새로운 문제를 찾지 못하는 편향
- **Path Traversal**: `../` 등을 이용한 경로 조작 공격
- **Command Injection**: 명령어 삽입 공격

### B. 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-77: Command Injection](https://cwe.mitre.org/data/definitions/77.html)

### C. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| v1.0 | 2026-01-17 | 초기 자동화 (자동 커밋 포함) |
| v2.0 | 2026-01-17 | 보안 개선 (자동 커밋 제거, mktemp) |
| v3.0 | 2026-01-17 | 설계 문서 (보안 패치, 다중 리뷰) |

---

**작성자**: Claude Sonnet 4.5
**검토 요청**: Opus 4.5, Gemini 3 Pro, Grok, GPT-4
