# Go 프로젝트 규칙

## 기술 스택
```yaml
language: Go 1.21+
framework: Gin / Echo / Chi (웹), gRPC (API)
build: go build
test: go test
package: go mod
```

## 프로젝트 구조

### Standard Layout (추천)
```
project/
├── cmd/
│   └── api/              # 메인 애플리케이션
│       └── main.go
├── internal/             # 프라이빗 코드 (외부 import 불가)
│   ├── handler/          # HTTP 핸들러
│   ├── service/          # 비즈니스 로직
│   ├── repository/       # 데이터 접근 계층
│   ├── model/            # 도메인 모델
│   └── middleware/       # 미들웨어
├── pkg/                  # 퍼블릭 라이브러리 (외부 import 가능)
│   └── util/
├── api/                  # API 스펙 (OpenAPI, protobuf)
├── config/               # 설정 파일
├── migrations/           # DB 마이그레이션
├── go.mod
└── go.sum
```

### 소규모 프로젝트
```
project/
├── handler/
├── service/
├── repository/
├── model/
├── main.go
├── go.mod
└── go.sum
```

## 네이밍 컨벤션

### 파일명
- **소문자 + 언더스코어**: `user_handler.go`, `user_service.go`
- **테스트**: `user_handler_test.go`

### 패키지명
- **소문자 단수형**: `handler`, `service`, `repository`
- **약어 피하기**: `util` 대신 `utility` (단, 관용적 약어는 허용: `http`, `url`)

### 변수/함수명
| 유형 | 컨벤션 | 예시 |
|------|--------|------|
| 공개 함수/타입 | `PascalCase` | `UserHandler`, `GetUser()` |
| 비공개 함수/변수 | `camelCase` | `userHandler`, `getUser()` |
| 상수 | `PascalCase` 또는 `camelCase` | `MaxRetries`, `defaultTimeout` |
| 약어 | 전체 대문자 또는 소문자 | `HTTPServer`, `userID`, `urlPath` |

### 인터페이스명
- **행동 기반 + er**: `Reader`, `Writer`, `UserService`
- **단일 메서드 인터페이스**: 메서드명 + `er`
  - `type Reader interface { Read() }`

## 코드 스타일

### Handler (Gin 예시)
```go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "yourproject/internal/service"
)

type UserHandler struct {
    userService service.UserService
}

func NewUserHandler(userService service.UserService) *UserHandler {
    return &UserHandler{
        userService: userService,
    }
}

// ListUsers godoc
// @Summary 사용자 목록 조회
// @Tags users
// @Produce json
// @Success 200 {array} model.User
// @Router /api/users [get]
func (h *UserHandler) ListUsers(c *gin.Context) {
    users, err := h.userService.ListUsers(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, users)
}

// GetUser godoc
// @Summary 사용자 조회
// @Tags users
// @Param id path int true "User ID"
// @Produce json
// @Success 200 {object} model.User
// @Router /api/users/{id} [get]
func (h *UserHandler) GetUser(c *gin.Context) {
    id := c.Param("id")
    user, err := h.userService.GetUser(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
        return
    }
    c.JSON(http.StatusOK, user)
}
```

### Service
```go
package service

import (
    "context"
    "yourproject/internal/model"
    "yourproject/internal/repository"
)

type UserService interface {
    ListUsers(ctx context.Context) ([]*model.User, error)
    GetUser(ctx context.Context, id string) (*model.User, error)
    CreateUser(ctx context.Context, req *model.UserCreateRequest) (*model.User, error)
}

type userService struct {
    userRepo repository.UserRepository
}

func NewUserService(userRepo repository.UserRepository) UserService {
    return &userService{
        userRepo: userRepo,
    }
}

func (s *userService) ListUsers(ctx context.Context) ([]*model.User, error) {
    return s.userRepo.FindAll(ctx)
}

func (s *userService) GetUser(ctx context.Context, id string) (*model.User, error) {
    return s.userRepo.FindByID(ctx, id)
}

func (s *userService) CreateUser(ctx context.Context, req *model.UserCreateRequest) (*model.User, error) {
    user := &model.User{
        Name:  req.Name,
        Email: req.Email,
    }
    return s.userRepo.Save(ctx, user)
}
```

### Repository
```go
package repository

import (
    "context"
    "database/sql"

    "yourproject/internal/model"
)

type UserRepository interface {
    FindAll(ctx context.Context) ([]*model.User, error)
    FindByID(ctx context.Context, id string) (*model.User, error)
    Save(ctx context.Context, user *model.User) (*model.User, error)
}

type userRepository struct {
    db *sql.DB
}

func NewUserRepository(db *sql.DB) UserRepository {
    return &userRepository{db: db}
}

func (r *userRepository) FindAll(ctx context.Context) ([]*model.User, error) {
    query := "SELECT id, name, email, created_at FROM users"
    rows, err := r.db.QueryContext(ctx, query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var users []*model.User
    for rows.Next() {
        var user model.User
        if err := rows.Scan(&user.ID, &user.Name, &user.Email, &user.CreatedAt); err != nil {
            return nil, err
        }
        users = append(users, &user)
    }
    return users, nil
}

func (r *userRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
    query := "SELECT id, name, email, created_at FROM users WHERE id = ?"
    var user model.User
    err := r.db.QueryRowContext(ctx, query, id).Scan(
        &user.ID, &user.Name, &user.Email, &user.CreatedAt,
    )
    if err != nil {
        return nil, err
    }
    return &user, nil
}
```

## 에러 처리

### 에러 반환
```go
// 나쁜 예
func GetUser(id string) *User {
    // panic 발생 가능
}

// 좋은 예
func GetUser(id string) (*User, error) {
    if id == "" {
        return nil, errors.New("id is required")
    }
    return user, nil
}
```

### 커스텀 에러
```go
package model

import "errors"

var (
    ErrUserNotFound     = errors.New("user not found")
    ErrInvalidEmail     = errors.New("invalid email format")
    ErrDuplicateEmail   = errors.New("email already exists")
)

// 에러 래핑
import "fmt"

func (s *userService) GetUser(ctx context.Context, id string) (*User, error) {
    user, err := s.userRepo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("failed to get user %s: %w", id, err)
    }
    return user, nil
}
```

### 에러 체크
```go
// errors.Is 사용
if errors.Is(err, ErrUserNotFound) {
    // 처리
}

// errors.As 사용 (타입 변환)
var validationErr *ValidationError
if errors.As(err, &validationErr) {
    // 처리
}
```

## 동시성 (Concurrency)

### Goroutine 사용
```go
// Context로 취소 전파
func ProcessUsers(ctx context.Context, userIDs []string) error {
    errCh := make(chan error, len(userIDs))

    for _, id := range userIDs {
        id := id // 클로저 변수 캡처
        go func() {
            select {
            case <-ctx.Done():
                errCh <- ctx.Err()
                return
            default:
                err := processUser(ctx, id)
                errCh <- err
            }
        }()
    }

    // 결과 수집
    for range userIDs {
        if err := <-errCh; err != nil {
            return err
        }
    }
    return nil
}
```

### WaitGroup 사용
```go
import "sync"

func FetchAllData(urls []string) []Data {
    var wg sync.WaitGroup
    results := make([]Data, len(urls))

    for i, url := range urls {
        wg.Add(1)
        go func(i int, url string) {
            defer wg.Done()
            results[i] = fetchData(url)
        }(i, url)
    }

    wg.Wait()
    return results
}
```

## 테스트

### Unit Test
```go
package service

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

// Mock Repository
type MockUserRepository struct {
    mock.Mock
}

func (m *MockUserRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
    args := m.Called(ctx, id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*model.User), args.Error(1)
}

func TestUserService_GetUser(t *testing.T) {
    // Arrange
    mockRepo := new(MockUserRepository)
    service := NewUserService(mockRepo)

    expectedUser := &model.User{
        ID:    "123",
        Name:  "John",
        Email: "john@example.com",
    }

    mockRepo.On("FindByID", mock.Anything, "123").Return(expectedUser, nil)

    // Act
    user, err := service.GetUser(context.Background(), "123")

    // Assert
    assert.NoError(t, err)
    assert.Equal(t, expectedUser.Name, user.Name)
    mockRepo.AssertExpectations(t)
}
```

### Table-Driven Tests
```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name    string
        email   string
        wantErr bool
    }{
        {"valid email", "test@example.com", false},
        {"missing @", "testexample.com", true},
        {"empty", "", true},
        {"no domain", "test@", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateEmail(tt.email)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateEmail() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

## 보안

### SQL Injection 방지
```go
// 나쁜 예
query := fmt.Sprintf("SELECT * FROM users WHERE id = %s", id)

// 좋은 예
query := "SELECT * FROM users WHERE id = ?"
db.QueryContext(ctx, query, id)
```

### 민감 정보 관리
```go
// 환경 변수 사용
import "os"

dbPassword := os.Getenv("DB_PASSWORD")

// .env 파일 (프로덕션 아님!)
// godotenv 패키지 사용
```

## 성능

### Slice 사전 할당
```go
// 나쁜 예
var users []User
for _, id := range ids {
    users = append(users, getUser(id))
}

// 좋은 예
users := make([]User, 0, len(ids))
for _, id := range ids {
    users = append(users, getUser(id))
}
```

### String 연결
```go
// 나쁜 예 (많은 반복)
var result string
for _, s := range strings {
    result += s
}

// 좋은 예
var builder strings.Builder
for _, s := range strings {
    builder.WriteString(s)
}
result := builder.String()
```

## Linting & Formatting

### 필수 도구
```bash
# 코드 포맷팅
go fmt ./...

# Import 정리
goimports -w .

# Linting (golangci-lint 권장)
golangci-lint run
```

### .golangci.yml 예시
```yaml
linters:
  enable:
    - gofmt
    - govet
    - errcheck
    - staticcheck
    - unused
    - gosimple
    - ineffassign
```

## 의존성 관리

```bash
# 모듈 초기화
go mod init github.com/username/project

# 의존성 추가
go get github.com/gin-gonic/gin

# 의존성 정리
go mod tidy

# 벤더링 (선택)
go mod vendor
```

## 참고 자료
- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Standard Go Project Layout](https://github.com/golang-standards/project-layout)
