#!/bin/bash
# run_claude.sh - Claude CLI 실행 및 로그 저장 (Git Bash / WSL / Linux)
# 사용법: ./run_claude.sh "질문 내용"
#         ./run_claude.sh "질문 내용" task_name

QUESTION="$1"
TASK_NAME="${2:-query}"
LOG_DIR="logs/claude"

if [ -z "$QUESTION" ]; then
    echo "Usage: ./run_claude.sh \"질문\" [task_name]"
    exit 1
fi

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 타임스탬프
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
LOG_FILE="$LOG_DIR/${TIMESTAMP}_${TASK_NAME}.log"

# 헤더 기록
cat << EOF | tee "$LOG_FILE"
=== Claude CLI 실행 ===
실행 시각: $(date "+%Y-%m-%d %H:%M:%S")
작업명: $TASK_NAME
실행 명령어: claude "$QUESTION"
질문:
$QUESTION
=== 응답 ===
EOF

# Claude 실행 (tee로 콘솔 + 파일 동시 출력)
claude "$QUESTION" 2>&1 | tee -a "$LOG_FILE"

# 종료 시각
echo "" | tee -a "$LOG_FILE"
echo "=== 종료 시각: $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG_FILE"

echo ""
echo "로그 저장됨: $LOG_FILE"
