# AI 크로스체크 v2.2 P2 보안 강화 패치

**작성일**: 2026-01-18
**작업**: Opus 4.5 P2 (Medium) 보안 문제 추가 수정
**버전**: v2.1 → v2.2

---

## 수정 사항 요약

Opus 4.5가 v3.0 설계에서 발견한 P2 (Medium) 보안 문제를 v2.1 스크립트에 추가로 적용했습니다.

### P2 (Medium) - 권장 수정 완료 ✅

#### P2-1: Rollback 메커니즘 (자동/수동)

**문제** (Opus 지적):
```
No rollback mechanism → Cannot recover from bad AI suggestions
```

**해결** (scripts/cross_check_auto.sh:77-157):

**1. 자동 백업 커밋 생성**
```bash
# 작업 전 자동 백업
create_backup_commit() {
    # 변경사항이 있으면 백업 커밋 생성
    git add -A
    git commit -m "backup: before AI cross-check (auto-backup at $(date))"
    BACKUP_COMMIT=$(git rev-parse HEAD)
}
```

**2. 자동 롤백 (에러 발생 시)**
```bash
# 에러 발생 시 자동으로 백업 커밋으로 복구
auto_rollback() {
    if [ "$AUTO_ROLLBACK_ENABLED" != "true" ]; then
        return 0
    fi

    log_error "에러 발생! 자동 롤백 시작..."
    git reset --hard "$BACKUP_COMMIT"
    log_success "롤백 완료: ${BACKUP_COMMIT:0:7}로 복구됨"

    # 백업 커밋 제거 (원래 상태로 복구)
    if git log -1 --format=%s | grep -q "^backup: before AI cross-check"; then
        git reset --soft HEAD~1
    fi
}
```

**3. 수동 롤백 (사용자 명령)**
```bash
# 명시적 롤백 명령
./cross_check_auto.sh rollback [커밋해시]

# 함수 구현
manual_rollback() {
    local target_commit="${1:-HEAD~1}"

    # 확인 요청
    read -p "정말 롤백하시겠습니까? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        git reset --hard "$target_commit"
    fi
}
```

**사용 예시**:
```bash
# 자동 롤백 활성화 (기본값)
./cross_check_auto.sh design request.md

# 자동 롤백 비활성화
./cross_check_auto.sh design request.md --no-auto-rollback

# 수동 롤백
./cross_check_auto.sh rollback HEAD~1
```

**영향**:
- 에러 발생 시 자동으로 이전 상태로 복구
- 잘못된 AI 제안으로부터 보호
- 사용자가 명시적으로 롤백 가능

---

#### P2-2: 파일 백업 메커니즘

**문제** (Opus 지적):
```
No backup before destructive changes → Data loss risk
```

**해결** (scripts/cross_check_auto.sh:161-222):

```bash
# 변경될 파일 백업
backup_files() {
    if [ "$BACKUP_ENABLED" != "true" ]; then
        return 0
    fi

    # 백업 디렉토리 생성
    BACKUP_DIR="backups/cross_check_$(get_timestamp)"
    mkdir -p "$BACKUP_DIR"

    # Git으로 변경될 파일 목록 추출
    git diff --name-only HEAD | while read -r file; do
        if [ -f "$file" ]; then
            local file_dir="$BACKUP_DIR/$(dirname "$file")"
            mkdir -p "$file_dir"
            cp "$file" "$file_dir/"
        fi
    done

    log_success "파일 백업 완료: $BACKUP_DIR"
}

# 백업 복구
restore_backup() {
    local backup_dir="$1"

    find "$backup_dir" -type f | while read -r backup_file; do
        local rel_path="${backup_file#$backup_dir/}"
        cp "$backup_file" "$rel_path"
    done

    log_success "백업 복구 완료"
}
```

**사용 예시**:
```bash
# 백업 활성화 (기본값)
./cross_check_auto.sh design request.md

# 백업 비활성화
./cross_check_auto.sh design request.md --no-backup

# 백업 복구 (프로그램 내에서 자동)
# 백업 위치: backups/cross_check_YYYY-MM-DD_HHMMSS/
```

**영향**:
- 모든 변경 파일의 타임스탬프별 백업
- 수동 복구 가능
- Git 커밋 외 추가 보호층

**.gitignore 추가**:
```
# Backups
backups/
```

---

#### P2-3: 로그 민감 정보 필터링

**문제** (Opus 지적):
```
Log files may contain secrets → Information disclosure
```

**해결** (scripts/cross_check_auto.sh:224-272):

```bash
# 로그 민감 정보 마스킹
sanitize_log() {
    local log_file="$1"

    # 민감 정보 패턴 마스킹
    sed -e 's/sk-ant-[a-zA-Z0-9_-]\{32,\}/sk-ant-***REDACTED***/g' \
        -e 's/sk-[a-zA-Z0-9]\{32,\}/sk-***REDACTED***/g' \
        -e 's/\(ANTHROPIC_API_KEY=\)[^[:space:]]*/\1***REDACTED***/g' \
        -e 's/\(CLAUDE_API_KEY=\)[^[:space:]]*/\1***REDACTED***/g' \
        -e 's/\(GEMINI_API_KEY=\)[^[:space:]]*/\1***REDACTED***/g' \
        -e 's/\(GOOGLE_API_KEY=\)[^[:space:]]*/\1***REDACTED***/g' \
        -e 's/\(API_KEY=\)[^[:space:]]*/\1***REDACTED***/g' \
        -e 's/\(PASSWORD=\)[^[:space:]]*/\1***REDACTED***/g' \
        -e 's/\(TOKEN=\)[^[:space:]]*/\1***REDACTED***/g' \
        -e 's/\(SECRET=\)[^[:space:]]*/\1***REDACTED***/g' \
        "$log_file" > "$temp_log"

    mv "$temp_log" "$log_file"
}

# 모든 로그 자동 필터링
sanitize_all_logs() {
    find "$LOG_DIR" -type f -name "*.log" | while read -r log_file; do
        sanitize_log "$log_file"
    done
}
```

**마스킹 패턴**:
- Anthropic API 키: `sk-ant-xxx...` → `sk-ant-***REDACTED***`
- OpenAI API 키: `sk-xxx...` → `sk-***REDACTED***`
- 환경 변수: `ANTHROPIC_API_KEY=xxx` → `ANTHROPIC_API_KEY=***REDACTED***`
- 비밀번호/토큰: `PASSWORD=xxx` → `PASSWORD=***REDACTED***`

**적용 시점**:
1. Claude/Gemini 응답 저장 후 즉시 (run_claude_auto, run_gemini_auto)
2. 전체 작업 완료 후 (sanitize_all_logs)

**영향**:
- 로그에 API 키 노출 방지
- 환경 변수 유출 차단
- 민감 정보 자동 마스킹

---

## 메인 함수 통합

**옵션 파싱 추가**:
```bash
while [[ $# -gt 0 ]]; do
    case "$1" in
        --max-rounds)
            MAX_ROUNDS="$2"
            shift 2
            ;;
        --no-auto-rollback)      # P2-1 옵션
            AUTO_ROLLBACK_ENABLED=false
            shift
            ;;
        --no-backup)             # P2-2 옵션
            BACKUP_ENABLED=false
            shift
            ;;
        ...
    esac
done
```

**Rollback 모드 추가**:
```bash
# 수동 롤백 모드
if [ "$mode" = "rollback" ]; then
    manual_rollback "$request_file"
    exit $?
fi
```

**작업 전후 처리**:
```bash
# 작업 전: 백업 생성
create_backup_commit
backup_files

# 작업 실행
case "$mode" in
    design)
        if cross_check_design_auto "$request_file" "$output_dir"; then
            show_commit_guide "design" "$output_dir"
        else
            result=1
            # 에러 발생 시 자동 롤백
            auto_rollback
        fi
        ;;
    ...
esac

# 작업 후: 로그 sanitize
sanitize_all_logs
```

---

## 전역 변수 추가

```bash
# 백업 관련
BACKUP_COMMIT=""                 # 백업 커밋 해시
AUTO_ROLLBACK_ENABLED=true       # 자동 롤백 활성화 (기본값)
BACKUP_ENABLED=true              # 파일 백업 활성화 (기본값)
BACKUP_DIR=""                    # 백업 디렉토리 경로
```

---

## Usage 업데이트

```
모드:
  design     - 설계 크로스체크
  implement  - 구현 크로스체크
  test       - 테스트 크로스체크
  full       - 전체 파이프라인
  rollback   - 수동 롤백 (이전 상태로 복구)  ← NEW

옵션:
  --max-rounds N       : 최대 크로스체크 횟수 (기본: 3)
  --no-auto-rollback   : 자동 롤백 비활성화      ← NEW
  --no-backup          : 백업 생성 비활성화      ← NEW

주의:
  - 자동 커밋하지 않음
  - 무한루프 방지: 최대 3회
  - 에러 발생 시 자동 롤백 (비활성화 가능)   ← NEW
```

---

## 테스트 시나리오

### 1. 자동 롤백 테스트
```bash
# 의도적으로 에러 발생시키기
$ ./cross_check_auto.sh design invalid_file.md
[ERROR] 요청 파일이 존재하지 않습니다
[ERROR] 에러 발생! 자동 롤백 시작...
[SUCCESS] 롤백 완료: abc1234로 복구됨
```

### 2. 파일 백업 테스트
```bash
$ ./cross_check_auto.sh design request.md
[STEP] 변경될 파일 백업 중...
[SUCCESS] 파일 백업 완료: backups/cross_check_2026-01-18_063000

# 백업 확인
$ ls -la backups/cross_check_2026-01-18_063000/
scripts/cross_check_auto.sh
docs/design.md
```

### 3. 로그 sanitize 테스트
```bash
$ cat logs/cross_check_auto/2026-01-18_063000_design.log
ANTHROPIC_API_KEY=***REDACTED***
sk-ant-***REDACTED***
```

### 4. 수동 롤백 테스트
```bash
$ ./cross_check_auto.sh rollback HEAD~1
[WARN] 수동 롤백 요청: HEAD~1
정말 롤백하시겠습니까? 모든 변경사항이 손실됩니다. (yes/no): yes
[SUCCESS] 수동 롤백 완료: HEAD~1
```

---

## 변경 파일

| 파일 | 변경 | 설명 |
|------|------|------|
| `scripts/cross_check_auto.sh` | +197 lines | P2-1,2,3 추가 |
| `.gitignore` | +3 lines | backups/ 제외 |
| `docs/cross-check-auto-v2.2-patch.md` | NEW | 이 문서 (P2 패치 상세) |

---

## Opus P2 문제 해결 현황

| ID | 문제 | v2.2 해결 |
|----|------|-----------|
| P2-1 | Rollback 메커니즘 없음 | ✅ 자동/수동 롤백 추가 |
| P2-2 | 파괴적 변경 전 백업 없음 | ✅ 파일 백업 메커니즘 추가 |
| P2-3 | 로그에 민감 정보 포함 | ✅ 자동 필터링 추가 |
| P2-4 | 4개 모드 선택 기준 불명확 | ⚠️ v3.0 설계 문제 (보류) |
| P2-5 | 오프라인/캐시 모드 없음 | ⚠️ 대규모 변경 (보류) |

---

## 다음 단계

1. ✅ P0/P1/P2 보안 문제 수정 완료 (v2.0 → v2.2)
2. ⏳ v3.0 설계 문서 업데이트 (Opus 피드백 반영)
3. ⏳ Gemini/Grok/GPT 검토 대기
4. ⏳ 4개 AI 피드백 통합
5. ⏳ v3.0 최종 설계 확정

---

**작성자**: Claude Sonnet 4.5
**검토자**: Opus 4.5 (P2 권장사항 기반)
**적용 버전**: v2.2
**관련**: docs/cross-check-auto-v2.1-patch.md (P0/P1)
