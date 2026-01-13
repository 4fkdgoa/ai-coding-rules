# Java/Spring Boot 프로젝트 규칙

## 기술 스택
```yaml
language: Java 21+
framework: Spring Boot 3.x
build: Gradle (Kotlin DSL) 또는 Maven
test: JUnit 5 + Mockito
```

## 프로젝트 구조
```
src/
├── main/
│   ├── java/com/example/project/
│   │   ├── controller/     # REST 컨트롤러
│   │   ├── service/        # 비즈니스 로직
│   │   ├── repository/     # JPA Repository
│   │   ├── entity/         # JPA Entity
│   │   ├── dto/            # Request/Response DTO
│   │   ├── config/         # Configuration 클래스
│   │   └── exception/      # 예외 처리
│   └── resources/
│       ├── application.yml
│       └── application-{profile}.yml
└── test/java/              # 테스트 코드
```

## 네이밍 컨벤션

### 클래스명
| 유형 | 접미사 | 예시 |
|------|--------|------|
| 컨트롤러 | `*Controller` | `UserController` |
| 서비스 | `*Service` | `UserService` |
| 서비스 구현 | `*ServiceImpl` | `UserServiceImpl` |
| Repository | `*Repository` | `UserRepository` |
| Entity | 없음 (도메인명) | `User` |
| DTO | `*Request`, `*Response` | `UserCreateRequest` |
| 설정 | `*Config` | `SecurityConfig` |

### 메서드명 (REST)
| HTTP | 메서드 접두사 | 예시 |
|------|--------------|------|
| GET (목록) | `list*` | `listUsers()` |
| GET (단건) | `get*` | `getUser(id)` |
| POST | `create*` | `createUser(request)` |
| PUT | `update*` | `updateUser(id, request)` |
| DELETE | `delete*` | `deleteUser(id)` |

## 코드 스타일

### Controller
```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<UserResponse>> listUsers() {
        return ResponseEntity.ok(userService.listUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUser(id));
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userService.createUser(request));
    }
}
```

### Service
```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse createUser(UserCreateRequest request) {
        User user = request.toEntity();
        return UserResponse.from(userRepository.save(user));
    }
}
```

### DTO
```java
public record UserCreateRequest(
    @NotBlank String name,
    @Email String email
) {
    public User toEntity() {
        return User.builder()
                .name(name)
                .email(email)
                .build();
    }
}

public record UserResponse(
    Long id,
    String name,
    String email,
    LocalDateTime createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getName(),
            user.getEmail(),
            user.getCreatedAt()
        );
    }
}
```

## 예외 처리
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(EntityNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("VALIDATION_ERROR", message));
    }
}
```

## 테스트 패턴

### 단위 테스트 (Service)
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void getUser_existingId_returnsUser() {
        // given
        User user = User.builder().id(1L).name("Test").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        // when
        UserResponse result = userService.getUser(1L);

        // then
        assertThat(result.name()).isEqualTo("Test");
    }
}
```

### 통합 테스트 (Controller)
```java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void listUsers_returnsOk() throws Exception {
        when(userService.listUsers()).thenReturn(List.of());

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
```

## 의존성 (build.gradle.kts 예시)
```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    runtimeOnly("com.h2database:h2")  // 개발용
    runtimeOnly("org.postgresql:postgresql")  // 운영용

    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

---

**이 템플릿을 CLAUDE.md에 포함하거나 참조하여 사용하세요.**
