#!/bin/bash
# run_ai.sh - Claude/Gemini CLI 통합 실행 스크립트
# 사용법:
#   ./run_ai.sh claude "질문"
#   ./run_ai.sh gemini "질문" task_name

AI="$1"
QUESTION="$2"
TASK_NAME="${3:-query}"

if [ -z "$AI" ] || [ -z "$QUESTION" ]; then
    echo "Usage: ./run_ai.sh <claude|gemini> \"질문\" [task_name]"
    exit 1
fi

if [ "$AI" != "claude" ] && [ "$AI" != "gemini" ]; then
    echo "Error: AI는 'claude' 또는 'gemini'만 가능합니다."
    exit 1
fi

LOG_DIR="logs/$AI"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
LOG_FILE="$LOG_DIR/${TIMESTAMP}_${TASK_NAME}.log"

AI_UPPER=$(echo "$AI" | tr '[:lower:]' '[:upper:]')

cat << EOF | tee "$LOG_FILE"
=== $AI_UPPER CLI 실행 ===
실행 시각: $(date "+%Y-%m-%d %H:%M:%S")
작업명: $TASK_NAME
실행 명령어: $AI "$QUESTION"
질문:
$QUESTION
=== 응답 ===
EOF

$AI "$QUESTION" 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "=== 종료 시각: $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG_FILE"

echo ""
echo "로그 저장됨: $LOG_FILE"
