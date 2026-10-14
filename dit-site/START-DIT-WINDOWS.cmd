@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install Node.js and retry.
  pause
  exit /b 1
)
echo.
echo  DEAD INTERNET THEORY  /  LOCAL RESEARCH LAB
 echo http://localhost:4173
 echo.
echo Open http://127.0.0.1:4173/operator to connect your local JARVIS or Ollama models.
echo This runs a research prototype with TEST-ONLY local voting and no live token deployments.
echo Ctrl+C to stop the local server.
 echo.
if exist .env (
  echo [config] Loading local .env file
  node --env-file=.env server\local.mjs
) else (
  echo [config] Local Ollama autodiscovery at 127.0.0.1:11434
  node server\local.mjs
)
if errorlevel 1 pause
endlocal
