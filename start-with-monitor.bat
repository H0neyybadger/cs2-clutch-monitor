@echo off
echo Starting CS2 Clutch Mode with Network Protection...
echo.

echo Step 1: Network Health Check...
call :checkPort 3001
call :checkPort 3002

echo.
echo Step 2: Cleanup any existing issues...
call :cleanup

echo.
echo Step 3: Starting Network Health Monitor...
start "Network Monitor" cmd /k "node network-health-monitor.js"

echo.
echo Step 4: Starting CS2 Clutch Mode Server...
echo Dashboard: http://localhost:3001/ui
echo Overlay: http://localhost:3001/overlay
echo.
echo Network Monitor is running in separate window
echo Press Ctrl+C here to stop the server
echo.

npm run dev

goto :eof

:checkPort
netstat -ano | findstr :%1 >nul 2>&1
if %errorlevel% == 0 (
    echo ⚠️  Port %1 is in use, checking connection count...
    for /f %%i in ('netstat -ano ^| findstr :%1 ^| find /c /v ""') do set count=%%i
    echo     Connections on port %1: %count%
    if %count% GTR 5 (
        echo     ⚠️  High connection count detected, cleaning up...
        call :cleanup
    )
) else (
    echo ✅ Port %1 is available
)
goto :eof

:cleanup
echo Killing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ts-node.exe >nul 2>&1
timeout /t 2 >nul
echo Cleanup complete
goto :eof
