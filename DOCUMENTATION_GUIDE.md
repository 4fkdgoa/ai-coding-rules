# 문서 작성 가이드

**버전**: 1.0
**최종 업데이트**: 2026-01-17
**근거**: Anthropic 공식 가이드라인

---

## 📏 문서 크기 제한 (공식 기준)

### Anthropic 공식 권장사항

| 파일 유형 | 최대 크기 | 근거 |
|----------|---------|------|
| **CLAUDE.md** | **1,000줄** (20K 토큰) | [Anthropic 공식 권장](https://mcpcat.io/guides/managing-claude-code-context/) |
| **일반 문서** | **1,000줄** (25K 토큰) | [Claude Code 파일 읽기 상한](https://claudelog.com/claude-code-limits/) |
| **권장 분리** | **500줄** | Context rot 방지 |
| **단일 섹션** | **200-300줄** | Attention budget |

### 토큰 환산표

```
20,000 토큰 ≈ 한글 20,000-40,000자
           ≈ 1,000-2,000줄
           ≈ Markdown 50-100KB

25,000 토큰 ≈ 한글 25,000-50,000자
           ≈ 1,250-2,500줄
           ≈ Markdown 60-125KB
```

---

## 🔬 왜 이 제한이 필요한가?

### Context Rot (컨텍스트 부패)

Anthropic 공식 연구 결과:

> "LLMs lose focus or experience confusion at certain points due to **'context rot'** - as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases."

**출처**: [Anthropic Engineering - Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**의미**:
- ❌ 컨텍스트가 길수록 **정확도 감소**
- ❌ "Attention budget" (주의력 예산)이 유한함
- ❌ 사람의 작업 기억(working memory)과 동일한 제약

### CLAUDE.md 과부하

> "If you have a large amount of documentation to provide (**over 20K tokens**), you will likely get better results by developing a documentation retrieval tool with MCP, as **overloading the CLAUDE.md file will have negative impacts** past a certain point."

**출처**: [Managing Claude Code Context](https://mcpcat.io/guides/managing-claude-code-context/)

**영향**:
- ⚠️ 20K 토큰 초과 시 성능 저하
- ⚠️ 25K 토큰 초과 시 `MaxFileReadTokenExceededError`
- ⚠️ 중요한 정보를 놓칠 가능성 증가

---

## 📋 문서 작성 규칙

### 1단계: 길이 확인

```bash
# 문서 줄 수 확인
wc -l docs/*.md

# 결과 해석:
# ✅ 500줄 이하: 안전
# ⚠️ 500-1000줄: 분리 검토
# ❌ 1000줄 초과: 즉시 분리
```

### 2단계: 분리 전략

#### Pattern A: 요약 + 상세 (기본 전략)

```
docs/
├── FEATURE.md              (요약, 200줄 이하)
│   ├── 개요
│   ├── 빠른 시작
│   ├── 핵심 개념
│   └── [상세 설계 →](design/FEATURE.md)
│
└── design/
    └── FEATURE.md          (상세, 제한 없음)
        ├── 전체 아키텍처
        ├── 구현 세부사항
        └── 예제 코드
```

**예시**:
```markdown
# AI 모드 (AI_MODE.md)

## 📋 목차
- [개요](#개요)
- [빠른 시작](#빠른-시작)
- [상세 설계](#상세-설계)

## 개요 (100줄)
AI 모드는 3가지가 있습니다...

## 빠른 시작 (50줄)
```bash
export AI_MODE=ai-assisted
node db-monitor.js
```

## 상세 설계
전체 아키텍처, 비용 분석, 구현 가이드는 [AI_MODE_DESIGN.md](design/AI_MODE_DESIGN.md) 참고
```

#### Pattern B: 주제별 분리 (복잡한 경우)

```
docs/FEATURE/
├── README.md           (목차 + 개요, 100줄)
├── architecture.md     (아키텍처, 300-500줄)
├── api.md             (API 문서, 300-500줄)
├── implementation.md   (구현 가이드, 300-500줄)
└── examples.md        (예제, 300-500줄)
```

### 3단계: 문서 구조

#### ✅ 좋은 예시

```markdown
# 제목

## 📋 목차
- [개요](#개요)
- [빠른 시작](#빠른-시작)
- [API Reference](#api-reference)

---

## 개요

간단한 설명 (100줄 이하)

---

## 빠른 시작

```bash
# 최소한의 실행 코드
npm install
npm start
```

---

## API Reference

상세 내용은 [API_DESIGN.md](design/API_DESIGN.md) 참고

---
```

#### ❌ 나쁜 예시

```markdown
# 제목

(구조 없이 2000줄의 텍스트 블록...)
(목차 없음)
(섹션 구분 없음)
```

---

## 🏗️ CLAUDE.md 작성 규칙

### 절대 규칙

```
❌ 1,000줄 절대 초과 금지
❌ 모든 설계 문서 복붙 금지
❌ 긴 코드 예제 포함 금지
```

### 권장 구조

```markdown
# AI Coding Assistant Rules

## 📏 문서 크기 제한
- 일반 문서: 500줄 초과 시 분리
- CLAUDE.md: 1,000줄 절대 초과 금지
- 상세 설계: docs/design/*.md 참고

## 코딩 표준
(핵심 규칙만 200줄 이하)

## Git 커밋 규칙
(핵심 규칙만 100줄 이하)

## 프로젝트별 설정
(간단한 정보만)

## 📚 상세 문서
- 성능 분석: [docs/performance-analysis-guide.md](docs/performance-analysis-guide.md)
- Wiki 사용법: [docs/WIKI.md](docs/WIKI.md)
- AI 모드: [docs/AI_MODE.md](docs/AI_MODE.md)
```

**핵심**:
- CLAUDE.md는 "목차 + 핵심 규칙 + 링크"
- 상세는 별도 문서로 분리

---

## 📊 체크리스트

### 문서 작성 전

- [ ] 예상 길이가 500줄 이하인가?
- [ ] 명확한 목차가 있는가?
- [ ] 각 섹션이 독립적인가?

### 문서 작성 후

- [ ] 줄 수 확인 (`wc -l 파일명`)
- [ ] 500줄 초과 시 분리 계획 수립
- [ ] 1,000줄 초과 시 즉시 분리
- [ ] CLAUDE.md 업데이트 (링크 추가)

### 문서 검토 (코드 리뷰 시)

- [ ] 코드 블록은 100줄 이하인가?
- [ ] 표가 너무 길지 않은가? (50줄 이상 → 별도 파일)
- [ ] 중복 내용이 없는가?
- [ ] 링크가 정확한가?

---

## 🛠️ 자동 검사 스크립트

### scripts/check-docs.sh

```bash
#!/bin/bash
# 문서 크기 검사

echo "📏 문서 크기 검사"
echo "=" | tr '=' '='

find docs -name "*.md" | sort | while read file; do
    lines=$(wc -l < "$file")

    if [ $lines -gt 1000 ]; then
        echo "❌ $file: $lines lines (MUST SPLIT - 초과)"
    elif [ $lines -gt 500 ]; then
        echo "⚠️  $file: $lines lines (CONSIDER SPLIT - 검토 필요)"
    else
        echo "✅ $file: $lines lines"
    fi
done

echo ""
echo "CLAUDE.md 검사:"
if [ -f "CLAUDE.md" ]; then
    claude_lines=$(wc -l < "CLAUDE.md")
    if [ $claude_lines -gt 1000 ]; then
        echo "❌ CLAUDE.md: $claude_lines lines (CRITICAL - 즉시 수정)"
    elif [ $claude_lines -gt 800 ]; then
        echo "⚠️  CLAUDE.md: $claude_lines lines (WARNING - 주의)"
    else
        echo "✅ CLAUDE.md: $claude_lines lines"
    fi
fi
```

### 사용법

```bash
chmod +x scripts/check-docs.sh
./scripts/check-docs.sh

# 출력 예시:
# ❌ docs/WIKI_DB_DESIGN.md: 876 lines (MUST SPLIT)
# ⚠️  docs/AI_MODE_DESIGN.md: 834 lines (CONSIDER SPLIT)
# ✅ docs/project-analyzer-design.md: 342 lines
# ✅ CLAUDE.md: 500 lines
```

---

## 🎯 적용 예시

### Before (문제)

```
docs/
├── WIKI_DB_DESIGN.md       876 lines ❌
├── AI_MODE_DESIGN.md       834 lines ❌
└── OPUS_REVIEW_RESULT.md   834 lines ❌

CLAUDE.md                   1,200 lines ❌ (과부하!)
```

### After (개선)

```
docs/
├── WIKI.md                 150 lines ✅ (요약)
├── AI_MODE.md              200 lines ✅ (요약)
├── OPUS_REVIEW.md          200 lines ✅ (요약)
│
└── design/
    ├── WIKI_DB_DESIGN.md       876 lines ✅ (필요시만)
    ├── AI_MODE_DESIGN.md       834 lines ✅ (필요시만)
    └── OPUS_REVIEW_RESULT.md   834 lines ✅ (필요시만)

CLAUDE.md                   500 lines ✅ (핵심만)
```

**CLAUDE.md 변경**:

```diff
- ## Wiki DB 설계
- (876줄의 전체 설계...)

+ ## Wiki DB
+ 위키 자동 생성 시스템
+ 상세: [docs/WIKI.md](docs/WIKI.md)
```

---

## 📚 참고 자료 (공식 출처)

### Anthropic 공식 문서

1. **CLAUDE.md 크기 제한**
   - [Managing Claude Code Context](https://mcpcat.io/guides/managing-claude-code-context/)
   - 권장: 20K 토큰 (약 1,000줄) 이하
   - 초과 시: MCP 검색 도구 권장

2. **파일 읽기 제한**
   - [Claude Code Limits](https://claudelog.com/claude-code-limits/)
   - 상한: 25,000 토큰
   - 초과 시: `MaxFileReadTokenExceededError`

3. **Context Engineering**
   - [Anthropic Engineering Blog](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
   - Context rot 현상 설명
   - Attention budget 개념

4. **Prompt Engineering Best Practices**
   - [Claude 4.x Best Practices](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)
   - 명확한 구조 권장
   - System prompt 작성법

5. **Long Context Tips**
   - [Long Context Window Tips](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips)
   - 문서를 논리적 섹션으로 분리
   - 각 섹션에 명확한 헤더

### 추가 참고 자료

6. **Claude Context Window Guide**
   - [DataStudios - Claude Context Window](https://www.datastudios.org/post/claude-context-window-token-limits-memory-policy-and-2025-rules)
   - 토큰 제한 및 정책

7. **Practical Guide to Context Window**
   - [Eesel AI - Context Window Size](https://www.eesel.ai/blog/claude-code-context-window-size)
   - 실용적인 사용 가이드

8. **Prompt Engineering Interactive Tutorial**
   - [GitHub - Anthropic Tutorial](https://github.com/anthropics/prompt-eng-interactive-tutorial)
   - 실습 기반 학습

---

## 🔄 문서 마이그레이션 가이드

### 기존 긴 문서 분리하기

#### 1단계: 현재 상태 파악

```bash
# 긴 문서 찾기
find docs -name "*.md" -exec wc -l {} \; | sort -nr | head -10
```

#### 2단계: 요약 문서 생성

```markdown
# NEW: docs/FEATURE.md

## 개요
(기존 문서의 "개요" 섹션 복사)

## 빠른 시작
(기존 문서의 "빠른 시작" 섹션 복사)

## 주요 개념
(핵심 개념만 간단히)

## 상세 문서
전체 설계는 [design/FEATURE.md](design/FEATURE.md) 참고
```

#### 3단계: 상세 문서 이동

```bash
# 기존 문서를 design/ 폴더로 이동
mkdir -p docs/design
mv docs/FEATURE_DESIGN.md docs/design/FEATURE.md
```

#### 4단계: CLAUDE.md 업데이트

```diff
- 상세 내용: docs/FEATURE_DESIGN.md 참고
+ 상세 내용: docs/FEATURE.md 참고 (요약)
+ 전체 설계: docs/design/FEATURE.md (필요시)
```

---

## ❓ FAQ

### Q1. 정확히 몇 줄까지 괜찮나요?

**A1**:
- **안전 구간**: 500줄 이하
- **주의 구간**: 500-1,000줄 (분리 검토)
- **위험 구간**: 1,000줄 초과 (즉시 분리)
- **CLAUDE.md**: 1,000줄 절대 초과 금지

### Q2. 왜 줄 수로 측정하나요? 토큰이 더 정확하지 않나요?

**A2**:
- 토큰 계산은 복잡함 (언어, 코드 블록마다 다름)
- 줄 수는 간단하고 일관성 있음
- 1,000줄 ≈ 20K 토큰 (안전한 근사치)

### Q3. 설계 문서가 원래 길면 어떡하나요?

**A3**:
- design/ 폴더에 보관 (제한 없음)
- 요약 문서만 500줄 이하 유지
- CLAUDE.md에서 링크만 제공
- 필요할 때만 읽도록 유도

### Q4. 코드 예제가 길면요?

**A4**:
- 100줄 넘는 코드는 별도 파일로
- 문서에는 링크만 포함
- 또는 핵심 부분만 발췌

```markdown
# 나쁜 예시
```javascript
// 500줄의 전체 코드...
```

# 좋은 예시
핵심 코드:
```javascript
// 20줄의 핵심 로직만
```

전체 코드: [examples/full-code.js](examples/full-code.js)
```

### Q5. 이미 작성된 문서는 어떻게 하나요?

**A5**:
- 당장 급한 건 아님
- 점진적 개선 (문서 수정할 때마다)
- 우선순위: CLAUDE.md > README > 나머지

---

## ✅ 요약

```
📏 문서 크기 제한 (Anthropic 공식):
   - CLAUDE.md: 1,000줄 이하 (필수)
   - 일반 문서: 500줄 넘으면 검토, 1,000줄 넘으면 분리

🏗️ 분리 전략:
   - 요약 (docs/FEATURE.md) + 상세 (docs/design/FEATURE.md)
   - 또는 주제별 분리 (docs/FEATURE/*.md)

📋 체크리스트:
   - [ ] wc -l 로 줄 수 확인
   - [ ] 500줄 초과 시 분리 계획
   - [ ] 1,000줄 초과 시 즉시 분리
   - [ ] CLAUDE.md는 링크만 유지

🔗 근거:
   - Context rot (정확도 감소)
   - Attention budget (유한한 주의력)
   - 20K 토큰 초과 시 성능 저하 (공식)
```

---

**작성일**: 2026-01-17
**버전**: 1.0
**다음 리뷰**: 프로젝트 규모 증가 시
