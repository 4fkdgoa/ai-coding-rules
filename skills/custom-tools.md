# 커스텀 도구 및 자동화 예시

## 개요

AI 어시스턴트와 함께 사용할 수 있는 커스텀 도구들입니다.
프로젝트에 맞게 수정하여 사용하세요.

---

## 1. 로그 분석 도구

### log-analyzer.py

```python
#!/usr/bin/env python3
"""
로그 파일 분석 도구
- 에러 추출
- 패턴 분석
- 통계 생성
"""
import argparse
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path


def parse_log_line(line: str) -> dict | None:
    """로그 라인 파싱 (ISO 형식 가정)"""
    pattern = r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)'
    match = re.match(pattern, line)
    if match:
        return {
            'timestamp': match.group(1),
            'level': match.group(2),
            'message': match.group(3)
        }
    return None


def analyze_errors(log_path: str, limit: int = 10) -> dict:
    """에러 로그 분석"""
    errors = []
    error_patterns = Counter()

    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            parsed = parse_log_line(line)
            if parsed and parsed['level'] == 'ERROR':
                errors.append(parsed)
                # 에러 메시지 패턴 추출 (숫자/UUID 제거)
                pattern = re.sub(r'\b\d+\b', 'N', parsed['message'])
                pattern = re.sub(r'[a-f0-9-]{36}', 'UUID', pattern)
                error_patterns[pattern] += 1

    return {
        'total_errors': len(errors),
        'recent_errors': errors[-limit:],
        'top_patterns': error_patterns.most_common(5)
    }


def generate_report(analysis: dict) -> str:
    """분석 결과 리포트 생성"""
    report = []
    report.append(f"## 로그 분석 리포트")
    report.append(f"")
    report.append(f"### 에러 통계")
    report.append(f"- 총 에러 수: {analysis['total_errors']}")
    report.append(f"")
    report.append(f"### 자주 발생하는 에러 패턴")
    for pattern, count in analysis['top_patterns']:
        report.append(f"- ({count}회) {pattern[:80]}...")
    report.append(f"")
    report.append(f"### 최근 에러")
    for err in analysis['recent_errors']:
        report.append(f"- [{err['timestamp']}] {err['message'][:100]}")

    return '\n'.join(report)


def main():
    parser = argparse.ArgumentParser(description='로그 분석 도구')
    parser.add_argument('log_file', help='분석할 로그 파일')
    parser.add_argument('--limit', type=int, default=10, help='표시할 최근 에러 수')
    parser.add_argument('--json', action='store_true', help='JSON 출력')
    args = parser.parse_args()

    analysis = analyze_errors(args.log_file, args.limit)

    if args.json:
        print(json.dumps(analysis, indent=2, ensure_ascii=False))
    else:
        print(generate_report(analysis))


if __name__ == '__main__':
    main()
```

**사용법**:
```bash
python log-analyzer.py server.log
python log-analyzer.py server.log --limit 20 --json
```

---

## 2. API 테스트 도구

### api-tester.py

```python
#!/usr/bin/env python3
"""
API 테스트 도구
- JSON 시나리오 기반 테스트
- 응답 검증
- 성능 측정
"""
import argparse
import json
import time
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class TestResult:
    name: str
    success: bool
    status_code: int
    response_time_ms: float
    error: str | None = None


def run_test(client: httpx.Client, test: dict) -> TestResult:
    """단일 테스트 실행"""
    name = test.get('name', 'Unnamed')
    method = test.get('method', 'GET')
    path = test.get('path', '/')
    headers = test.get('headers', {})
    body = test.get('body')
    expected_status = test.get('expected_status', 200)
    expected_fields = test.get('expected_fields', [])

    start = time.perf_counter()
    try:
        response = client.request(
            method=method,
            url=path,
            headers=headers,
            json=body if body else None,
            timeout=30.0
        )
        elapsed = (time.perf_counter() - start) * 1000

        # 상태 코드 검증
        if response.status_code != expected_status:
            return TestResult(
                name=name,
                success=False,
                status_code=response.status_code,
                response_time_ms=elapsed,
                error=f"Expected {expected_status}, got {response.status_code}"
            )

        # 필드 검증
        if expected_fields and response.headers.get('content-type', '').startswith('application/json'):
            data = response.json()
            for field in expected_fields:
                if field not in data:
                    return TestResult(
                        name=name,
                        success=False,
                        status_code=response.status_code,
                        response_time_ms=elapsed,
                        error=f"Missing field: {field}"
                    )

        return TestResult(
            name=name,
            success=True,
            status_code=response.status_code,
            response_time_ms=elapsed
        )

    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        return TestResult(
            name=name,
            success=False,
            status_code=0,
            response_time_ms=elapsed,
            error=str(e)
        )


def run_scenario(base_url: str, scenario_file: str) -> list[TestResult]:
    """시나리오 파일 실행"""
    with open(scenario_file, 'r', encoding='utf-8') as f:
        scenario = json.load(f)

    results = []
    with httpx.Client(base_url=base_url) as client:
        for test in scenario.get('tests', []):
            result = run_test(client, test)
            results.append(result)
            status = "PASS" if result.success else "FAIL"
            print(f"[{status}] {result.name} ({result.response_time_ms:.1f}ms)")
            if result.error:
                print(f"       Error: {result.error}")

    return results


def print_summary(results: list[TestResult]):
    """테스트 결과 요약"""
    total = len(results)
    passed = sum(1 for r in results if r.success)
    failed = total - passed
    avg_time = sum(r.response_time_ms for r in results) / total if total > 0 else 0

    print(f"\n{'='*50}")
    print(f"테스트 결과: {passed}/{total} 성공")
    print(f"평균 응답 시간: {avg_time:.1f}ms")
    if failed > 0:
        print(f"\n실패한 테스트:")
        for r in results:
            if not r.success:
                print(f"  - {r.name}: {r.error}")


def main():
    parser = argparse.ArgumentParser(description='API 테스트 도구')
    parser.add_argument('scenario', help='테스트 시나리오 JSON 파일')
    parser.add_argument('--base-url', default='http://localhost:8080', help='Base URL')
    args = parser.parse_args()

    print(f"테스트 시작: {args.scenario}")
    print(f"Base URL: {args.base_url}")
    print('='*50)

    results = run_scenario(args.base_url, args.scenario)
    print_summary(results)


if __name__ == '__main__':
    main()
```

**시나리오 파일 예시** (`test_users.json`):
```json
{
  "name": "User API Tests",
  "tests": [
    {
      "name": "List users",
      "method": "GET",
      "path": "/api/users",
      "expected_status": 200,
      "expected_fields": ["data", "total"]
    },
    {
      "name": "Create user",
      "method": "POST",
      "path": "/api/users",
      "headers": {"Content-Type": "application/json"},
      "body": {"name": "Test", "email": "test@example.com"},
      "expected_status": 201,
      "expected_fields": ["id", "name", "email"]
    },
    {
      "name": "Get non-existent user",
      "method": "GET",
      "path": "/api/users/99999",
      "expected_status": 404
    }
  ]
}
```

**사용법**:
```bash
python api-tester.py test_users.json --base-url http://localhost:8080
```

---

## 3. 데이터베이스 스키마 문서화

### db-documenter.py

```python
#!/usr/bin/env python3
"""
DB 스키마 문서화 도구
- 테이블 구조 추출
- ERD 정보 생성
- Markdown 문서 출력
"""
import argparse
from dataclasses import dataclass


@dataclass
class Column:
    name: str
    data_type: str
    nullable: bool
    primary_key: bool
    foreign_key: str | None
    comment: str | None


@dataclass
class Table:
    name: str
    columns: list[Column]
    comment: str | None


def get_tables_mysql(cursor) -> list[Table]:
    """MySQL 스키마 추출"""
    cursor.execute("SHOW TABLES")
    table_names = [row[0] for row in cursor.fetchall()]

    tables = []
    for table_name in table_names:
        cursor.execute(f"DESCRIBE `{table_name}`")
        columns = []
        for row in cursor.fetchall():
            columns.append(Column(
                name=row[0],
                data_type=row[1],
                nullable=row[2] == 'YES',
                primary_key=row[3] == 'PRI',
                foreign_key=None,  # 별도 쿼리 필요
                comment=None
            ))
        tables.append(Table(name=table_name, columns=columns, comment=None))

    return tables


def get_tables_postgresql(cursor) -> list[Table]:
    """PostgreSQL 스키마 추출"""
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    table_names = [row[0] for row in cursor.fetchall()]

    tables = []
    for table_name in table_names:
        cursor.execute(f"""
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name = '{table_name}'
                    AND tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_name = '{table_name}'
            ORDER BY c.ordinal_position
        """)
        columns = []
        for row in cursor.fetchall():
            columns.append(Column(
                name=row[0],
                data_type=row[1],
                nullable=row[2] == 'YES',
                primary_key=row[3],
                foreign_key=None,
                comment=None
            ))
        tables.append(Table(name=table_name, columns=columns, comment=None))

    return tables


def generate_markdown(tables: list[Table]) -> str:
    """Markdown 문서 생성"""
    lines = []
    lines.append("# 데이터베이스 스키마")
    lines.append("")
    lines.append("## 테이블 목록")
    lines.append("")
    for table in tables:
        lines.append(f"- [{table.name}](#{table.name})")
    lines.append("")

    for table in tables:
        lines.append(f"## {table.name}")
        if table.comment:
            lines.append(f"")
            lines.append(f"{table.comment}")
        lines.append("")
        lines.append("| 컬럼명 | 타입 | Nullable | PK | 설명 |")
        lines.append("|--------|------|----------|----|----|")
        for col in table.columns:
            nullable = "O" if col.nullable else "X"
            pk = "O" if col.primary_key else ""
            comment = col.comment or ""
            lines.append(f"| {col.name} | {col.data_type} | {nullable} | {pk} | {comment} |")
        lines.append("")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='DB 스키마 문서화 도구')
    parser.add_argument('--db-type', choices=['mysql', 'postgresql'], required=True)
    parser.add_argument('--host', default='localhost')
    parser.add_argument('--port', type=int)
    parser.add_argument('--database', required=True)
    parser.add_argument('--user', required=True)
    parser.add_argument('--password', required=True)
    parser.add_argument('--output', default='schema.md')
    args = parser.parse_args()

    if args.db_type == 'mysql':
        import mysql.connector
        port = args.port or 3306
        conn = mysql.connector.connect(
            host=args.host, port=port,
            database=args.database,
            user=args.user, password=args.password
        )
        cursor = conn.cursor()
        tables = get_tables_mysql(cursor)
    else:
        import psycopg2
        port = args.port or 5432
        conn = psycopg2.connect(
            host=args.host, port=port,
            dbname=args.database,
            user=args.user, password=args.password
        )
        cursor = conn.cursor()
        tables = get_tables_postgresql(cursor)

    markdown = generate_markdown(tables)

    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(markdown)

    print(f"스키마 문서 생성 완료: {args.output}")
    print(f"테이블 수: {len(tables)}")

    cursor.close()
    conn.close()


if __name__ == '__main__':
    main()
```

**사용법**:
```bash
python db-documenter.py --db-type postgresql --database mydb --user admin --password secret
```

---

## 4. 코드 통계 도구

### code-stats.sh (Bash)

```bash
#!/bin/bash
# 코드베이스 통계 도구

echo "## 코드 통계"
echo ""

# 파일 수
echo "### 파일 수"
echo "| 언어 | 파일 수 |"
echo "|------|---------|"
echo "| Java | $(find . -name "*.java" | wc -l) |"
echo "| Python | $(find . -name "*.py" | wc -l) |"
echo "| TypeScript | $(find . -name "*.ts" -o -name "*.tsx" | wc -l) |"
echo "| JavaScript | $(find . -name "*.js" -o -name "*.jsx" | wc -l) |"
echo ""

# 라인 수
echo "### 코드 라인 수 (주석/빈줄 제외)"
if command -v cloc &> /dev/null; then
    cloc . --quiet --md
else
    echo "(cloc 미설치 - 'brew install cloc' 또는 'apt install cloc')"
    echo "| 언어 | 라인 수 |"
    echo "|------|---------|"
    echo "| Java | $(find . -name "*.java" -exec cat {} \; | grep -v "^$" | grep -v "^\s*//" | wc -l) |"
    echo "| Python | $(find . -name "*.py" -exec cat {} \; | grep -v "^$" | grep -v "^\s*#" | wc -l) |"
fi
echo ""

# TODO 개수
echo "### TODO/FIXME"
echo "| 태그 | 개수 |"
echo "|------|------|"
echo "| TODO | $(grep -r "TODO" --include="*.java" --include="*.py" --include="*.ts" . | wc -l) |"
echo "| FIXME | $(grep -r "FIXME" --include="*.java" --include="*.py" --include="*.ts" . | wc -l) |"
echo "| HACK | $(grep -r "HACK" --include="*.java" --include="*.py" --include="*.ts" . | wc -l) |"
echo ""

# 최근 수정 파일
echo "### 최근 수정된 파일 (10개)"
git log --pretty=format: --name-only --since="1 week ago" | sort | uniq -c | sort -rn | head -10
```

**사용법**:
```bash
chmod +x code-stats.sh
./code-stats.sh > stats.md
```

---

## 5. Git 훅 예시

### pre-commit

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running pre-commit checks..."

# 1. 민감 정보 체크
if git diff --cached | grep -E "(password|secret|api_key|token)\s*=\s*['\"][^'\"]+['\"]"; then
    echo "ERROR: Possible sensitive data detected!"
    exit 1
fi

# 2. 디버그 코드 체크
if git diff --cached | grep -E "(console\.log|print\(|System\.out\.print)"; then
    echo "WARNING: Debug statements found. Continue? (y/n)"
    read -r answer
    if [ "$answer" != "y" ]; then
        exit 1
    fi
fi

# 3. 테스트 실행 (선택)
# ./gradlew test --quiet || exit 1

echo "Pre-commit checks passed!"
exit 0
```

### commit-msg (commitlint)

```bash
#!/bin/bash
# .git/hooks/commit-msg

commit_msg=$(cat "$1")

# Conventional Commits 형식 검증
pattern="^(feat|fix|refactor|docs|test|chore|style|perf|ci)(\(.+\))?: .{1,72}$"

if ! echo "$commit_msg" | head -1 | grep -qE "$pattern"; then
    echo "ERROR: Invalid commit message format!"
    echo ""
    echo "Expected: <type>(<scope>): <subject>"
    echo "Types: feat, fix, refactor, docs, test, chore, style, perf, ci"
    echo ""
    echo "Example: feat(auth): add OAuth2 login support"
    exit 1
fi

exit 0
```

---

## 설치 및 설정

### 필요 패키지

```bash
# Python
pip install httpx mysql-connector-python psycopg2-binary

# Node.js (commitlint)
npm install -D @commitlint/cli @commitlint/config-conventional husky

# System tools
brew install cloc  # macOS
apt install cloc   # Ubuntu
```

### Git 훅 설정

```bash
# 훅 파일에 실행 권한 부여
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/commit-msg

# 또는 Husky 사용 (Node.js 프로젝트)
npx husky install
npx husky add .husky/pre-commit "npm test"
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

---

**참고**: 이 도구들은 예시입니다. 프로젝트 환경에 맞게 수정하여 사용하세요.
