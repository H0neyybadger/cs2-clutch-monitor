@echo off
REM ============================================
REM CS2 Clutch Mode - Stop Script
REM ============================================
REM This script stops the CS2 Clutch Mode server
REM by killing the Node.js process on port 3001.
REM ============================================

echo.
echo ========================================
echo   CS2 Clutch Mode - Stopping...
echo ========================================
echo.

REM Find the process listening on port 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    set PID=%%a
)

if defined PID (
    echo Found CS2 Clutch Mode server running on PID %PID%
    echo Stopping server...
    taskkill /PID %PID% /F >nul 2>&1
    
    if %errorlevel% equ 0 (
        echo.
        echo ========================================
        echo   Server stopped successfully!
        echo ========================================
    ) else (
        echo.
        echo ERROR: Failed to stop server.
        echo You may need to close it manually.
    )
) else (
    echo No CS2 Clutch Mode server found running.
    echo Nothing to stop.
)

echo.
echo Press any key to close this window...
pause >nul
