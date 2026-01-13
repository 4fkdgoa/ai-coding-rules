# run_gemini.ps1 - Gemini CLI 실행 및 로그 저장
# 사용법: .\run_gemini.ps1 -Question "질문 내용"
#         .\run_gemini.ps1 "질문 내용"
#         .\run_gemini.ps1 -Question "질문" -TaskName "code_review"
param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$Question,

    [string]$LogDir = "logs/gemini",

    [string]$TaskName = "query"
)

# UTF-8 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# 로그 디렉토리 생성
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 타임스탬프 로그 파일명
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$logFile = "$LogDir/${timestamp}_${TaskName}.log"

# 헤더 기록
$header = @"
=== Gemini CLI 실행 ===
실행 시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
작업명: $TaskName
명령어:
gemini "$Question"
=== 응답 ===
"@

$header | Out-File -FilePath $logFile -Encoding UTF8
Write-Host $header -ForegroundColor Cyan

# Gemini 실행 및 로그 저장
try {
    # gemini 명령 실행
    $response = & gemini $Question 2>&1

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
