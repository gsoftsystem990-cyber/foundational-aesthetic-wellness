# Deploy Foundational Aesthetic Wellness to GitHub Pages
# Run in PowerShell from this folder:
#   gh auth login
#   .\deploy-github-pages.ps1

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\bin\git.exe"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repoName = "foundational-aesthetic-wellness"

Set-Location $PSScriptRoot

& $gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Log in first, then run this script again:" -ForegroundColor Yellow
  Write-Host "  gh auth login"
  exit 1
}

$owner = (& $gh api user -q .login).Trim()
Write-Host "GitHub account: $owner"

if (-not (Test-Path ".git")) {
  & $git init
  & $git branch -M main
}

$hasRemote = & $git remote 2>$null
if (-not $hasRemote) {
  & $gh repo create $repoName --public --source=. --remote=origin --push
} else {
  & $git add -A
  $status = & $git status --porcelain
  if ($status) {
    & $git commit -m "Update site for GitHub Pages"
  }
  & $git push -u origin main
}

# Enable GitHub Pages via Actions (recommended)
& $gh api --method PUT "/repos/$owner/$repoName/pages" -f build_type=workflow | Out-Null

# Trigger deploy workflow
& $gh workflow run "Deploy to GitHub Pages" --repo "$owner/$repoName" 2>$null

$url = "https://$owner.github.io/$repoName/"
Write-Host ""
Write-Host "Deployment started." -ForegroundColor Green
Write-Host "Client link: $url" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you still see 404:"
Write-Host "1. Open https://github.com/$owner/$repoName/settings/pages"
Write-Host "2. Source must be: GitHub Actions"
Write-Host "3. Open https://github.com/$owner/$repoName/actions and wait for green checkmark"
Write-Host "4. index.html must be in the repo root (not inside a subfolder)"
