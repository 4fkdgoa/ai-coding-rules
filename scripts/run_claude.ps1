# run_claude.ps1 - Claude CLI 실행 및 로그 저장
# 사용법: .\run_claude.ps1 -Question "질문 내용"
#         .\run_claude.ps1 "질문 내용"
param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$Question,

    [string]$LogDir = "logs/claude",

    [string]$TaskName = "query"
)

# 로그 디렉토리 생성
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 타임스탬프 로그 파일명
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$logFile = "$LogDir/${timestamp}_${TaskName}.log"

# 헤더
$header = @"
=== Claude CLI 실행 ===
실행 시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
작업명: $TaskName
질문:
$Question
=== 응답 ===
"@

# 헤더 저장 + 출력
$header | Out-File -FilePath $logFile -Encoding UTF8
Write-Host $header -ForegroundColor Cyan

# Claude 실행
try {
    $response = & claude $Question 2>&1

    # 파일에 저장 (UTF8)
    $response | Out-File -FilePath $logFile -Append -Encoding UTF8

    # 콘솔에 출력
    Write-Host ""
    Write-Host $response
} catch {
    $errorMsg = "Error: $_"
    $errorMsg | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host $errorMsg -ForegroundColor Red
}

# 종료 시각
$footer = "=== 종료 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
$footer | Out-File -FilePath $logFile -Append -Encoding UTF8

Write-Host ""
Write-Host "로그 저장됨: $logFile" -ForegroundColor Green
