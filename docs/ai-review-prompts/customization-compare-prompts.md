# AI 검토 요청 프롬프트 - Customization Compare

각 AI(Gemini, GPT, Grok)에게 Customization Compare 도구의 설계를 검토받기 위한 프롬프트입니다.

---

## 🟢 Gemini용 프롬프트

```
당신은 소프트웨어 아키텍처 전문가입니다. 아래 "Customization Compare" 도구의 설계 문서를 검토하고, 개선점을 제안해주세요.

## 도구 개요
솔루션 기반 프로젝트에서 Base 프로젝트와 고객사별 커스터마이징을 자동으로 비교 분석하는 Node.js 도구입니다.

## 검토 문서
[아래에 DESIGN.md 전체 내용을 붙여넣으세요]

## 검토 요청 사항

### 1. 문제 정의 평가
- 실무에서 실제로 겪는 문제인가?
- 문제 해결 방법이 적절한가?
- 다른 도구로 대체 가능한가?

### 2. Diff 알고리즘 검증
현재 사용 중인 방식:
- 파일 목록 Set 연산 (추가/삭제/공통)
- 파일 크기 비교 → 내용 비교
- 라인 단위 Set 비교

**문제점**:
- 라인 순서 변경 감지 못 함
- 공백 변경도 차이로 인식
- 리팩토링 감지 불가

**대안**:
- Git diff 활용
- Myers diff 알고리즘
- AST 기반 semantic diff

각 방법의 장단점과 권장 방법을 제시해주세요.

### 3. 인사이트 생성 로직 평가
현재 규칙 기반 인사이트:
```javascript
if (addedFiles contains '*Service.java') → "신규 기능 추가"
if (modifiedFiles contains 'Login*') → "보안 검토 필수"
if (addedLines > 200) → "대규모 변경 감지"
```

**질문**:
- 이 규칙들이 타당한가?
- 놓치고 있는 중요한 패턴은?
- AI/ML로 자동 학습 가능한가?

### 4. 확장성 검증
**시나리오**:
- Base 1개 + Customer 10개
- Base 1개 + Customer 100개
- 각 프로젝트 10만 줄 이상

현재 설계로 처리 가능한가? 병목 지점은?

### 5. Mock 테스트 데이터 평가
현재 Mock 프로젝트:
- Base: LoginController (기본 DB 인증)
- 삼천리: LoginController (OTP 추가)
- LG: LoginController (LDAP 추가)

**질문**:
- Mock 데이터가 현실적인가?
- 더 테스트해야 할 시나리오는?
- 실제 프로젝트와의 차이점은?

### 6. 고객사별 커스텀 추적 전략
**문제**: 시간이 지나면서 커스텀이 누적되면?
- 3년 후 Base와 Customer가 완전히 달라짐
- 어떤 변경이 언제 왜 추가되었는지 추적 불가

**해결 방법**:
- Git history 분석
- 변경 이력 DB화
- 주기적 리포트 자동 생성

구체적인 설계 제안해주세요.

### 7. 여러 고객사 동시 비교
**요구사항**: "OTP 기능을 어느 고객사들이 사용하나?"

현재 설계로는:
- Base vs A 비교
- Base vs B 비교
- Base vs C 비교
- 수동으로 결과 비교

**개선 필요**:
- 한 번에 여러 고객사 비교
- 기능별 매트릭스 생성
- 공통/고유 커스텀 구분

설계 방안을 제시해주세요.

## 출력 형식
다음 구조로 답변해주세요:

```markdown
# Customization Compare 설계 검토

## 1. 전체 평가 (1-10점)
[점수]: [이유]

## 2. 문제 정의 분석
### 실무 적합성
- [평가]
### 유사 도구 비교
- Git diff: [...]
- Beyond Compare: [...]
- 차이점: [...]

## 3. Diff 알고리즘 개선
### 현재 방식의 한계
1. [문제]
2. [문제]

### 권장 방식
**추천**: [Git diff / Myers / AST]
**이유**: [...]
**구현 방법**:
```javascript
// 예시 코드
```

## 4. 인사이트 생성 개선
### 추가해야 할 규칙
1. [패턴] → [인사이트]
2. ...

### AI/ML 적용 가능성
- [방법]: [...]
- 필요 데이터: [...]

## 5. 확장성 분석
### 병목 지점
1. [컴포넌트]: [이유]
2. ...

### 최적화 방안
1. [방법]: [예상 개선 효과]
2. ...

## 6. Mock 데이터 개선
### 추가 테스트 시나리오
1. [시나리오]: [이유]
2. ...

### 현실성 평가
- [항목]: [평가]

## 7. 장기 추적 전략
### Git History 활용
```bash
# 구현 예시
git log --all --grep="customer-A"
```

### 변경 이력 DB 설계
```sql
-- 테이블 구조
CREATE TABLE customizations (
  id INT,
  customer VARCHAR,
  file VARCHAR,
  change_type VARCHAR,
  added_at TIMESTAMP
);
```

## 8. 다중 고객사 비교 설계
### 매트릭스 생성
| 기능 | 삼천리 | LG | 현대 | 롯데 |
|------|--------|----|----|------|
| OTP | ✅ | ❌ | ✅ | ❌ |
| LDAP | ❌ | ✅ | ❌ | ✅ |

### 구현 방안
[...]

## 9. 우선순위 개선 사항
### 즉시 개선 (Critical)
1. [항목]

### 단기 (1-2주)
1. [항목]

### 장기 (1-2개월)
1. [항목]

## 10. 기타 제안
[추가 의견]
```
```

---

## 🔵 GPT-4용 프롬프트 (ChatGPT)

```
You are a senior software architect reviewing a solution customization tracking tool. Please provide a comprehensive review of "Customization Compare".

## Tool Overview
A Node.js tool that compares Base solutions with customer-specific customizations, automatically tracking changes across multiple customer deployments.

## Design Document
[Paste the entire DESIGN.md content below]

## Review Focus Areas

### 1. Business Value Assessment
- Does this solve a real problem?
- Is the ROI worth building this?
- What's the alternative? (Manual comparison, Git, other tools)

### 2. Diff Algorithm Deep Dive
**Current Approach**:
```javascript
// File level: Set operations
const added = customerFiles - baseFiles;
const deleted = baseFiles - customerFiles;
const modified = files with different content;

// Code level: Line-by-line Set comparison
const addedLines = customerLines - baseLines;
```

**Issues**:
- Doesn't detect line reordering
- Treats whitespace changes as diffs
- Misses semantic-preserving refactors

**Evaluate**:
1. Git diff integration: Pros/Cons
2. Myers algorithm: When to use
3. AST-based diff: Worth the complexity?

Provide a **decision matrix** with implementation difficulty vs accuracy.

### 3. Insight Generation Quality
**Current Rules**:
```javascript
if (new *Service.java) → "New feature"
if (modified Login*) → "Security review needed"
if (lines > 200) → "Major change"
```

**Questions**:
- Are these heuristics sufficient?
- What false positives/negatives occur?
- How to improve without ML?
- If using ML, what training data needed?

### 4. Scalability Analysis
**Load Tests**:
| Scenario | Files | Customers | Est. Time | Memory |
|----------|-------|-----------|-----------|--------|
| Small | 100 | 5 | ? | ? |
| Medium | 1,000 | 20 | ? | ? |
| Large | 10,000 | 100 | ? | ? |

Fill in estimates and identify bottlenecks.

### 5. Multi-Customer Comparison
**Problem**: Compare 10 customers at once

**Current**: Run tool 10 times manually
**Needed**: One command, matrix output

**Design Requirements**:
- Efficient data structure
- Parallel processing
- Aggregated insights
- Visual dashboard (HTML)

Propose an architecture.

### 6. Change Tracking Over Time
**Scenario**: Track 3 years of customizations

**Challenges**:
- Base version upgrades
- Customer upgrades
- Divergence quantification

**Propose**:
- Database schema
- Git integration strategy
- Automated reporting

### 7. Mock Data Validation
**Current Mocks**:
- Base: Basic login
- Customer A: +OTP
- Customer B: +LDAP

**Evaluate**:
- Realistic enough?
- Missing scenarios?
- Should we add: Database changes, Config changes, API changes?

## Output Format

```markdown
# Customization Compare - Architecture Review

## Executive Summary
- **Rating**: [X/10]
- **Production Ready**: [Yes/No/Conditionally]
- **Critical Gap**: [...]
- **Estimated Development**: [X weeks to production]

## Business Case
### Problem Validation
- ✅ Real problem: [evidence]
- ❌ Edge case: [...]

### ROI Analysis
- Build time: [X weeks]
- Time saved: [Y hours/month]
- Breakeven: [Z months]

## Technical Deep Dive

### 1. Diff Algorithm Recommendation
**Winner**: [Git diff / Myers / AST / Hybrid]

**Decision Matrix**:
| Approach | Accuracy | Speed | Complexity | Recommendation |
|----------|----------|-------|------------|----------------|
| Current (Set) | 6/10 | 10/10 | 2/10 | Replace |
| Git diff | 9/10 | 7/10 | 5/10 | **Use this** |
| Myers | 8/10 | 6/10 | 8/10 | Overkill |
| AST | 10/10 | 4/10 | 10/10 | Future |

**Implementation**:
```javascript
// Use Git diff
import { execSync } from 'child_process';

function gitDiff(base, customer, file) {
  // No need to commit, use --no-index
  const cmd = `git diff --no-index ${base}/${file} ${customer}/${file}`;
  const output = execSync(cmd).toString();
  return parseDiff(output);
}
```

### 2. Insight Engine Upgrade
**Add These Rules**:
1. Database schema changes → "Review migration strategy"
2. API endpoint changes → "Update documentation"
3. Dependency version changes → "Check compatibility"

**ML Integration (Optional)**:
```python
# Train on historical customizations
X = [file_changes, code_complexity, customer_type]
y = [bug_count, support_tickets]

model.fit(X, y)
# Predict risk score for new customizations
```

### 3. Scalability Plan
**Bottlenecks**:
1. File I/O → Use streaming
2. Diff computation → Parallelize with Worker Threads
3. Memory → Process in batches

**Optimized Architecture**:
```javascript
// Parallel diff processing
import { Worker } from 'worker_threads';

function parallelDiff(files) {
  const workers = files.map(file =>
    new Worker('./diff-worker.js', { workerData: file })
  );
  return Promise.all(workers.map(w => w.promise));
}
```

### 4. Multi-Customer Matrix
**Data Structure**:
```javascript
{
  features: {
    'OTP Authentication': {
      customers: ['Samchully', 'Hyundai'],
      files: ['LoginController.java'],
      addedLines: 50
    },
    'LDAP Integration': {
      customers: ['LG'],
      files: ['LoginController.java', 'LdapService.java'],
      addedLines: 120
    }
  }
}
```

**HTML Dashboard**:
```html
<table>
  <tr>
    <th>Feature</th>
    <th>Samchully</th>
    <th>LG</th>
    <th>Hyundai</th>
  </tr>
  <tr>
    <td>OTP</td>
    <td>✅</td>
    <td>❌</td>
    <td>✅</td>
  </tr>
</table>
```

### 5. Change Tracking Database
```sql
CREATE TABLE base_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR,
  released_at TIMESTAMP
);

CREATE TABLE customizations (
  id SERIAL PRIMARY KEY,
  customer VARCHAR,
  base_version INT REFERENCES base_versions,
  feature VARCHAR,
  file_path VARCHAR,
  lines_added INT,
  lines_removed INT,
  added_at TIMESTAMP,
  risk_score FLOAT
);

-- Query: Which customers have OTP?
SELECT customer
FROM customizations
WHERE feature = 'OTP Authentication';
```

### 6. Mock Data Improvements
**Add**:
- Database schema changes (ALTER TABLE)
- Configuration differences (YAML)
- Dependency changes (package.json)
- Build script changes (Maven/Gradle)

### 7. Testing Strategy
**Unit Tests**:
```javascript
describe('StructureDiffAnalyzer', () => {
  it('detects added files', () => {
    const base = ['file1.js'];
    const customer = ['file1.js', 'file2.js'];
    expect(analyzer.getAdded()).toEqual(['file2.js']);
  });
});
```

**Integration Tests**:
- Full comparison workflow
- Report generation
- Edge cases (empty, large, binary files)

## Implementation Roadmap

### Week 1: Critical Fixes
- [ ] Integrate Git diff
- [ ] Add path validation
- [ ] Improve error messages

### Week 2-3: Core Features
- [ ] Multi-customer comparison
- [ ] Feature matrix generation
- [ ] HTML dashboard

### Week 4: Enhancement
- [ ] Database tracking
- [ ] Performance optimization
- [ ] Documentation

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Git not installed | High | Check and warn |
| Large files timeout | Medium | Stream processing |
| Binary files | Low | Detect and skip |

## Conclusion
[Final recommendation]
```
```

---

## 🟣 Grok용 프롬프트 (xAI)

```
Need a no-BS review of this tool that compares different versions of the same software (like "Show me what's different between our base product and the version we sold to Samsung").

## What It Does
- Takes base software + customized versions
- Shows what changed
- Generates reports

## The Docs
[Paste DESIGN.md]

## Questions

### 1. Is This Actually Useful?
- Would real companies use this?
- Or can they just use Git?
- What's the value-add?

### 2. The Diff Logic Sucks, Right?
Current approach:
```javascript
// Compares files line-by-line using Sets
baseLines vs customerLines
```

Problems:
- Misses line reorders
- Whitespace = diff (dumb)
- No semantic understanding

**Should I:**
- A) Just shell out to `git diff` (easy but lazy?)
- B) Implement Myers algorithm (hard but cool?)
- C) Use AST (overkill?)

Be honest: which one would you actually do?

### 3. "Insights" Are Just Hardcoded Rules
```javascript
if (file.includes('Service')) → "new feature"
if (file.includes('Login')) → "security review"
```

This feels hacky. Is it? Or is this fine for v1?

### 4. Can This Scale?
What breaks first when comparing 100 customer versions with 100K files each?
- Memory?
- CPU?
- Time?

Quick fix for scalability?

### 5. Missing Features?
What obvious stuff am I not thinking about?

### 6. Mock Data Test
I made fake projects to test:
- Base: Regular login
- Customer A: Login + OTP
- Customer B: Login + LDAP

Good enough or need more scenarios?

## How to Reply
Short and blunt. Example:

```
# Brutal Review

## Worth Building?
**Maybe.** If you have 10+ customers and manual diff takes hours, sure.
If you have 2 customers, just use Git.

## Fix The Diff
**Use Git.** Seriously.

```bash
git diff --no-index base/ customer/
```

Don't reinvent diff algorithms. Git's is battle-tested.

Alternative: If you need semantic diff (like "this is a refactor, not a real change"), use jscodeshift or similar. But that's v2.

## Insights Are Fine
Hardcoded rules are okay for v1. They'll catch 80% of cases.

Add these:
- Config changes → "Check deployment"
- Dependency version bump → "Test regression"
- DB schema change → "Review migration"

ML later if needed. Don't overthink.

## Scalability
**Breaks at:** 50 customers × 50K files = death

**Fix:** Parallelize with worker threads. Diff each customer in parallel.

```javascript
customers.map(c => new Worker('diff.js', c))
```

Also: Don't load all files in memory. Stream.

## Missing
- HTML dashboard (matrix of who has what feature)
- Time-based tracking (what changed in last 3 months)
- Risk scoring (high-risk changes flagged)

## Mock Data
Add:
- Database changes
- Config changes
- Broken files (invalid syntax)

## Priority
1. Use Git diff (30 min)
2. Add HTML report (2 hours)
3. Parallelize (1 day)
4. Everything else (later)

## Ship It?
After #1 and #2, yeah. Rest can wait.
```
```

---

## 📋 사용 방법

동일하게:
1. 프롬프트 복사
2. `tools/customization-compare/DESIGN.md` 내용 삽입
3. AI에게 전송
4. 결과를 `tools/customization-compare/reviews/` 에 저장

---

**작성일**: 2026-01-16
**목적**: 다중 AI 교차 검토 (Customization Compare)
