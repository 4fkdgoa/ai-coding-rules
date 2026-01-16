# 프로젝트 TODO

**최종 업데이트**: 2026-01-16

---

## 📊 진행 상황 요약

```
완료: ████████████░░░░░░░░ 60%
```

| 카테고리 | 완료 | 진행중 | 대기 | 합계 |
|---------|------|--------|------|------|
| 프로젝트 분석 | 3 | 1 | 1 | 5 |
| 테스트 도구 | 1 | 0 | 2 | 3 |
| DB 모니터링 | 5 | 0 | 0 | 5 |
| AI 워크플로우 | 1 | 0 | 2 | 3 |
| **합계** | **10** | **1** | **5** | **16** |

---

## ✅ 완료된 작업

### 1. 프로젝트 분석 도구

- ✅ **analyze_project.sh** - 프로젝트 스캔 및 구조 파악
- ✅ **db_analyzer** - DB 스키마 추출 (비대화형 모드)
- ✅ **Mermaid 템플릿** - 아키텍처 다이어그램 자동 생성

### 2. 테스트 도구

- ✅ **Playwright 성능 테스트** - SDMS/삼천리 성능 분석

### 3. DB 모니터링 시스템 (완성도 높음)

- ✅ **기본 모니터링** - 느린 쿼리, Lock, CPU, Table Scan, 데드락
- ✅ **알림 시스템** - 로그 + 이메일 + Webhook (Google Chat, Slack, Discord, Teams)
- ✅ **특정 쿼리 감시** - MyBatis XML ID 기반 감시 (`#{}`, `${}` 대응)
- ✅ **Lock 누적 추적** - 10분 이상 유지 시 Critical 알림
- ✅ **동시 모니터링** - 느린 쿼리 전체 + 지정 쿼리 동시 작동

### 4. AI 모드

- ✅ **AI 모드 설계** - 하이브리드 아키텍처 (standard, ai-assisted, ai-full)
- ✅ **프로토타입 구현** - AIEngine, CostTracker, Cache, Anthropic Provider

---

## 🔄 진행 중

### 위키 DB 설계 (설계 단계)

**우선순위**: 중간
**담당**: 실제 프로젝트 테스트 후 구현
**문서**: [docs/WIKI_DB_DESIGN.md](docs/WIKI_DB_DESIGN.md)

**내용**:
- SQLite + Markdown 하이브리드
- 기능, API, 테이블 관계 추적
- 솔루션 vs 커스텀 차이 분석

**다음 단계**:
1. AutoCRM 프로젝트로 실제 테스트
2. DB 스키마 생성 및 검증
3. 검색/비교 도구 구현

---

## ⏳ 대기 중 (우선순위순)

### 1. 위키 자동 생성 (HIGH)

**우선순위**: ⭐⭐⭐
**예상 시간**: 4-6시간
**의존성**: 위키 DB 설계 완료

**내용**:
- DB 스키마 생성 (better-sqlite3)
- analyze_project.sh → DB 저장
- 검색 CLI 도구
- 솔루션 vs 커스텀 비교 도구

**AI 프롬프트**: [docs/WIKI_DB_DESIGN.md](docs/WIKI_DB_DESIGN.md) 참고

---

### 2. 통합 테스트 툴 (HIGH)

**우선순위**: ⭐⭐⭐
**예상 시간**: 2-3시간

**내용**:
- 솔루션 원본 vs 커스텀 프로젝트 차이 자동 분석
- 회귀 테스트 (기능 삭제/변경 감지)
- 자동 리포트 생성

**사용 예시**:
```bash
./test-customization.sh \
  --solution ~/AutoCRM_Core3 \
  --custom ~/AutoCRM_Samchully_BPS
```

**출력**:
```markdown
# 커스텀 리포트

## 추가된 기능 (3개)
- 삼천리 전용 재고 입고
- ...

## 변경된 API (5개)
- GET /api/customer/list (pageSize 변경)
```

---

### 3. 리팩토링 점검 도구 (MEDIUM)

**우선순위**: ⭐⭐
**예상 시간**: 2-3시간

**내용**:
- SonarQube/PMD 연동
- 코드 품질 지표 수집
- 자동 리포트 생성

**사용 예시**:
```bash
./check-quality.sh ~/AutoCRM_Samchully_BPS
```

**출력**:
```
코드 품질 리포트

🔴 Critical: 3개
⚠️  Warning: 15개
ℹ️  Info: 42개

주요 문제:
- SQL Injection 취약점: 2개
- 중복 코드: 8개
```

---

### 4. AI 워크플로우 완전 자동화 (MEDIUM)

**우선순위**: ⭐⭐
**예상 시간**: 4-6시간

**내용**:
- cross_check.sh 개선
- AI 에이전트가 스스로 코드 작성/테스트/리뷰
- 무한루프 방지 (최대 2회)

**목표**:
```
사용자: "고객 검색 기능 추가해줘"

AI 워크플로우 (자동):
1. Gemini: 설계 작성
2. Claude: 코드 구현
3. Gemini: 코드 리뷰
4. Claude: 피드백 반영
5. Gemini: 최종 승인
6. 자동 커밋 + PR 생성
```

---

### 5. AI 모드 실제 통합 (LOW)

**우선순위**: ⭐
**예상 시간**: 2-3시간
**의존성**: Anthropic API 키 필요

**내용**:
- db-alert-monitor.js에 AIEngine 통합
- 쿼리 유사도 분석 구현
- 실제 프로젝트 테스트

---

## 📝 미래 계획 (아이디어 단계)

### 1. 인계 문서 자동 생성

**내용**:
- 프로젝트 분석 → 인계 문서 자동 생성
- "신규 개발자 온보딩 가이드"
- "주요 기능 설명서"

### 2. 성능 회귀 테스트

**내용**:
- 배포 전 성능 비교 (이전 버전 vs 새 버전)
- 느려진 쿼리 자동 감지
- 알림 발송

### 3. 자동 버그 리포트

**내용**:
- 운영 로그 분석
- 빈번한 에러 패턴 감지
- 수정 제안

---

## 🎯 다음 작업 우선순위

### 추천 순서

1. **위키 DB 설계 완성** (4-6시간)
   - 실제 프로젝트 테스트
   - DB 스키마 확정
   - 검색/비교 도구 구현

2. **통합 테스트 툴** (2-3시간)
   - 솔루션 vs 커스텀 차이 분석
   - 회귀 테스트

3. **리팩토링 점검 도구** (2-3시간)
   - SonarQube/PMD 연동

---

## 📚 관련 문서

| 문서 | 내용 |
|------|------|
| [WIKI_DB_DESIGN.md](docs/WIKI_DB_DESIGN.md) | 위키 DB 설계 + AI 프롬프트 |
| [project-analyzer-design.md](docs/project-analyzer-design.md) | 프로젝트 분석기 설계 |
| [AI_MODE_DESIGN.md](tools/performance-test/db-monitor/AI_MODE_DESIGN.md) | AI 모드 전체 설계 |
| [AI_MODE.md](tools/performance-test/db-monitor/AI_MODE.md) | AI 모드 요약 |

---

## 🤖 다음 AI에게 전달할 메시지

### Claude Code에게

```markdown
프로젝트 상태:
- 완료: DB 모니터링 시스템 (완성도 높음)
- 진행 중: 위키 DB 설계 (설계 단계)
- 다음 작업: 위키 DB 구현 또는 통합 테스트 툴

다음 작업 선택:
1. 위키 DB 구현 (docs/WIKI_DB_DESIGN.md 참고)
2. 통합 테스트 툴 (솔루션 vs 커스텀 비교)
3. 리팩토링 점검 도구

사용자 의견 확인 후 진행하세요.
```

### Gemini에게

```markdown
프로젝트 목적:
1. SI 프로젝트 자동 완성 (요구사항 → AI 워크플로우 → 구현)
2. 테스트 도구 (성능, 회귀)
3. 모니터링 (DB, 성능)
4. 인계 문서 자동화

현재 상태: 60% 완료

다음 설계 검토 요청:
- 위키 DB 스키마 검토 (docs/WIKI_DB_DESIGN.md)
- 통합 테스트 전략 제안
- AI 워크플로우 개선 방안
```

---

**작성일**: 2026-01-16
**완료율**: 60% (10/16)
**다음 마일스톤**: 위키 자동 생성 완성 (70%)
