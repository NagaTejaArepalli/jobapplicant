@echo off
setlocal enabledelayedexpansion

:: AI SDET Job Applier - Windows Runner
:: Navigate to project directory
cd /d "%~dp0"

echo ========================================================
echo   Starting AI SDET Job Applier Agent
echo   Time: %date% %time%
echo ========================================================

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on PATH. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Run Playwright Job Application Agent
echo.
echo [1/2] Discovering & Applying to QA/SDET Roles...
call npx ts-node src/applyAgent.ts

:: Run Consolidated Email Reporter
echo.
echo [2/2] Generating and Dispatching Consolidated Email Report...
call npx ts-node src/sendEmailReport.ts

echo.
echo ========================================================
echo   Agent execution completed!
echo ========================================================

if "%1"=="--no-pause" goto end
if not "%CI%"=="" goto end
pause

:end
exit /b 0
