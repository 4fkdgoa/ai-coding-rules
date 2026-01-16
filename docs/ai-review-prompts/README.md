# AI 검토 요청 문서 모음

이 디렉토리는 각 자동화 도구의 설계 문서와 AI 검토 프롬프트를 모아둔 곳입니다.

## 📁 파일 목록

### Convention Extractor (컨벤션 자동 추출 도구)
- `convention-extractor-design.md` - 상세 설계 문서
- `convention-extractor-prompts.md` - Gemini, GPT, Grok용 검토 프롬프트

### Customization Compare (고객사별 커스텀 비교 도구)
- `customization-compare-design.md` - 상세 설계 문서
- `customization-compare-prompts.md` - Gemini, GPT, Grok용 검토 프롬프트

## 🚀 사용 방법

### 1. AI 검토 요청하기

각 프롬프트 파일(`*-prompts.md`)을 열면:
- 🟢 Gemini용 프롬프트
- 🔵 GPT-4용 프롬프트
- 🟣 Grok용 프롬프트

가 포함되어 있습니다.

### 2. 프롬프트 사용법

1. 프롬프트 파일에서 원하는 AI 섹션 복사
2. `[Paste DESIGN.md here]` 부분에 해당 설계 문서 내용 붙여넣기
3. AI에게 전송

### 3. AI 접속

- **Gemini**: https://gemini.google.com
- **ChatGPT**: https://chat.openai.com
- **Grok**: https://x.com/i/grok

## 📝 검토 결과 저장

각 도구의 `reviews/` 디렉토리에 저장:
```
tools/convention-extractor/reviews/
  ├── gemini-review.md
  ├── gpt-review.md
  └── grok-review.md

tools/customization-compare/reviews/
  ├── gemini-review.md
  ├── gpt-review.md
  └── grok-review.md
```

## 🎯 검토 포인트

### Convention Extractor
- 에러 핸들링 부족
- 정규식 vs AST 파싱
- 테스트 전략
- 확장성

### Customization Compare
- Diff 알고리즘 선택
- 인사이트 생성 로직
- 다중 고객사 비교
- 장기 추적 전략

---

**생성일**: 2026-01-16
**목적**: 다중 AI 교차 검토
