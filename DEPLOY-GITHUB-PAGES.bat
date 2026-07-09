@echo off
title Deploy to GitHub Pages
cd /d "%~dp0"
echo.
echo Deploying website to GitHub Pages...
echo.
powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0deploy-github-pages.ps1"
pause
