@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\setup-jsonbin-reviews.ps1"
pause
