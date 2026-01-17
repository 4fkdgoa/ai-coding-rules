#!/bin/bash
# Wiki 검색 CLI 래퍼

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Node.js 스크립트 실행
node "$SCRIPT_DIR/search-wiki.js" "$@"
