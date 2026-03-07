@echo off
echo Starting CS2 Clutch Mode safely...
echo.

echo Step 1: Check if ports are available...
netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% == 0 (
    echo WARNING: Port 3001 is in use. Cleaning up...
    taskkill /F /IM node.exe >nul 2>&1
    timeout /t 2 >nul
)

netstat -ano | findstr :3002 >nul 2>&1
if %errorlevel% == 0 (
    echo WARNING: Port 3002 is in use. Cleaning up...
    taskkill /F /IM node.exe >nul 2>&1
    timeout /t 2 >nul
)

echo Step 2: Start the server...
echo The server will run on http://localhost:3001
echo Dashboard: http://localhost:3001/ui
echo Overlay: http://localhost:3001/overlay
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
