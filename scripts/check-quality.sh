#!/bin/bash
# 리팩토링 점검 도구 - Shell Wrapper
#
# 목적:
#   Node.js 스크립트를 더 쉽게 실행하기 위한 래퍼
#
# 사용법:
#   ./check-quality.sh <project-path> [--output report.html]
#
# 예시:
#   ./check-quality.sh ~/AutoCRM_Samchully
#   ./check-quality.sh ~/AutoCRM_Samchully -o quality-report.html

# 스크립트 디렉토리 찾기
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/check-quality.js"

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "❌ 오류: Node.js가 설치되어 있지 않습니다."
    echo "설치 방법: https://nodejs.org/"
    exit 1
fi

# 스크립트 존재 확인
if [ ! -f "$NODE_SCRIPT" ]; then
    echo "❌ 오류: check-quality.js를 찾을 수 없습니다: $NODE_SCRIPT"
    exit 1
fi

# 모든 인자를 Node.js 스크립트로 전달
node "$NODE_SCRIPT" "$@"
