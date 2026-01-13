# Git 커밋 규칙

## 커밋 메시지 형식

```
<type>(<scope>): <subject>

[body]

[footer]
```

### 구조 설명

| 부분 | 필수 | 설명 |
|------|------|------|
| type | O | 변경 유형 |
| scope | X | 영향 범위 (모듈, 기능) |
| subject | O | 변경 요약 (50자 이내) |
| body | X | 상세 설명 (72자 줄바꿈) |
| footer | X | Breaking changes, 이슈 참조 |

## Type 종류

| Type | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 | `feat: 사용자 로그인 기능 추가` |
| `fix` | 버그 수정 | `fix: 로그인 시 세션 만료 오류 수정` |
| `refactor` | 리팩토링 (기능 변경 없음) | `refactor: UserService 메서드 분리` |
| `docs` | 문서 변경 | `docs: API 문서 업데이트` |
| `test` | 테스트 추가/수정 | `test: 로그인 단위 테스트 추가` |
| `chore` | 빌드, 설정 변경 | `chore: ESLint 설정 업데이트` |
| `style` | 코드 포맷팅 (기능 변경 없음) | `style: 코드 들여쓰기 수정` |
| `perf` | 성능 개선 | `perf: 쿼리 인덱스 최적화` |
| `ci` | CI 설정 변경 | `ci: GitHub Actions 워크플로우 추가` |

## 커밋 메시지 예시

### 기본 형식
```
feat: 사용자 프로필 이미지 업로드 기능 추가
```

### Scope 포함
```
feat(auth): OAuth2 구글 로그인 지원
```

### Body 포함
```
fix(api): 사용자 목록 조회 시 N+1 문제 수정

기존 코드는 사용자별로 역할을 개별 조회하여 성능 저하 발생.
JOIN FETCH를 사용하여 단일 쿼리로 변경.

- UserRepository에 fetchWithRoles 메서드 추가
- 기존 findAll 대신 새 메서드 사용
```

### Breaking Change
```
refactor(api)!: 사용자 API 응답 형식 변경

BREAKING CHANGE: 응답의 `data` 필드가 `result`로 변경됨.
기존 클라이언트는 응답 파싱 로직 수정 필요.

Before: { "data": { ... } }
After:  { "result": { ... } }
```

### 이슈 참조
```
fix: 로그인 실패 시 에러 메시지 미표시 수정

Closes #123
```

## 커밋 전 체크리스트

```bash
# 1. 변경 파일 확인
git status

# 2. 변경 내용 확인
git diff              # unstaged
git diff --staged     # staged

# 3. 최근 커밋 스타일 확인
git log --oneline -5

# 4. 민감 정보 확인
git diff --staged | grep -E "(password|secret|api_key|token)"
```

## 커밋 분리 원칙

### 좋은 예
```bash
# 기능과 리팩토링 분리
git commit -m "refactor: UserService 의존성 주입 방식 변경"
git commit -m "feat: 사용자 프로필 조회 API 추가"
```

### 나쁜 예
```bash
# 여러 변경을 하나로 묶음 (X)
git commit -m "feat: 프로필 API 추가 및 UserService 리팩토링 및 로그 추가"
```

## Git Hook (pre-commit) 예시

### commitlint 설정 (commitlint.config.js)
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'style', 'perf', 'ci'],
    ],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
```

### Husky 설정
```bash
# 설치
npm install -D husky @commitlint/cli @commitlint/config-conventional

# Husky 초기화
npx husky install

# commit-msg hook 추가
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

## 금지 사항

- `git push --force` (main/master 브랜치)
- `git commit --amend` (이미 push된 커밋)
- `--no-verify` 플래그 (hook 우회)
- 민감 정보 커밋 (.env, credentials, API keys)

## AI 어시스턴트용 커밋 Skill

```markdown
# /commit skill 구현

1. `git status`로 변경 파일 목록 확인
2. `git diff --staged`로 staged 변경 내용 분석
3. `git log --oneline -3`으로 최근 커밋 스타일 확인
4. 변경 내용 기반으로 type 결정:
   - 새 기능 → feat
   - 버그 수정 → fix
   - 리팩토링 → refactor
5. 커밋 메시지 초안 생성
6. 사용자 확인 후 커밋 실행
```

---

**참고**: 팀 컨벤션이 있으면 이 규칙보다 팀 규칙 우선
