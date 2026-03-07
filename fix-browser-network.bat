@echo off
echo Fixing Browser Network Issues for GPT Uploads...
echo.

echo Step 1: Clearing DNS cache...
ipconfig /flushdns
echo ✅ DNS cache cleared

echo.
echo Step 2: Resetting network adapter...
netsh interface ip delete arpcache
echo ✅ ARP cache cleared

echo.
echo Step 3: Clearing browser data...
echo Please manually clear your browser cache:
echo.
echo For Chrome/Edge:
echo   1. Press Ctrl+Shift+Delete
echo   2. Select "Cached images and files"
echo   3. Select "Cookies and other site data"
echo   4. Click "Clear data"
echo.
echo For Firefox:
echo   1. Press Ctrl+Shift+Delete
echo   2. Select "Cache"
echo   3. Select "Cookies"
echo   4. Click "Clear Now"
echo.

echo Step 4: Checking network connectivity...
ping -n 1 files.oaiusercontent.com >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Can reach files.oaiusercontent.com
) else (
    echo ⚠️  Cannot reach files.oaiusercontent.com
    echo    This might be a firewall or DNS issue
)

echo.
echo Step 5: Checking for proxy settings...
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer

echo.
echo ========================================
echo NEXT STEPS:
echo ========================================
echo 1. Close ALL browser windows completely
echo 2. Wait 10 seconds
echo 3. Reopen browser
echo 4. Try uploading to GPT again
echo.
echo If still failing, restart your computer.
echo ========================================

pause
