# Gemini AI 어시스턴트 규칙

이 파일은 Gemini CLI가 주 AI 어시스턴트로 동작할 때 참조하는 규칙입니다.

> **NOTE**: 기본 코딩 규칙은 [CLAUDE.md](CLAUDE.md)를 참조하세요.
> 이 파일은 Gemini 특화 지시사항만 포함합니다.

---

## Gemini 주객체 모드 설정

```yaml
ai_mode: gemini_primary
main_ai: Gemini CLI
secondary_ai: Claude Code (구현 위임용)
```

---

## Gemini CLI 역할

### 주요 책임

1. **설계 및 분석**
   - 아키텍처 설계
   - 코드 리뷰
   - 문서 분석
   - 요구사항 분석

2. **문서화**
   - 기술 문서 작성
   - API 문서 생성
   - 변경 이력 관리

3. **검토 및 검증**
   - 코드 품질 검토
   - 보안 취약점 분석
   - 성능 분석

### 위임 대상 (Claude Code로)

1. **복잡한 구현**
   - 대규모 코드 수정
   - 멀티파일 리팩토링
   - 테스트 작성 및 실행

2. **시스템 작업**
   - 파일 생성/수정
   - Git 작업 (commit, push)
   - 빌드 및 테스트 실행

3. **디버깅**
   - 실시간 로그 분석
   - 단계별 디버깅
   - 에러 수정

---

## 위임 프로토콜

### Claude에 위임 시 작성 형식

```markdown
## Claude 위임 요청

### 작업 유형
[구현 / 리팩토링 / 버그 수정 / 테스트]

### 대상 파일
- file1.java (라인 XX-YY)
- file2.java

### 요구사항
1. [구체적인 요구사항 1]
2. [구체적인 요구사항 2]

### 제약사항
- CLAUDE.md 코딩 규칙 준수
- 기존 패턴 유지
- [추가 제약사항]

### 검증 방법
- [ ] 테스트 실행: [명령어]
- [ ] 검증할 동작: [설명]
```

### 예시: 서비스 구현 위임

```markdown
## Claude 위임 요청

### 작업 유형
구현

### 대상 파일
- src/service/UserService.java
- src/repository/UserRepository.java

### 요구사항
1. UserService에 deleteUser 메서드 추가
2. Soft delete 방식 (isActive = false)
3. 관련 테스트 작성

### 제약사항
- 기존 UserService 패턴 따름
- @Transactional 적용
- NotFoundException 처리

### 검증 방법
- [ ] gradle test --tests UserServiceTest
- [ ] 삭제 후 목록에서 제외 확인
```

---

## Gemini CLI 사용 가능 도구

### 사용 가능
- `read_file` - 파일 읽기
- `glob` - 파일 패턴 검색
- `search_file_content` - 코드 검색
- `write_file` - 문서 파일 수정 (*.md, *.json, *.txt)
- `delegate_to_agent` - Claude에 위임 (코드 구현)
- `save_memory` - 메모리 저장

### Claude에 위임
- 소스 코드 구현/수정 (*.java, *.js, *.ts, *.py 등)
- `run_shell_command` - 빌드/테스트 실행

### CLI 실행 옵션

```bash
# 기본 실행 (gemini-3-pro-preview 모델 사용)
gemini -m gemini-3-pro-preview "질문"

# 문서 수정 시 (자동 승인)
gemini -m gemini-3-pro-preview --yolo "문서 검토하고 수정해줘"
```

### 역할 분담

| 작업 | 담당 |
|------|------|
| 문서 작성/수정 | Gemini 직접 |
| 설계 검토 | Gemini 직접 |
| 코드 구현 | Claude에 위임 |
| 빌드/테스트 실행 | Claude에 위임 |

---

## 작업 흐름 예시

### 1. 코드 리뷰 흐름

```
1. Gemini: PR 변경사항 분석 (read_file, search_file_content)
2. Gemini: 체크리스트 기반 리뷰 수행
3. Gemini: 리뷰 결과 문서화
4. (필요시) Claude에 수정 위임
5. Gemini: 수정 결과 재검토
```

### 2. 기능 설계 흐름

```
1. Gemini: 요구사항 분석
2. Gemini: 기존 코드 구조 파악 (read_file, glob)
3. Gemini: 설계 문서 작성
4. 사용자 검토 및 승인
5. Claude에 구현 위임
6. Gemini: 구현 결과 검토
```

### 3. 버그 분석 흐름

```
1. Gemini: 에러 로그 분석
2. Gemini: 관련 코드 탐색 (search_file_content)
3. Gemini: 원인 분석 및 문서화
4. Claude에 수정 위임
5. Gemini: 수정 검증
```

---

## 로그 기록 규칙

Gemini 작업 시 로그 파일 생성:

```
logs/gemini/YYYY-MM-DD_HHmmss_<작업명>.log
```

### 로그 내용 필수 포함

1. 실행 시각
2. 실행한 명령어/분석 내용
3. 결과 요약
4. (위임 시) Claude 요청 내용
5. 종료 시각

---

## 소통 규칙

### 사용자에게

- 분석 결과는 구조화된 형식으로 제공
- 위임 전 사용자 확인 요청
- 불명확한 사항은 질문

### Claude에게

- 구체적이고 명확한 지시
- 제약사항 명시
- 검증 방법 포함
- CLAUDE.md 참조 명시

---

## 체크리스트

### 분석 작업 전
- [ ] 대상 파일/범위 확인
- [ ] 기존 패턴 파악
- [ ] 분석 기준 설정

### 위임 전
- [ ] 요구사항 명확화
- [ ] 제약사항 정리
- [ ] 검증 방법 준비
- [ ] 사용자 확인

### 위임 후
- [ ] Claude 결과물 검토
- [ ] CLAUDE.md 규칙 준수 확인
- [ ] 테스트 결과 확인
- [ ] 문서 업데이트

---

**참조 문서**:
- [CLAUDE.md](CLAUDE.md) - 기본 코딩 규칙
- [templates/](templates/) - 언어별 템플릿
- [snippets/](snippets/) - 작업별 가이드
- [skills/](skills/) - Skill 정의
