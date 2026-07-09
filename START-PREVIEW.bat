@echo off
title Website Client Preview
cd /d "%~dp0"
echo.
echo Starting website preview...
echo Keep this window open.
echo.
powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0start-client-preview.ps1"
pause
