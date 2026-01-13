# AI 어시스턴트 Skill 예시

## Skill이란?

Skill은 AI 어시스턴트가 특정 작업을 수행하기 위한 명령어 집합입니다.
슬래시 명령어(`/commit`, `/review` 등)로 호출할 수 있습니다.

---

## 기본 Skill 목록

### /commit - 커밋 생성

```markdown
# /commit skill

## 목적
변경사항 분석 후 적절한 커밋 메시지 생성

## 실행 단계
1. `git status` - 변경된 파일 목록 확인
2. `git diff --staged` - staged 변경 내용 분석
3. `git log --oneline -3` - 최근 커밋 스타일 참고
4. 변경 내용 기반 type 결정 (feat/fix/refactor/docs/test/chore)
5. 커밋 메시지 초안 작성
6. 사용자 확인 요청
7. 확인 후 커밋 실행

## 출력 형식
```
변경 파일: 3개
- src/service/UserService.java (수정)
- src/dto/UserDto.java (추가)
- test/UserServiceTest.java (추가)

제안 커밋 메시지:
feat: 사용자 조회 API 추가

- UserService에 getUser 메서드 추가
- UserDto 응답 객체 생성
- 단위 테스트 작성

이대로 커밋할까요? (Y/n)
```

## 주의사항
- 민감 정보(.env, credentials) 커밋 방지
- staged 파일이 없으면 경고
- 너무 많은 변경이면 분리 제안
```

---

### /review - 코드 리뷰

```markdown
# /review skill

## 목적
변경된 코드에 대한 체계적 리뷰 수행

## 실행 단계
1. 변경된 파일 목록 확인 (`git diff --name-only`)
2. 각 파일별 변경사항 분석
3. 체크리스트 기반 검토:
   - 기능: 로직 오류, 엣지 케이스
   - 보안: SQL Injection, XSS, 민감 정보
   - 성능: N+1, 불필요 연산
   - 품질: 네이밍, 중복, 복잡도
4. 문제점 분류 ([필수]/[권장]/[제안])
5. 수정 제안 (Before/After)
6. 종합 의견 제시

## 출력 형식
```
## 코드 리뷰 결과

### UserService.java

[필수] 라인 45: NPE 위험
- 문제: user.getName() 호출 전 null 체크 없음
- 제안:
  ```java
  // Before
  String name = user.getName().toUpperCase();

  // After
  String name = user != null ? user.getName().toUpperCase() : "";
  ```

[권장] 라인 78: 메서드 분리
- 문제: 메서드가 50줄 초과
- 제안: 검증 로직을 별도 메서드로 추출

### 종합
- 필수 수정: 1건
- 권장 수정: 1건
- 전반적으로 양호하나 null 처리 보완 필요
```
```

---

### /test - 테스트 작성/실행

```markdown
# /test skill

## 목적
변경된 코드에 대한 테스트 작성 또는 기존 테스트 실행

## 실행 단계 (테스트 작성)
1. 변경된 파일 확인
2. 테스트 대상 식별
3. 기존 테스트 패턴 참고
4. 테스트 케이스 설계:
   - 정상 케이스
   - 엣지 케이스
   - 에러 케이스
5. 테스트 코드 작성
6. 테스트 실행 및 결과 확인

## 실행 단계 (테스트 실행)
1. 테스트 명령어 실행 (gradle test / pytest / npm test)
2. 실패한 테스트 분석
3. 실패 원인 설명
4. 수정 제안 (필요시)

## 출력 형식 (작성)
```
## 테스트 작성 대상: UserService.createUser

### 테스트 케이스
1. createUser_validInput_savesAndReturnsUser
2. createUser_duplicateEmail_throwsConflictException
3. createUser_nullName_throwsValidationException

### 생성된 테스트 코드
[테스트 코드 출력]

테스트를 실행할까요? (Y/n)
```

## 출력 형식 (실행)
```
## 테스트 실행 결과

총 15개 테스트 중 14개 성공, 1개 실패

### 실패한 테스트
- UserServiceTest.createUser_duplicateEmail_throwsConflictException

### 실패 원인
- Expected: ConflictException
- Actual: No exception thrown

### 수정 제안
UserService.createUser에서 중복 이메일 체크 로직 누락
```
```

---

### /explain - 코드 설명

```markdown
# /explain skill

## 목적
선택된 코드 또는 파일의 동작 설명

## 실행 단계
1. 대상 코드/파일 읽기
2. 전체 구조 파악
3. 핵심 로직 분석
4. 단계별 설명 작성
5. 관련 개념 설명 (필요시)

## 출력 형식
```
## UserService.createUser 메서드 설명

### 개요
새 사용자를 생성하고 저장하는 메서드

### 처리 흐름
1. 입력값 검증 (이메일 형식, 필수 필드)
2. 이메일 중복 체크
3. 비밀번호 해싱
4. User 엔티티 생성
5. DB 저장
6. 응답 DTO 변환 후 반환

### 주요 의존성
- UserRepository: DB 접근
- PasswordEncoder: 비밀번호 해싱

### 예외 처리
- ValidationException: 입력값 검증 실패
- ConflictException: 이메일 중복
```
```

---

### /fix - 버그 수정

```markdown
# /fix skill

## 목적
에러 메시지 또는 증상 기반 버그 수정

## 실행 단계
1. 에러/증상 분석
2. 관련 코드 탐색
3. 원인 파악
4. 수정 방안 제시
5. 수정 코드 작성
6. 테스트 (재현 케이스)

## 입력 형식
```
/fix NullPointerException at UserService.java:45
```
또는
```
/fix 로그인 후 세션이 유지되지 않음
```

## 출력 형식
```
## 버그 분석

### 증상
NullPointerException at UserService.java:45

### 원인
user 객체가 null인 상태에서 getName() 호출

### 발생 조건
findById() 결과가 null일 때 처리 누락

### 수정 방안
Optional 처리 또는 null 체크 추가

### 수정 코드
```java
// Before (라인 44-46)
User user = userRepository.findById(id);
String name = user.getName();

// After
User user = userRepository.findById(id)
    .orElseThrow(() -> new NotFoundException("User not found: " + id));
String name = user.getName();
```

### 재현 테스트
```java
@Test
void getUser_nonExistingId_throwsNotFoundException() {
    assertThrows(NotFoundException.class,
        () -> userService.getUser(999L));
}
```

수정을 적용할까요? (Y/n)
```
```

---

### /search - 코드 검색

```markdown
# /search skill

## 목적
코드베이스에서 특정 패턴/함수/클래스 검색

## 실행 단계
1. 검색어 분석 (클래스명, 함수명, 문자열 등)
2. 적절한 검색 방법 선택 (grep, find, LSP)
3. 검색 실행
4. 결과 정리 및 출력

## 입력 형식
```
/search UserService
/search "TODO"
/search function login
```

## 출력 형식
```
## 검색 결과: "UserService"

### 파일 (3개)
1. src/service/UserService.java - 메인 서비스 클래스
2. src/controller/UserController.java - UserService 사용
3. test/service/UserServiceTest.java - 테스트

### 참조 위치 (5개)
- UserController.java:15 - private final UserService userService;
- UserController.java:23 - userService.createUser(request);
- SecurityConfig.java:45 - @Autowired UserService userService;
...

상세 내용을 볼 파일을 선택하세요 (1-3, all):
```
```

---

## Custom Skill 정의 방법

### 템플릿

```markdown
# /<skill-name> skill

## 목적
[이 Skill이 해결하는 문제]

## 실행 단계
1. [단계 1]
2. [단계 2]
3. ...

## 입력 형식
[사용자 입력 예시]

## 출력 형식
[예상 출력 형식]

## 주의사항
[제약사항, 예외 처리 등]
```

### 예시: /deploy skill

```markdown
# /deploy skill

## 목적
로컬 변경사항을 서버에 배포

## 실행 단계
1. 미커밋 변경사항 확인
2. 테스트 실행
3. 빌드
4. 배포 대상 서버 확인
5. 배포 스크립트 실행
6. 헬스체크
7. 결과 보고

## 입력 형식
/deploy staging
/deploy production --skip-tests

## 출력 형식
```
## 배포 시작: staging

[1/5] 변경사항 확인... OK
[2/5] 테스트 실행... 15/15 passed
[3/5] 빌드... OK (jar: 45MB)
[4/5] 배포 중... ████████████ 100%
[5/5] 헬스체크... OK

배포 완료!
- 환경: staging
- 버전: v1.2.3
- URL: https://staging.example.com
```

## 주의사항
- production 배포는 이중 확인 필요
- 테스트 실패 시 배포 중단
- 롤백 명령어: /rollback staging
```

---

## Skill 등록 위치

Claude Code의 경우:
- 프로젝트 루트의 `.claude/` 또는 `CLAUDE.md`에 정의
- `/skills` 디렉토리에 개별 파일로 관리

Cursor의 경우:
- `.cursorrules` 파일에 정의
- 프로젝트별 설정

---

**참고**: Skill은 반복 작업을 자동화하고 일관성을 유지하는 데 유용합니다.
