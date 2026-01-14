# DB Analyzer 비대화형 모드 설계

## 문제점

현재 db_analyzer는 DB 설정이 불완전할 때 `readline`으로 대화형 입력을 요청합니다.
이 방식은 **AI 사용자(Claude Code, Gemini CLI 등)에서 작동하지 않습니다** - stdin 입력이 불가능하기 때문.

```
[INFO] DB 설정이 불완전합니다.
DB 타입 (mysql/oracle/mssql/postgresql): <-- 여기서 막힘
```

## 제안하는 해결책

### 1. `--non-interactive` 옵션 추가

설정이 불완전해도 프롬프트 없이 진행:
- 누락된 정보를 JSON으로 출력
- 템플릿 파일 생성
- 비정상 종료 코드 반환 (사용자 개입 필요 표시)

### 2. 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: db_analyzer --non-interactive --extract-from <path>    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  설정 완전?                    │
              └───────────────────────────────┘
                     │              │
                    Yes            No
                     │              │
                     ▼              ▼
              ┌──────────┐  ┌──────────────────────────────────┐
              │ DB 분석   │  │ 1. 누락 정보 JSON 출력            │
              │ 실행      │  │ 2. 템플릿 파일 생성               │
              └──────────┘  │    → .ai-analyzer-template.json  │
                            │ 3. exit code 2 반환              │
                            └──────────────────────────────────┘
                                           │
                                           ▼
              ┌─────────────────────────────────────────────────┐
              │  Step 2: 사용자/AI가 템플릿 작성                  │
              │  → .ai-analyzer.json 으로 저장                   │
              └─────────────────────────────────────────────────┘
                                           │
                                           ▼
              ┌─────────────────────────────────────────────────┐
              │  Step 3: db_analyzer --config .ai-analyzer.json  │
              └─────────────────────────────────────────────────┘
```

### 3. 출력 형식

**설정 불완전 시 stdout (JSON)**:
```json
{
  "status": "incomplete",
  "detected": {
    "type": "mssql",
    "database": null,
    "host": null,
    "port": null,
    "user": null,
    "extracted_from": "application.yml"
  },
  "missing": ["host", "port", "database", "user", "password"],
  "template_path": ".ai-analyzer-template.json",
  "next_step": "템플릿 파일을 작성 후 --config 옵션으로 다시 실행하세요"
}
```

**생성되는 템플릿 파일 (.ai-analyzer-template.json)**:
```json
{
  "$schema": "템플릿 파일입니다. 값을 채운 후 .ai-analyzer.json으로 저장하세요",
  "db": {
    "type": "mssql",
    "host": "<DB 서버 주소>",
    "port": 1433,
    "database": "<데이터베이스명>",
    "user": "<사용자명>",
    "password": "<비밀번호 또는 환경변수 ${DB_PASSWORD}>"
  },
  "options": {
    "limit": 100,
    "schema": null
  },
  "common_code_detection": {
    "table_patterns": ["TB_CODE", "COMMON_CODE", "CMM_CD"],
    "required_columns": null,
    "use_column_heuristic": false
  }
}
```

### 4. Exit Code 정의

| Code | 의미 | 설명 |
|------|------|------|
| 0 | 성공 | DB 분석 완료 |
| 1 | 에러 | 연결 실패, 쿼리 오류 등 |
| 2 | 설정 필요 | 사용자 입력 필요 (템플릿 생성됨) |

### 5. Shell Script 연동 (analyze_project.sh)

```bash
# analyze_project.sh 내부
analyze_db_schema() {
    # Step 1: 비대화형으로 시도
    node "$db_analyzer_dir/index.js" --non-interactive --extract-from "$project_path" --output "$output_file"
    local exit_code=$?

    if [ $exit_code -eq 2 ]; then
        # 설정 불완전 - 템플릿 생성됨
        log_warn "DB 설정이 불완전합니다."
        log_info "생성된 템플릿: .ai-analyzer-template.json"
        log_info "템플릿을 작성하여 .ai-analyzer.json으로 저장 후 다시 실행하세요."
        log_info "또는 --db-config 옵션으로 설정 파일을 직접 지정하세요."
        return 2
    elif [ $exit_code -eq 0 ]; then
        log_success "DB 스키마 분석 완료"
        return 0
    else
        log_error "DB 분석 실패"
        return 1
    fi
}
```

### 6. AI 사용자 워크플로우 예시

**Claude Code에서의 흐름**:

1. 사용자: "AutoCRM 프로젝트 DB 분석해줘"

2. Claude: analyze_project.sh 실행
   ```bash
   ./analyze_project.sh /path/to/autocrm scan --with-db
   ```

3. 결과: exit code 2, 템플릿 생성됨
   ```
   [WARN] DB 설정이 불완전합니다.
   [INFO] 생성된 템플릿: .ai-analyzer-template.json
   ```

4. Claude: 템플릿 읽고 사용자에게 질문
   ```
   DB 연결 정보가 필요합니다:
   - Host: ?
   - Port: 1433 (기본값)
   - Database: ?
   - User: ?
   - Password: ?
   ```

5. 사용자: "localhost, autocrm_db, sa, mypassword"

6. Claude: 설정 파일 생성
   ```javascript
   // .ai-analyzer.json 작성
   ```

7. Claude: 다시 실행
   ```bash
   ./analyze_project.sh /path/to/autocrm scan --db-config .ai-analyzer.json
   ```

## 장점

1. **AI 호환성**: stdin 의존 없이 파일 기반으로 정보 교환
2. **재사용성**: 템플릿 저장하면 다음 분석 시 재사용
3. **명확한 워크플로우**: exit code로 상태 구분
4. **점진적 진행**: 감지된 정보는 유지, 누락된 것만 요청

## 검토 요청 사항

1. 이 접근 방식이 적절한가?
2. 템플릿 파일 구조가 충분한가?
3. Exit code 외에 다른 상태 전달 방법이 필요한가?
4. 보안상 비밀번호를 파일에 저장하는 것의 대안은?

---
작성자: Claude
작성일: 2026-01-14
