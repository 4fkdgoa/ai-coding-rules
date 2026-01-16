# Webhook 알림 가이드 (Google Chat, Slack, Discord, Teams)

**핵심 질문**: "구글챗이나 그런거도 가능한가?"
**답변**: 예! Google Chat, Slack, Discord, MS Teams 모두 지원합니다!

---

## 📌 지원하는 메신저

| 메신저 | 타입 | 설정 난이도 | 특징 |
|--------|------|-------------|------|
| **Google Chat** | `google-chat` | ⭐ 쉬움 | 카드 형식, 깔끔한 UI |
| **Slack** | `slack` | ⭐ 쉬움 | Attachment 형식 |
| **Discord** | `discord` | ⭐ 쉬움 | Embed 형식, 컬러 |
| **MS Teams** | `teams` | ⭐⭐ 보통 | MessageCard 형식 |
| **범용** | `generic` | ⭐ 쉬움 | JSON 그대로 |

---

## 🚀 빠른 시작

### 1. Google Chat 설정 (권장)

#### 1-1. Google Chat Webhook 생성

1. Google Chat 접속
2. 채팅방 생성 또는 기존 방 선택
3. 방 이름 클릭 → **앱 및 통합 관리**
4. **Webhook 추가**
5. 이름 입력: `DB 알림`
6. **저장** → Webhook URL 복사

URL 형식:
```
https://chat.googleapis.com/v1/spaces/AAAAxxxx/messages?key=AIzaxxxx&token=xxxx
```

#### 1-2. 설정 파일 수정

`config/alert-config.json`:

```json
{
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "name": "Google Chat - Dev Team",
        "type": "google-chat",
        "url": "https://chat.googleapis.com/v1/spaces/YOUR_SPACE_ID/messages?key=YOUR_KEY&token=YOUR_TOKEN",
        "enabled": true
      }
    ]
  }
}
```

#### 1-3. 테스트

```bash
cd tools/performance-test
npm run monitor:test-webhook
```

Google Chat에 테스트 메시지가 도착하면 성공!

---

### 2. Slack 설정

#### 2-1. Slack Incoming Webhook 생성

1. Slack 워크스페이스 접속
2. https://api.slack.com/apps 접속
3. **Create New App** → **From scratch**
4. App Name: `DB Monitor`
5. **Incoming Webhooks** 활성화
6. **Add New Webhook to Workspace**
7. 채널 선택 (예: `#db-alerts`)
8. Webhook URL 복사

URL 형식:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

#### 2-2. 설정

```json
{
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "name": "Slack - DBA Channel",
        "type": "slack",
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "enabled": true
      }
    ]
  }
}
```

---

### 3. Discord 설정

#### 3-1. Discord Webhook 생성

1. Discord 서버 접속
2. 채널 설정 (톱니바퀴 아이콘)
3. **통합** → **웹후크**
4. **새 웹후크** 생성
5. 이름: `DB 알림`
6. **웹후크 URL 복사**

URL 형식:
```
https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz
```

#### 3-2. 설정

```json
{
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "name": "Discord - Alerts Channel",
        "type": "discord",
        "url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN",
        "enabled": true
      }
    ]
  }
}
```

---

### 4. MS Teams 설정

#### 4-1. Teams Incoming Webhook 생성

1. Teams 팀 접속
2. 채널 클릭 → **···** → **커넥터**
3. **Incoming Webhook** 검색 → **추가**
4. 이름: `DB 알림`
5. **만들기** → Webhook URL 복사

URL 형식:
```
https://outlook.office.com/webhook/xxx@xxx/IncomingWebhook/xxx/xxx
```

#### 4-2. 설정

```json
{
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "name": "MS Teams - Operations",
        "type": "teams",
        "url": "https://outlook.office.com/webhook/YOUR_WEBHOOK_URL",
        "enabled": true
      }
    ]
  }
}
```

---

## 📊 메시지 형식 예시

### Google Chat

```
┌─────────────────────────────────────────┐
│ 🚨 DB Alert - CRITICAL                  │
│ 느린 쿼리 감지: 3,456ms                  │
├─────────────────────────────────────────┤
│ 발생 시각: 2026-01-16 16:30:15          │
│ 알림 유형: SLOW QUERY                    │
│ 세션 ID: 52                              │
│ 데이터베이스: AutoCRM_Samchully          │
├─────────────────────────────────────────┤
│ 성능 지표                                │
│ 실행 시간: 3,456 ms                      │
│ CPU 시간: 2,123 ms                       │
│ 논리적 읽기: 67,890 회                   │
├─────────────────────────────────────────┤
│ 쿼리                                     │
│ WITH SSI AS (SELECT...                   │
└─────────────────────────────────────────┘
```

### Slack

```
🚨 DB Alert - CRITICAL

느린 쿼리 감지: 3,456ms

발생 시각: 2026-01-16 16:30:15
알림 유형: SLOW QUERY
세션 ID: 52
데이터베이스: AutoCRM_Samchully

실행 시간: 3,456 ms
CPU 시간: 2,123 ms

DB Monitor | 2026-01-16 16:30:15
```

### Discord

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 DB Alert - CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

느린 쿼리 감지: 3,456ms

발생 시각: 2026-01-16 16:30:15
알림 유형: SLOW QUERY
세션 ID: 52

실행 시간: 3,456 ms
CPU 시간: 2,123 ms

쿼리:
```sql
WITH SSI AS (SELECT...
```

DB Monitor v1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ⚙️ 고급 설정

### 1. 여러 메신저 동시 사용

```json
{
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "name": "Google Chat - 개발팀",
        "type": "google-chat",
        "url": "...",
        "enabled": true
      },
      {
        "name": "Slack - DBA팀",
        "type": "slack",
        "url": "...",
        "enabled": true
      },
      {
        "name": "Discord - 운영팀",
        "type": "discord",
        "url": "...",
        "enabled": true
      }
    ]
  }
}
```

→ 3개 메신저 모두에 동시 발송!

### 2. 레벨별 다른 메신저

```json
{
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "name": "Google Chat - Critical Only",
        "type": "google-chat",
        "url": "...",
        "sendOnLevels": ["critical"],
        "enabled": true
      },
      {
        "name": "Slack - All Alerts",
        "type": "slack",
        "url": "...",
        "sendOnLevels": ["critical", "warning", "info"],
        "enabled": true
      }
    ]
  }
}
```

### 3. Throttling 개별 설정

```json
{
  "webhook": {
    "webhooks": [
      {
        "name": "Google Chat",
        "type": "google-chat",
        "url": "...",
        "throttleMinutes": 5,
        "enabled": true
      },
      {
        "name": "Slack",
        "type": "slack",
        "url": "...",
        "throttleMinutes": 30,
        "enabled": true
      }
    ]
  }
}
```

---

## 🔧 프로그래밍 방식 사용

### JavaScript/Node.js

```javascript
const WebhookSender = require('./utils/webhook-sender');

const config = {
    enabled: true,
    webhooks: [
        {
            type: 'google-chat',
            url: process.env.GOOGLE_CHAT_WEBHOOK,
            enabled: true
        }
    ]
};

const webhookSender = new WebhookSender(config);

// 알림 발송
const alert = {
    timestamp: new Date().toISOString(),
    level: 'critical',
    type: 'slow_query',
    message: '느린 쿼리 감지: 3,456ms',
    sessionId: 52,
    database: 'AutoCRM_Samchully',
    executionTimeMs: 3456,
    cpuTimeMs: 2123,
    logicalReads: 67890,
    queryText: 'SELECT * FROM STOCK...'
};

await webhookSender.sendAlert(alert);
```

### 테스트 발송

```javascript
// 테스트 메시지 발송
await webhookSender.sendTestMessage();
```

---

## 🐛 문제 해결

### 1. Webhook 발송 실패

**증상**:
```
❌ Webhook 발송 실패: google-chat HTTP 400: Bad Request
```

**원인**: URL이 잘못되었거나 만료됨

**해결**:
1. Webhook URL 재생성
2. URL 복사 시 전체 URL 복사 확인
3. 테스트:
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text": "테스트"}' \
  YOUR_WEBHOOK_URL
```

### 2. Google Chat 카드 렌더링 안됨

**증상**:
Google Chat에 메시지는 오지만 카드 형식이 아님

**원인**: 페이로드 형식 오류

**해결**:
Google Chat은 `cards` 형식만 지원:
```json
{
  "cards": [{
    "header": {...},
    "sections": [...]
  }]
}
```

### 3. Slack Attachment 색상 안나옴

**증상**:
Slack 메시지에 색상이 표시되지 않음

**원인**: `color` 필드 형식 오류

**해결**:
색상은 HEX 코드 (예: `#dc3545`)

### 4. Discord Embed 제한 초과

**증상**:
```
HTTP 400: Embed length must be less than 6000
```

**원인**: Embed 내용이 너무 김

**해결**:
쿼리 텍스트를 500자로 제한:
```javascript
queryText: this.truncate(alert.queryText, 500)
```

---

## 📚 Webhook URL 예시

### Google Chat

**공식 문서**: https://developers.google.com/chat/how-tos/webhooks

**URL 형식**:
```
https://chat.googleapis.com/v1/spaces/{space}/messages?key={key}&token={token}
```

**테스트**:
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello World"}' \
  'https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=YOUR_KEY&token=YOUR_TOKEN'
```

### Slack

**공식 문서**: https://api.slack.com/messaging/webhooks

**URL 형식**:
```
https://hooks.slack.com/services/T{team_id}/B{bot_id}/{token}
```

**테스트**:
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello World"}' \
  https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Discord

**공식 문서**: https://discord.com/developers/docs/resources/webhook

**URL 형식**:
```
https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
```

**테스트**:
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"content": "Hello World"}' \
  https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### MS Teams

**공식 문서**: https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/

**URL 형식**:
```
https://outlook.office.com/webhook/{webhook_id}/IncomingWebhook/{channel_id}/{connector_id}
```

**테스트**:
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello World"}' \
  https://outlook.office.com/webhook/YOUR_WEBHOOK_URL
```

---

## 🎯 실전 시나리오

### 시나리오 1: 개발팀 + DBA팀 분리 알림

**요구사항**:
- 개발팀: Google Chat에 모든 알림
- DBA팀: Slack에 Critical만

**설정**:
```json
{
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "name": "Google Chat - 개발팀",
        "type": "google-chat",
        "url": "...",
        "sendOnLevels": ["critical", "warning", "info"],
        "enabled": true
      },
      {
        "name": "Slack - DBA팀",
        "type": "slack",
        "url": "...",
        "sendOnLevels": ["critical"],
        "enabled": true
      }
    ]
  }
}
```

### 시나리오 2: 이메일 + Webhook 동시 사용

**요구사항**:
- Critical: 이메일 + Google Chat
- Warning: Google Chat만

**설정**:
```json
{
  "email": {
    "enabled": true,
    "sendOnLevels": ["critical"]
  },
  "webhook": {
    "enabled": true,
    "webhooks": [
      {
        "type": "google-chat",
        "url": "...",
        "sendOnLevels": ["critical", "warning"]
      }
    ]
  }
}
```

### 시나리오 3: 환경별 다른 Webhook

**개발 환경** (`config/alert-config-dev.json`):
```json
{
  "webhook": {
    "webhooks": [
      {
        "name": "Discord - Dev Channel",
        "type": "discord",
        "url": "..."
      }
    ]
  }
}
```

**운영 환경** (`config/alert-config-prod.json`):
```json
{
  "webhook": {
    "webhooks": [
      {
        "name": "Google Chat - Ops Team",
        "type": "google-chat",
        "url": "..."
      },
      {
        "name": "Slack - DBA Team",
        "type": "slack",
        "url": "..."
      }
    ]
  }
}
```

---

## 💡 팁

### 1. 보안: Webhook URL 환경변수 사용

```bash
export GOOGLE_CHAT_WEBHOOK="https://chat.googleapis.com/..."
export SLACK_WEBHOOK="https://hooks.slack.com/..."
```

```json
{
  "webhook": {
    "webhooks": [
      {
        "type": "google-chat",
        "url": "${GOOGLE_CHAT_WEBHOOK}"
      }
    ]
  }
}
```

### 2. 알림 빈도 조절

```json
{
  "webhook": {
    "throttleMinutes": 30
  }
}
```

### 3. 테스트 모드

```bash
# 테스트 알림만 발송 (실제 모니터링 안함)
npm run monitor:test-webhook
```

---

**다음 문서**: [README.md](README.md) - 메인 가이드로 돌아가기
