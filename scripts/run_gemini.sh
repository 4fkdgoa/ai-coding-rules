#!/bin/bash
# run_gemini.sh - Gemini CLI 실행 및 로그 저장 (Git Bash / WSL / Linux)
# 사용법: ./run_gemini.sh "질문 내용" [task_name] [model] [--yolo]
#         ./run_gemini.sh "질문 내용" task_name gemini-3-pro
#         ./run_gemini.sh "질문 내용" task_name default --yolo

QUESTION="$1"
TASK_NAME="${2:-query}"
MODEL_INPUT="${3:-gemini-3-pro-preview}"  # 기본값: gemini-3-pro-preview
YOLO_FLAG="${4:-}"
LOG_DIR="logs/gemini"

if [ -z "$QUESTION" ]; then
    echo "Usage: ./run_gemini.sh \"질문\" [task_name] [model] [--yolo]"
    echo ""
    echo "Models:"
    echo "  gemini-3-pro-preview  - Gemini 3 Pro Preview (default, experimental)"
    echo "  gemini-2-flash        - Gemini 2 Flash (fast)"
    echo "  gemini-2-pro          - Gemini 2 Pro (balanced)"
    echo "  gemini-1.5-pro        - Gemini 1.5 Pro (stable)"
    exit 1
fi

# 모델 이름 변환 (별칭 지원)
case "$MODEL_INPUT" in
    3-pro|3pro|preview|default)
        MODEL="gemini-3-pro-preview"
        ;;
    2-flash|flash)
        MODEL="gemini-2-flash"
        ;;
    2-pro|2pro)
        MODEL="gemini-2-pro"
        ;;
    1.5|1.5-pro|stable)
        MODEL="gemini-1.5-pro"
        ;;
    *)
        MODEL="$MODEL_INPUT"  # 직접 모델 ID 입력한 경우
        ;;
esac

# --yolo가 세 번째 인자인 경우 처리 (하위 호환성)
if [ "$MODEL_INPUT" = "--yolo" ]; then
    MODEL="gemini-3-pro-preview"
    YOLO_FLAG="--yolo"
fi

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 타임스탬프
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
LOG_FILE="$LOG_DIR/${TIMESTAMP}_${TASK_NAME}.log"

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

# Gemini 실행 (tee로 콘솔 + 파일 동시 출력)
$GEMINI_CMD "$QUESTION" 2>&1 | tee -a "$LOG_FILE"

# 종료 시각
echo "" | tee -a "$LOG_FILE"
echo "=== 종료 시각: $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG_FILE"

echo ""
echo "로그 저장됨: $LOG_FILE"
