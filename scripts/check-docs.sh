#!/bin/bash
# 문서 크기 검사
# Anthropic 공식 가이드라인 기반: 1,000줄(20K 토큰) 제한

echo "📏 문서 크기 검사 (Anthropic 공식 기준)"
echo "=================================================="
echo ""

# 색상 코드
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

total_files=0
safe_files=0
warning_files=0
critical_files=0

# docs 폴더 검사
if [ -d "docs" ]; then
    echo "📂 docs/ 폴더:"
    find docs -name "*.md" | sort | while read file; do
        lines=$(wc -l < "$file")
        total_files=$((total_files + 1))

        if [ $lines -gt 1000 ]; then
            echo -e "${RED}❌ $file: $lines lines (MUST SPLIT - 즉시 분리 필요)${NC}"
            critical_files=$((critical_files + 1))
        elif [ $lines -gt 500 ]; then
            echo -e "${YELLOW}⚠️  $file: $lines lines (CONSIDER SPLIT - 분리 검토)${NC}"
            warning_files=$((warning_files + 1))
        else
            echo -e "${GREEN}✅ $file: $lines lines${NC}"
            safe_files=$((safe_files + 1))
        fi
    done
    echo ""
fi

# CLAUDE.md 검사 (가장 중요)
echo "📋 CLAUDE.md 검사 (필수):"
if [ -f "CLAUDE.md" ]; then
    claude_lines=$(wc -l < "CLAUDE.md")
    if [ $claude_lines -gt 1000 ]; then
        echo -e "${RED}❌ CLAUDE.md: $claude_lines lines (CRITICAL - 1,000줄 초과!)${NC}"
        echo -e "${RED}   → 즉시 수정 필요: 20K 토큰 초과 시 성능 저하${NC}"
        echo -e "${RED}   → 상세 내용은 docs/design/*.md로 분리하세요${NC}"
    elif [ $claude_lines -gt 800 ]; then
        echo -e "${YELLOW}⚠️  CLAUDE.md: $claude_lines lines (WARNING - 주의)${NC}"
        echo -e "${YELLOW}   → 1,000줄 근접, 분리 준비 권장${NC}"
    else
        echo -e "${GREEN}✅ CLAUDE.md: $claude_lines lines${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  CLAUDE.md not found${NC}"
fi
echo ""

# README.md 검사
echo "📖 README.md 검사:"
if [ -f "README.md" ]; then
    readme_lines=$(wc -l < "README.md")
    if [ $readme_lines -gt 500 ]; then
        echo -e "${YELLOW}⚠️  README.md: $readme_lines lines (권장: 500줄 이하)${NC}"
    else
        echo -e "${GREEN}✅ README.md: $readme_lines lines${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  README.md not found${NC}"
fi
echo ""

# 요약
echo "=================================================="
echo "📊 요약"
echo "=================================================="
echo "기준: Anthropic 공식 (20K 토큰 ≈ 1,000줄)"
echo ""

# CLAUDE.md 상태
if [ -f "CLAUDE.md" ]; then
    claude_lines=$(wc -l < "CLAUDE.md")
    if [ $claude_lines -gt 1000 ]; then
        echo -e "${RED}🚨 CLAUDE.md: CRITICAL (${claude_lines} lines)${NC}"
    elif [ $claude_lines -gt 800 ]; then
        echo -e "${YELLOW}⚠️  CLAUDE.md: WARNING (${claude_lines} lines)${NC}"
    else
        echo -e "${GREEN}✅ CLAUDE.md: OK (${claude_lines} lines)${NC}"
    fi
fi

echo ""
echo "출처:"
echo "  - https://mcpcat.io/guides/managing-claude-code-context/"
echo "  - https://claudelog.com/claude-code-limits/"
echo ""
echo "상세 가이드: DOCUMENTATION_GUIDE.md 참고"
