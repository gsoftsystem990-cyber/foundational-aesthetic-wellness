# One-time setup: create JSONBin cloud storage for live reviews on GitHub Pages.
# 1. Sign up free at https://jsonbin.io
# 2. Copy your X-Master-Key from https://jsonbin.io/app/api-keys
# 3. Run: .\setup-jsonbin-reviews.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$configPath = Join-Path $PSScriptRoot "assets\js\site-config.js"
$seedPath = Join-Path $PSScriptRoot "assets\data\approved-reviews.json"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Review Cloud Storage (JSONBin)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "This stores approved reviews online so they appear for ALL visitors." -ForegroundColor Gray
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

$seed = @()
if (Test-Path $seedPath) {
  try {
    $seed = Get-Content $seedPath -Raw | ConvertFrom-Json
    if ($seed -isnot [Array]) { $seed = @() }
  } catch {
    $seed = @()
  }
}

Write-Host "Creating review storage bin..." -ForegroundColor Cyan
$body = ($seed | ConvertTo-Json -Depth 10 -Compress)
if (-not $body -or $body -eq "null") { $body = "[]" }

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

if (-not $binId) {
  Write-Host "Could not create JSONBin. Response: $($createJson | ConvertTo-Json -Compress)" -ForegroundColor Red
  exit 1
}

Write-Host "Bin created: $binId" -ForegroundColor Green

$config = Get-Content $configPath -Raw
$config = $config -replace "reviewsBinId:\s*'[^']*'", "reviewsBinId: '$binId'"
$config = $config -replace "reviewsBinKey:\s*'[^']*'", "reviewsBinKey: '$masterKey'"
Set-Content -Path $configPath -Value $config -NoNewline

Write-Host ""
Write-Host "Review storage configured in assets/js/site-config.js" -ForegroundColor Green
Write-Host "Next: run DEPLOY-GITHUB-PAGES.bat to publish the update." -ForegroundColor Yellow
Write-Host ""
