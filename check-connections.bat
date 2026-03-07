@echo off
echo Checking CS2 Clutch Mode network connections...
echo.

echo === Port 3001 (Main Server) ===
netstat -ano | findstr :3001

echo.
echo === Port 3002 (GSI Server) ===
netstat -ano | findstr :3002

echo.
echo === Node.js Processes ===
tasklist | findstr node.exe

echo.
echo === TIME_WAIT Connections (should be minimal) ===
netstat -ano | findstr TIME_WAIT | findstr :3001 | wc -l

echo.
echo If you see many TIME_WAIT connections, the server may need to be restarted.
echo Run: taskkill /F /IM node.exe
echo Then restart the app with: npm run dev

pause
