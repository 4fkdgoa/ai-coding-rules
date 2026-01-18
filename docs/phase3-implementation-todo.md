# Phase 3: Independent Review 구현 TODO

## 진행 상황 요약

**목표**: Confirmation Bias 제거를 위한 독립적 설계 비교 시스템
**예상 시간**: 16-24시간
**시작일**: 2026-01-18

---

## TODO 체크리스트

### ✅ 0. 사전 준비
- [x] Phase 3 구현 계획 문서 작성
- [x] TODO 체크리스트 작성
- [x] Git 커밋 및 푸시

### ✅ 1. 옵션 파싱 및 기본 구조 (30분-1시간)
- [x] `--mode independent` 옵션 파싱 추가
- [x] `usage()` 함수에 independent 모드 설명 추가
- [x] 전역 변수 `REVIEW_MODE` 추가
- [x] 메인 함수에 independent 모드 분기 추가
- [x] 기본 검증 로직 (옵션 유효성)
- [x] **커밋**: `feat: add --mode independent option skeleton`
- [x] **문서 업데이트**: 이 파일의 1번 체크

**Task ID**: TBD
**예상 시간**: 30분-1시간
**우선순위**: P0 (기반 작업)

---

### ⏳ 2. 독립적 설계 생성 함수 - Claude (2-3시간)
- [ ] `run_claude_design_independent()` 함수 생성
- [ ] 독립 설계용 프롬프트 작성
  - [ ] "다른 AI 참고하지 말고 독립적으로" 명시
  - [ ] JSON 스키마 형식 요구
  - [ ] 설계 가이드라인 포함
- [ ] 출력 파일: `design_claude_v1.md`
- [ ] 로그 저장: `logs/claude_design_independent.log`
- [ ] 에러 처리 및 재시도 로직
- [ ] **커밋**: `feat: add Claude independent design function`
- [ ] **문서 업데이트**: 이 파일의 2번 체크

**Task ID**: TBD
**예상 시간**: 2-3시간
**우선순위**: P0

---

### ⏳ 3. 독립적 설계 생성 함수 - Gemini (2-3시간)
- [ ] `run_gemini_design_independent()` 함수 생성
- [ ] 독립 설계용 프롬프트 작성
  - [ ] Claude와 동일한 가이드라인
  - [ ] JSON 스키마 형식 요구
- [ ] 출력 파일: `design_gemini_v1.md`
- [ ] 로그 저장: `logs/gemini_design_independent.log`
- [ ] 에러 처리 및 재시도 로직
- [ ] **커밋**: `feat: add Gemini independent design function`
- [ ] **문서 업데이트**: 이 파일의 3번 체크

**Task ID**: TBD
**예상 시간**: 2-3시간
**우선순위**: P0

---

### ⏳ 4. 병렬 실행 함수 (1-2시간)
- [ ] `independent_design_parallel()` 함수 생성
- [ ] 백그라운드 프로세스로 Claude 실행 (`&`)
- [ ] 백그라운드 프로세스로 Gemini 실행 (`&`)
- [ ] `wait` 명령어로 두 작업 완료 대기
- [ ] 병렬 실행 로그 관리
- [ ] 타임아웃 처리 (최대 대기 시간)
- [ ] 실패 시 에러 메시지
- [ ] **커밋**: `feat: add parallel independent design execution`
- [ ] **문서 업데이트**: 이 파일의 4번 체크

**Task ID**: TBD
**예상 시간**: 1-2시간
**우선순위**: P0

---

### ⏳ 5. 설계 비교 분석 함수 (3-4시간)
- [ ] `compare_designs()` 함수 생성
- [ ] Claude Opus에게 비교 요청 프롬프트 작성
  - [ ] 공통점 분석
  - [ ] 차이점 분석
  - [ ] 장단점 비교
  - [ ] 보안 비교
  - [ ] 추천사항
- [ ] JSON 형식 비교 리포트 파싱
- [ ] 마크다운 비교 리포트 생성: `design_comparison_report.md`
- [ ] 로그 저장: `logs/comparison.log`
- [ ] **커밋**: `feat: add design comparison analysis function`
- [ ] **문서 업데이트**: 이 파일의 5번 체크

**Task ID**: TBD
**예상 시간**: 3-4시간
**우선순위**: P1

---

### ⏳ 6. 사용자 선택 UI (2-3시간)
- [ ] `user_select_design()` 함수 생성
- [ ] 비교 리포트 출력 (터미널 포맷팅)
  - [ ] 공통점 섹션
  - [ ] Claude 설계 특징
  - [ ] Gemini 설계 특징
  - [ ] 추천사항
- [ ] 사용자 입력 받기 (1-4 선택)
  - [ ] 1: Claude 설계 선택
  - [ ] 2: Gemini 설계 선택
  - [ ] 3: Hybrid 병합
  - [ ] 4: 나중에 결정
- [ ] 선택 검증 (1-4 외 입력 시 재요청)
- [ ] 선택 결과 저장: `metadata.json`
- [ ] **커밋**: `feat: add user design selection UI`
- [ ] **문서 업데이트**: 이 파일의 6번 체크

**Task ID**: TBD
**예상 시간**: 2-3시간
**우선순위**: P1

---

### ⏳ 7. 최종 설계 파일 생성 (1시간)
- [ ] `create_final_design()` 함수 생성
- [ ] 선택에 따른 파일 복사 로직
  - [ ] 1번: `design_claude_v1.md` → `design_final.md`
  - [ ] 2번: `design_gemini_v1.md` → `design_final.md`
  - [ ] 3번: Hybrid 함수 호출
  - [ ] 4번: 비교 리포트만 저장
- [ ] 최종 설계 메타데이터 기록
- [ ] **커밋**: `feat: add final design file creation`
- [ ] **문서 업데이트**: 이 파일의 7번 체크

**Task ID**: TBD
**예상 시간**: 1시간
**우선순위**: P1

---

### ⏳ 8. Hybrid 병합 기능 (3-4시간)
- [ ] `merge_designs_hybrid()` 함수 생성
- [ ] 병합 전략 선택 UI
  - [ ] Best-of-both (각 설계 장점만)
  - [ ] Guided (섹션별 A/B 선택)
  - [ ] AI-auto (Claude 자동 병합)
- [ ] Claude Opus에게 병합 요청
- [ ] 병합 프롬프트 작성
- [ ] 병합 결과: `design_hybrid_v1.md`
- [ ] 로그 저장: `logs/hybrid_merge.log`
- [ ] **커밋**: `feat: add hybrid design merge function`
- [ ] **문서 업데이트**: 이 파일의 8번 체크

**Task ID**: TBD
**예상 시간**: 3-4시간
**우선순위**: P2

---

### ⏳ 9. 메인 함수 통합 (1-2시간)
- [ ] `main()` 함수에 independent 모드 케이스 추가
- [ ] `case "$mode" in design)` 분기 수정
  - [ ] 기존 design: `cross_check_design_auto()`
  - [ ] independent: 새 워크플로우
- [ ] 디렉토리 구조 생성
  - [ ] `output/independent_design_TIMESTAMP/`
  - [ ] `logs/` 하위 디렉토리
- [ ] 워크플로우 순서 정의
  1. 병렬 독립 설계
  2. 비교 분석
  3. 사용자 선택
  4. 최종 파일 생성
- [ ] 에러 처리 및 롤백
- [ ] **커밋**: `feat: integrate independent mode into main workflow`
- [ ] **문서 업데이트**: 이 파일의 9번 체크

**Task ID**: TBD
**예상 시간**: 1-2시간
**우선순위**: P1

---

### ⏳ 10. 테스트 케이스 작성 (2-3시간)
- [ ] 샘플 요청 파일 작성: `tests/phase3/sample-request.md`
- [ ] 테스트 스크립트: `tests/phase3/test-independent-mode.sh`
- [ ] 테스트 항목
  - [ ] 병렬 설계 생성 확인
  - [ ] 비교 리포트 생성 확인
  - [ ] 사용자 선택 UI 동작 확인
  - [ ] 최종 파일 생성 확인
  - [ ] 에러 처리 확인
- [ ] 예상 출력 파일 검증
- [ ] **커밋**: `test: add Phase 3 independent mode tests`
- [ ] **문서 업데이트**: 이 파일의 10번 체크

**Task ID**: TBD
**예상 시간**: 2-3시간
**우선순위**: P2

---

### ⏳ 11. 문서화 및 정리 (1-2시간)
- [ ] README 업데이트 (independent 모드 사용법)
- [ ] CLAUDE.md 업데이트
- [ ] 사용 예시 추가
- [ ] 스크린샷 또는 출력 예시
- [ ] Phase 3 완료 리포트 작성
- [ ] **커밋**: `docs: add Phase 3 independent mode documentation`
- [ ] **문서 업데이트**: 이 파일의 11번 체크

**Task ID**: TBD
**예상 시간**: 1-2시간
**우선순위**: P2

---

### ⏳ 12. 최종 검증 및 배포 (1-2시간)
- [ ] 전체 워크플로우 End-to-End 테스트
- [ ] 기존 모드(design) 동작 확인 (regression test)
- [ ] 성능 측정 (병렬 실행 시간)
- [ ] 비용 측정 (API 호출 횟수)
- [ ] v3.0 설계 문서 업데이트 (Phase 3 완료 표시)
- [ ] **커밋**: `feat: Phase 3 Independent Review complete (v2.4 → v3.0)`
- [ ] **문서 업데이트**: 이 파일의 12번 체크
- [ ] **Git Tag**: `v3.0-phase3`

**Task ID**: TBD
**예상 시간**: 1-2시간
**우선순위**: P0

---

## 진행 상황 추적

### 완료된 항목
- [x] 0. 사전 준비
- [x] 1. 옵션 파싱 및 기본 구조

### 진행 중인 항목
- [ ] 없음

### 대기 중인 항목
- [ ] 2-12번 전체

---

## Task 실행 계획

각 TODO 항목을 별도 Task로 실행:

### Task 1: 옵션 파싱 (30분-1시간)
```bash
# TODO 1번 구현
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 2-3: 독립 설계 함수 (4-6시간)
```bash
# TODO 2, 3번 구현 (병합 가능)
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 4: 병렬 실행 (1-2시간)
```bash
# TODO 4번 구현
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 5: 비교 분석 (3-4시간)
```bash
# TODO 5번 구현
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 6-7: 사용자 UI (3-4시간)
```bash
# TODO 6, 7번 구현 (병합 가능)
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 8: Hybrid 병합 (3-4시간)
```bash
# TODO 8번 구현
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 9: 메인 통합 (1-2시간)
```bash
# TODO 9번 구현
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 10-11: 테스트 및 문서화 (3-5시간)
```bash
# TODO 10, 11번 구현 (병합 가능)
→ 커밋 및 푸시
→ 이 문서 업데이트
```

### Task 12: 최종 검증 (1-2시간)
```bash
# TODO 12번 구현
→ 커밋 및 푸시
→ v3.0 릴리스
```

---

## 예상 총 소요 시간

| 단계 | 시간 |
|------|------|
| 옵션 파싱 (1) | 1h |
| 독립 설계 함수 (2-3) | 5h |
| 병렬 실행 (4) | 2h |
| 비교 분석 (5) | 4h |
| 사용자 UI (6-7) | 4h |
| Hybrid 병합 (8) | 4h |
| 메인 통합 (9) | 2h |
| 테스트/문서 (10-11) | 4h |
| 최종 검증 (12) | 2h |
| **총계** | **28h** |

**실제 예상**: 20-24시간 (병렬 작업 및 효율화)

---

## 업데이트 로그

| 날짜 | 작업 | 커밋 |
|------|------|------|
| 2026-01-18 | TODO 1: 옵션 파싱 및 기본 구조 완료 | 20890df |
| 2026-01-18 | TODO 문서 작성 | TBD |

---

**작성자**: Claude Sonnet 4.5
**최종 업데이트**: 2026-01-18
