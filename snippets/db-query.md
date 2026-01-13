# 데이터베이스 쿼리 가이드

## 기본 원칙

### 보안

1. **Parameterized Query 필수** (SQL Injection 방지)
2. **최소 권한 원칙** (필요한 컬럼만 SELECT)
3. **민감 정보 마스킹** (로그 출력 시)

### 성능

1. **N+1 문제 방지** (JOIN 또는 Batch Fetch)
2. **인덱스 활용** (WHERE, ORDER BY, JOIN 컬럼)
3. **페이징 처리** (대용량 데이터)
4. **불필요한 SELECT * 금지**

---

## SQL Injection 방지

### 올바른 예시

```java
// Java - JPA/JPQL
@Query("SELECT u FROM User u WHERE u.email = :email")
Optional<User> findByEmail(@Param("email") String email);

// Native Query
@Query(value = "SELECT * FROM users WHERE email = :email", nativeQuery = true)
Optional<User> findByEmailNative(@Param("email") String email);

// JdbcTemplate
String sql = "SELECT * FROM users WHERE id = ?";
User user = jdbcTemplate.queryForObject(sql, userRowMapper, id);
```

```python
# Python - SQLAlchemy
user = session.query(User).filter(User.email == email).first()

# Raw SQL with parameters
result = session.execute(
    text("SELECT * FROM users WHERE email = :email"),
    {"email": email}
)
```

```javascript
// Node.js - Prisma
const user = await prisma.user.findUnique({
  where: { email: email }
});

// Raw SQL
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;
```

### 잘못된 예시 (절대 금지)

```java
// ❌ 문자열 연결 - SQL Injection 취약
String sql = "SELECT * FROM users WHERE email = '" + email + "'";

// ❌ String.format - SQL Injection 취약
String sql = String.format("SELECT * FROM users WHERE email = '%s'", email);
```

---

## N+1 문제 해결

### 문제 상황

```java
// ❌ N+1 문제 발생
List<Order> orders = orderRepository.findAll();
for (Order order : orders) {
    User user = order.getUser();  // 추가 쿼리 발생!
    System.out.println(user.getName());
}
// 1번 (orders) + N번 (각 order의 user) = N+1 쿼리
```

### 해결 방법

```java
// ✅ JOIN FETCH
@Query("SELECT o FROM Order o JOIN FETCH o.user")
List<Order> findAllWithUser();

// ✅ @EntityGraph
@EntityGraph(attributePaths = {"user"})
List<Order> findAll();

// ✅ Batch Size 설정 (application.yml)
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 100
```

```python
# Python - SQLAlchemy
# ✅ joinedload
orders = session.query(Order).options(joinedload(Order.user)).all()

# ✅ selectinload (별도 쿼리, 대용량에 유리)
orders = session.query(Order).options(selectinload(Order.user)).all()
```

---

## 페이징 처리

### Spring Data JPA

```java
// Repository
Page<User> findByNameContaining(String name, Pageable pageable);

// Service
public Page<UserResponse> searchUsers(String name, int page, int size) {
    Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
    return userRepository.findByNameContaining(name, pageable)
        .map(UserResponse::from);
}

// Controller
@GetMapping
public Page<UserResponse> listUsers(
    @RequestParam(defaultValue = "") String name,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
) {
    return userService.searchUsers(name, page, size);
}
```

### Offset vs Cursor 페이징

```sql
-- Offset 방식 (작은 데이터셋에 적합)
SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 100;

-- Cursor 방식 (대용량에 적합, 성능 우수)
SELECT * FROM users WHERE id > :lastId ORDER BY id LIMIT 20;
```

```java
// Cursor 기반 페이징
@Query("SELECT u FROM User u WHERE u.id > :cursor ORDER BY u.id")
List<User> findUsersAfterCursor(@Param("cursor") Long cursor, Pageable pageable);
```

---

## 인덱스 활용

### 인덱스가 필요한 경우

1. WHERE 절에서 자주 사용되는 컬럼
2. JOIN 조건 컬럼
3. ORDER BY 컬럼
4. 외래 키 컬럼

### 인덱스 생성

```sql
-- 단일 컬럼 인덱스
CREATE INDEX idx_users_email ON users(email);

-- 복합 인덱스 (순서 중요!)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- 부분 인덱스 (특정 조건에만)
CREATE INDEX idx_users_active ON users(email) WHERE is_active = true;

-- 커버링 인덱스
CREATE INDEX idx_users_covering ON users(email, name, created_at);
```

### 인덱스 확인 (EXPLAIN)

```sql
-- MySQL
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- PostgreSQL
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

---

## 트랜잭션 관리

### Spring @Transactional

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentService paymentService;

    // 읽기 전용 (성능 최적화)
    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long orderId) {
        return orderRepository.findById(orderId)
            .map(OrderResponse::from)
            .orElseThrow(() -> new NotFoundException("Order not found"));
    }

    // 쓰기 작업
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        Order order = request.toEntity();
        order = orderRepository.save(order);
        paymentService.processPayment(order);  // 실패 시 롤백
        return OrderResponse.from(order);
    }

    // 격리 수준 지정
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void updateInventory(Long productId, int quantity) {
        // ...
    }

    // 전파 속성
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAudit(AuditLog log) {
        // 독립 트랜잭션 (메인 트랜잭션 롤백해도 저장됨)
    }
}
```

### 주의사항

```java
// ❌ 같은 클래스 내 호출 - 프록시 우회로 트랜잭션 미적용
public void methodA() {
    methodB();  // @Transactional 무시됨!
}

@Transactional
public void methodB() { }

// ✅ 해결: 별도 서비스로 분리 또는 self-injection
```

---

## 벌크 연산

### 대량 INSERT

```java
// JPA saveAll (Batch Insert)
@Transactional
public void bulkInsert(List<User> users) {
    List<List<User>> batches = Lists.partition(users, 1000);
    for (List<User> batch : batches) {
        userRepository.saveAll(batch);
        entityManager.flush();
        entityManager.clear();  // 메모리 관리
    }
}

// JDBC Batch Insert (더 빠름)
public void bulkInsertJdbc(List<User> users) {
    String sql = "INSERT INTO users (email, name) VALUES (?, ?)";
    jdbcTemplate.batchUpdate(sql, users, 1000, (ps, user) -> {
        ps.setString(1, user.getEmail());
        ps.setString(2, user.getName());
    });
}
```

### 대량 UPDATE/DELETE

```java
// JPQL 벌크 업데이트
@Modifying
@Query("UPDATE User u SET u.status = :status WHERE u.lastLoginAt < :date")
int bulkUpdateStatus(@Param("status") String status, @Param("date") LocalDateTime date);

// 사용 시 주의: 영속성 컨텍스트와 동기화 안됨
@Transactional
public void deactivateInactiveUsers() {
    LocalDateTime threshold = LocalDateTime.now().minusDays(90);
    int count = userRepository.bulkUpdateStatus("INACTIVE", threshold);
    entityManager.clear();  // 영속성 컨텍스트 초기화
    log.info("Deactivated {} users", count);
}
```

---

## 쿼리 최적화 체크리스트

```markdown
## 쿼리 작성 체크리스트
- [ ] Parameterized Query 사용 (SQL Injection 방지)
- [ ] SELECT * 대신 필요한 컬럼만 조회
- [ ] N+1 문제 없는지 확인 (JOIN FETCH, EntityGraph)
- [ ] 적절한 인덱스 존재 확인
- [ ] 페이징 처리 (대용량 데이터)
- [ ] EXPLAIN으로 실행 계획 확인
- [ ] 트랜잭션 범위 적절한지 확인
- [ ] 읽기 전용 쿼리에 readOnly=true 적용
```

---

## AI 어시스턴트용 DB 쿼리 Skill

```markdown
# /db-query skill 구현

1. 요구사항 분석 (조회/수정/삭제)
2. 테이블 구조 확인 (Entity/Model 파일)
3. 기존 쿼리 패턴 파악 (Repository 참고)
4. 쿼리 작성:
   - Parameterized Query 사용
   - 인덱스 활용 가능한 조건
   - N+1 방지 (필요시 JOIN)
5. 성능 검토:
   - 대용량 처리 시 페이징
   - 벌크 연산 고려
6. 테스트 쿼리 제안
```

---

**참고**: 쿼리 최적화는 EXPLAIN으로 실행 계획을 확인하고, 실제 데이터로 테스트하는 것이 가장 확실합니다.
