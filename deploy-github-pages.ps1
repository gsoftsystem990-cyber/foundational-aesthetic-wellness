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
  # gh auth status writes to stderr when logged out; do not treat that as a fatal script error.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $gh auth status 2>&1 | Out-Null
  $authExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap

  if ($authExit -eq 0) {
    $ghLoggedIn = $true
    $ErrorActionPreference = "Continue"
    $owner = (& $gh api user -q .login 2>$null)
    $ErrorActionPreference = $prevEap
    if ($owner) { $owner = $owner.Trim() }
  }
}

if (-not $owner) {
  $remoteUrl = ""
  if (Test-Path ".git") {
    $ErrorActionPreference = "Continue"
    $remoteUrl = (& $git remote get-url origin 2>$null)
    $ErrorActionPreference = "Stop"
  }

  if ($remoteUrl -match "github\.com[:/]([^/]+)/([^/.]+)") {
    $owner = $Matches[1]
    if (-not $ghLoggedIn) {
      Write-Host "GitHub CLI is not logged in - deploying with git push (origin already set)." -ForegroundColor Yellow
      Write-Host "Optional later: gh auth login" -ForegroundColor Gray
      Write-Host ""
    }
  } else {
    Write-Host "No GitHub remote found, and GitHub CLI is not logged in." -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix option A (recommended if repo already exists):" -ForegroundColor Cyan
    Write-Host "  git remote add origin https://github.com/YOUR_USER/$repoName.git"
    Write-Host ""
    Write-Host "Fix option B (login GitHub CLI once):" -ForegroundColor Cyan
    Write-Host "  gh auth login"
    Write-Host ""
    exit 1
  }
}

$pagesUrl = "https://$owner.github.io/$repoName/"
Write-Host "GitHub account: $owner" -ForegroundColor Gray
Write-Host "Live site URL:  $pagesUrl" -ForegroundColor Cyan
Write-Host ""

# Set public URL in site-config.js
$configPath = Join-Path $PSScriptRoot "assets\js\site-config.js"
$config = Get-Content $configPath -Raw
$replacement = "publicSiteUrl: '" + $pagesUrl + "'"
$config = [regex]::Replace($config, 'publicSiteUrl:\s*''[^'']*''', $replacement)
Set-Content -Path $configPath -Value $config -NoNewline

if (-not (Test-Path ".git")) {
  & $git init
  & $git branch -M main
}

$ErrorActionPreference = "Continue"
$hasRemote = & $git remote 2>$null
$ErrorActionPreference = "Stop"

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
  Write-Host "Pushing to origin/main..." -ForegroundColor Cyan
  & $git push -u origin main
  if ($LASTEXITCODE -ne 0) {
    Write-Host "git push failed. Check your GitHub credentials / remote access." -ForegroundColor Red
    exit 1
  }
}

if ($ghLoggedIn) {
  Write-Host "Enabling GitHub Pages..." -ForegroundColor Cyan
  $pagesApi = "/repos/$owner/$repoName/pages"
  $ErrorActionPreference = "Continue"
  & $gh api $pagesApi 2>$null | Out-Null
  $pagesExists = ($LASTEXITCODE -eq 0)

  if ($pagesExists) {
    & $gh api --method PUT $pagesApi -f build_type=workflow 2>$null | Out-Null
  } else {
    & $gh api --method POST $pagesApi -f build_type=workflow 2>$null | Out-Null
  }
  $pagesOk = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = "Stop"

  if (-not $pagesOk) {
    Write-Host "Could not enable GitHub Pages via API." -ForegroundColor Yellow
    Write-Host "Enable manually if needed: https://github.com/$owner/$repoName/settings/pages" -ForegroundColor Yellow
    Write-Host "Choose: Source = GitHub Actions" -ForegroundColor Yellow
  } else {
    Write-Host "Starting deployment workflow..." -ForegroundColor Cyan
    $ErrorActionPreference = "Continue"
    & $gh workflow run "Deploy to GitHub Pages" --repo "$owner/$repoName" 2>$null
    $ErrorActionPreference = "Stop"
  }
} else {
  Write-Host "Pages should update automatically from the push (GitHub Actions)." -ForegroundColor Gray
  Write-Host "If the live site 404s, open:" -ForegroundColor Yellow
  Write-Host "  https://github.com/$owner/$repoName/settings/pages" -ForegroundColor Cyan
  Write-Host "  Source = GitHub Actions" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Deployment started!" -ForegroundColor Green
Write-Host ""
Write-Host "Your permanent website link:" -ForegroundColor Yellow
Write-Host "  $pagesUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Wait 1-3 minutes, then open the link above." -ForegroundColor Gray
Write-Host "Actions: https://github.com/$owner/$repoName/actions"
Write-Host ""
