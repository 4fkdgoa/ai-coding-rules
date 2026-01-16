#!/bin/bash
# cross_review.sh - Claude <-> Gemini 교차 리뷰
# 사용법:
#   ./cross_review.sh claude gemini "코드 리뷰해줘" src/file.java
#   ./cross_review.sh gemini claude "로직 검토해줘" src/main.py

set -euo pipefail  # Bash strict mode

FROM="$1"
TO="$2"
REQUEST="$3"
FILE="${4:-}"
LOG_RETENTION_DAYS=30

# 입력 검증
if [ -z "$FROM" ] || [ -z "$TO" ] || [ -z "$REQUEST" ]; then
    echo "Error: 필수 인자가 누락되었습니다."
    echo "Usage: ./cross_review.sh <from:claude|gemini> <to:claude|gemini> \"요청\" [파일]"
    exit 1
fi

# From/To 검증
FROM_LOWER=$(echo "$FROM" | tr '[:upper:]' '[:lower:]')
TO_LOWER=$(echo "$TO" | tr '[:upper:]' '[:lower:]')

if [ "$FROM_LOWER" != "claude" ] && [ "$FROM_LOWER" != "gemini" ]; then
    echo "Error: FROM은 'claude' 또는 'gemini'여야 합니다. (입력: $FROM)"
    exit 1
fi

if [ "$TO_LOWER" != "claude" ] && [ "$TO_LOWER" != "gemini" ]; then
    echo "Error: TO는 'claude' 또는 'gemini'여야 합니다. (입력: $TO)"
    exit 1
fi

if [ "$FROM_LOWER" = "$TO_LOWER" ]; then
    echo "Error: FROM과 TO가 같을 수 없습니다."
    exit 1
fi

LOG_DIR="logs/cross_review"
mkdir -p "$LOG_DIR"

# 오래된 로그 정리 (30일 이상)
find "$LOG_DIR" -name "*.log" -type f -mtime +${LOG_RETENTION_DAYS} -delete 2>/dev/null || true

# PID 포함 로그 파일명
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
PID=$$
LOG_FILE="$LOG_DIR/${TIMESTAMP}_${FROM_LOWER}_to_${TO_LOWER}_${PID}.log"

# 파일 경로 검증 및 내용 읽기
FILE_CONTENT=""
FILE_INFO=""

if [ -n "$FILE" ]; then
    # 경로 정규화 (realpath)
    if command -v realpath &> /dev/null; then
        FILE_REAL=$(realpath "$FILE" 2>/dev/null || echo "$FILE")
    else
        FILE_REAL="$FILE"
    fi

    # 파일 존재 확인
    if [ ! -e "$FILE_REAL" ]; then
        echo "Error: 파일을 찾을 수 없습니다: $FILE_REAL"
        exit 1
    fi

    # 디렉토리가 아닌지 확인
    if [ -d "$FILE_REAL" ]; then
        echo "Error: 디렉토리는 리뷰할 수 없습니다: $FILE_REAL"
        exit 1
    fi

    # 읽기 권한 확인
    if [ ! -r "$FILE_REAL" ]; then
        echo "Error: 파일을 읽을 수 없습니다 (권한 없음): $FILE_REAL"
        exit 1
    fi

    FILE_CONTENT=$(cat "$FILE_REAL")
    FILE_INFO="파일: $FILE_REAL
파일 내용:
$FILE_CONTENT"
else
    FILE_INFO="파일: (지정되지 않음)"
fi

FROM_UPPER=$(echo "$FROM" | tr '[:lower:]' '[:upper:]')
TO_UPPER=$(echo "$TO" | tr '[:lower:]' '[:upper:]')

# 프롬프트 구성
PROMPT="[교차 리뷰 요청]
요청자: $FROM_UPPER
수신자: $TO_UPPER
요청 시각: $(date '+%Y-%m-%d %H:%M:%S')

요청 내용:
$REQUEST

$FILE_INFO

---
위 내용을 검토하고 피드백을 제공해주세요."

# 헤더 기록
cat << EOF | tee "$LOG_FILE"
=== 교차 리뷰 요청 ===
From: $FROM_UPPER
To: $TO_UPPER
시각: $(date "+%Y-%m-%d %H:%M:%S")
파일: $FILE
요청:
$REQUEST
=== $TO_UPPER 응답 ===
EOF

# 대상 AI 호출
$TO "$PROMPT" 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "=== 리뷰 완료: $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG_FILE"

echo ""
echo "로그 저장됨: $LOG_FILE"
