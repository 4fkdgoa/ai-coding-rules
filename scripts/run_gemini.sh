#!/bin/bash
# run_gemini.sh - Gemini CLI 실행 및 로그 저장 (Git Bash / WSL / Linux)
# 사용법: ./run_gemini.sh "질문 내용"
#         ./run_gemini.sh "질문 내용" task_name
#         ./run_gemini.sh "질문 내용" task_name --yolo

set -euo pipefail  # Bash strict mode

QUESTION="$1"
TASK_NAME="${2:-query}"
YOLO_FLAG="${3:-}"
LOG_DIR="logs/gemini"
MODEL="gemini-3-pro-preview"  # GEMINI.md 참조
TIMEOUT=300  # 5분 타임아웃
LOG_RETENTION_DAYS=30

# 입력 검증
if [ -z "$QUESTION" ]; then
    echo "Error: 질문 내용이 필요합니다."
    echo "Usage: ./run_gemini.sh \"질문\" [task_name] [--yolo]"
    exit 1
fi

# gemini CLI 존재 확인
if ! command -v gemini &> /dev/null; then
    echo "Error: gemini CLI를 찾을 수 없습니다."
    echo "설치 방법: npm install -g @google/generative-ai-cli"
    exit 1
fi

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 오래된 로그 정리 (30일 이상)
find "$LOG_DIR" -name "*.log" -type f -mtime +${LOG_RETENTION_DAYS} -delete 2>/dev/null || true

# 타임스탬프 + PID로 로그 파일명 생성
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
PID=$$
LOG_FILE="$LOG_DIR/${TIMESTAMP}_${TASK_NAME}_${PID}.log"

# 명령어 구성
GEMINI_CMD="gemini -m $MODEL"
if [ "$YOLO_FLAG" = "--yolo" ]; then
    GEMINI_CMD="$GEMINI_CMD --yolo"
fi

# 헤더 기록
cat << EOF | tee "$LOG_FILE"
=== Gemini CLI 실행 ===
실행 시각: $(date "+%Y-%m-%d %H:%M:%S")
작업명: $TASK_NAME
모델: $MODEL
실행 명령어: $GEMINI_CMD "$QUESTION"
질문:
$QUESTION
=== 응답 ===
EOF

# Gemini 실행 (timeout + tee로 콘솔 + 파일 동시 출력)
if ! timeout ${TIMEOUT}s $GEMINI_CMD "$QUESTION" 2>&1 | tee -a "$LOG_FILE"; then
    EXIT_CODE=${PIPESTATUS[0]}
    if [ $EXIT_CODE -eq 124 ]; then
        echo "" | tee -a "$LOG_FILE"
        echo "Error: Timeout (${TIMEOUT}초 초과)" | tee -a "$LOG_FILE"
    fi
    echo "=== 종료 시각: $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG_FILE"
    echo "로그 저장됨: $LOG_FILE"
    exit $EXIT_CODE
fi

# 종료 시각
echo "" | tee -a "$LOG_FILE"
echo "=== 종료 시각: $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG_FILE"

echo ""
echo "로그 저장됨: $LOG_FILE"
