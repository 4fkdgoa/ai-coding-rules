# PowerShell 인코딩 가이드 (Windows)

Windows PowerShell 5.1과 PowerShell 7+의 인코딩 차이 및 해결 방법

---

## 문제 상황

Windows에서 PowerShell 스크립트 실행 시 한글이 깨지는 현상:

```
=== Claude CLI ?ㅽ뻾 ===
?ㅽ뻾 ?쒓컖: 2026-01-11 02:08:51
```

**원인**: Windows 기본 코드페이지가 949 (MS949/EUC-KR)

---

## AI 세션 간 대화 이력 공유 불가

**중요**: 각 AI CLI 호출은 완전히 독립된 세션입니다.

```
┌─────────────────┐        ┌─────────────────┐
│  현재 Claude    │        │  스크립트로     │
│  세션 (이것)    │   ≠    │  호출된 Claude  │
└─────────────────┘        └─────────────────┘
      │                           │
      │                           │
  대화 이력 있음            새 세션 (이력 없음)
```

**Gemini가 Claude를 호출해도**:
- Claude는 Gemini가 뭘 물어봤는지 모름
- 그 Claude도 현재 세션의 Claude와 다른 인스턴스
- **로그 파일만이 유일한 증거**

이것이 로그 스크립트가 필수인 이유입니다.

---

## Windows 코드페이지 확인

```powershell
# 현재 코드페이지 확인
chcp
# 활성 코드 페이지: 949  (한국어 Windows 기본)

# PowerShell 인코딩 확인
[System.Text.Encoding]::Default.EncodingName
# 한국어
[Console]::OutputEncoding.EncodingName
# 한국어
```

---

## 해결 방법 1: 스크립트 시작 시 UTF-8 강제

```powershell
# 스크립트 맨 위에 추가
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
```

**주의**: 이 방법은 현재 세션에만 적용됩니다.

---

## 해결 방법 2: PowerShell 프로필에 설정

```powershell
# 프로필 경로 확인
$PROFILE

# 프로필 편집 (없으면 생성)
if (!(Test-Path $PROFILE)) {
    New-Item -Path $PROFILE -ItemType File -Force
}
notepad $PROFILE
```

**프로필에 추가**:

```powershell
# UTF-8 인코딩 설정
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# Out-File 기본 인코딩 (PS 5.1)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
```

---

## 해결 방법 3: Windows 시스템 설정 변경 (영구)

1. **설정** → **시간 및 언어** → **언어 및 지역**
2. **관리 언어 설정** 클릭
3. **시스템 로캘 변경** 클릭
4. **Beta: 세계 언어 지원을 위해 Unicode UTF-8 사용** 체크
5. 재부팅

**⚠️ 주의**: 일부 레거시 프로그램이 깨질 수 있음

---

## PowerShell 버전별 차이

| 항목 | PowerShell 5.1 | PowerShell 7+ |
|------|----------------|---------------|
| 기본 인코딩 | BOM 있는 UTF-8 | BOM 없는 UTF-8 |
| `utf8NoBOM` 지원 | X | O |
| 시스템 코드페이지 영향 | 큼 | 적음 |
| 권장 | 프로필 설정 필수 | 그대로 사용 |

---

## Out-File vs Set-Content vs 리다이렉션

```powershell
# Out-File: UTF-8 with BOM (PS 5.1)
"한글" | Out-File -FilePath test.txt -Encoding UTF8

# Set-Content: 시스템 기본 인코딩 (PS 5.1)
"한글" | Set-Content -Path test.txt -Encoding UTF8

# 리다이렉션: 시스템 기본 인코딩
"한글" > test.txt

# [System.IO.File]: 인코딩 직접 제어
[System.IO.File]::WriteAllText("test.txt", "한글", [System.Text.Encoding]::UTF8)
```

**권장**: `[System.IO.File]::WriteAllText()` 또는 `Out-File -Encoding UTF8`

---

## AI 스크립트에서 권장 설정

```powershell
# run_ai.ps1 시작 부분
param(
    [string]$Question
)

# === 인코딩 설정 (필수) ===
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# === 파일 저장 시 ===
# 방법 1: Out-File (BOM 포함되지만 대부분 호환)
$content | Out-File -FilePath $logFile -Encoding UTF8

# 방법 2: .NET 직접 사용 (BOM 없음, 더 호환성 좋음)
[System.IO.File]::WriteAllText($logFile, $content, [System.Text.Encoding]::UTF8)
```

---

## 로그 파일 확인 시 인코딩

```powershell
# UTF-8로 읽기
Get-Content -Path $logFile -Encoding UTF8

# 인코딩 자동 감지 (PS 7+)
Get-Content -Path $logFile

# Notepad++에서 열기 (인코딩 자동 감지)
& "C:\Program Files\Notepad++\notepad++.exe" $logFile
```

---

## VS Code 설정

`.vscode/settings.json`:

```json
{
    "files.encoding": "utf8",
    "files.autoGuessEncoding": true,
    "terminal.integrated.defaultProfile.windows": "PowerShell",
    "terminal.integrated.profiles.windows": {
        "PowerShell": {
            "source": "PowerShell",
            "args": ["-NoLogo"]
        }
    }
}
```

---

## 요약

| 상황 | 해결 방법 |
|------|----------|
| 콘솔 출력 깨짐 | `chcp 65001` + OutputEncoding 설정 |
| 파일 저장 깨짐 | `-Encoding UTF8` 또는 .NET WriteAllText |
| 영구 설정 | PowerShell 프로필에 추가 |
| 근본 해결 | Windows UTF-8 시스템 로캘 설정 |

**핵심**: Windows PowerShell 5.1은 기본이 MS949이므로, UTF-8을 명시적으로 설정해야 합니다.

---

**마지막 업데이트**: 2026-01-11
