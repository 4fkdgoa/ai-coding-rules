# request_code_review.ps1 - 코드 리뷰 전용 스크립트
# 사용법:
#   .\request_code_review.ps1 -Reviewer gemini -File "src/Service.java"
#   .\request_code_review.ps1 -Reviewer claude -File "src/main.py" -Focus "성능"
#   .\request_code_review.ps1 gemini "src/Service.java"
param(
    [Parameter(Position=0, Mandatory=$true)]
    [ValidateSet("claude", "gemini")]
    [string]$Reviewer,

    [Parameter(Position=1, Mandatory=$true)]
    [string]$File,

    [ValidateSet("general", "security", "performance", "logic", "style")]
    [string]$Focus = "general",

    [string]$AdditionalContext = "",

    [string]$LogDir = "logs/code_review"
)

# UTF-8 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# 로그 디렉토리 생성
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# 파일 존재 확인
if (!(Test-Path $File)) {
    Write-Host "Error: 파일을 찾을 수 없습니다: $File" -ForegroundColor Red
    exit 1
}

# 파일 내용 읽기
$fileContent = Get-Content $File -Raw -Encoding UTF8
$fileName = Split-Path $File -Leaf

# 타임스탬프
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$logFile = "$LogDir/${timestamp}_${Reviewer}_review_${fileName}.log"

# Focus별 프롬프트
$focusPrompt = switch ($Focus) {
    "security" { "보안 취약점(SQL Injection, XSS, 인증/인가 문제 등)에 집중해서 리뷰해주세요." }
    "performance" { "성능 이슈(N+1 쿼리, 메모리 누수, 불필요한 연산 등)에 집중해서 리뷰해주세요." }
    "logic" { "비즈니스 로직의 정확성과 엣지 케이스 처리에 집중해서 리뷰해주세요." }
    "style" { "코드 스타일, 네이밍, 가독성에 집중해서 리뷰해주세요." }
    default { "전반적인 코드 품질을 리뷰해주세요." }
}

# 리뷰 요청 프롬프트
$reviewPrompt = @"
[코드 리뷰 요청]
파일: $File
리뷰어: $($Reviewer.ToUpper())
포커스: $Focus
요청 시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

$focusPrompt
$(if ($AdditionalContext) { "`n추가 컨텍스트: $AdditionalContext" })

--- 코드 시작 ---
$fileContent
--- 코드 끝 ---

다음 형식으로 리뷰해주세요:
1. 요약 (1-2문장)
2. 발견된 이슈 (라인번호와 함께)
3. 개선 제안
4. 잘된 점 (있다면)
"@

# 헤더 기록
$header = @"
=== 코드 리뷰 요청 ===
리뷰어: $($Reviewer.ToUpper())
파일: $File
포커스: $Focus
시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
=== 리뷰 결과 ===
"@

$header | Out-File -FilePath $logFile -Encoding UTF8
Write-Host $header -ForegroundColor Cyan

# 리뷰어 호출
try {
    $response = & $Reviewer $reviewPrompt 2>&1

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
Write-Host "리뷰 로그 저장됨: $logFile" -ForegroundColor Green
