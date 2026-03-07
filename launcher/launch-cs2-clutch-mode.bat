@echo off
REM ============================================
REM CS2 Clutch Mode - Windows Launcher
REM ============================================
REM This script starts the CS2 Clutch Mode app
REM and automatically opens the dashboard in
REM your default browser.
REM ============================================

echo.
echo ========================================
echo   CS2 Clutch Mode - Starting...
echo ========================================
echo.

REM Navigate to the project root directory
cd /d "%~dp0.."

REM Check if node_modules exists
if not exist "node_modules\" (
    echo ERROR: node_modules not found!
    echo Please run "npm install" first.
    echo.
    pause
    exit /b 1
)

REM Start the Node.js server in a new window
echo Starting CS2 Clutch Mode server...
start "CS2 Clutch Mode Server" cmd /k "npm run dev"

REM Smart readiness check - poll the health endpoint until server responds
REM Maximum wait time: 15 seconds (15 attempts x 1 second each)
echo Waiting for server to be ready...
set /a attempts=0
set /a max_attempts=15

:check_server
set /a attempts+=1

REM Use PowerShell to check if server is responding (suppress output)
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/health' -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1

if %errorlevel% equ 0 (
    echo Server is ready!
    goto server_ready
)

if %attempts% geq %max_attempts% (
    echo.
    echo WARNING: Server did not respond after %max_attempts% seconds.
    echo Opening dashboard anyway - it may take a moment to load.
    goto server_ready
)

REM Wait 1 second before next check
timeout /t 1 /nobreak >nul
goto check_server

:server_ready
REM Open the dashboard in the default browser
echo Opening dashboard in browser...
start http://127.0.0.1:3001/ui

echo.
echo ========================================
echo   CS2 Clutch Mode is now running!
echo ========================================
echo.
echo Dashboard: http://127.0.0.1:3001/ui
echo.
echo The server is running in a separate window.
echo Close that window to stop the server.
echo.
REM Launcher exits automatically - no pause needed
