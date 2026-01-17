#!/bin/bash
# 솔루션 비교 CLI 래퍼

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Node.js 스크립트 실행
node "$SCRIPT_DIR/compare-solutions.js" "$@"
