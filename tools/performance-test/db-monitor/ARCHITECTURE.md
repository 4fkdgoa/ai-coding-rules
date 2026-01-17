# 아키텍처 - 외부 독립 실행 상세

**핵심 질문에 대한 답변**:
1. 타겟 프로젝트에 코드를 심어야 하나? → **아니오**
2. 화면과 연결 없이 분리 처리 가능한가? → **예**
3. AI 없이도 가능한가? → **예**
4. 외부에서 실행 가능한가? → **예**

---

## 1. 외부 독립 실행 아키텍처

### 기존 APM 도구 vs 이 도구

```
┌─────────────────────────────────────────────────────┐
│ 기존 APM (Application Performance Monitoring)       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [타겟 프로젝트] ← Agent 설치 (코드 수정 필요!)      │
│   ├─ Scouter Agent (Java)                           │
│   ├─ Pinpoint Agent                                 │
│   └─ New Relic Agent                                │
│                                                      │
│ 문제점:                                              │
│ - 타겟 프로젝트 재배포 필요                          │
│ - 성능 오버헤드                                      │
│ - 프로젝트와 결합                                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ DB 알림 모니터링 (이 도구)                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [타겟 프로젝트] ← 코드 수정 불필요! 완전 분리       │
│        ↓                                             │
│    [MSSQL DB] ← DMV 쿼리로 감시                      │
│        ↑                                             │
│ [모니터링 도구] (별도 서버 또는 로컬)                │
│                                                      │
│ 장점:                                                │
│ - 타겟 프로젝트 그대로 유지                          │
│ - 성능 영향 거의 없음                                │
│ - 프로젝트와 완전 분리                               │
└─────────────────────────────────────────────────────┘
```

### 상세 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    실행 환경                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ 옵션 1: 별도 서버 (권장) ─────────────┐         │
│  │  - 모니터링 전용 서버                   │         │
│  │  - Ubuntu/CentOS/Windows Server         │         │
│  │  - 24/7 운영                            │         │
│  └──────────────────────────────────────────┘         │
│                                                      │
│  ┌─ 옵션 2: 로컬 PC ───────────────────────┐         │
│  │  - 개발자 PC에서 테스트 시              │         │
│  │  - 일시적 모니터링                      │         │
│  └──────────────────────────────────────────┘         │
│                                                      │
│  ┌─ 옵션 3: Docker 컨테이너 ───────────────┐         │
│  │  - Dockerfile로 이미지 생성             │         │
│  │  - K8s로 배포                           │         │
│  └──────────────────────────────────────────┘         │
│                                                      │
└─────────────────────────────────────────────────────┘
                        ↓
         ┌──────────────────────────┐
         │  db-alert-monitor.js     │
         │  (Node.js 프로세스)       │
         └──────────┬───────────────┘
                    ↓ TCP 1433 포트
         ┌──────────────────────────┐
         │      MSSQL Server        │
         │    211.217.11.5:1433     │
         │                          │
         │  DMV (Dynamic Mgmt Views)│
         │  ├─ sys.dm_exec_requests │
         │  ├─ sys.dm_exec_query    │
         │  ├─ sys.dm_tran_locks    │
         │  └─ sys.dm_db_index      │
         └──────────┬───────────────┘
                    ↑
         ┌──────────┴───────────────┐
         │   타겟 애플리케이션       │
         │   (SDMS/AutoCRM/BPS)     │
         │                          │
         │  ← 코드 수정 불필요!      │
         └──────────────────────────┘
```

---

## 2. DMV란? (Dynamic Management Views)

MSSQL이 **자체적으로 제공**하는 실시간 성능 정보:

```sql
-- 현재 실행 중인 모든 쿼리 조회
SELECT * FROM sys.dm_exec_requests

-- 쿼리 통계 조회
SELECT * FROM sys.dm_exec_query_stats

-- 락 정보 조회
SELECT * FROM sys.dm_tran_locks

-- 인덱스 사용 통계
SELECT * FROM sys.dm_db_index_usage_stats
```

**타겟 프로젝트 코드를 전혀 건드리지 않고도**,
DB에서 직접 성능 정보를 가져올 수 있습니다.

---

## 3. 네트워크 구성

### Case 1: 같은 네트워크

```
┌──────────────────────────────────────┐
│      회사 내부 네트워크               │
│                                      │
│  [모니터링 서버]    [MSSQL DB]       │
│   192.168.1.10 ←→ 192.168.1.20       │
│                                      │
│  방화벽 설정 불필요                   │
└──────────────────────────────────────┘
```

### Case 2: 외부 네트워크 (VPN)

```
┌──────────────┐       VPN       ┌──────────────┐
│ 외부 서버     │ ←──────────────→ │ 회사 MSSQL   │
│ (모니터링)    │   IPsec/OpenVPN  │  DB 서버     │
└──────────────┘                  └──────────────┘
```

### Case 3: 로컬 PC → 회사 DB

```
┌──────────────┐                  ┌──────────────┐
│ 개발자 PC     │                  │ 회사 MSSQL   │
│ (테스트)      │ ←──────────────→ │  DB 서버     │
│               │  방화벽 1433 포트 │              │
└──────────────┘     오픈 필요      └──────────────┘
```

**필요한 것**:
- DB 서버 IP/포트 (1433)
- DB 계정 (VIEW SERVER STATE 권한)
- 방화벽 1433 포트 오픈

**불필요한 것**:
- 타겟 프로젝트 접근
- 타겟 프로젝트 소스 코드
- 타겟 프로젝트 재배포

---

## 4. 타겟 프로젝트와의 관계

### 기존 방식 (Agent 설치)

```java
// 타겟 프로젝트 코드 수정 필요!

// Application.java
public class Application {
    public static void main(String[] args) {
        // Agent 초기화 (코드 추가!)
        ScouterAgent.init();

        SpringApplication.run(Application.class, args);
    }
}

// pom.xml (의존성 추가!)
<dependency>
    <groupId>io.github.scouter-project</groupId>
    <artifactId>scouter-agent-java</artifactId>
</dependency>

// 재배포 필요!
mvn clean package
```

### 이 도구 (코드 수정 없음)

```java
// 타겟 프로젝트 코드 그대로!

// Application.java
public class Application {
    public static void main(String[] args) {
        // 아무것도 추가 안함!
        SpringApplication.run(Application.class, args);
    }
}

// pom.xml 수정 없음!
// 재배포 불필요!
```

**타겟 프로젝트는 모르고 지나갑니다.**

---

## 5. 백그라운드 실행 방법

### 방법 1: nohup (리눅스/Mac)

```bash
# 백그라운드 실행
nohup npm run monitor > monitor.log 2>&1 &

# PID 저장
echo $! > monitor.pid

# 확인
ps aux | grep db-alert-monitor

# 중단
kill $(cat monitor.pid)
```

### 방법 2: systemd 서비스 (리눅스 권장)

`/etc/systemd/system/db-monitor.service`:

```ini
[Unit]
Description=DB Alert Monitoring
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/opt/ai-coding-rules/tools/performance-test
ExecStart=/usr/bin/npm run monitor
Restart=always
RestartSec=10

Environment=DB_USER=sa
Environment=DB_PASSWORD=yourpass
Environment=DB_SERVER=211.217.11.5
Environment=DB_NAME=AutoCRM_Samchully

[Install]
WantedBy=multi-user.target
```

실행:
```bash
sudo systemctl enable db-monitor
sudo systemctl start db-monitor
sudo systemctl status db-monitor

# 로그 확인
journalctl -u db-monitor -f
```

### 방법 3: screen/tmux (간단)

```bash
# screen 세션 생성
screen -S db-monitor

# 모니터링 시작
npm run monitor

# Ctrl+A, D로 세션 분리 (백그라운드로)

# 재접속
screen -r db-monitor
```

### 방법 4: PM2 (Node.js 권장)

```bash
# PM2 설치
npm install -g pm2

# 백그라운드 실행
pm2 start db-monitor/db-alert-monitor.js --name db-monitor

# 자동 시작 등록
pm2 startup
pm2 save

# 관리
pm2 list
pm2 logs db-monitor
pm2 restart db-monitor
pm2 stop db-monitor
```

### 방법 5: Docker

`Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY tools/performance-test /app

RUN npm install

CMD ["npm", "run", "monitor"]
```

실행:
```bash
docker build -t db-monitor .
docker run -d \
  --name db-monitor \
  -e DB_USER=sa \
  -e DB_PASSWORD=pwd \
  -e DB_SERVER=211.217.11.5 \
  -e DB_NAME=AutoCRM_Samchully \
  -v $(pwd)/logs:/app/db-monitor/logs \
  db-monitor

# 로그 확인
docker logs -f db-monitor
```

---

## 6. 권한 요구사항

### DB 계정 권한

모니터링에 필요한 최소 권한:

```sql
-- 1. DB 접근 권한
USE AutoCRM_Samchully;
CREATE USER monitor_user FOR LOGIN monitor_login;

-- 2. DMV 조회 권한 (필수!)
GRANT VIEW SERVER STATE TO monitor_login;

-- 3. 특정 DB에서 쿼리 텍스트 조회 권한
GRANT VIEW DATABASE STATE TO monitor_user;

-- 4. 선택적: 실행 계획 조회
GRANT SHOWPLAN TO monitor_user;
```

**권한이 없으면**:
```
Error: SELECT permission denied on sys.dm_exec_requests
```

**DBA에게 요청**:
"DMV 조회를 위해 `VIEW SERVER STATE` 권한이 필요합니다."

---

## 7. 성능 영향

### 모니터링 도구의 오버헤드

```
┌──────────────────────────────────────────────────┐
│ 리소스 사용량 (10초마다 체크)                     │
├──────────────────────────────────────────────────┤
│ CPU 사용량:      < 1%                            │
│ 메모리 사용량:   ~50MB                           │
│ 네트워크:        ~10KB/s (10초마다)              │
│ DB 부하:         매우 낮음 (DMV는 빠름)          │
└──────────────────────────────────────────────────┘
```

**타겟 프로젝트 영향**: 거의 없음

DMV 쿼리는:
- 메모리 내 정보만 조회 (디스크 I/O 없음)
- 인덱스 접근 (Table Scan 없음)
- 실행 시간 < 10ms

### 비교: Agent 방식

```
┌──────────────────────────────────────────────────┐
│ APM Agent (Scouter/Pinpoint 등)                  │
├──────────────────────────────────────────────────┤
│ CPU 오버헤드:    5-10% (메서드 인터셉트)         │
│ 메모리 오버헤드: 100-200MB (트레이스 버퍼)       │
│ 네트워크:        상시 연결 (콜렉터로 전송)       │
└──────────────────────────────────────────────────┘
```

**이 도구가 훨씬 가볍습니다.**

---

## 8. 배포 시나리오

### 시나리오 1: 개발 환경 테스트

```bash
# 1. 개발자 PC에서 실행
cd ai-coding-rules/tools/performance-test
npm install
npm run monitor

# 2. 개발 DB 연결 (localhost 또는 개발 서버)
export DB_SERVER="localhost"
export DB_NAME="AutoCRM_Dev"

# 3. 테스트 중 알림 확인
tail -f db-monitor/logs/db-alert-*.json
```

**용도**: 개발 중 성능 문제 조기 발견

### 시나리오 2: 스테이징 환경 배포

```bash
# 1. 스테이징 서버에 배포
ssh staging-server
cd /opt/monitoring
git clone https://github.com/your/ai-coding-rules
cd ai-coding-rules/tools/performance-test
npm install

# 2. systemd 서비스 등록
sudo cp db-monitor/systemd/db-monitor.service /etc/systemd/system/
sudo systemctl enable db-monitor
sudo systemctl start db-monitor

# 3. 이메일 알림 확인 (운영팀)
```

**용도**: 배포 전 성능 검증

### 시나리오 3: 운영 환경 배포

```bash
# 1. Docker로 배포 (권장)
docker-compose up -d db-monitor

# 2. K8s로 배포
kubectl apply -f db-monitor-deployment.yaml

# 3. 24/7 모니터링
kubectl logs -f deployment/db-monitor
```

**용도**: 24시간 실시간 모니터링

---

## 9. 제한사항 및 향후 개선

### 현재 제한사항

1. **특정 쿼리만 지정 모니터링 불가**
   ```
   현재: 모든 느린 쿼리 감지
   원하는 것: StockManagerImpl.xml의 listStock만 감시
   ```

2. **Lock 상세 정보 부족**
   ```
   현재: Blocking(차단) 세션만 감지
   원하는 것: Lock 타입, 테이블, 행 범위
   ```

3. **XML 쿼리 ID 매핑 없음**
   ```
   현재: 쿼리 텍스트만
   원하는 것: "StockManagerImpl.listStock" 표시
   ```

### 향후 개선 계획

1. **특정 쿼리 필터링**
   ```json
   {
     "monitoring": {
       "watchQueries": [
         {
           "name": "StockManagerImpl.listStock",
           "pattern": "WITH SSI AS (SELECT.*FROM STOCK_ISSUE",
           "threshold": 1000
         }
       ]
     }
   }
   ```

2. **Lock 상세 모니터링**
   ```
   감지 항목:
   - Lock 타입 (S, X, U, IS, IX, SIX)
   - 테이블 및 인덱스
   - 행 범위
   - 대기 시간
   ```

3. **iBatis XML 파싱**
   ```javascript
   // XML에서 쿼리 ID 추출
   const query = parseIBatisXML('StockManagerImpl.xml', 'listStock');
   monitorQuery('StockManagerImpl.listStock', query);
   ```

---

## 10. FAQ

**Q: 타겟 프로젝트 재배포가 필요한가?**
A: 아니오. 코드 수정이 전혀 없으므로 재배포 불필요.

**Q: 타겟 프로젝트 성능에 영향을 주나?**
A: 거의 없음. DMV 쿼리는 매우 가볍습니다 (<10ms).

**Q: DB 계정 권한이 필요한가?**
A: 예. `VIEW SERVER STATE` 권한 필요 (DBA에게 요청).

**Q: 여러 DB를 동시에 모니터링할 수 있나?**
A: 가능. 여러 인스턴스를 실행하거나 설정에서 DB 배열 지정.

**Q: 클라우드 DB (Azure SQL, AWS RDS)도 되나?**
A: Azure SQL: 예 (DMV 지원)
   AWS RDS SQL Server: 예
   MySQL/PostgreSQL: 아니오 (MSSQL 전용)

**Q: AI가 필요한가?**
A: 아니오. 단순 임계값 기반 알림.

---

**다음 문서**: [CONFIG.md](CONFIG.md) - 설정 파일 완벽 가이드
