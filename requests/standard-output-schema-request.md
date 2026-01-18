# 요청: 표준 출력 스키마 정의 및 구현

## 배경

**현재 상태** (v2.3):
- cross_check_auto.sh는 자유 형식 텍스트 응답에 의존
- Claude와 Gemini가 일관성 없는 형식으로 리뷰 결과 반환
- 파싱 어려움, 자동화 제한, 메트릭 추적 불가

**문제점**:
1. 일관성 부족: AI마다 다른 형식으로 응답
2. 파싱 어려움: 텍스트에서 중요 정보 추출 복잡
3. 자동화 제한: CI/CD 통합 어려움
4. 메트릭 부재: 품질 추적 불가

**GPT 5.1 mini 지적**:
- P3-4: Standard Output Format 필요성
- JSON 스키마로 구조화된 응답 권장

---

## 목표

AI 리뷰 응답을 구조화된 JSON 형식으로 표준화하여:
1. 일관된 파싱 가능
2. 자동화된 결과 집계
3. CI/CD 통합 용이
4. 메트릭 추적 가능
5. 다중 AI 비교 단순화

---

## 요청 사항

### 1. JSON 스키마 정의 (JSONSchema v7)

**요구사항**:
- 보안 이슈 (P0~P3) 구조화
- 개선사항 (improvements) 구조화
- 메트릭 (총 이슈 수, P0/P1/P2/P3 개수, 승인 신뢰도)
- 버전, 타임스탬프, 리뷰어, 단계(phase) 정보
- 결정(verdict): APPROVED, APPROVED_WITH_CHANGES, REJECTED

**참고 - GPT 제안 스키마 예시**:
```json
{
  "version": "1.0",
  "timestamp": "2026-01-18T06:30:00Z",
  "reviewer": "Claude Opus 4.5",
  "phase": "design",
  "verdict": "APPROVED_WITH_CHANGES",
  "security_issues": [
    {
      "id": "P0-1",
      "severity": "P0",
      "type": "Command Injection",
      "location": "scripts/cross_check_auto.sh:202",
      "description": "Prompt passed as command argument",
      "recommendation": "Use stdin instead",
      "cwe": "CWE-77"
    }
  ],
  "improvements": [
    {
      "priority": "P1",
      "category": "Performance",
      "suggestion": "Add static analysis pre-check",
      "reasoning": "60-80% faster than AI for simple issues"
    }
  ],
  "metrics": {
    "total_issues": 5,
    "p0_count": 2,
    "p1_count": 2,
    "p2_count": 1,
    "approval_confidence": 0.7
  }
}
```

**작업**:
- 완전한 JSONSchema v7 정의 작성
- 필수/선택 필드 명확히 구분
- 타입 검증 규칙 정의
- 예제 스키마 문서 작성

### 2. AI 프롬프트 템플릿 업데이트

**요구사항**:
- Claude/Gemini 프롬프트에 JSON 스키마 요구사항 추가
- 명확한 형식 지시사항
- 예제 JSON 응답 포함
- 스키마 준수 강제

**작업**:
- run_claude_auto() 함수의 프롬프트 수정
- run_gemini_auto() 함수의 프롬프트 수정
- JSON 응답 강제 방법 설계

### 3. 파싱 로직 설계 및 구현

**요구사항**:
- JSON 파싱 함수 작성 (jq 또는 Python)
- 스키마 검증
- 에러 처리 (잘못된 JSON, 스키마 불일치)
- 폴백 메커니즘: AI가 JSON 안 따를 경우 자유 형식 처리

**작업**:
- parse_ai_response() 함수 구현
- validate_schema() 함수 구현
- 기존 텍스트 파싱 로직을 폴백으로 유지

### 4. 스키마 파일 생성

**요구사항**:
- `schemas/ai-review-response.schema.json` 생성
- JSONSchema v7 형식
- 문서화 포함 (description 필드)

### 5. 테스트 및 검증

**요구사항**:
- 샘플 JSON 응답으로 파싱 테스트
- Claude/Gemini가 실제로 JSON 형식 따르는지 검증
- 폴백 메커니즘 테스트

---

## 성공 기준

1. ✅ JSONSchema v7 정의 완료
2. ✅ AI 프롬프트에 JSON 요구사항 통합
3. ✅ 파싱 로직 구현 및 테스트
4. ✅ 폴백 메커니즘 동작 확인
5. ✅ 기존 기능 유지 (자유 형식도 여전히 작동)

---

## 예상 시간

- JSON 스키마 정의: 1-2시간
- AI 프롬프트 업데이트: 1시간
- 파싱 로직 구현: 2-3시간
- 테스트 및 검증: 1시간

**총 예상 시간**: 4-6시간

---

## 우선순위

**P2** (중요):
- v3.0 Phase 3 (Independent Review) 구현 시 필수
- 다중 AI 비교에 꼭 필요
- 현재 v2.3로도 작동하지만, 자동화 향상을 위해 중요

---

## 참고 문서

- `docs/cross-check-auto-v3-design.md` - Section 7.5 참조
- `scripts/cross_check_auto.sh` - 현재 구현 (v2.3)
- JSONSchema v7 명세: https://json-schema.org/draft-07/schema

---

## 추가 고려사항

1. **하위 호환성**: 기존 자유 형식 응답도 여전히 처리 가능해야 함
2. **에러 메시지**: JSON 파싱 실패 시 명확한 에러 메시지
3. **성능**: 파싱이 전체 워크플로우를 늦추지 않아야 함
4. **확장성**: 향후 필드 추가 용이하도록 설계

---

**요청자**: Claude Sonnet 4.5
**위임 대상**: Opus 4.5
**날짜**: 2026-01-18
**관련 이슈**: GPT 5.1 mini P3-4 지적사항
