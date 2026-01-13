# cross_review.ps1 - Claude <-> Gemini 교차 리뷰 스크립트
# 사용법:
#   .\cross_review.ps1 -From claude -To gemini -Request "코드 리뷰해줘" -File "src/Service.java"
#   .\cross_review.ps1 -From gemini -To claude -Request "이 로직 검토해줘" -File "src/main.py"
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("claude", "gemini")]
    [string]$From,

    [Parameter(Mandatory=$true)]
    [ValidateSet("claude", "gemini")]
    [string]$To,

    [Parameter(Mandatory=$true)]
    [string]$Request,

    [string]$File,

    [string]$LogDir = "logs/cross_review",

    [string]$TaskName = "review"
)

# UTF-8 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# 검증
if ($From -eq $To) {
    Write-Host "Error: From과 To가 같을 수 없습니다." -ForegroundColor Red
    exit 1
}

# 로그 디렉토리 생성
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 타임스탬프
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$logFile = "$LogDir/${timestamp}_${From}_to_${To}_${TaskName}.log"

# 파일 내용 읽기 (선택적)
$fileContent = ""
if ($File -and (Test-Path $File)) {
    $fileContent = Get-Content $File -Raw -Encoding UTF8
    $fileInfo = "파일: $File`n파일 내용:`n$fileContent"
} elseif ($File) {
    $fileInfo = "파일: $File (파일을 찾을 수 없음)"
} else {
    $fileInfo = "파일: (지정되지 않음)"
}

# 요청 프롬프트 구성
$fullPrompt = @"
[교차 리뷰 요청]
요청자: $($From.ToUpper())
수신자: $($To.ToUpper())
요청 시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

요청 내용:
$Request

$fileInfo

---
위 내용을 검토하고 피드백을 제공해주세요.
"@

# 헤더 기록
$header = @"
=== 교차 리뷰 요청 ===
From: $($From.ToUpper())
To: $($To.ToUpper())
시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
파일: $File
요청:
$Request
=== $($To.ToUpper()) 응답 ===
"@

$header | Out-File -FilePath $logFile -Encoding UTF8
Write-Host $header -ForegroundColor Cyan

# 대상 AI 호출
try {
    $response = & $To $fullPrompt 2>&1

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
$footer = @"

=== 리뷰 완료 ===
종료 시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
로그 파일: $logFile
"@
$footer | Out-File -FilePath $logFile -Append -Encoding UTF8

Write-Host ""
Write-Host "로그 저장됨: $logFile" -ForegroundColor Green
