# Deploy Foundational Aesthetic Wellness to GitHub Pages
# Run in PowerShell from this folder:
#   gh auth login
#   .\deploy-github-pages.ps1

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\bin\git.exe"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repoName = "foundational-aesthetic-wellness"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deploy to GitHub Pages" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "You are not logged into GitHub yet." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Run this first (one time):" -ForegroundColor Cyan
  Write-Host "  gh auth login"
  Write-Host ""
  Write-Host "Then run this script again:" -ForegroundColor Cyan
  Write-Host "  .\deploy-github-pages.ps1"
  exit 1
}

$owner = (& $gh api user -q .login).Trim()
$pagesUrl = "https://$owner.github.io/$repoName/"
Write-Host "GitHub account: $owner" -ForegroundColor Gray
Write-Host "Live site URL:  $pagesUrl" -ForegroundColor Cyan
Write-Host ""

# Set public URL in site-config.js for approval email links
$configPath = Join-Path $PSScriptRoot "assets\js\site-config.js"
$config = Get-Content $configPath -Raw
$config = $config -replace "publicSiteUrl:\s*'[^']*'", "publicSiteUrl: '$pagesUrl'"
Set-Content -Path $configPath -Value $config -NoNewline

if (-not (Test-Path ".git")) {
  & $git init
  & $git branch -M main
}

$hasRemote = & $git remote 2>$null
if (-not $hasRemote) {
  Write-Host "Creating GitHub repo and pushing..." -ForegroundColor Cyan
  & $gh repo create $repoName --public --source=. --remote=origin --push
} else {
  & $git add -A
  $status = & $git status --porcelain
  if ($status) {
    & $git -c user.name="$owner" -c user.email="$owner@users.noreply.github.com" commit -m "Deploy site to GitHub Pages"
  }
  & $git push -u origin main
}

Write-Host "Enabling GitHub Pages..." -ForegroundColor Cyan
$pagesApi = "/repos/$owner/$repoName/pages"
$pagesExists = $true
& $gh api $pagesApi 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { $pagesExists = $false }

if ($pagesExists) {
  & $gh api --method PUT $pagesApi -f build_type=workflow 2>$null | Out-Null
} else {
  & $gh api --method POST $pagesApi -f build_type=workflow 2>$null | Out-Null
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "Could not enable GitHub Pages via API." -ForegroundColor Red
  Write-Host "Enable manually: https://github.com/$owner/$repoName/settings/pages" -ForegroundColor Yellow
  Write-Host "Choose: Source = GitHub Actions" -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting deployment workflow..." -ForegroundColor Cyan
& $gh workflow run "Deploy to GitHub Pages" --repo "$owner/$repoName"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Workflow will run automatically on push; check Actions if needed." -ForegroundColor Yellow
}

$configCheck = Get-Content (Join-Path $PSScriptRoot "assets\js\site-config.js") -Raw
if ($configCheck -notmatch "reviewsBinId:\s*'[^']+'") {
  Write-Host ""
  Write-Host "IMPORTANT: Review cloud storage is not configured yet." -ForegroundColor Yellow
  Write-Host "Approved reviews will NOT appear on the live site until you run:" -ForegroundColor Yellow
  Write-Host "  SETUP-REVIEWS-STORAGE.bat" -ForegroundColor Cyan
  Write-Host "Then run this deploy script again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deployment started!" -ForegroundColor Green
Write-Host ""
Write-Host "Your permanent website link:" -ForegroundColor Yellow
Write-Host "  $pagesUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Wait 1-3 minutes, then open the link above." -ForegroundColor Gray
Write-Host "If you see 404, check:" -ForegroundColor Gray
Write-Host "  https://github.com/$owner/$repoName/actions"
Write-Host "  https://github.com/$owner/$repoName/settings/pages"
Write-Host ""
Write-Host "You do NOT need local tunnel / START-PREVIEW.bat for clients anymore." -ForegroundColor Yellow
Write-Host ""
