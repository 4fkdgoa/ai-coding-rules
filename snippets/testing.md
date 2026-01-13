# 테스트 작성 가이드

## 테스트 원칙

### 필수 테스트 항목

| 변경 유형 | 필수 테스트 |
|----------|------------|
| 새 기능 | 단위 테스트 |
| 버그 수정 | 재현 테스트 (버그 시나리오) |
| API 변경 | 통합 테스트 |
| 리팩토링 | 기존 테스트 통과 확인 |

### 테스트 피라미드

```
        /\
       /  \      E2E 테스트 (적음)
      /----\
     /      \    통합 테스트 (중간)
    /--------\
   /          \  단위 테스트 (많음)
  --------------
```

---

## 네이밍 컨벤션

### 테스트 메서드명

```
test_<기능>_<조건>_<예상결과>
```

또는 (BDD 스타일)

```
<기능>_should_<예상결과>_when_<조건>
```

### 예시

```java
// Java - JUnit
@Test
void getUser_existingId_returnsUser() { }

@Test
void getUser_nonExistingId_throwsNotFoundException() { }

@Test
void createUser_validInput_savesAndReturnsUser() { }

@Test
void createUser_duplicateEmail_throwsConflictException() { }
```

```python
# Python - pytest
def test_get_user_existing_id_returns_user():
    pass

def test_get_user_non_existing_id_raises_not_found():
    pass
```

```typescript
// TypeScript - Jest
describe('UserService', () => {
  describe('getUser', () => {
    it('should return user when id exists', () => {});
    it('should throw NotFoundError when id does not exist', () => {});
  });
});
```

---

## 테스트 구조 (AAA / GWT)

### Arrange-Act-Assert (AAA)

```java
@Test
void getUser_existingId_returnsUser() {
    // Arrange (준비)
    User expectedUser = new User(1L, "Test User");
    when(userRepository.findById(1L)).thenReturn(Optional.of(expectedUser));

    // Act (실행)
    UserResponse result = userService.getUser(1L);

    // Assert (검증)
    assertThat(result.getId()).isEqualTo(1L);
    assertThat(result.getName()).isEqualTo("Test User");
}
```

### Given-When-Then (GWT / BDD)

```java
@Test
void getUser_existingId_returnsUser() {
    // Given
    User expectedUser = new User(1L, "Test User");
    when(userRepository.findById(1L)).thenReturn(Optional.of(expectedUser));

    // When
    UserResponse result = userService.getUser(1L);

    // Then
    assertThat(result.getId()).isEqualTo(1L);
    assertThat(result.getName()).isEqualTo("Test User");
}
```

---

## 테스트 유형별 가이드

### 단위 테스트 (Unit Test)

**목적**: 개별 메서드/클래스의 로직 검증

```java
// Java - 서비스 레이어 테스트
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void createUser_validInput_savesAndReturnsUser() {
        // Given
        CreateUserRequest request = new CreateUserRequest("test@example.com", "Test");
        User savedUser = User.builder()
            .id(1L)
            .email("test@example.com")
            .name("Test")
            .build();
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        // When
        UserResponse result = userService.createUser(request);

        // Then
        assertThat(result.getEmail()).isEqualTo("test@example.com");
        verify(userRepository).save(any(User.class));
    }
}
```

### 통합 테스트 (Integration Test)

**목적**: 컴포넌트 간 상호작용 검증

```java
// Java - 컨트롤러 통합 테스트
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void createUser_validRequest_returns201() throws Exception {
        String requestBody = """
            {
                "email": "test@example.com",
                "name": "Test User"
            }
            """;

        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("test@example.com"))
            .andExpect(jsonPath("$.id").exists());

        assertThat(userRepository.findByEmail("test@example.com")).isPresent();
    }
}
```

### API 테스트 (E2E)

**목적**: 전체 시스템 동작 검증

```python
# Python - pytest + httpx
import pytest
import httpx

BASE_URL = "http://localhost:8000/api"

@pytest.fixture
def client():
    with httpx.Client(base_url=BASE_URL) as client:
        yield client

def test_user_lifecycle(client):
    # Create
    response = client.post("/users", json={
        "email": "test@example.com",
        "name": "Test"
    })
    assert response.status_code == 201
    user_id = response.json()["id"]

    # Read
    response = client.get(f"/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

    # Update
    response = client.put(f"/users/{user_id}", json={
        "name": "Updated"
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Updated"

    # Delete
    response = client.delete(f"/users/{user_id}")
    assert response.status_code == 204

    # Verify deletion
    response = client.get(f"/users/{user_id}")
    assert response.status_code == 404
```

---

## Mock 사용 원칙

### Mock 허용

- 외부 API 호출
- 데이터베이스 (단위 테스트 시)
- 파일 시스템
- 시간 (Clock)
- 랜덤 값

### Mock 지양

- 테스트 대상 클래스의 내부 로직
- 단순 값 객체 (DTO, Entity)
- 테스트하려는 핵심 로직

### 테스트 컨테이너 선호

```java
// Testcontainers 사용 예시
@Testcontainers
@SpringBootTest
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
        .withDatabaseName("test")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private UserRepository userRepository;

    @Test
    void findByEmail_existingEmail_returnsUser() {
        // Given
        User user = userRepository.save(User.builder()
            .email("test@example.com")
            .name("Test")
            .build());

        // When
        Optional<User> result = userRepository.findByEmail("test@example.com");

        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(user.getId());
    }
}
```

---

## 테스트 데이터 관리

### Fixture / Factory 패턴

```java
// Java - 테스트 데이터 팩토리
public class UserFixture {

    public static User createDefaultUser() {
        return User.builder()
            .id(1L)
            .email("test@example.com")
            .name("Test User")
            .build();
    }

    public static User createUser(String email, String name) {
        return User.builder()
            .email(email)
            .name(name)
            .build();
    }

    public static CreateUserRequest createValidRequest() {
        return new CreateUserRequest("test@example.com", "Test User");
    }
}
```

```python
# Python - pytest fixture
import pytest
from app.models import User

@pytest.fixture
def sample_user():
    return User(
        id=1,
        email="test@example.com",
        name="Test User"
    )

@pytest.fixture
def create_user_data():
    return {
        "email": "test@example.com",
        "name": "Test User"
    }
```

---

## 테스트 실행 및 검증

### 명령어

```bash
# Java - Gradle
./gradlew test
./gradlew test --tests "UserServiceTest"
./gradlew test --info  # 상세 로그

# Python - pytest
pytest
pytest tests/test_user.py -v
pytest --cov=app --cov-report=html

# Node.js - Jest
npm test
npm test -- --coverage
npm test -- --watch
```

### CI/CD 통합

```yaml
# GitHub Actions 예시
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      - name: Run tests
        run: ./gradlew test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## AI 어시스턴트용 테스트 Skill

```markdown
# /test skill 구현

1. 변경된 파일 확인 (git diff)
2. 테스트 대상 식별:
   - 새 기능 → 단위 테스트 작성
   - 버그 수정 → 재현 테스트 작성
   - API 변경 → 통합 테스트 확인
3. 테스트 파일 위치 확인 (기존 패턴 따름)
4. 테스트 작성:
   - AAA/GWT 구조 사용
   - 네이밍 컨벤션 준수
   - 엣지 케이스 포함
5. 테스트 실행 및 결과 확인
6. 커버리지 리포트 생성 (선택)
```

---

## 테스트 체크리스트

```markdown
## 테스트 작성 체크리스트
- [ ] 테스트가 독립적으로 실행되는가?
- [ ] 테스트가 결정적인가? (항상 같은 결과)
- [ ] 테스트가 빠른가? (단위 테스트 < 100ms)
- [ ] 테스트가 의미 있는가? (가치 있는 검증)
- [ ] 테스트가 읽기 쉬운가? (AAA/GWT 구조)
- [ ] 엣지 케이스를 다루는가?
- [ ] Mock이 과하지 않은가?
```

---

**참고**: 테스트는 문서이자 안전망입니다. 좋은 테스트는 코드의 의도를 명확히 전달합니다.
