# dual_review.ps1 - Claude + Gemini 동시 리뷰 (크로스체크용)
# 사용법:
#   .\dual_review.ps1 -File "src/Service.java"
#   .\dual_review.ps1 -File "src/main.py" -Focus "security"
param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$File,

    [ValidateSet("general", "security", "performance", "logic", "style")]
    [string]$Focus = "general",

    [string]$AdditionalContext = "",

    [string]$LogDir = "logs/dual_review"
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
$claudeLog = "$LogDir/${timestamp}_claude_${fileName}.log"
$geminiLog = "$LogDir/${timestamp}_gemini_${fileName}.log"
$summaryLog = "$LogDir/${timestamp}_summary_${fileName}.log"

# Focus별 프롬프트
$focusPrompt = switch ($Focus) {
    "security" { "보안 취약점에 집중" }
    "performance" { "성능 이슈에 집중" }
    "logic" { "비즈니스 로직 정확성에 집중" }
    "style" { "코드 스타일/가독성에 집중" }
    default { "전반적인 코드 품질 리뷰" }
}

# 리뷰 프롬프트
$reviewPrompt = @"
[코드 리뷰 요청]
파일: $File
포커스: $Focus ($focusPrompt)
$(if ($AdditionalContext) { "추가 컨텍스트: $AdditionalContext" })

--- 코드 ---
$fileContent
--- 끝 ---

리뷰 형식:
1. 요약 (1-2문장)
2. 발견된 이슈 (심각도: HIGH/MEDIUM/LOW, 라인번호)
3. 개선 제안
"@

Write-Host "=== 듀얼 리뷰 시작 ===" -ForegroundColor Cyan
Write-Host "파일: $File" -ForegroundColor Cyan
Write-Host "포커스: $Focus" -ForegroundColor Cyan
Write-Host ""

# Claude 리뷰
Write-Host "[1/2] Claude 리뷰 중..." -ForegroundColor Yellow
$claudeHeader = @"
=== Claude 코드 리뷰 ===
파일: $File
포커스: $Focus
시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
=== 리뷰 결과 ===
"@
$claudeHeader | Out-File -FilePath $claudeLog -Encoding UTF8

try {
    $claudeResponse = & claude $reviewPrompt 2>&1
    $claudeResponse | Out-File -FilePath $claudeLog -Append -Encoding UTF8
    Write-Host "Claude 리뷰 완료: $claudeLog" -ForegroundColor Green
} catch {
    "Error: $_" | Out-File -FilePath $claudeLog -Append -Encoding UTF8
    Write-Host "Claude 리뷰 실패: $_" -ForegroundColor Red
}

# Gemini 리뷰
Write-Host "[2/2] Gemini 리뷰 중..." -ForegroundColor Yellow
$geminiHeader = @"
=== Gemini 코드 리뷰 ===
파일: $File
포커스: $Focus
시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
=== 리뷰 결과 ===
"@
$geminiHeader | Out-File -FilePath $geminiLog -Encoding UTF8

try {
    $geminiResponse = & gemini $reviewPrompt 2>&1
    $geminiResponse | Out-File -FilePath $geminiLog -Append -Encoding UTF8
    Write-Host "Gemini 리뷰 완료: $geminiLog" -ForegroundColor Green
} catch {
    "Error: $_" | Out-File -FilePath $geminiLog -Append -Encoding UTF8
    Write-Host "Gemini 리뷰 실패: $_" -ForegroundColor Red
}

# 요약 생성
$summary = @"
=== 듀얼 리뷰 요약 ===
파일: $File
포커스: $Focus
시각: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

로그 파일:
- Claude: $claudeLog
- Gemini: $geminiLog

=== Claude 리뷰 ===
$claudeResponse

=== Gemini 리뷰 ===
$geminiResponse

=== 크로스체크 포인트 ===
- 양쪽이 동일하게 지적한 이슈 확인
- 한쪽만 발견한 이슈 검토
- 상충되는 의견 있으면 추가 분석 필요
"@

$summary | Out-File -FilePath $summaryLog -Encoding UTF8

Write-Host ""
Write-Host "=== 듀얼 리뷰 완료 ===" -ForegroundColor Cyan
Write-Host "Claude 로그: $claudeLog" -ForegroundColor Green
Write-Host "Gemini 로그: $geminiLog" -ForegroundColor Green
Write-Host "요약 로그: $summaryLog" -ForegroundColor Green
