# Phase 4: 2-Agent Consensus 설계 (v2)

**검토일**: 2026-01-18
**검토자**: Gemini 3 Pro Preview
**상태**: ✅ 승인됨

---

## 설계 변경 사항

| 항목 | 기존 (v1) | 수정 (v2) |
|------|-----------|-----------|
| AI 수 | 4개 (Claude, Gemini, Grok, GPT) | **2개 (Claude, Gemini)** |
| 복잡도 | N² 합의 알고리즘 | **1:1 비교 (Match/Mismatch)** |
| 예상 시간 | 40+ 시간 | **8-12시간** |
| Grok/GPT | CLI 통합 필요 | **웹에서 수동 확인 (선택)** |

---

## 워크플로우

```
사용자 요청
    ↓
Phase 3: Independent Mode (이미 구현됨)
    ↓
┌─────────────┬─────────────┐
│ Claude 설계 │ Gemini 설계 │
│ + JSON 메타 │ + JSON 메타 │
└──────┬──────┴──────┬──────┘
       ↓             ↓
    Consensus Engine (비교)
           ↓
    ┌──────┼──────┐
    ↓      ↓      ↓
  일치   불일치  둘다거부
    ↓      ↓      ↓
  자동   사용자   반려
  승인   선택    재작성
           ↓
      (선택) 웹에서 Grok/GPT 확인
```

---

## 구현 권장 사항

### 1. Consensus Engine (Node.js)

**위치**: `scripts/consensus/analyze_consensus.js`

**입력**:
- Claude의 `metadata.json`
- Gemini의 `metadata.json`

**로직**:
1. Verdict Check: 둘 다 APPROVED인가?
2. Severity Check: P0, P1 보안 취약점 없는가?
3. Score Diff: 점수 차이 10% 이내인가? (선택)

**출력**: `consensus_result.json`
```json
{
  "status": "MATCH | CONFLICT | BOTH_REJECTED",
  "claude_verdict": "APPROVED",
  "gemini_verdict": "APPROVED",
  "auto_merge": true,
  "reason": "두 AI 모두 승인, 보안 이슈 없음"
}
```

### 2. CLI 옵션

새 모드 대신 Phase 3의 후처리 옵션으로 통합:

```bash
# 독립 설계 + 합의 시 자동 병합
./cross_check_auto.sh design request.md --mode independent --auto-merge-on-consensus
```

### 3. Grok/GPT 수동 통합

CLI 배제, 체크리스트로 유도:
- CONFLICT 발생 시: "심각한 의견 차이. 웹에서 Grok/GPT 검토 권장"

---

## 예상 소요 시간

| 작업 | 시간 |
|------|------|
| 비교 로직 구현 (Node.js) | 3-4시간 |
| Shell 스크립트 통합 | 2-3시간 |
| 테스트 및 엣지 케이스 | 2-3시간 |
| 문서화 | 1-2시간 |
| **총계** | **8-12시간** |

---

## 결론

- ✅ 2-Agent 설계 승인
- ✅ 8-12시간 추정 정확
- ✅ Phase 3 결과물과 완벽 호환
- ✅ 즉시 구현 가능

---

**로그**: `logs/gemini/2026-01-18_212226_phase4-review.log`
