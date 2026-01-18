# Phase 3: Independent Review 구현 계획

## 목표

Confirmation Bias를 완전히 제거하기 위해 Claude와 Gemini가 독립적으로 설계하고, 두 설계를 비교하여 사용자가 선택하도록 함.

---

## 현재 구조 (v2.4) vs 목표 구조 (v3.0)

### 현재 (v2.4): 의존적 리뷰
```
사용자 요청 (request.md)
    ↓
Claude 설계 (design_claude.md)
    ↓
Gemini 리뷰 (Claude 결과 기반)
    ↓
승인/반려
```

**문제점**:
- Gemini가 Claude의 결과를 "주어진 것"으로 받아들임
- Claude가 고려하지 않은 대안은 Gemini도 제안 안 함
- 둘 다 놓친 이슈는 발견 불가

### 목표 (v3.0 Phase 3): 독립적 설계
```
사용자 요청 (request.md)
    ↓
┌───────────────┴───────────────┐
│ Claude (독립)  │ Gemini (독립) │
│ design_a.md    │ design_b.md   │
└───────┬───────┴───────┬───────┘
        │               │
        └──→ 비교 ←────┘
             ↓
       비교 분석 리포트
             ↓
       사용자 선택 UI
       (A / B / Hybrid)
             ↓
       선택된 설계로 구현
```

**장점**:
- 다양한 접근 방식 발견
- Claude가 놓친 대안을 Gemini가 독립적으로 제시
- 두 관점 비교로 더 나은 선택 가능

---

## 구현 항목

### 1. 명령어 옵션 추가

**새 모드**:
```bash
./cross_check_auto.sh design request.md --mode independent
```

**기존 모드와 비교**:
- `design` (기본): Claude 설계 → Gemini 리뷰
- `design --mode independent`: Claude 설계 || Gemini 설계 → 비교

### 2. 병렬 독립 설계 함수

**함수**: `independent_design_parallel()`

**동작**:
1. Claude와 Gemini가 동시에 같은 request.md 읽기
2. 각자 독립적으로 설계 작성
   - Claude → `design_claude_v1.md`
   - Gemini → `design_gemini_v1.md`
3. 서로의 결과를 모름 (완전 독립)

**구현 방법**:
- 백그라운드 프로세스로 동시 실행
- `&` 연산자 사용하여 병렬 실행
- `wait` 명령어로 두 작업 완료 대기

**프롬프트**:
```
당신은 다음 요청에 대한 설계를 작성해야 합니다.
**중요**: 다른 AI의 설계를 참고하지 않고, 오직 요청서만 보고 독립적으로 설계하세요.

[요청 내용]
$(cat request.md)

[설계 가이드]
1. 아키텍처 설계
2. 주요 컴포넌트
3. 데이터 구조
4. API 설계
5. 보안 고려사항
6. 테스트 전략

**응답 형식**: JSON (ai-review-response.schema.json)
```

### 3. 설계 비교 분석 함수

**함수**: `compare_designs()`

**입력**:
- `design_claude_v1.md`
- `design_gemini_v1.md`

**출력**:
- `design_comparison_report.md`

**비교 항목**:
1. **공통점**:
   - 두 설계가 일치하는 부분
   - 핵심 아키텍처 합의

2. **차이점**:
   - Claude만 제시한 것
   - Gemini만 제시한 것
   - 접근 방식 차이

3. **장단점 분석**:
   - 각 설계의 강점
   - 각 설계의 약점
   - Trade-off 분석

4. **보안 비교**:
   - 각 설계의 보안 이슈
   - 보안 강도 비교

5. **추천**:
   - 어떤 설계가 더 적합한지
   - 또는 하이브리드 제안

**비교 방법**:
- Claude Opus 4.5에게 두 설계 비교 요청
- JSON 형식으로 구조화된 비교 결과

### 4. 사용자 선택 UI

**함수**: `user_select_design()`

**출력 형식**:
```
========================================
  설계 비교 결과
========================================

[공통점]
- RESTful API 사용
- PostgreSQL 데이터베이스
- JWT 인증

[Claude 설계 (A)의 특징]
+ 마이크로서비스 아키텍처
+ Event-driven 패턴
+ Redis 캐싱
- 복잡도 높음

[Gemini 설계 (B)의 특징]
+ 모놀리식 아키텍처
+ 단순한 구조
+ SQLite 캐싱
- 확장성 제한

[추천]
Gemini 설계 (B) - 프로토타입 단계에 적합

========================================
  선택하세요:
========================================

1) Claude 설계 (A) 선택
2) Gemini 설계 (B) 선택
3) Hybrid (두 설계 병합)
4) 비교 리포트만 저장하고 나중에 결정

선택 (1-4):
```

**선택에 따른 동작**:
- **1번**: `design_claude_v1.md` → `design_final.md`로 복사
- **2번**: `design_gemini_v1.md` → `design_final.md`로 복사
- **3번**: Hybrid 병합 가이드 제공
- **4번**: 비교 리포트만 저장하고 종료

### 5. Hybrid 병합 기능

**함수**: `merge_designs_hybrid()`

**동작**:
1. 사용자에게 병합 전략 선택 요청
2. Claude에게 두 설계 병합 요청
3. 병합된 설계 생성 (`design_hybrid_v1.md`)

**병합 전략**:
- **Best-of-both**: 각 설계의 장점만 선택
- **Guided**: 사용자가 각 섹션별로 A/B 선택
- **AI-auto**: Claude가 자동으로 최적 병합

### 6. 출력 파일 구조

```
output/independent_design_TIMESTAMP/
├── design_claude_v1.md          # Claude 독립 설계
├── design_gemini_v1.md          # Gemini 독립 설계
├── design_comparison_report.md  # 비교 분석 리포트
├── design_final.md               # 선택된 최종 설계 (또는 hybrid)
├── logs/
│   ├── claude_design.log
│   ├── gemini_design.log
│   └── comparison.log
└── metadata.json                 # 실행 정보 (선택, 시간 등)
```

---

## 구현 순서

### Step 1: 옵션 파싱 추가
- `--mode independent` 플래그 추가
- usage() 업데이트

### Step 2: 병렬 설계 함수 구현
- `run_claude_design_independent()`
- `run_gemini_design_independent()`
- `independent_design_parallel()`

### Step 3: 비교 함수 구현
- `compare_designs()`
- 비교 리포트 생성

### Step 4: 사용자 선택 UI
- `user_select_design()`
- 선택 처리 로직

### Step 5: Hybrid 병합
- `merge_designs_hybrid()`

### Step 6: 메인 함수 통합
- `case "$mode" in design)` 분기에 independent 모드 추가

### Step 7: 테스트
- 샘플 요청으로 전체 워크플로우 테스트

---

## 예상 시간

| 단계 | 작업 | 예상 시간 |
|------|------|----------|
| 1 | 옵션 파싱 | 30분 |
| 2 | 병렬 설계 함수 | 3-4시간 |
| 3 | 비교 함수 | 3-4시간 |
| 4 | 사용자 UI | 2-3시간 |
| 5 | Hybrid 병합 | 3-4시간 |
| 6 | 통합 | 2-3시간 |
| 7 | 테스트 | 2-3시간 |

**총 예상 시간**: 16-24시간

---

## 성공 기준

1. ✅ `--mode independent` 옵션 동작
2. ✅ Claude와 Gemini가 독립적으로 설계 생성
3. ✅ 두 설계 비교 리포트 생성
4. ✅ 사용자 선택 UI 동작
5. ✅ 선택된 설계로 최종 파일 생성
6. ✅ Hybrid 병합 기능 동작
7. ✅ 기존 모드(design)도 여전히 동작

---

## 위험 및 대응

| 위험 | 가능성 | 영향 | 대응 |
|------|--------|------|------|
| **API 호출 2배 증가** | 높음 | 중 | 비용 경고 메시지 표시 |
| **실행 시간 2배** | 높음 | 중 | 병렬 실행으로 최소화 |
| **두 설계가 너무 달라서 비교 어려움** | 중 | 중 | 구조화된 비교 항목 사용 |
| **Hybrid 병합 품질 낮음** | 중 | 낮음 | 사용자가 수동 병합 가능 |

---

**작성자**: Claude Sonnet 4.5
**날짜**: 2026-01-18
**관련**: docs/cross-check-auto-v3-design.md Section 7.3
