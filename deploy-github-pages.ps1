# Deploy Foundational Aesthetic Wellness to GitHub Pages
# Run in PowerShell from this folder:
#   .\deploy-github-pages.ps1

$ErrorActionPreference = "Stop"

function Resolve-Tool {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string[]]$FallbackPaths
  )

  $fromPath = Get-Command $Name -ErrorAction SilentlyContinue
  if ($fromPath -and $fromPath.Source) {
    return $fromPath.Source
  }

  foreach ($candidate in $FallbackPaths) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

$git = Resolve-Tool -Name "git" -FallbackPaths @(
  "C:\Program Files\Git\bin\git.exe",
  "C:\Program Files (x86)\Git\bin\git.exe"
)

$gh = Resolve-Tool -Name "gh" -FallbackPaths @(
  "C:\Program Files\GitHub CLI\gh.exe",
  "$env:LOCALAPPDATA\GitHub CLI\gh.exe",
  "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
)

$repoName = "foundational-aesthetic-wellness"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deploy to GitHub Pages" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if (-not $git) {
  Write-Host "Git is not installed or not on PATH." -ForegroundColor Red
  Write-Host "Install Git from https://git-scm.com/download/win then try again." -ForegroundColor Yellow
  exit 1
}

$ghLoggedIn = $false
$owner = $null

if ($gh) {
  & $gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ghLoggedIn = $true
    $owner = (& $gh api user -q .login).Trim()
  }
}

if (-not $ghLoggedIn) {
  $remoteUrl = ""
  if (Test-Path ".git") {
    $remoteUrl = (& $git remote get-url origin 2>$null)
  }

  if ($remoteUrl -match "github\.com[:/]([^/]+)/([^/.]+)") {
    $owner = $Matches[1]
  } else {
    Write-Host "GitHub CLI (gh) is not installed, so this script cannot create a new repo automatically." -ForegroundColor Yellow
    Write-Host ""
    if (-not $gh) {
      Write-Host "Install GitHub CLI (optional, one time):" -ForegroundColor Cyan
      Write-Host "  winget install --id GitHub.cli"
      Write-Host "  gh auth login"
      Write-Host ""
    } else {
      Write-Host "You are not logged into GitHub CLI yet. Run:" -ForegroundColor Cyan
      Write-Host "  gh auth login"
      Write-Host ""
    }
    Write-Host "Or create the GitHub repo in the browser, then in this folder run:" -ForegroundColor Cyan
    Write-Host "  git remote add origin https://github.com/YOUR_USER/$repoName.git"
    Write-Host "  git add -A"
    Write-Host "  git commit -m `"Deploy site to GitHub Pages`""
    Write-Host "  git push -u origin main"
    Write-Host ""
    Write-Host "Then enable Pages: GitHub repo → Settings → Pages → Source = GitHub Actions" -ForegroundColor Yellow
    exit 1
  }
}

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
  if (-not $ghLoggedIn) {
    Write-Host "No git remote is set, and GitHub CLI is not available to create one." -ForegroundColor Red
    exit 1
  }
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

if ($ghLoggedIn) {
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
} else {
  Write-Host "GitHub CLI is not installed, so Pages must be enabled once in the browser:" -ForegroundColor Yellow
  Write-Host "  https://github.com/$owner/$repoName/settings/pages" -ForegroundColor Cyan
  Write-Host "  Source = GitHub Actions" -ForegroundColor Cyan
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
