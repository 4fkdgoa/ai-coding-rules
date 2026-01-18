#!/bin/bash
# run_claude.sh - Claude CLI 실행 및 로그 저장 (Git Bash / WSL / Linux)
# 사용법: ./run_claude.sh "질문 내용" [task_name] [model]
#         ./run_claude.sh "질문 내용" task_name opus-4
#         ./run_claude.sh "질문 내용" task_name sonnet

QUESTION="$1"
TASK_NAME="${2:-query}"
MODEL="${3:-opus-4}"  # 기본값: opus-4 (claude-opus-4-5)
LOG_DIR="logs/claude"

if [ -z "$QUESTION" ]; then
    echo "Usage: ./run_claude.sh \"질문\" [task_name] [model]"
    echo ""
    echo "Models:"
    echo "  opus-4    - Claude Opus 4.5 (default, most capable)"
    echo "  opus      - Claude Opus 4"
    echo "  sonnet    - Claude Sonnet 4.5"
    echo "  haiku     - Claude Haiku 3.5"
    exit 1
fi

# 모델 이름 변환
case "$MODEL" in
    opus-4|opus4|4.5)
        CLAUDE_MODEL="claude-opus-4-5"
        ;;
    opus)
        CLAUDE_MODEL="claude-opus-4"
        ;;
    sonnet|sonnet-4|4)
        CLAUDE_MODEL="claude-sonnet-4-5"
        ;;
    haiku)
        CLAUDE_MODEL="claude-haiku-3-5"
        ;;
    *)
        CLAUDE_MODEL="$MODEL"  # 직접 모델 ID 입력한 경우
        ;;
esac

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
모델: $CLAUDE_MODEL
실행 명령어: claude --model $CLAUDE_MODEL -p "$QUESTION"
질문:
$QUESTION
=== 응답 ===
EOF

# Claude 실행 (tee로 콘솔 + 파일 동시 출력)
claude --model "$CLAUDE_MODEL" -p "$QUESTION" 2>&1 | tee -a "$LOG_FILE"

# 종료 시각
echo "" | tee -a "$LOG_FILE"
echo "=== 종료 시각: $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG_FILE"

echo ""
echo "로그 저장됨: $LOG_FILE"
