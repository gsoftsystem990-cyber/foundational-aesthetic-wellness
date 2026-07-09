# Starts a public preview link with a brand-friendly name
# Keep this PowerShell window OPEN while the client views the site.

$ErrorActionPreference = "Continue"
$project = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $project) { $project = "C:\Users\GSoft Store\Desktop\Website Project" }
Set-Location $project

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Local Preview (optional — for testing)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "For your LIVE client website, use GitHub Pages instead:" -ForegroundColor Yellow
Write-Host "  DEPLOY-GITHUB-PAGES.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "This local preview is only for testing on your PC." -ForegroundColor Gray
Write-Host "Local tunnel links (loca.lt) stop working when your PC is off." -ForegroundColor Gray
Write-Host ""

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  Write-Host "ERROR: Python is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Press Enter to close..."
  Read-Host
  exit 1
}

$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
  Write-Host "ERROR: Node.js / npx is not installed." -ForegroundColor Red
  Write-Host "Install Node.js from https://nodejs.org then try again." -ForegroundColor Yellow
  Write-Host "Press Enter to close..."
  Read-Host
  exit 1
}

try {
  $pids = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    if ($pid -and $pid -gt 0) {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  }
  if ($pids) { Start-Sleep -Seconds 1 }
} catch {}

Write-Host "1) Starting local website server on port 8765..." -ForegroundColor Cyan
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "preview-server.py" -WorkingDirectory $project
Start-Sleep -Seconds 3

try {
  Invoke-WebRequest -Uri "http://127.0.0.1:8765/" -UseBasicParsing -TimeoutSec 5 | Out-Null
  $api = Invoke-WebRequest -Uri "http://127.0.0.1:8765/api/reviews" -UseBasicParsing -TimeoutSec 5
  if ($api.StatusCode -ne 200) { throw "Reviews API returned $($api.StatusCode)" }
  Write-Host "   Local site is UP (pages + reviews API)." -ForegroundColor Green
} catch {
  Write-Host "ERROR: Local site did not start." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Press Enter to close..."
  Read-Host
  exit 1
}

Write-Host ""
Write-Host "2) Creating branded public link..." -ForegroundColor Cyan
Write-Host "   Client / approval links use:" -ForegroundColor Yellow
Write-Host "   https://foundationalaestheticwellness.loca.lt" -ForegroundColor Green
Write-Host ""
Write-Host "   IMPORTANT: Old emails may still have old URL." -ForegroundColor Yellow
Write-Host "   Submit a NEW review after restart to get a fresh approval link." -ForegroundColor Yellow
Write-Host "   DO NOT CLOSE THIS WINDOW or the link will stop working." -ForegroundColor Yellow
Write-Host "   If a password page appears for your client, tell them to click Continue." -ForegroundColor Gray
Write-Host ""

try {
  npx --yes localtunnel --port 8765 --subdomain foundationalaestheticwellness
} catch {
  Write-Host ""
  Write-Host "Named link failed, creating a backup random Cloudflare link..." -ForegroundColor Yellow
  npx --yes cloudflared tunnel --url http://127.0.0.1:8765
}

Write-Host ""
Write-Host "Preview stopped. Press Enter to close this window..." -ForegroundColor Yellow
Read-Host
