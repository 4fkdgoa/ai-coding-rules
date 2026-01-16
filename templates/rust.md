# Rust 프로젝트 규칙

## 기술 스택
```yaml
language: Rust 1.70+
framework: Actix-web / Axum / Rocket (웹), Tokio (비동기)
build: cargo
test: cargo test
package: crates.io
```

## 프로젝트 구조

### 웹 애플리케이션
```
project/
├── src/
│   ├── main.rs           # 진입점
│   ├── lib.rs            # 라이브러리 루트 (선택)
│   ├── handlers/         # HTTP 핸들러
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── services/         # 비즈니스 로직
│   │   ├── mod.rs
│   │   └── user_service.rs
│   ├── repositories/     # 데이터 접근
│   │   ├── mod.rs
│   │   └── user_repository.rs
│   ├── models/           # 도메인 모델
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── config.rs         # 설정 관리
│   └── error.rs          # 에러 타입
├── migrations/           # DB 마이그레이션 (sqlx, diesel)
├── tests/                # 통합 테스트
├── Cargo.toml
└── Cargo.lock
```

### 라이브러리
```
lib-project/
├── src/
│   ├── lib.rs
│   ├── core.rs
│   └── utils.rs
├── tests/
├── examples/
├── benches/              # 벤치마크
└── Cargo.toml
```

## 네이밍 컨벤션

### 파일명/모듈명
- **snake_case**: `user_service.rs`, `http_client.rs`
- **크레이트명**: snake_case 또는 kebab-case

### 변수/함수명
| 유형 | 컨벤션 | 예시 |
|------|--------|------|
| 함수 | `snake_case` | `get_user()`, `create_user()` |
| 변수 | `snake_case` | `user_id`, `email_address` |
| 타입/구조체 | `PascalCase` | `User`, `UserService` |
| 트레이트 | `PascalCase` | `UserRepository`, `Serialize` |
| 상수 | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT`, `DEFAULT_PORT` |
| 매크로 | `snake_case!` | `println!`, `vec!` |
| 라이프타임 | `'lowercase` | `'a`, `'static` |

### 타입 약어
```rust
// 관용적 약어 사용
fn create_html() {}      // ❌ 나쁜 예
fn create_HTML() {}      // ❌ 나쁜 예
fn create_html() {}      // ✅ 좋은 예

struct HTTPServer {}     // ❌ 나쁜 예
struct HttpServer {}     // ✅ 좋은 예
```

## 코드 스타일

### Handler (Actix-web 예시)
```rust
use actix_web::{web, HttpResponse, Result};
use crate::services::UserService;
use crate::models::{User, CreateUserRequest};

pub struct UserHandler {
    user_service: web::Data<UserService>,
}

impl UserHandler {
    pub fn new(user_service: web::Data<UserService>) -> Self {
        Self { user_service }
    }
}

/// 사용자 목록 조회
pub async fn list_users(
    service: web::Data<UserService>,
) -> Result<HttpResponse> {
    let users = service.list_users().await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    Ok(HttpResponse::Ok().json(users))
}

/// 사용자 조회
pub async fn get_user(
    service: web::Data<UserService>,
    user_id: web::Path<i64>,
) -> Result<HttpResponse> {
    let user = service.get_user(*user_id).await
        .map_err(|e| actix_web::error::ErrorNotFound(e))?;

    Ok(HttpResponse::Ok().json(user))
}

/// 사용자 생성
pub async fn create_user(
    service: web::Data<UserService>,
    req: web::Json<CreateUserRequest>,
) -> Result<HttpResponse> {
    let user = service.create_user(req.into_inner()).await
        .map_err(|e| actix_web::error::ErrorBadRequest(e))?;

    Ok(HttpResponse::Created().json(user))
}
```

### Service
```rust
use crate::models::{User, CreateUserRequest};
use crate::repositories::UserRepository;
use crate::error::AppError;

pub struct UserService {
    user_repo: Box<dyn UserRepository + Send + Sync>,
}

impl UserService {
    pub fn new(user_repo: Box<dyn UserRepository + Send + Sync>) -> Self {
        Self { user_repo }
    }

    pub async fn list_users(&self) -> Result<Vec<User>, AppError> {
        self.user_repo.find_all().await
    }

    pub async fn get_user(&self, id: i64) -> Result<User, AppError> {
        self.user_repo.find_by_id(id).await
            .ok_or(AppError::NotFound("User not found".to_string()))
    }

    pub async fn create_user(&self, req: CreateUserRequest) -> Result<User, AppError> {
        // 검증
        if req.email.is_empty() {
            return Err(AppError::ValidationError("Email is required".to_string()));
        }

        let user = User {
            id: 0, // DB에서 자동 생성
            name: req.name,
            email: req.email,
            created_at: chrono::Utc::now(),
        };

        self.user_repo.save(user).await
    }
}
```

### Repository (Trait)
```rust
use async_trait::async_trait;
use crate::models::User;
use crate::error::AppError;

#[async_trait]
pub trait UserRepository {
    async fn find_all(&self) -> Result<Vec<User>, AppError>;
    async fn find_by_id(&self, id: i64) -> Option<User>;
    async fn save(&self, user: User) -> Result<User, AppError>;
    async fn delete(&self, id: i64) -> Result<(), AppError>;
}

// PostgreSQL 구현 예시 (sqlx)
pub struct PostgresUserRepository {
    pool: sqlx::PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn find_all(&self) -> Result<Vec<User>, AppError> {
        let users = sqlx::query_as!(
            User,
            "SELECT id, name, email, created_at FROM users"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(users)
    }

    async fn find_by_id(&self, id: i64) -> Option<User> {
        sqlx::query_as!(
            User,
            "SELECT id, name, email, created_at FROM users WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten()
    }

    async fn save(&self, user: User) -> Result<User, AppError> {
        let user = sqlx::query_as!(
            User,
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
            user.name,
            user.email
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }
}
```

### Model
```rust
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: i64,
    pub name: String,
    pub email: String,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            name: user.name,
            email: user.email,
        }
    }
}
```

## 에러 처리

### 커스텀 에러 타입
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Internal server error")]
    InternalError,
}

// Actix-web ResponseError 구현
impl actix_web::error::ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::NotFound(_) => HttpResponse::NotFound().json(self.to_string()),
            AppError::ValidationError(_) => HttpResponse::BadRequest().json(self.to_string()),
            _ => HttpResponse::InternalServerError().json("Internal server error"),
        }
    }
}
```

### Result 타입 사용
```rust
// 단순한 경우
type Result<T> = std::result::Result<T, AppError>;

// 함수에서 사용
pub async fn get_user(id: i64) -> Result<User> {
    // ...
}

// ? 연산자로 에러 전파
pub async fn process_user(id: i64) -> Result<()> {
    let user = get_user(id).await?;
    let profile = get_profile(user.id).await?;
    Ok(())
}
```

## 소유권 (Ownership) 패턴

### 함수 인자
```rust
// 소유권 이동 (큰 데이터, 한 번만 사용)
fn consume_user(user: User) {
    // user 소유권이 이동됨
}

// 불변 참조 (읽기만)
fn read_user(user: &User) {
    println!("{}", user.name);
}

// 가변 참조 (수정)
fn update_user(user: &mut User) {
    user.name = "New Name".to_string();
}

// Clone (복사 필요 시)
fn clone_user(user: &User) -> User {
    user.clone()
}
```

### String vs &str
```rust
// 소유권 있는 문자열
fn take_ownership(s: String) {}

// 문자열 슬라이스 (차용)
fn borrow_string(s: &str) {}

// 사용 예
let owned = String::from("hello");
borrow_string(&owned);      // ✅
borrow_string("hello");      // ✅

take_ownership(owned);       // ✅ 소유권 이동
// owned는 더 이상 사용 불가
```

## 비동기 프로그래밍

### Tokio 사용
```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let result = fetch_data().await;
    println!("{:?}", result);
}

async fn fetch_data() -> Result<String, AppError> {
    sleep(Duration::from_secs(1)).await;
    Ok("data".to_string())
}
```

### 동시 실행
```rust
use tokio::join;

async fn fetch_multiple() -> Result<(), AppError> {
    let (user, profile, posts) = join!(
        fetch_user(),
        fetch_profile(),
        fetch_posts()
    );

    Ok(())
}

// select! 매크로 (먼저 완료되는 것 선택)
use tokio::select;

async fn race_tasks() {
    select! {
        result = task1() => println!("Task1 finished first"),
        result = task2() => println!("Task2 finished first"),
    }
}
```

## 테스트

### Unit Test
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_creation() {
        let user = User {
            id: 1,
            name: "John".to_string(),
            email: "john@example.com".to_string(),
            created_at: Utc::now(),
        };

        assert_eq!(user.name, "John");
        assert_eq!(user.email, "john@example.com");
    }

    #[test]
    #[should_panic(expected = "Email is required")]
    fn test_validation_fails() {
        validate_email("").unwrap();
    }
}
```

### 비동기 테스트
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_async_function() {
        let result = fetch_data().await;
        assert!(result.is_ok());
    }

    #[actix_web::test]
    async fn test_handler() {
        let resp = list_users(web::Data::new(mock_service())).await;
        assert!(resp.is_ok());
    }
}
```

### Mock (mockall)
```rust
use mockall::predicate::*;
use mockall::mock;

mock! {
    pub UserRepository {}

    #[async_trait]
    impl UserRepository for UserRepository {
        async fn find_by_id(&self, id: i64) -> Option<User>;
        async fn save(&self, user: User) -> Result<User, AppError>;
    }
}

#[tokio::test]
async fn test_with_mock() {
    let mut mock_repo = MockUserRepository::new();

    mock_repo
        .expect_find_by_id()
        .with(eq(1))
        .returning(|_| Some(User { /* ... */ }));

    let service = UserService::new(Box::new(mock_repo));
    let user = service.get_user(1).await.unwrap();

    assert_eq!(user.id, 1);
}
```

## 보안

### SQL Injection 방지
```rust
// ❌ 나쁜 예 (unsafe)
let query = format!("SELECT * FROM users WHERE id = {}", user_id);

// ✅ 좋은 예 (parameterized)
sqlx::query!("SELECT * FROM users WHERE id = $1", user_id)
```

### 입력 검증
```rust
use validator::{Validate, ValidationError};

#[derive(Debug, Validate, Deserialize)]
pub struct CreateUserRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,

    #[validate(email)]
    pub email: String,

    #[validate(range(min = 18, max = 120))]
    pub age: u8,
}

pub async fn create_user(req: web::Json<CreateUserRequest>) -> Result<HttpResponse> {
    req.validate()
        .map_err(|e| actix_web::error::ErrorBadRequest(e))?;

    // ...
}
```

## 성능

### Vec 사전 할당
```rust
// ❌ 비효율적
let mut users = Vec::new();
for i in 0..1000 {
    users.push(create_user(i));
}

// ✅ 효율적
let mut users = Vec::with_capacity(1000);
for i in 0..1000 {
    users.push(create_user(i));
}
```

### Iterator 활용
```rust
// ❌ 느림 (중간 Vec 생성)
let result: Vec<_> = data.iter()
    .filter(|x| x.is_valid())
    .collect();
let sum: i32 = result.iter().map(|x| x.value).sum();

// ✅ 빠름 (lazy evaluation)
let sum: i32 = data.iter()
    .filter(|x| x.is_valid())
    .map(|x| x.value)
    .sum();
```

### Clone 최소화
```rust
// ❌ 불필요한 clone
fn process(data: Vec<String>) {
    for item in data.clone() {  // 전체 복사!
        println!("{}", item);
    }
}

// ✅ 참조 사용
fn process(data: &[String]) {
    for item in data {
        println!("{}", item);
    }
}
```

## Linting & Formatting

### Clippy (린터)
```bash
# 전체 검사
cargo clippy

# 경고를 에러로 처리
cargo clippy -- -D warnings

# 자동 수정 (일부)
cargo clippy --fix
```

### Rustfmt (포매터)
```bash
# 포맷팅
cargo fmt

# 체크만 (CI에서)
cargo fmt -- --check
```

### rustfmt.toml 예시
```toml
max_width = 100
hard_tabs = false
tab_spaces = 4
edition = "2021"
```

## 의존성 관리

### Cargo.toml
```toml
[package]
name = "my-project"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4.4"
tokio = { version = "1.35", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio"] }

[dev-dependencies]
mockall = "0.12"

[profile.release]
opt-level = 3
lto = true
```

### 업데이트
```bash
# 의존성 업데이트 체크
cargo outdated

# 업데이트 (semver 준수)
cargo update

# 주요 버전 업데이트
cargo upgrade
```

## 참고 자료
- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)
- [Clippy Lints](https://rust-lang.github.io/rust-clippy/)
- [Async Book](https://rust-lang.github.io/async-book/)
