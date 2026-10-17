@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 22 or newer is required. Install Node.js LTS first.
 pause
 exit /b 1
)
if exist "..\dit-site\.env" (
 node --env-file="..\dit-site\.env" server.mjs
) else (
 node server.mjs
)
if errorlevel 1 pause
