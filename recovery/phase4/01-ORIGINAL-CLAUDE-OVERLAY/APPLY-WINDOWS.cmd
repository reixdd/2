@echo off
setlocal
if "%~1"=="" (
 echo Usage: APPLY-WINDOWS.cmd "C:\path\to\colosseum"
 exit /b 1
)
py -3 "%~dp0scripts\apply_patch.py" "%~1" --check
if errorlevel 1 exit /b 1
choice /c YN /n /m "Apply changes and back up existing files? [Y/N] "
if errorlevel 2 exit /b 0
py -3 "%~dp0scripts\apply_patch.py" "%~1"
