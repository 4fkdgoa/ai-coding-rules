# 아키텍처

> AI가 자동 생성한 문서입니다. 생성일: {{DATE}}

## 개요

{{PROJECT_NAME}}의 시스템 아키텍처를 설명합니다.

---

## 시스템 구조

### 전체 아키텍처

```mermaid
graph TD
    subgraph "Presentation Layer"
        A[Client/Browser]
        B[Mobile App]
    end

    subgraph "Application Layer"
        C[API Gateway]
        D[Controller]
        E[Service]
    end

    subgraph "Data Layer"
        F[Repository]
        G[(Database)]
        H[Cache]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    E --> H
```

### 레이어별 설명

| 레이어 | 역할 | 주요 컴포넌트 |
|--------|------|---------------|
| Presentation | 사용자 인터페이스 | Web Client, Mobile App |
| Application | 비즈니스 로직 처리 | Controller, Service |
| Data | 데이터 접근 및 저장 | Repository, Database |

---

## 모듈 구조

```mermaid
graph LR
    subgraph "Core Modules"
        A[Common]
        B[Security]
        C[Config]
    end

    subgraph "Domain Modules"
        D[User]
        E[Product]
        F[Order]
    end

    subgraph "Infrastructure"
        G[Database]
        H[Cache]
        I[Message Queue]
    end

    D --> A
    E --> A
    F --> A
    D --> B
    E --> B
    F --> B
    D --> G
    E --> G
    F --> G
```

### 모듈 설명

- **Common**: 공통 유틸리티, 상수, 예외 처리
- **Security**: 인증/인가, 암호화
- **Config**: 설정 관리
- **Domain Modules**: 비즈니스 도메인별 모듈

---

## 엔티티 관계도 (ERD)

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        bigint id PK
        string email
        string name
        datetime created_at
    }

    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        bigint id PK
        bigint user_id FK
        string status
        decimal total_amount
        datetime created_at
    }

    PRODUCT ||--o{ ORDER_ITEM : "included in"
    PRODUCT {
        bigint id PK
        string name
        decimal price
        int stock
    }

    ORDER_ITEM {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        int quantity
        decimal unit_price
    }
```

---

## 시퀀스 다이어그램

### 주문 처리 플로우

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Gateway
    participant OS as OrderService
    participant PS as ProductService
    participant DB as Database

    C->>API: POST /orders
    API->>OS: createOrder(orderDto)
    OS->>PS: checkStock(productIds)
    PS->>DB: SELECT stock FROM products
    DB-->>PS: stock data
    PS-->>OS: stock available

    OS->>DB: INSERT INTO orders
    OS->>DB: INSERT INTO order_items
    OS->>PS: decreaseStock(items)
    PS->>DB: UPDATE products SET stock

    DB-->>OS: success
    OS-->>API: OrderResponse
    API-->>C: 201 Created
```

---

## 배포 구조

```mermaid
graph TB
    subgraph "Production Environment"
        subgraph "Load Balancer"
            LB[Nginx/ALB]
        end

        subgraph "Application Servers"
            APP1[App Server 1]
            APP2[App Server 2]
        end

        subgraph "Data Stores"
            DB[(Primary DB)]
            DB_R[(Replica DB)]
            CACHE[Redis Cache]
        end
    end

    LB --> APP1
    LB --> APP2
    APP1 --> DB
    APP2 --> DB
    DB --> DB_R
    APP1 --> CACHE
    APP2 --> CACHE
```

---

## 기술 스택

### Backend

| 구분 | 기술 | 버전 |
|------|------|------|
| Language | {{LANGUAGE}} | {{VERSION}} |
| Framework | {{FRAMEWORK}} | {{FRAMEWORK_VERSION}} |
| Database | {{DATABASE}} | {{DB_VERSION}} |
| Cache | Redis | - |

### Frontend

| 구분 | 기술 | 버전 |
|------|------|------|
| Framework | {{FRONTEND_FRAMEWORK}} | - |
| State Management | {{STATE_MANAGEMENT}} | - |
| Build Tool | {{BUILD_TOOL}} | - |

---

## 의존성 관계

### 프로젝트 의존성

```mermaid
graph TD
    A[현재 프로젝트]
    B[Core Library]
    C[Common Utils]
    D[External API Client]

    A --> B
    A --> C
    B --> C
    A --> D
```

### 외부 서비스 연동

- **인증**: OAuth 2.0 / JWT
- **결제**: PG사 연동
- **알림**: SMS/Email/Push 서비스
- **스토리지**: S3 / Cloud Storage

---

## 보안 아키텍처

```mermaid
graph LR
    subgraph "Security Layers"
        A[WAF] --> B[API Gateway]
        B --> C[Authentication]
        C --> D[Authorization]
        D --> E[Application]
    end

    subgraph "Security Components"
        F[JWT Token]
        G[Role-Based Access]
        H[Data Encryption]
    end

    C --- F
    D --- G
    E --- H
```

---

## 참고 문서

- [API 문서](./api/index.md)
- [기능 목록](./features/index.md)
- [개발 가이드](./development-guide.md)

---

*이 문서는 AI에 의해 자동 생성되었습니다. 정확성을 위해 검토가 필요합니다.*
