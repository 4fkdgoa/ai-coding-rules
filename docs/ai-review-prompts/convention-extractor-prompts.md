# AI 검토 요청 프롬프트

각 AI(Gemini, GPT, Grok)에게 Convention Extractor 설계를 검토받기 위한 프롬프트입니다.

---

## 🟢 Gemini용 프롬프트

```
당신은 소프트웨어 아키텍처 전문가입니다. 아래 "Convention Extractor" 도구의 설계 문서를 검토하고, 개선점을 제안해주세요.

## 도구 개요
기존 코드베이스를 분석하여 실제 사용 중인 코딩 컨벤션을 자동으로 추출하고 문서화하는 Node.js 도구입니다.

## 검토 문서
[아래에 DESIGN.md 전체 내용을 붙여넣으세요]

## 검토 요청 사항

### 1. 아키텍처 평가
- 컴포넌트 분리가 적절한가?
- 데이터 흐름이 합리적인가?
- 확장성을 고려한 설계인가?

### 2. 알고리즘 검증
- 정규식 기반 파싱의 한계점은?
- 통계 계산 방식이 타당한가?
- 신뢰도 측정 방식이 적절한가?

### 3. 현재 문제점 분석
문서에서 언급된 한계점들:
- 에러 핸들링 부족
- 정규식 기반 파싱 (AST 미사용)
- 제한된 파일 타입 지원
- 컨텍스트 인식 부족

위 문제들의 **우선순위**와 **구체적인 해결 방법**을 제시해주세요.

### 4. 개선 제안
- 즉시 개선해야 할 것 (Critical)
- 단기 개선 (1-2주 내)
- 장기 개선 (1-2개월)

### 5. 대안 기술 제안
- AST 파서: Babel vs acorn vs TypeScript API
- 병렬 처리: Worker Threads vs child_process
- 캐싱 전략: 메모리 vs 파일

### 6. Edge Case 시나리오
다음 상황에서 도구가 어떻게 동작해야 하는지 제안해주세요:
- 빈 프로젝트 (파일 0개)
- JS/TS 파일이 하나도 없는 프로젝트
- 100만 줄 이상의 대규모 프로젝트
- 여러 언어 혼재 (JS + Java + Python)
- 생성된 코드 (node_modules, dist/)

### 7. 테스트 전략
현재 **테스트 코드가 전혀 없습니다**. 어떤 테스트를 작성해야 할까요?
- 단위 테스트 (각 Analyzer)
- 통합 테스트
- Edge case 테스트
- 성능 테스트

## 출력 형식
다음 구조로 답변해주세요:

```markdown
# Convention Extractor 설계 검토

## 1. 전체 평가 (1-10점)
[점수]: [이유]

## 2. 아키텍처 분석
### 강점
- [...]
### 약점
- [...]
### 개선 제안
- [...]

## 3. 즉시 수정 필요 (Critical)
1. [문제] → [해결 방법]
2. ...

## 4. 단기 개선 (1-2주)
1. [항목] → [구체적 방법]
2. ...

## 5. 장기 개선 (1-2개월)
1. [항목] → [전략]
2. ...

## 6. 기술 선택 권장
- AST 파서: [추천] (이유: ...)
- 병렬 처리: [추천] (이유: ...)
- 캐싱: [추천] (이유: ...)

## 7. Edge Case 처리 가이드
| 시나리오 | 현재 동작 | 권장 동작 |
|---------|----------|----------|
| 빈 프로젝트 | 0개 문서 생성 | 에러 발생 |
| ... | ... | ... |

## 8. 테스트 우선순위
1. [테스트 종류] - [이유]
2. ...

## 9. 기타 제안
[추가 의견]
```
```

---

## 🔵 GPT-4용 프롬프트 (ChatGPT)

```
You are a senior software engineer reviewing a code analysis tool design. Please provide a thorough review of the "Convention Extractor" tool.

## Tool Overview
A Node.js tool that analyzes existing codebases to automatically extract and document actual coding conventions being used.

## Design Document
[Paste the entire DESIGN.md content below]

## Review Checklist

### Architecture & Design
- [ ] Is the component separation logical?
- [ ] Is the data flow efficient?
- [ ] Is the design scalable?
- [ ] Are there any missing components?

### Implementation Quality
- [ ] Are the algorithms sound?
- [ ] Is regex-based parsing appropriate?
- [ ] Are there better alternatives (AST)?
- [ ] Is error handling sufficient?

### Current Issues (from document)
The design identifies these problems:
1. Insufficient error handling
2. Regex-based parsing limitations
3. Limited file type support
4. Lack of context awareness

**For each issue, provide:**
- Severity (Critical/High/Medium/Low)
- Specific solution with code example
- Implementation difficulty (Easy/Medium/Hard)
- Estimated time to fix

### Code Quality Concerns
- What happens with edge cases?
- How to handle large projects (1M+ LOC)?
- How to avoid false positives?
- How to improve confidence scores?

### Testing Strategy
**There are NO tests currently.** Recommend:
1. Unit tests needed (which components?)
2. Integration tests (which scenarios?)
3. Edge case tests (which cases?)
4. Performance benchmarks

### Improvement Roadmap
Prioritize improvements:
- **Week 1**: [Critical fixes]
- **Month 1**: [Important features]
- **Month 3**: [Nice-to-haves]

## Output Format
Please structure your response as:

```markdown
# Convention Extractor - Code Review

## Summary
- Overall Rating: [X/10]
- Ready for Production: [Yes/No/With fixes]
- Biggest Concern: [...]

## Critical Issues (Fix Immediately)
1. **[Issue]**
   - Severity: Critical
   - Problem: [...]
   - Solution:
   ```javascript
   // Code example
   ```
   - Effort: [X hours]

## Architecture Review
### Strengths
- ✅ [...]

### Weaknesses
- ❌ [...]

### Recommendations
1. [...]

## Algorithm Analysis
### FileStructureAnalyzer
- Current approach: [...]
- Issues: [...]
- Better approach: [...]

### CodingStyleAnalyzer
[Similar structure]

### NamingConventionAnalyzer
[Similar structure]

### TechStackDetector
[Similar structure]

## Error Handling Improvements
```javascript
// Before
if (!fs.existsSync(path)) {
  // silently continues
}

// After
if (!fs.existsSync(path)) {
  throw new Error(`Path not found: ${path}`);
}
```

## Edge Cases Matrix
| Scenario | Current Behavior | Expected Behavior | Fix Priority |
|----------|-----------------|-------------------|--------------|
| Empty project | Creates meaningless doc | Throw error | High |
| No JS files | Analyzes nothing | Warn user | Medium |
| ... | ... | ... | ... |

## Testing Recommendations
### Priority 1 (This Week)
- [ ] Test: Empty directory
- [ ] Test: Non-existent path
- [ ] Test: ...

### Priority 2 (This Month)
- [ ] Integration test: Full workflow
- [ ] Performance test: 10K files
- [ ] ...

## Technology Recommendations
- **AST Parser**: Use Babel Parser
  - Pros: Accurate, widely used
  - Cons: Slower
  - Alternative: acorn (faster, less features)

- **Parallel Processing**: Worker Threads
  - Reason: [...]

## Implementation Timeline
Week 1:
- Day 1-2: [...]
- Day 3-5: [...]

Month 1:
- Week 2: [...]
- Week 3: [...]

## Additional Suggestions
[Any other recommendations]
```
```

---

## 🟣 Grok용 프롬프트 (xAI)

```
Yo! I need a brutally honest code review. Cut the BS and tell me what's actually wrong with this design.

## What I Built
A Node.js tool that analyzes code and extracts coding conventions. Think of it like "what coding style is this project actually using?"

## The Design Doc
[Paste DESIGN.md here]

## What I Need From You

### 1. Is This Even A Good Idea?
- Worth building?
- Or just reinventing the wheel?
- Better alternatives?

### 2. What's Actually Broken?
I know these are problems:
- No error handling (paths don't exist → crashes? idk)
- Uses regex not AST (yeah I know, lazy)
- Only works for JS/TS
- No tests (oops)

**Tell me:** Which one will bite me in the ass first?

### 3. Quick Fixes
What can I fix in like 2 hours that'll make this 10x better?

### 4. WTF Moments
Point out the dumb stuff I'm doing. Like:
- "Why are you using regex for this?"
- "This will break on [scenario]"
- "Did you even test this?"

### 5. Tech Choices
- Should I use Babel/acorn/TypeScript AST?
- Worker threads worth it or overkill?
- Any npm packages that already do this?

### 6. Make It Not Suck
Give me a priority list:
1. Fix [this] first (takes 30 min)
2. Then [this] (takes 2 hours)
3. Then [this] (takes a day)

## How to Answer
Keep it short. Use bullet points. No corporate speak.

Example:
```
# Real Talk Review

## TL;DR
- 6/10 - works but fragile
- Will break on: empty dirs, weird file names, large projects
- Fix error handling first, everything else is cosmetic

## Immediate Fixes (Do Today)
1. Check if path exists → throw error if not
   - Current: silently makes empty doc (wtf?)
   - Fix: Add 2 lines of validation

2. Warn on <10 files
   - Results are BS with tiny projects
   - Just console.warn(), takes 30 sec

## This Week
- Replace regex with Babel parser
  - Regex misses edge cases
  - Babel is standard, just use it
  - Example: [code]

## This Month
- Add tests (you have ZERO tests)
- Support Java/Python
- Handle 100K+ files without dying

## Tech Stack
- AST: Use Babel, not acorn
  - Why: Everyone uses Babel, more support
  - When: This week

- Parallel: Skip for now
  - Why: Premature optimization
  - When: Only if >10K files

## You're Doing This Wrong
- ❌ No path validation
- ❌ Regex for parsing (use AST)
- ❌ No tests
- ❌ No handling for non-JS projects
- ✅ Good: Component separation
- ✅ Good: Markdown + JSON output

## Bottom Line
Decent POC, needs hardening before real use.
Priority: Error handling → AST → Tests → Everything else

Ship it? Not yet. Fix those 3 things first.
```
```

---

## 📋 Customization Compare 도구 검토 프롬프트

Customization Compare 도구도 검토받으려면, 위 프롬프트의 "Convention Extractor"를 "Customization Compare"로 바꾸고, `tools/customization-compare/DESIGN.md` 내용을 붙여넣으세요.

## 검토 포인트 차이
- Convention Extractor: 통계 분석, 신뢰도, Edge case
- Customization Compare: Diff 알고리즘, 여러 고객사 비교, 인사이트 정확도

---

## 📝 사용 방법

### 1. 설계 문서 준비
```bash
# Convention Extractor
cat tools/convention-extractor/DESIGN.md

# Customization Compare
cat tools/customization-compare/DESIGN.md
```

### 2. AI별로 프롬프트 복사
- Gemini: 위의 "Gemini용 프롬프트" 전체 복사
- GPT-4: 위의 "GPT-4용 프롬프트" 전체 복사
- Grok: 위의 "Grok용 프롬프트" 전체 복사

### 3. 설계 문서 삽입
각 프롬프트의 `[Paste DESIGN.md here]` 부분에 실제 DESIGN.md 내용 붙여넣기

### 4. AI에게 전송
- Gemini: https://gemini.google.com
- ChatGPT: https://chat.openai.com
- Grok: https://x.com/i/grok

### 5. 결과 수집
각 AI의 응답을 다음 파일에 저장:
```
tools/convention-extractor/reviews/
  ├── gemini-review.md
  ├── gpt-review.md
  └── grok-review.md
```

### 6. 결과 비교 및 적용
- 공통 지적사항 우선 수정
- AI별 독특한 제안 검토
- 우선순위에 따라 개선 진행

---

## 💡 Tip

### 효과적인 검토를 위해
1. **한 번에 하나씩**: 한 도구씩 검토받기
2. **구체적 질문 추가**: "X 기능이 Y 방식인데 맞나요?"
3. **코드 예시 제공**: 문제가 되는 코드 스니펫 포함
4. **제약사항 명시**: "외부 의존성 최소화 필요" 등

### AI별 장점 활용
- **Gemini**: 긴 문서 분석, 다양한 관점
- **GPT-4**: 구조화된 체크리스트, 실용적 조언
- **Grok**: 핵심만 빠르게, 직설적 피드백

---

**작성일**: 2026-01-16
**목적**: 다중 AI 교차 검토
