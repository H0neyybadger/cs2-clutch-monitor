@echo off
echo Force cleaning CS2 Clutch Mode network connections...
echo.

echo Step 1: Kill any remaining Node processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM ts-node.exe 2>nul
taskkill /F /IM electron.exe 2>nul

echo.
echo Step 2: Kill processes using ports 3001-3002...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo Killing PID %%a (port 3001)...
    taskkill /F /PID %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do (
    echo Killing PID %%a (port 3002)...
    taskkill /F /PID %%a 2>nul
)

echo.
echo Step 3: Clear Windows socket cache...
netsh winsock reset
netsh int ip reset

echo.
echo Step 4: Flush DNS...
ipconfig /flushdns

echo.
echo Step 5: Check remaining connections...
echo Port 3001 connections:
netstat -ano | findstr :3001
echo.
echo Port 3002 connections:
netstat -ano | findstr :3002

echo.
echo Cleanup complete! Try uploading to GPT now.
echo If still failing, restart your computer.
pause
