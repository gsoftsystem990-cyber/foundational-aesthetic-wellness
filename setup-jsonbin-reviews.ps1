# One-time setup: create JSONBin cloud storage for live reviews on GitHub Pages.
# Without this, approval emails work but Approve & Publish cannot save reviews for all visitors.
#
# 1. Sign up free at https://jsonbin.io
# 2. Copy your X-Master-Key from https://jsonbin.io/app/api-keys
# 3. Run: .\setup-jsonbin-reviews.ps1   (or SETUP-REVIEWS-STORAGE.bat)
# 4. Run: DEPLOY-GITHUB-PAGES.bat

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$configPath = Join-Path $PSScriptRoot "assets\js\site-config.js"
$seedPath = Join-Path $PSScriptRoot "assets\data\approved-reviews.json"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Review Cloud Storage (JSONBin)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "This is REQUIRED for Approve & Publish on the live GitHub Pages site." -ForegroundColor Yellow
Write-Host "Get a free API key at: https://jsonbin.io/app/api-keys" -ForegroundColor Cyan
Write-Host ""

$masterKey = $env:FAW_JSONBIN_KEY
if (-not $masterKey) {
  $masterKey = Read-Host "Paste your JSONBin X-Master-Key"
}
$masterKey = $masterKey.Trim()
if (-not $masterKey) {
  Write-Host "No API key provided. Setup cancelled." -ForegroundColor Red
  exit 1
}

# Always start from current seed file (should be [] after clearing reviews)
$seed = @()
if (Test-Path $seedPath) {
  try {
    $parsed = Get-Content $seedPath -Raw | ConvertFrom-Json
    if ($parsed -is [Array]) { $seed = $parsed }
  } catch {
    $seed = @()
  }
}

Write-Host "Creating empty public review storage bin..." -ForegroundColor Cyan
$body = "[]"
if ($seed.Count -gt 0) {
  $body = ($seed | ConvertTo-Json -Depth 10 -Compress)
  if (-not $body -or $body -eq "null") { $body = "[]" }
}

try {
  $createReq = [System.Net.HttpWebRequest]::Create("https://api.jsonbin.io/v3/b")
  $createReq.Method = "POST"
  $createReq.Headers.Add("X-Master-Key", $masterKey)
  $createReq.Headers.Add("X-Bin-Name", "faw-approved-reviews")
  $createReq.Headers.Add("X-Bin-Private", "false")
  $createReq.ContentType = "application/json"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $createReq.ContentLength = $bytes.Length
  $stream = $createReq.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()
  $createResp = $createReq.GetResponse()
  $createReader = New-Object System.IO.StreamReader($createResp.GetResponseStream())
  $createJson = $createReader.ReadToEnd() | ConvertFrom-Json
  $createReader.Close()
  $binId = $createJson.metadata.id
} catch {
  Write-Host "Could not create JSONBin. Check your API key and try again." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

if (-not $binId) {
  Write-Host "Could not create JSONBin. No bin id returned." -ForegroundColor Red
  exit 1
}

Write-Host "Bin created: $binId" -ForegroundColor Green

$config = Get-Content $configPath -Raw
if ($config -notmatch "reviewsBinId:") {
  Write-Host "site-config.js is missing reviewsBinId. Setup cancelled." -ForegroundColor Red
  exit 1
}
$config = $config -replace "reviewsBinId:\s*'[^']*'", "reviewsBinId: '$binId'"
$config = $config -replace "reviewsBinKey:\s*'[^']*'", "reviewsBinKey: '$masterKey'"
Set-Content -Path $configPath -Value $config -NoNewline

# Keep local seed empty / in sync
Set-Content -Path $seedPath -Value "[]`n" -NoNewline

Write-Host ""
Write-Host "Review storage configured in assets/js/site-config.js" -ForegroundColor Green
Write-Host "Existing reviews were cleared." -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEP (required):" -ForegroundColor Yellow
Write-Host "  Run DEPLOY-GITHUB-PAGES.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "Then test:" -ForegroundColor Gray
Write-Host "  1. Submit a review on the live site" -ForegroundColor Gray
Write-Host "  2. Open the approval email" -ForegroundColor Gray
Write-Host "  3. Click approve_link -> Approve & Publish Review" -ForegroundColor Gray
Write-Host "  4. Confirm it appears on the Reviews page" -ForegroundColor Gray
Write-Host ""
