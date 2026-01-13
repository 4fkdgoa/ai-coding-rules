# run_ai.ps1 - Claude/Gemini CLI 통합 실행 스크립트
# 사용법:
#   .\run_ai.ps1 -AI claude -Question "질문"
#   .\run_ai.ps1 -AI gemini -Question "질문" -TaskName "review"
#   .\run_ai.ps1 claude "질문"
#   .\run_ai.ps1 gemini "질문"
param(
    [Parameter(Position=0, Mandatory=$true)]
    [ValidateSet("claude", "gemini")]
    [string]$AI,

    [Parameter(Position=1, Mandatory=$true)]
    [string]$Question,

    [string]$LogDir,

    [string]$TaskName = "query"
)

# UTF-8 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# 로그 디렉토리 기본값 설정
if (-not $LogDir) {
    $LogDir = "logs/$AI"
}

# 로그 디렉토리 생성
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 타임스탬프 로그 파일명
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$logFile = "$LogDir/${timestamp}_${TaskName}.log"

# 헤더 기록
$aiUpper = $AI.ToUpper()
$header = @"
=== $aiUpper CLI 실행 ===
실행 시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
작업명: $TaskName
명령어:
$AI "$Question"
=== 응답 ===
"@

$header | Out-File -FilePath $logFile -Encoding UTF8
Write-Host $header -ForegroundColor Cyan

# AI CLI 실행 및 로그 저장
try {
    # 명령 실행
    $response = & $AI $Question 2>&1

    # 응답 저장
    $response | Out-File -FilePath $logFile -Append -Encoding UTF8

    # 화면 출력
    Write-Host ""
    Write-Host $response
} catch {
    $errorMsg = "Error: $_"
    $errorMsg | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host $errorMsg -ForegroundColor Red
}

# 종료 시각 기록
$footer = "=== 종료 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
$footer | Out-File -FilePath $logFile -Append -Encoding UTF8

Write-Host ""
Write-Host "로그 저장됨: $logFile" -ForegroundColor Green
