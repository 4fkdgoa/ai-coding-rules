#!/bin/bash
# cross_review.sh - Claude <-> Gemini 교차 리뷰
# 사용법:
#   ./cross_review.sh claude gemini "코드 리뷰해줘" src/file.java
#   ./cross_review.sh gemini claude "로직 검토해줘" src/main.py

FROM="$1"
TO="$2"
REQUEST="$3"
FILE="$4"

if [ -z "$FROM" ] || [ -z "$TO" ] || [ -z "$REQUEST" ]; then
    echo "Usage: ./cross_review.sh <from:claude|gemini> <to:claude|gemini> \"요청\" [파일]"
    exit 1
fi

if [ "$FROM" == "$TO" ]; then
    echo "Error: From과 To가 같을 수 없습니다."
    exit 1
fi

LOG_DIR="logs/cross_review"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
LOG_FILE="$LOG_DIR/${TIMESTAMP}_${FROM}_to_${TO}.log"

# 파일 내용 읽기 (있으면)
FILE_CONTENT=""
if [ -n "$FILE" ] && [ -f "$FILE" ]; then
    FILE_CONTENT=$(cat "$FILE")
    FILE_INFO="파일: $FILE
파일 내용:
$FILE_CONTENT"
elif [ -n "$FILE" ]; then
    FILE_INFO="파일: $FILE (파일을 찾을 수 없음)"
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
