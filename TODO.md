# 프로젝트 TODO

**최종 업데이트**: 2026-01-17

---

## 📊 진행 상황 요약

```
완료: ████████████████░░░░ 80%
```

| 카테고리 | 완료 | 테스트 대기 | 진행중 | 대기 | 합계 |
|---------|------|------------|--------|------|------|
| 프로젝트 분석 | 3 | 1 | 0 | 1 | 5 |
| 테스트 도구 | 3 | 0 | 0 | 0 | 3 |
| DB 모니터링 | 5 | 1 | 0 | 0 | 6 |
| AI 워크플로우 | 1 | 0 | 0 | 2 | 3 |
| 문서화 | 1 | 0 | 0 | 0 | 1 |
| **합계** | **13** | **2** | **0** | **3** | **18** |

---

## ✅ 완료된 작업

### 1. 프로젝트 분석 도구

- ✅ **analyze_project.sh** - 프로젝트 스캔 및 구조 파악
- ✅ **db_analyzer** - DB 스키마 추출 (비대화형 모드)
- ✅ **Mermaid 템플릿** - 아키텍처 다이어그램 자동 생성

### 2. 테스트 도구

- ✅ **Playwright 성능 테스트** - SDMS/삼천리 성능 분석
- ✅ **통합 테스트 툴** - 솔루션 vs 커스텀 프로젝트 비교 (test-customization.js)
- ✅ **리팩토링 점검 도구** - 코드 품질 자동 분석 (check-quality.js)

### 3. DB 모니터링 시스템 (완성도 높음)

- ✅ **기본 모니터링** - 느린 쿼리, Lock, CPU, Table Scan, 데드락
- ✅ **알림 시스템** - 로그 + 이메일 + Webhook (Google Chat, Slack, Discord, Teams)
- ✅ **특정 쿼리 감시** - MyBatis XML ID 기반 감시 (`#{}`, `${}` 대응)
- ✅ **Lock 누적 추적** - 10분 이상 유지 시 Critical 알림
- ✅ **동시 모니터링** - 느린 쿼리 전체 + 지정 쿼리 동시 작동

### 4. AI 모드

- ✅ **AI 모드 설계** - 하이브리드 아키텍처 (standard, ai-assisted, ai-full)
- ✅ **프로토타입 구현** - AIEngine, CostTracker, Cache, Anthropic Provider

### 5. 위키 시스템 (구현 완료, 테스트 대기)

- ✅ **Wiki DB 구현** - SQLite + 정규화 스키마 (schema.sql, wiki-db.js)
- ✅ **검색 도구** - search-wiki.js (전체 검색, 통계, 기능 상세)
- ✅ **비교 도구** - compare-solutions.js (솔루션 vs 커스텀)
- ✅ **저장 도구** - save-to-wiki.js (프로젝트 분석 → DB 저장)
- ⚠️ **실제 프로젝트 테스트 필요** - AutoCRM 프로젝트로 검증 대기

### 6. 문서화

- ✅ **Documentation Guide** - Anthropic 공식 기준 (DOCUMENTATION_GUIDE.md, check-docs.sh)

---

## ⚠️ 테스트 대기 중

### 1. 위키 자동 생성 시스템

**상태**: 구현 완료, 실제 프로젝트 테스트 필요
**파일**:
- scripts/wiki/schema.sql
- scripts/wiki/wiki-db.js
- scripts/search-wiki.js
- scripts/compare-solutions.js
- scripts/save-to-wiki.js

**테스트 방법**:
```bash
# 1. 의존성 설치
npm install

# 2. 샘플 데이터 테스트
node scripts/save-to-wiki.js ~/TestProject --sample

# 3. 검색 테스트
node scripts/search-wiki.js project-id 고객

# 4. 실제 프로젝트 테스트 (필요)
node scripts/save-to-wiki.js ~/AutoCRM_Samchully_BPS
```

### 2. DB 모니터링 Opus 개선사항

**상태**: 구현 완료, 실제 DB 테스트 필요
**변경사항**:
- SQL Injection 수정 (파라미터 바인딩)
- Lock History 메모리 관리 (LRU + 영속화)
- 성능 지표 추가 (인덱스 사용률, 버퍼 캐시)

**테스트 방법**:
```bash
# 실제 MSSQL DB 연결 필요
cd tools/performance-test/db-monitor
node db-alert-monitor.js
```

---

## 🔄 진행 중

없음

---

## ⏳ 대기 중 (우선순위순)

### 1. AI 워크플로우 완전 자동화 (MEDIUM)

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

### 2. AI 모드 실제 통합 (LOW)

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

1. **위키 시스템 실제 테스트** (1-2시간) ⭐ 다음 작업
   - AutoCRM 프로젝트로 검증
   - 버그 수정

2. **AI 워크플로우 완전 자동화** (4-6시간)
   - cross_check.sh 개선
   - AI 에이전트 자동 협업

3. **AI 모드 실제 통합** (2-3시간)
   - db-alert-monitor.js에 AIEngine 통합
   - 쿼리 유사도 분석

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
- 완료: DB 모니터링, 위키 생성 (구현), 통합 테스트, 리팩토링 점검
- 테스트 대기: 위키 시스템, DB 모니터링 개선사항
- 다음 작업: 위키 시스템 실제 프로젝트 테스트

다음 작업:
1. 위키 시스템 실제 테스트
   - AutoCRM 프로젝트로 검증
   - 발견된 버그 수정
   - 성능 측정

2. AI 워크플로우 완전 자동화
   - cross_check.sh 개선
   - AI 에이전트 자동 협업 구현

주의사항:
- 주석 충분히 작성 (다른 개발자가 이해 가능하게)
- 실제 프로젝트 테스트 전까지 "완료"가 아닌 "구현 완료, 테스트 대기"
```

### Gemini에게

```markdown
프로젝트 목적:
1. SI 프로젝트 자동 완성 (요구사항 → AI 워크플로우 → 구현)
2. 테스트 도구 (성능, 통합, 품질, 회귀) ✅ 완료
3. 모니터링 (DB, 성능) ✅ 완료
4. 인계 문서 자동화

현재 상태: 80% 완료 (구현), 테스트 대기 중

다음 설계 검토 요청:
- AI 워크플로우 자동화 설계 (Claude ↔ Gemini 협업)
- 인계 문서 자동 생성 전략
- 성능 회귀 테스트 방안
```

---

**작성일**: 2026-01-17
**완료율**: 80% (13/18 완료, 2/18 테스트 대기)
**다음 마일스톤**: 위키 시스템 실제 테스트 (85%)
