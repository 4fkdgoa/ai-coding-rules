# AI 테스트 프레임워크 구축 가이드

AI 기반 API/챗봇 시스템 테스트를 위한 Python 프레임워크 구축 방법

---

## 기본 구조

```
test/
├── framework/
│   ├── __init__.py
│   ├── api_client.py       # API 호출 클라이언트
│   ├── test_runner.py      # 테스트 실행기
│   ├── result_analyzer.py  # 결과 분석
│   └── tools/
│       ├── db_fetcher.py   # DB 데이터 조회
│       └── log_analyzer.py # 로그 분석
├── scenarios/
│   ├── simple_test.json    # 단순 테스트
│   ├── menu_search.json    # 메뉴 검색 테스트
│   └── multi_turn.json     # 멀티턴 대화 테스트
├── logs/                   # 테스트 로그 (타임스탬프)
├── requirements.txt
└── run_test.py             # 메인 실행 스크립트
```

---

## requirements.txt

```text
# 필수
requests>=2.31.0
httpx>=0.25.0

# DB 연결 (필요한 것만 선택)
pymssql>=2.2.8         # MSSQL
cx_Oracle>=8.3.0       # Oracle
psycopg2-binary>=2.9.9 # PostgreSQL
pymysql>=1.1.0         # MySQL

# 테스트/분석
pytest>=7.4.0
rich>=13.7.0           # 터미널 출력 포맷팅
tabulate>=0.9.0        # 테이블 출력

# 선택
jinja2>=3.1.2          # HTML 리포트 생성
```

---

## API 클라이언트 (api_client.py)

```python
#!/usr/bin/env python3
"""AI API 테스트 클라이언트"""
import httpx
import json
import time
from dataclasses import dataclass, field
from typing import Any
from datetime import datetime


@dataclass
class TestResult:
    """테스트 결과"""
    scenario_name: str
    input_text: str
    expected: dict
    actual: dict
    success: bool
    response_time_ms: float
    error: str | None = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class AIApiClient:
    """AI API 테스트 클라이언트"""

    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.client = httpx.Client(timeout=timeout)
        self.session_id = None

    def chat(
        self,
        user_input: str,
        dealer_id: str = "TEST",
        auth_seq: str = "CS0001",
        session_id: str | None = None
    ) -> dict:
        """AI 채팅 API 호출"""
        payload = {
            "userInput": user_input,
            "dealerId": dealer_id,
            "authSeq": auth_seq,
        }
        if session_id:
            payload["sessionId"] = session_id

        start = time.perf_counter()
        try:
            response = self.client.post(
                f"{self.base_url}/ai",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            elapsed = (time.perf_counter() - start) * 1000

            data = response.json()
            data["_response_time_ms"] = elapsed
            data["_status_code"] = response.status_code
            return data

        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            return {
                "success": False,
                "error": str(e),
                "_response_time_ms": elapsed,
                "_status_code": 0
            }

    def run_scenario(self, scenario: dict) -> list[TestResult]:
        """시나리오 실행"""
        results = []
        session_id = scenario.get("sessionId", f"test_{int(time.time())}")

        for step in scenario.get("steps", []):
            user_input = step.get("input", "")
            expected = step.get("expected", {})

            response = self.chat(
                user_input=user_input,
                dealer_id=scenario.get("dealerId", "TEST"),
                auth_seq=scenario.get("authSeq", "CS0001"),
                session_id=session_id
            )

            # 결과 검증
            success = self._validate_response(response, expected)

            results.append(TestResult(
                scenario_name=scenario.get("name", "unnamed"),
                input_text=user_input,
                expected=expected,
                actual=response,
                success=success,
                response_time_ms=response.get("_response_time_ms", 0),
                error=response.get("error") if not success else None
            ))

        return results

    def _validate_response(self, response: dict, expected: dict) -> bool:
        """응답 검증"""
        if not response.get("success", False):
            return False

        # 분류 검증
        if "classification" in expected:
            if response.get("classification") != expected["classification"]:
                return False

        # Tool 실행 검증
        if "executedTools" in expected:
            actual_tools = response.get("executedTools", [])
            for tool in expected["executedTools"]:
                if tool not in actual_tools:
                    return False

        # 메뉴 추천 검증
        if "hasMenuRecommendations" in expected:
            has_menus = len(response.get("menuRecommendations", [])) > 0
            if has_menus != expected["hasMenuRecommendations"]:
                return False

        return True

    def close(self):
        """클라이언트 종료"""
        self.client.close()
```

---

## 테스트 시나리오 형식 (JSON)

### 단순 테스트 (simple_test.json)

```json
{
  "name": "단순 인사 테스트",
  "description": "일반 대화 분류 테스트",
  "dealerId": "SCLBYD",
  "authSeq": "CS0001",
  "steps": [
    {
      "input": "안녕하세요",
      "expected": {
        "classification": "GENERAL",
        "executedTools": []
      }
    }
  ]
}
```

### 메뉴 검색 테스트 (menu_search.json)

```json
{
  "name": "메뉴 검색 테스트",
  "description": "메뉴 검색 Tool 호출 테스트",
  "dealerId": "SCLBYD",
  "authSeq": "CS0001",
  "steps": [
    {
      "input": "고객 관리 메뉴 찾아줘",
      "expected": {
        "classification": "BUSINESS",
        "executedTools": ["searchMenu"],
        "hasMenuRecommendations": true
      }
    }
  ]
}
```

### 멀티턴 대화 테스트 (multi_turn.json)

```json
{
  "name": "멀티턴 대화 테스트",
  "description": "맥락 유지 테스트",
  "dealerId": "SCLBYD",
  "authSeq": "CS0001",
  "steps": [
    {
      "input": "고객 관리 메뉴 찾아줘",
      "expected": {
        "classification": "BUSINESS",
        "executedTools": ["searchMenu"]
      }
    },
    {
      "input": "그 중에서 신규 고객 등록은?",
      "expected": {
        "classification": "BUSINESS",
        "contextType": "CONTINUATION"
      }
    },
    {
      "input": "고마워",
      "expected": {
        "classification": "GENERAL"
      }
    }
  ]
}
```

---

## 테스트 실행기 (test_runner.py)

```python
#!/usr/bin/env python3
"""테스트 실행기"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.table import Table

from api_client import AIApiClient, TestResult


class TestRunner:
    """테스트 실행 및 결과 리포트"""

    def __init__(self, base_url: str, log_dir: str = "logs"):
        self.client = AIApiClient(base_url)
        self.console = Console()
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

    def run_scenario_file(self, scenario_path: str) -> list[TestResult]:
        """시나리오 파일 실행"""
        with open(scenario_path, 'r', encoding='utf-8') as f:
            scenario = json.load(f)

        self.console.print(f"\n[bold blue]시나리오: {scenario.get('name')}[/bold blue]")
        self.console.print(f"설명: {scenario.get('description', '')}")

        results = self.client.run_scenario(scenario)
        self._print_results(results)
        self._save_log(scenario_path, results)

        return results

    def run_all_scenarios(self, scenarios_dir: str) -> dict[str, list[TestResult]]:
        """모든 시나리오 실행"""
        all_results = {}
        scenario_files = Path(scenarios_dir).glob("*.json")

        for scenario_file in sorted(scenario_files):
            results = self.run_scenario_file(str(scenario_file))
            all_results[scenario_file.name] = results

        self._print_summary(all_results)
        return all_results

    def _print_results(self, results: list[TestResult]):
        """결과 출력"""
        table = Table(title="테스트 결과")
        table.add_column("입력", style="cyan", max_width=40)
        table.add_column("결과", style="green")
        table.add_column("응답시간", justify="right")
        table.add_column("에러", style="red", max_width=30)

        for r in results:
            status = "[green]PASS[/green]" if r.success else "[red]FAIL[/red]"
            table.add_row(
                r.input_text[:40],
                status,
                f"{r.response_time_ms:.0f}ms",
                r.error[:30] if r.error else ""
            )

        self.console.print(table)

    def _print_summary(self, all_results: dict[str, list[TestResult]]):
        """전체 요약 출력"""
        total = sum(len(r) for r in all_results.values())
        passed = sum(sum(1 for r in results if r.success) for results in all_results.values())
        failed = total - passed

        self.console.print(f"\n[bold]{'='*50}[/bold]")
        self.console.print(f"[bold]전체 결과: {passed}/{total} 성공[/bold]")
        if failed > 0:
            self.console.print(f"[red]실패: {failed}[/red]")

    def _save_log(self, scenario_path: str, results: list[TestResult]):
        """로그 저장"""
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        scenario_name = Path(scenario_path).stem
        log_file = self.log_dir / f"{timestamp}_{scenario_name}.json"

        log_data = {
            "scenario": scenario_path,
            "timestamp": timestamp,
            "results": [
                {
                    "input": r.input_text,
                    "success": r.success,
                    "response_time_ms": r.response_time_ms,
                    "expected": r.expected,
                    "actual": r.actual,
                    "error": r.error
                }
                for r in results
            ]
        }

        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(log_data, f, ensure_ascii=False, indent=2)

        self.console.print(f"[dim]로그 저장: {log_file}[/dim]")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='AI 테스트 실행기')
    parser.add_argument('--base-url', default='http://localhost:8888/crmai',
                        help='API Base URL')
    parser.add_argument('--scenario', help='단일 시나리오 파일')
    parser.add_argument('--all', action='store_true', help='모든 시나리오 실행')
    parser.add_argument('--scenarios-dir', default='scenarios', help='시나리오 디렉토리')
    args = parser.parse_args()

    runner = TestRunner(args.base_url)

    try:
        if args.scenario:
            runner.run_scenario_file(args.scenario)
        elif args.all:
            runner.run_all_scenarios(args.scenarios_dir)
        else:
            parser.print_help()
    finally:
        runner.client.close()


if __name__ == '__main__':
    main()
```

---

## 실행 방법

```bash
# 가상환경 생성
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 단일 시나리오 실행
python test_runner.py --scenario scenarios/simple_test.json

# 모든 시나리오 실행
python test_runner.py --all --scenarios-dir scenarios

# Base URL 지정
python test_runner.py --base-url http://localhost:8080/api --all
```

---

## 배치 파일 (Windows)

### run_test.bat

```batch
@echo off
chcp 65001 > nul
setlocal

set BASE_URL=http://localhost:8888/crmai
set SCENARIOS_DIR=scenarios
set LOG_DIR=logs

echo ========================================
echo AI 테스트 실행
echo 시작 시간: %date% %time%
echo ========================================

python test_runner.py --base-url %BASE_URL% --all --scenarios-dir %SCENARIOS_DIR%

echo.
echo 완료 시간: %date% %time%
echo 로그 위치: %LOG_DIR%
pause
```

---

## 결과 로그 예시

```json
{
  "scenario": "scenarios/menu_search.json",
  "timestamp": "2026-01-11_10-30-45",
  "results": [
    {
      "input": "고객 관리 메뉴 찾아줘",
      "success": true,
      "response_time_ms": 1523.4,
      "expected": {
        "classification": "BUSINESS",
        "executedTools": ["searchMenu"]
      },
      "actual": {
        "success": true,
        "classification": "BUSINESS",
        "executedTools": ["searchMenu"],
        "menuRecommendations": [
          {"menuName": "고객 관리", "menuId": "CM001"}
        ]
      },
      "error": null
    }
  ]
}
```

---

## 주의사항

1. **타임스탬프 로그 필수**: 모든 테스트 결과는 타임스탬프가 포함된 로그 파일로 저장
2. **실제 실행 증거**: "테스트 통과"라고 주장할 때는 반드시 로그 파일 경로 제시
3. **실패 시 상세 정보**: 실패한 테스트는 expected vs actual 비교 정보 포함
4. **응답 시간 기록**: 성능 분석을 위해 모든 API 호출의 응답 시간 기록

---

**참고**: 이 프레임워크는 AI 챗봇 API 테스트용입니다. 프로젝트에 맞게 수정하세요.
