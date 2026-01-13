#!/bin/bash
# dual_review.sh - Claude + Gemini 동시 리뷰 (크로스체크용)
# 사용법:
#   ./dual_review.sh src/Service.java
#   ./dual_review.sh src/main.py security

FILE="$1"
FOCUS="${2:-general}"

if [ -z "$FILE" ]; then
    echo "Usage: ./dual_review.sh <파일> [focus:general|security|performance|logic|style]"
    exit 1
fi

if [ ! -f "$FILE" ]; then
    echo "Error: 파일을 찾을 수 없습니다: $FILE"
    exit 1
fi

LOG_DIR="logs/dual_review"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
FILE_NAME=$(basename "$FILE")
CLAUDE_LOG="$LOG_DIR/${TIMESTAMP}_claude_${FILE_NAME}.log"
GEMINI_LOG="$LOG_DIR/${TIMESTAMP}_gemini_${FILE_NAME}.log"
SUMMARY_LOG="$LOG_DIR/${TIMESTAMP}_summary_${FILE_NAME}.log"

FILE_CONTENT=$(cat "$FILE")

# Focus별 프롬프트
case "$FOCUS" in
    security) FOCUS_DESC="보안 취약점에 집중" ;;
    performance) FOCUS_DESC="성능 이슈에 집중" ;;
    logic) FOCUS_DESC="비즈니스 로직 정확성에 집중" ;;
    style) FOCUS_DESC="코드 스타일/가독성에 집중" ;;
    *) FOCUS_DESC="전반적인 코드 품질 리뷰" ;;
esac

REVIEW_PROMPT="[코드 리뷰 요청]
파일: $FILE
포커스: $FOCUS ($FOCUS_DESC)

--- 코드 ---
$FILE_CONTENT
--- 끝 ---

리뷰 형식:
1. 요약 (1-2문장)
2. 발견된 이슈 (심각도: HIGH/MEDIUM/LOW, 라인번호)
3. 개선 제안"

echo "=== 듀얼 리뷰 시작 ==="
echo "파일: $FILE"
echo "포커스: $FOCUS"
echo ""

# Claude 리뷰
echo "[1/2] Claude 리뷰 중..."
cat << EOF > "$CLAUDE_LOG"
=== Claude 코드 리뷰 ===
파일: $FILE
포커스: $FOCUS
시각: $(date "+%Y-%m-%d %H:%M:%S")
=== 리뷰 결과 ===
EOF
claude "$REVIEW_PROMPT" 2>&1 | tee -a "$CLAUDE_LOG"
echo "Claude 리뷰 완료: $CLAUDE_LOG"
CLAUDE_RESPONSE=$(cat "$CLAUDE_LOG")

# Gemini 리뷰
echo ""
echo "[2/2] Gemini 리뷰 중..."
cat << EOF > "$GEMINI_LOG"
=== Gemini 코드 리뷰 ===
파일: $FILE
포커스: $FOCUS
시각: $(date "+%Y-%m-%d %H:%M:%S")
=== 리뷰 결과 ===
EOF
gemini "$REVIEW_PROMPT" 2>&1 | tee -a "$GEMINI_LOG"
echo "Gemini 리뷰 완료: $GEMINI_LOG"
GEMINI_RESPONSE=$(cat "$GEMINI_LOG")

# 요약 생성
cat << EOF > "$SUMMARY_LOG"
=== 듀얼 리뷰 요약 ===
파일: $FILE
포커스: $FOCUS
시각: $(date "+%Y-%m-%d %H:%M:%S")

로그 파일:
- Claude: $CLAUDE_LOG
- Gemini: $GEMINI_LOG

=== Claude 리뷰 ===
$CLAUDE_RESPONSE

=== Gemini 리뷰 ===
$GEMINI_RESPONSE

=== 크로스체크 포인트 ===
- 양쪽이 동일하게 지적한 이슈 확인
- 한쪽만 발견한 이슈 검토
- 상충되는 의견 있으면 추가 분석 필요
EOF

echo ""
echo "=== 듀얼 리뷰 완료 ==="
echo "Claude 로그: $CLAUDE_LOG"
echo "Gemini 로그: $GEMINI_LOG"
echo "요약 로그: $SUMMARY_LOG"
