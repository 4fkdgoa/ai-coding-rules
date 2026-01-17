# Opus 프로젝트 검토 결과

**검토일**: 2026-01-17
**검토 모델**: Claude Opus 4.5
**프로젝트**: ai-coding-rules (SI 자동화 도구)
**검토자 역할**: 아키텍처 및 설계 검토

---

## 전체 평가

**진행률**: 60% (10/16)
**전체 평가**: 중상 (Good)
**주요 강점**:
- DB 모니터링 시스템의 완성도가 높음 (Lock 추적, 다채널 알림, AI 모드 설계)
- 문서화가 체계적이고 AI 프롬프트까지 포함하여 연속 작업 가능
- 비용 최적화 전략이 현실적 (캐싱, 계층적 처리)

**주요 약점**:
- 위키 DB 스키마의 JSON 컬럼이 확장성에 제약
- 실제 프로젝트 테스트 없이 설계만 진행됨
- 도구 간 통합 테스트 부족

---

## 1. 전체 아키텍처 검토

### 장점

1. **명확한 디렉토리 구조**
   ```
   scripts/     - 분석 도구 (analyze_project.sh, db_analyzer)
   tools/       - 테스트/모니터링 도구 (playwright, db-monitor)
   docs/        - 설계 문서 및 가이드
   ```
   - 역할별 분리가 명확함
   - 각 도구가 독립적으로 실행 가능
   - 새로운 도구 추가 시 기존 구조에 자연스럽게 통합 가능

2. **도구 독립성**
   - `db-alert-monitor.js`는 단독 실행 가능
   - `analyze_project.sh`는 외부 의존성 최소화
   - 각 도구가 자체 설정 파일(config/) 보유

3. **확장 고려**
   - AI 모드 설계에서 Provider 패턴 사용 (Anthropic, OpenAI, Google)
   - 알림 채널 추상화 (Email, Webhook, Google Chat, Slack 등)

### 개선점

1. **도구 간 통합 인터페이스 부재**
   ```
   현재: 각 도구가 개별 실행
   개선: 통합 CLI 또는 오케스트레이터 필요
   ```
   ```bash
   # 현재 (개별 실행)
   ./scripts/analyze_project.sh ~/MyProject
   node tools/performance-test/db-monitor/db-alert-monitor.js

   # 개선 (통합 CLI)
   ai-tools analyze ~/MyProject
   ai-tools monitor --db
   ai-tools wiki search "고객"
   ```

2. **공통 유틸리티 중복 가능성**
   - 로깅, 설정 관리, 에러 처리가 각 도구에 분산
   - `lib/common/` 또는 `shared/` 디렉토리로 통합 권장

3. **버전 관리 전략 부재**
   - 각 도구의 버전 명시 없음
   - `package.json` 또는 버전 파일 추가 필요

### 제안

```
ai-coding-rules/
├── bin/                    # 통합 CLI (신규)
│   └── ai-tools            # 메인 진입점
├── lib/                    # 공통 라이브러리 (신규)
│   ├── common/
│   │   ├── logger.js
│   │   ├── config-loader.js
│   │   └── error-handler.js
│   └── ai-providers/       # AI Provider 통합
├── scripts/                # 기존 유지
├── tools/                  # 기존 유지
└── docs/                   # 기존 유지
```

---

## 2. 위키 DB 스키마 검증

### 스키마 평가

| 항목 | 평가 | 상세 |
|------|------|------|
| **정규화** | 부분적 | 기본 테이블은 적절하나 JSON 컬럼으로 역정규화 |
| **JSON 컬럼** | 비효율적 | 검색/조인 시 성능 저하 |
| **인덱스 전략** | 개선 필요 | JSON 내부 검색 불가, 다대다 관계 인덱스 없음 |

### 현재 스키마 문제점

#### 문제 1: JSON 컬럼 검색 비효율

```sql
-- 현재: JSON 문자열 검색 (매우 비효율)
SELECT * FROM db_tables
WHERE related_features LIKE '%feature-1%';

-- 문제:
-- 1. Full Table Scan 발생
-- 2. "feature-10", "feature-100"도 매칭됨
-- 3. 인덱스 활용 불가
```

#### 문제 2: 관계 추적 쿼리 복잡도

```sql
-- 현재 설계의 API-테이블 연결 쿼리
SELECT DISTINCT a.path, t.table_name
FROM apis a
JOIN features f ON a.feature_id = f.id
JOIN db_tables t ON t.related_features LIKE '%' || f.id || '%'
WHERE a.path = '/api/stock/list';

-- 문제:
-- 1. LIKE 연산으로 인해 O(n*m) 복잡도
-- 2. 500개 파일, 200개 API 시 성능 저하
-- 3. 관계 정합성 검증 어려움
```

#### 문제 3: 대규모 프로젝트 성능 예측

| 규모 | 예상 성능 | 문제점 |
|------|----------|--------|
| 50 파일 | 양호 (<100ms) | 없음 |
| 200 파일 | 보통 (<500ms) | JSON 검색 지연 |
| 500 파일 | 느림 (1-3s) | Full Scan 빈번 |
| 1000+ 파일 | 매우 느림 | 사용 불가 수준 |

### 대안 제시: 정규화된 관계 테이블

```sql
-- 대안 1: 다대다 관계 테이블 추가

-- 기능-파일 관계
CREATE TABLE feature_files (
    feature_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    relation_type TEXT,  -- 'primary', 'secondary', 'test'
    PRIMARY KEY (feature_id, file_id),
    FOREIGN KEY (feature_id) REFERENCES features(id),
    FOREIGN KEY (file_id) REFERENCES source_files(id)
);
CREATE INDEX idx_ff_feature ON feature_files(feature_id);
CREATE INDEX idx_ff_file ON feature_files(file_id);

-- API-테이블 관계
CREATE TABLE api_tables (
    api_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    operation TEXT,  -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    PRIMARY KEY (api_id, table_id),
    FOREIGN KEY (api_id) REFERENCES apis(id),
    FOREIGN KEY (table_id) REFERENCES db_tables(id)
);
CREATE INDEX idx_at_api ON api_tables(api_id);
CREATE INDEX idx_at_table ON api_tables(table_id);

-- 기능-테이블 관계
CREATE TABLE feature_tables (
    feature_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    PRIMARY KEY (feature_id, table_id),
    FOREIGN KEY (feature_id) REFERENCES features(id),
    FOREIGN KEY (table_id) REFERENCES db_tables(id)
);
```

### 개선된 쿼리 예시

```sql
-- 개선: 정규화된 관계 테이블 사용
SELECT DISTINCT a.path, t.table_name
FROM apis a
JOIN api_tables at ON a.id = at.api_id
JOIN db_tables t ON at.table_id = t.id
WHERE a.path = '/api/stock/list';

-- 장점:
-- 1. Index Seek 사용 가능
-- 2. O(log n) 복잡도
-- 3. 500개 파일에서도 <50ms
```

### 권장 스키마 변경 요약

| 현재 JSON 컬럼 | 변경 방안 | 이유 |
|---------------|----------|------|
| `features.related_files` | `feature_files` 테이블 | 다대다 관계 |
| `db_tables.related_features` | `feature_tables` 테이블 | 양방향 검색 |
| `source_files.methods` | `file_methods` 테이블 | 메서드별 검색 |
| `source_files.dependencies` | `file_dependencies` 테이블 | 의존성 그래프 |
| `db_tables.columns` | 유지 (JSON) | 내부 구조, 검색 불필요 |
| `apis.request_params` | 유지 (JSON) | 내부 구조, 검색 불필요 |

---

## 3. AI 워크플로우 실현 가능성

### 기술적 타당성: 중상

| 항목 | 평가 | 근거 |
|------|------|------|
| 무한루프 방지 | 충분 | 최대 2회 제한, 명확한 종료 조건 |
| AI 간 통신 | 실용적 | 파일 기반은 단순하고 디버깅 용이 |
| 비용 관리 | 현실적 | 캐싱 90% 절감 가능 |
| 품질 보장 | 불확실 | 자동 검증 메커니즘 부족 |

### 주요 리스크

#### 리스크 1: 컨텍스트 손실

```
문제:
파일 기반 통신 시 AI 간 컨텍스트가 손실됨

예시:
1. Gemini가 "CustomerService 수정 필요" 작성
2. Claude가 파일 읽지만 "왜 수정 필요한지" 이해 부족
3. 잘못된 방향으로 구현

해결책:
- 구조화된 전달 포맷 (JSON Schema)
- 컨텍스트 섹션 필수 포함
- 이전 대화 히스토리 요약 포함
```

```json
{
  "task": "CustomerService 수정",
  "context": {
    "why": "기존 메서드가 N+1 쿼리 발생",
    "current_issue": "getCustomerList()에서 100개 고객 조회 시 101번 DB 호출",
    "expected_result": "1번의 JOIN 쿼리로 해결"
  },
  "constraints": [
    "기존 API 시그니처 유지",
    "하위 호환성 보장"
  ],
  "previous_attempts": []
}
```

#### 리스크 2: 무한 개선 루프

```
문제:
AI가 "더 나은 방법이 있다"며 계속 수정 제안

시나리오:
1회차: Claude 구현 완료
2회차: Gemini "리팩토링 제안" -> Claude 수정
종료 후: 사용자가 보기에 불필요한 변경이 많음

해결책:
- 명확한 완료 기준 정의
- "기능 동작"이 최우선, "코드 품질"은 선택적
- 변경 규모 제한 (파일 수, 줄 수)
```

#### 리스크 3: 비용 예측 불확실성

```
현재 예측:
- AI-Assisted: $0.75/월
- AI-Full: $18/월

불확실성 요인:
1. 복잡한 프로젝트에서 토큰 사용량 증가
2. 캐시 미스율이 예상보다 높을 수 있음
3. 재시도로 인한 추가 호출

권장:
- 일일 비용 상한 설정 (Hard Limit)
- 실시간 비용 대시보드
- 예산 80% 도달 시 알림
```

### 구현 전략 제안

#### Phase 1: 반자동 모드 (권장 시작점)

```bash
# 현재 cross_check.sh 개선
./cross_check.sh "고객 검색 기능 추가"

# 워크플로우:
# 1. Gemini: 설계 작성 -> design.md
# 2. [사용자 확인] "이 설계로 진행?" (Y/n)
# 3. Claude: 코드 구현
# 4. Gemini: 리뷰 작성 -> review.md
# 5. [사용자 확인] "리뷰 반영?" (Y/n/skip)
# 6. Claude: 피드백 반영
# 7. 완료
```

#### Phase 2: 완전 자동 모드 (검증 후)

```javascript
// 자동 모드 조건
const autoModeConditions = {
    // 단순 작업만 자동 처리
    maxFilesChanged: 3,
    maxLinesChanged: 100,

    // 복잡한 작업은 사용자 확인
    requireApproval: [
        'database_schema_change',
        'api_breaking_change',
        'security_related'
    ]
};
```

---

## 4. DB 모니터링 시스템

### 현재 구현 평가

| 기능 | 완성도 | 평가 |
|------|--------|------|
| 느린 쿼리 감지 | 90% | 임계값 기반, 즉시 알림 |
| Lock 추적 | 85% | 누적 시간 추적, 해결 감지 |
| 다채널 알림 | 95% | Email, Webhook, 4개 플랫폼 |
| 특정 쿼리 감시 | 80% | MyBatis 대응, `${}` 제한적 |
| AI 분석 | 70% | 설계 완료, 통합 대기 |

### 한계점

#### 한계 1: 문자열 매칭의 근본적 제약

```javascript
// 현재 방식의 한계
const xmlQuery = "SELECT * FROM ${tableName} WHERE ID = #{id}";
const actualQuery = "SELECT * FROM STOCK_2024 WHERE ID = 12345";

// 단순 정규식으로는 매칭 실패
// - tableName이 동적으로 결정됨
// - 실행 시점에 어떤 테이블인지 알 수 없음
```

```
해결 방안 (복잡도순):
1. [쉬움] 테이블명 목록 사전 등록 -> 모든 가능한 값 패턴 생성
2. [중간] 쿼리 구조 해시 비교 -> 파라미터 제외 구조만 비교
3. [어려움] AI 유사도 분석 -> 의미론적 매칭 (설계됨)
```

#### 한계 2: Lock 추적 메모리 관리

```javascript
// 현재 코드
this.lockHistory = new Map();

// 문제:
// 1. 장기 실행 시 메모리 증가
// 2. 프로세스 재시작 시 히스토리 손실
// 3. 다중 인스턴스 시 히스토리 분리

// 개선:
class LockHistoryManager {
    constructor() {
        this.history = new Map();
        this.maxEntries = 10000;  // 상한 설정
        this.persistPath = './data/lock-history.json';
    }

    add(key, data) {
        // LRU 방식으로 오래된 항목 제거
        if (this.history.size >= this.maxEntries) {
            const oldest = this.history.keys().next().value;
            this.history.delete(oldest);
        }
        this.history.set(key, data);
    }

    // 주기적 영속화
    persist() {
        fs.writeFileSync(this.persistPath,
            JSON.stringify([...this.history.entries()]));
    }
}
```

#### 한계 3: 놓친 성능 지표

| 지표 | 현재 | 중요도 | 추가 방법 |
|------|------|--------|----------|
| 메모리 사용량 | 없음 | 높음 | `sys.dm_os_memory_clerks` |
| I/O 대기 시간 | 부분 | 중간 | `sys.dm_io_virtual_file_stats` |
| 쿼리 실행 계획 비용 | 부분 | 높음 | `sys.dm_exec_query_plan` |
| 인덱스 사용률 | 없음 | 높음 | `sys.dm_db_index_usage_stats` |
| 임시 테이블 사용 | 없음 | 중간 | `tempdb` 모니터링 |
| 버퍼 캐시 히트율 | 없음 | 중간 | `sys.dm_os_buffer_descriptors` |

### 개선 방안

```javascript
// 추가 모니터링 메트릭
async checkIndexUsage() {
    const result = await this.pool.request().query(`
        SELECT
            OBJECT_NAME(i.object_id) AS TableName,
            i.name AS IndexName,
            ius.user_seeks,
            ius.user_scans,
            ius.user_lookups,
            ius.user_updates
        FROM sys.dm_db_index_usage_stats ius
        JOIN sys.indexes i ON ius.object_id = i.object_id
            AND ius.index_id = i.index_id
        WHERE ius.database_id = DB_ID()
        AND ius.user_seeks = 0  -- 사용되지 않는 인덱스
        AND ius.user_scans = 0
        AND i.is_primary_key = 0
    `);

    // 미사용 인덱스 알림
    for (const row of result.recordset) {
        // ...
    }
}

async checkBufferCacheHit() {
    const result = await this.pool.request().query(`
        SELECT
            (CAST(SUM(CASE WHEN is_modified = 0
                THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*)) * 100
                AS BufferCacheHitRatio
        FROM sys.dm_os_buffer_descriptors
        WHERE database_id = DB_ID()
    `);

    const hitRatio = result.recordset[0].BufferCacheHitRatio;
    if (hitRatio < 90) {
        // 캐시 히트율 저하 알림
    }
}
```

---

## 5. 우선순위 조정 제안

### 현재 우선순위

1. 위키 자동 생성 (HIGH) - 4-6시간
2. 통합 테스트 툴 (HIGH) - 2-3시간
3. 리팩토링 점검 (MEDIUM) - 2-3시간

### 제안 우선순위

1. **[유지] 위키 자동 생성** - 4-6시간
   - 이유: 인계 문서화가 프로젝트 핵심 목적
   - 단, 스키마 개선 후 진행 (JSON -> 관계 테이블)

2. **[상향] 실제 프로젝트 테스트** - 2-3시간 (신규)
   - 이유: 설계만 있고 검증 없음
   - 내용: AutoCRM 프로젝트로 전체 워크플로우 테스트

3. **[유지] 통합 테스트 툴** - 2-3시간
   - 이유: 솔루션 vs 커스텀 비교가 SI 핵심

4. **[하향] 리팩토링 점검** - 2-3시간
   - 이유: SonarQube 연동은 외부 도구 의존, 우선순위 낮음

### 조정 이유

```
프로젝트 목적: SI 자동화 + 인계 문서화

현재 상태:
- 설계 문서는 풍부하나 실제 테스트 없음
- "작동할 것 같은" 설계에 머물러 있음

권장:
- 작은 규모로 전체 흐름 검증
- 문제 발견 후 설계 수정
- 이후 확장
```

---

## 6. 실전 적용 전략

### 배포 전략

#### Phase 1: 로컬 개발 환경 (현재)

```bash
# 필요 사항
- Node.js 18+
- SQLite3
- MSSQL/MySQL/Oracle 클라이언트

# 설치
npm install
cp .env.example .env
# .env 파일 수정
```

#### Phase 2: Docker 컨테이너화 (권장)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# 환경변수
ENV NODE_ENV=production

# 볼륨 마운트 포인트
VOLUME ["/app/data", "/app/logs"]

CMD ["node", "tools/performance-test/db-monitor/db-alert-monitor.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  db-monitor:
    build: .
    environment:
      - DB_SERVER=${DB_SERVER}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
```

#### Phase 3: 클라우드 배포 (미래)

| 옵션 | 장점 | 단점 | 비용 |
|------|------|------|------|
| AWS Lambda | 서버리스, 자동 스케일링 | 콜드 스타트, 15분 제한 | 낮음 |
| AWS ECS | 컨테이너, 안정적 | 관리 복잡 | 중간 |
| Azure Functions | 서버리스, MSSQL 친화적 | 콜드 스타트 | 낮음 |
| 자체 서버 | 완전 제어 | 관리 부담 | 고정 |

### 예상 문제점

#### 문제 1: 환경변수 관리

```
문제: 다수의 환경변수 필요
- DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME
- SMTP_HOST, SMTP_USER, SMTP_PASSWORD
- ANTHROPIC_API_KEY
- WEBHOOK_URL_SLACK, WEBHOOK_URL_TEAMS

해결:
1. 환경별 .env 파일 분리 (.env.dev, .env.prod)
2. 비밀 정보는 Vault/AWS Secrets Manager 사용
3. 설정 검증 스크립트 제공
```

```javascript
// scripts/validate-config.js
function validateConfig() {
    const required = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER'];
    const missing = required.filter(k => !process.env[k]);

    if (missing.length > 0) {
        console.error('Missing required env vars:', missing);
        process.exit(1);
    }
}
```

#### 문제 2: 로그 수집 및 분석

```
문제: 로그 파일이 로컬에만 저장됨

해결:
1. 중앙 로그 수집 (ELK Stack, CloudWatch)
2. 구조화된 로그 포맷 (JSON)
3. 로그 로테이션 설정
```

#### 문제 3: 장애 복구

```
문제: 모니터링 프로세스 자체가 죽으면?

해결:
1. Process Manager 사용 (PM2, systemd)
2. Health Check 엔드포인트
3. 자체 모니터링 알림 (watchdog)
```

```javascript
// health-check.js
const http = require('http');

http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage()
        }));
    }
}).listen(3000);
```

### 해결 방안 요약

| 문제 | 해결책 | 우선순위 |
|------|--------|----------|
| 환경변수 관리 | .env 분리 + Secrets Manager | 높음 |
| 로그 수집 | JSON 로그 + 중앙 수집 | 중간 |
| 장애 복구 | PM2 + Health Check | 높음 |
| 배포 자동화 | Docker + CI/CD | 중간 |

---

## 7. 추가 고려사항

### 보안

#### 현재 상태

| 항목 | 현재 | 평가 |
|------|------|------|
| DB 비밀번호 | 환경변수 | 적절 |
| API 키 | 환경변수 | 적절 |
| 로그 마스킹 | 부분적 | 개선 필요 |
| 입력 검증 | 없음 | 개선 필요 |

#### 개선 필요 사항

```javascript
// 1. 로그 마스킹 강화
function maskSensitive(text) {
    return text
        .replace(/password\s*=\s*'[^']+'/gi, "password='***'")
        .replace(/api[_-]?key\s*[:=]\s*['"]?[a-z0-9]+['"]?/gi, "api_key='***'")
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "***@***.***");
}

// 2. SQL Injection 방지 (동적 쿼리 시)
// 현재 코드에 직접 문자열 삽입 있음
const result = await this.pool.request().query(`
    ... WHERE DB_NAME(req.database_id) = '${dbConfig.database}'
`);

// 개선: 파라미터 바인딩 사용
const result = await this.pool.request()
    .input('dbName', sql.NVarChar, dbConfig.database)
    .query(`
        ... WHERE DB_NAME(req.database_id) = @dbName
    `);
```

### 비용

#### AI 모드 비용 분석

| 모드 | 월 예상 | 연 예상 | 캐싱 적용 후 |
|------|---------|---------|-------------|
| Standard | $0 | $0 | $0 |
| AI-Assisted | $1.8 | $21.6 | $0.18 (90% 절감) |
| AI-Full | $108 | $1,296 | $21.6 (80% 절감) |

#### 비용 폭증 시나리오

```
시나리오: 대규모 장애 발생
- 평소: 10건/시간 Critical 알림
- 장애 시: 1000건/시간 Critical 알림

AI-Assisted 모드:
- 평소 비용: $0.025/시간
- 장애 시 비용: $2.5/시간 (100배)

대응:
1. maxAiCallsPerHour: 10 (현재 설정됨)
2. 장애 시 AI 모드 자동 비활성화
3. 비용 알림 임계값 설정
```

### 확장성

#### 언어별 확장 (현재 Java 중심)

| 언어 | 현재 지원 | 확장 난이도 | 필요 작업 |
|------|----------|------------|----------|
| Java/Spring | 지원 | - | - |
| Python/Django | 미지원 | 중간 | 파서 추가 |
| Node.js/Express | 미지원 | 낮음 | 파서 추가 |
| Vue.js/React | 미지원 | 중간 | 프론트엔드 분석기 |

```javascript
// 확장 가능한 파서 구조
class ProjectAnalyzer {
    constructor() {
        this.parsers = {
            'java': new JavaParser(),
            'python': new PythonParser(),
            'javascript': new JavaScriptParser()
        };
    }

    analyze(projectPath) {
        const language = this.detectLanguage(projectPath);
        const parser = this.parsers[language];
        return parser.parse(projectPath);
    }
}

// 각 파서는 동일한 인터페이스
class JavaParser {
    parse(path) {
        return {
            features: [],
            apis: [],
            tables: [],
            files: []
        };
    }
}
```

---

## 핵심 권고사항 (Top 5)

### 1. [Critical] 위키 DB 스키마 정규화

```
문제: JSON 컬럼으로 인한 성능 및 검색 제약
해결: 다대다 관계 테이블 추가 (feature_files, api_tables 등)
효과: 500개 파일에서도 <50ms 응답, 정확한 관계 추적
```

### 2. [Critical] 실제 프로젝트 테스트 선행

```
문제: 설계만 있고 실제 검증 없음
해결: AutoCRM 프로젝트로 전체 워크플로우 1회 테스트
효과: 설계 오류 조기 발견, 현실적인 일정 산정
```

### 3. [Important] DB 모니터링 SQL Injection 방지

```
문제: 쿼리에 직접 문자열 삽입
해결: 파라미터 바인딩 사용
코드 위치: db-alert-monitor.js 170-194줄, 221-244줄
```

### 4. [Important] AI 워크플로우 구조화된 전달 포맷

```
문제: AI 간 컨텍스트 손실
해결: JSON Schema 기반 전달 포맷 정의
효과: 명확한 의도 전달, 재시도 감소
```

### 5. [Nice to Have] 통합 CLI 도구

```
문제: 각 도구 개별 실행으로 사용성 저하
해결: ai-tools 통합 CLI 개발
효과: 사용자 경험 개선, 온보딩 시간 단축
```

---

## 다음 단계

### 즉시 조치 필요

- [ ] `db-alert-monitor.js` SQL Injection 취약점 수정 (파라미터 바인딩)
- [ ] 위키 DB 스키마에 관계 테이블 추가 설계

### 단기 (1-2주)

- [ ] AutoCRM 프로젝트로 전체 워크플로우 테스트
- [ ] 위키 DB 구현 (개선된 스키마 적용)
- [ ] AI 워크플로우 전달 포맷 JSON Schema 정의

### 중장기 (1-2개월)

- [ ] Docker 컨테이너화 및 배포 자동화
- [ ] 통합 CLI 도구 개발
- [ ] 다른 언어(Python, Node.js) 파서 추가
- [ ] 중앙 로그 수집 시스템 구축

---

## 총평

프로젝트는 SI 자동화와 인계 문서화라는 명확한 목적을 가지고 있으며, 특히 **DB 모니터링 시스템**의 완성도가 높습니다. Lock 누적 추적, 다채널 알림, AI 모드 설계까지 실용적인 기능이 잘 구현되어 있습니다.

그러나 **실제 프로젝트 테스트 없이 설계만 진행**된 점이 가장 큰 약점입니다. 위키 DB의 JSON 컬럼 문제도 대규모 프로젝트에서 성능 저하를 일으킬 수 있습니다.

**권장 방향**:
1. 작은 규모로 전체 흐름을 먼저 검증
2. 발견된 문제를 반영하여 설계 수정
3. 이후 기능 확장

현재 60% 완료 상태에서 **스키마 개선 + 실제 테스트**를 먼저 진행하면, 나머지 40%를 더 안정적으로 완성할 수 있을 것입니다.

---

**검토 완료**: 2026-01-17
**검토 모델**: Claude Opus 4.5
**문서 버전**: v1.0
