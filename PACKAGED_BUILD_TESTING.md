# CS2 Clutch Mode - Packaged Build Testing Guide

## 🎯 Build Output

### **Installer Files Created**

**Location:** `dist-electron/`

1. **NSIS Installer (Recommended)**
   - File: `CS2-Clutch-Mode-Setup-1.0.0.exe`
   - Type: Windows installer with install wizard
   - Features:
     - Choose installation directory
     - Desktop shortcut creation
     - Start menu shortcut
     - Proper uninstaller
   - Size: ~150-200 MB

2. **Portable Executable**
   - File: `CS2-Clutch-Mode-1.0.0-portable.exe`
   - Type: Single executable (no installation)
   - Features:
     - Run from any location
     - No registry changes
     - Stores settings in app directory
   - Size: ~150-200 MB

3. **Unpacked Application**
   - Directory: `dist-electron/win-unpacked/`
   - Contains: `CS2 Clutch Mode.exe` + resources
   - Use for: Quick testing without installation

---

## 📋 Pre-Installation Testing Checklist

### **Before Installing**

- [ ] Close any running instances of CS2 Clutch Mode
- [ ] Stop any Node.js processes on port 3001
- [ ] Check available disk space (need ~500 MB)
- [ ] Disable antivirus temporarily if needed
- [ ] Have CS2 installed (for full testing)

---

## 🔧 Installation Testing

### **Test 1: NSIS Installer**

**Steps:**
1. Run `CS2-Clutch-Mode-Setup-1.0.0.exe`
2. Follow installation wizard
3. Choose installation directory
4. Enable desktop shortcut
5. Complete installation

**Expected Results:**
- ✅ Installer launches without errors
- ✅ Installation completes successfully
- ✅ Desktop shortcut created
- ✅ Start menu entry created
- ✅ App installed to chosen directory

**Logs to Check:**
- Installation log (if any errors)
- Windows Event Viewer (Application logs)

---

### **Test 2: Portable Executable**

**Steps:**
1. Copy `CS2-Clutch-Mode-1.0.0-portable.exe` to test folder
2. Double-click to run
3. Wait for app to start

**Expected Results:**
- ✅ App launches without installation
- ✅ Settings stored in app directory
- ✅ No registry modifications
- ✅ Can run from USB drive

---

## 🚀 Startup Testing

### **Test 3: First Launch**

**Steps:**
1. Launch CS2 Clutch Mode from desktop shortcut
2. Watch for console window (if visible)
3. Wait for system tray icon to appear
4. Check for error dialogs

**Expected Logs (Console):**
```
[Electron] ============================================================
[Electron] CS2 Clutch Mode Starting
[Electron] Version: 1.0.0
[Electron] Electron: 28.0.0
[Electron] Node: 18.x.x
[Electron] Packaged: true
[Electron] App Path: C:\Users\...\AppData\Local\Programs\cs2-clutch-mode
[Electron] User Data: C:\Users\...\AppData\Roaming\cs2-clutch-mode
[Electron] ============================================================
[Electron] App ready event fired
[Electron] Checking if server is already running...
[Electron] Settings stored at: C:\Users\...\AppData\Roaming\cs2-clutch-mode\config.json
[Electron] Restored preferences:
[Electron]   clickThrough: false
[Electron]   overlayVisible: false
[Electron] Starting backend server...
[Electron] Project root (packaged): C:\Users\...\AppData\Local\Programs\cs2-clutch-mode\resources\app
[Electron] Server startup (packaged mode):
[Electron]   Command: C:\Users\...\AppData\Local\Programs\cs2-clutch-mode\CS2 Clutch Mode.exe
[Electron]   Args: [ 'C:\\Users\\...\\resources\\app\\dist\\main.js' ]
[Electron]   Main script: C:\Users\...\resources\app\dist\main.js
[Electron]   Working dir: C:\Users\...\resources\app
[Electron] Server process spawned successfully (PID: xxxxx)
[Server] Starting CS2 Discord Clutch Mode...
[Server] Config loaded from: C:\Users\...\resources\app\config\config.json
[Server] GSI server listening on http://127.0.0.1:3002/gsi
[Server] UI server listening on http://127.0.0.1:3001
[Electron] Server is ready!
[Electron] Health check passed: http://127.0.0.1:3001/health
[Electron] Creating system tray icon...
[Electron] System tray created
[Electron] [Overlay] createOverlayWindow() called
[Electron] [Overlay] Window bounds: { x: 100, y: 100, width: 360, height: 320 }
[Electron] [Overlay] Loading overlay URL: http://127.0.0.1:3001/overlay
[Electron] [Overlay] Content loaded successfully
[Electron] ============================================================
[Electron] Startup complete!
[Electron] Dashboard URL: http://127.0.0.1:3001/ui
[Electron] Overlay URL: http://127.0.0.1:3001/overlay
[Electron] Overlay position: 100,100
[Electron] Overlay size: 360x320
[Electron] Hotkeys:
[Electron]   Ctrl+Shift+O - Toggle overlay visibility
[Electron]   Ctrl+Shift+X - Toggle click-through
[Electron] ============================================================
```

**Expected Results:**
- ✅ App starts within 5-10 seconds
- ✅ System tray icon appears
- ✅ No error dialogs
- ✅ Server starts successfully
- ✅ Overlay window created (hidden initially)

**If Startup Fails:**
- Check logs for error messages
- Verify port 3001 is not in use
- Check antivirus didn't block
- Look for missing dependencies

---

## 🎮 Overlay Testing

### **Test 4: Overlay Window Management**

**Steps:**
1. Right-click system tray icon
2. Click "Show Overlay"
3. Verify overlay appears
4. Click "Show Overlay" again
5. Verify same overlay brought to front (border flash)

**Expected Logs:**
```
[Electron] [Overlay] showOverlay() called
[Electron] [Overlay] Brought existing overlay to front
[Electron] [Overlay] Window visible: true
[Electron] [Overlay] Window focused: true
```

**Expected Results:**
- ✅ Overlay appears as transparent window
- ✅ Overlay is frameless (no title bar)
- ✅ Overlay stays on top of other windows
- ✅ Border flashes orange when brought to front
- ✅ Only ONE overlay window exists
- ✅ Overlay not visible in taskbar

**Verify Overlay Properties:**
- Transparent background: ✅
- Frameless: ✅
- Always on top: ✅
- Skip taskbar: ✅
- Size: 360x320px ✅
- Movable: ✅

---

### **Test 5: Dashboard "Open Overlay" Button**

**Steps:**
1. Open dashboard (tray → "Open Dashboard")
2. Click "Open Overlay" button in header
3. Verify overlay appears/focuses
4. Check for toast notification

**Expected Logs:**
```
[Electron] [Bridge] Dashboard requested overlay show via IPC
[Electron] [Overlay] showOverlay() called
```

**Expected Results:**
- ✅ Overlay appears or comes to front
- ✅ Toast shows "Overlay window shown"
- ✅ No browser window opens
- ✅ Same overlay instance reused

**If Opens Browser Window:**
- ❌ FAIL - Browser fallback should not trigger in Electron
- Check preload.js is loaded
- Check window.electronAPI exists

---

### **Test 6: Overlay Hotkeys**

**Steps:**
1. Press `Ctrl+Shift+O`
2. Verify overlay toggles visibility
3. Press `Ctrl+Shift+X`
4. Verify click-through toggles
5. Try clicking through overlay when enabled

**Expected Results:**
- ✅ Ctrl+Shift+O toggles overlay show/hide
- ✅ Ctrl+Shift+X toggles click-through
- ✅ Click-through allows clicks to pass through
- ✅ Tray menu updates to reflect state

---

## 🔌 Backend Server Testing

### **Test 7: Server Startup in Packaged Mode**

**Verify:**
- ✅ Server uses Electron's Node runtime (ELECTRON_RUN_AS_NODE=1)
- ✅ Server loads from `dist/main.js` (compiled TypeScript)
- ✅ Server starts on port 3001
- ✅ Health check responds at `/health`
- ✅ Dashboard accessible at `/ui`
- ✅ Overlay content at `/overlay`

**Expected Logs:**
```
[Electron] Server startup (packaged mode):
[Electron]   Command: C:\...\CS2 Clutch Mode.exe
[Electron]   Args: [ 'C:\\...\\dist\\main.js' ]
[Server] Starting CS2 Discord Clutch Mode...
[Server] Config loaded from: C:\...\config\config.json
[Server] GSI server listening on http://127.0.0.1:3002/gsi
[Server] UI server listening on http://127.0.0.1:3001
```

---

### **Test 8: Dashboard Access**

**Steps:**
1. Right-click tray icon
2. Click "Open Dashboard"
3. Browser opens to `http://127.0.0.1:3001/ui`
4. Verify all panels load

**Expected Results:**
- ✅ Dashboard loads in default browser
- ✅ All panels visible
- ✅ SSE connection established
- ✅ Status indicators show green
- ✅ "Open Overlay" button works

---

## 🎯 CS2 Integration Testing

### **Test 9: GSI Connection**

**Prerequisites:**
- CS2 installed
- GSI config file in CS2 directory

**Steps:**
1. Launch CS2
2. Start a match (any mode)
3. Watch dashboard for GSI updates
4. Check overlay shows clutch status

**Expected Logs:**
```
[Server] GSI payload received
[Server] Processing game state...
[Server] Clutch detection: Normal
```

**Expected Results:**
- ✅ Dashboard shows live match data
- ✅ Stats update in real-time
- ✅ Overlay reflects game state
- ✅ Clutch detection works

---

### **Test 10: Clutch Detection**

**Steps:**
1. In CS2, get into 1vX situation
2. Watch overlay for clutch activation
3. Verify visual changes
4. Check dashboard clutch history

**Expected Logs:**
```
[Server] 🎯 CLUTCH ACTIVE
[Server] Clutch started: 1v3 (CT)
[Electron] [Overlay] Content updated (clutch active)
```

**Expected Results:**
- ✅ Overlay shows "CLUTCH ACTIVE"
- ✅ Overlay glows orange
- ✅ Dashboard shows clutch event
- ✅ Stats increment clutch attempts

---

## 🔄 Persistence Testing

### **Test 11: Settings Persistence**

**Steps:**
1. Move overlay to new position
2. Enable click-through
3. Close app completely
4. Relaunch app
5. Verify settings restored

**Expected Results:**
- ✅ Overlay position remembered
- ✅ Click-through state restored
- ✅ Visibility preference restored
- ✅ Settings file created in user data

**Settings Location:**
```
C:\Users\<username>\AppData\Roaming\cs2-clutch-mode\config.json
```

---

### **Test 12: Clean Shutdown**

**Steps:**
1. Right-click tray icon
2. Click "Exit"
3. Wait for app to close
4. Verify no processes remain

**Expected Logs:**
```
[Electron] Stopping server (PID: xxxxx)...
[Electron] Server stopped via taskkill
[Server] Server shutting down...
```

**Expected Results:**
- ✅ App closes cleanly
- ✅ Server process terminated
- ✅ No orphaned Node processes
- ✅ Port 3001 released
- ✅ No error dialogs

**Verify:**
```powershell
# Check no processes remain
tasklist | findstr "CS2 Clutch Mode"
tasklist | findstr node

# Check port released
netstat -ano | findstr :3001
```

---

## ❌ Error Scenario Testing

### **Test 13: Port Already in Use**

**Steps:**
1. Start something on port 3001
2. Launch CS2 Clutch Mode
3. Verify error dialog

**Expected:**
- ❌ Error dialog: "Server did not start in time"
- ✅ Suggests port 3001 in use
- ✅ App closes gracefully

---

### **Test 14: Server Crash Recovery**

**Steps:**
1. Launch app normally
2. Kill server process manually
3. Verify error handling

**Expected:**
- ❌ Error dialog: "Server Crashed"
- ✅ Shows exit code and signal
- ✅ App closes gracefully

---

## 📊 Performance Testing

### **Test 15: Resource Usage**

**Monitor:**
- Memory usage (Task Manager)
- CPU usage during gameplay
- Disk I/O
- Network activity

**Expected:**
- Memory: < 200 MB total
- CPU: < 5% idle, < 15% during gameplay
- Disk: Minimal after startup
- Network: Local only (127.0.0.1)

---

## 🔍 Validation Checklist

### **Critical Features**

- [ ] App installs successfully
- [ ] App launches without errors
- [ ] System tray icon appears
- [ ] Overlay window created
- [ ] Overlay is transparent
- [ ] Overlay is frameless
- [ ] Overlay is always on top
- [ ] Overlay not in taskbar
- [ ] Single overlay instance enforced
- [ ] "Open Overlay" button works
- [ ] Dashboard loads correctly
- [ ] Server starts in packaged mode
- [ ] GSI integration works
- [ ] Clutch detection works
- [ ] Settings persist
- [ ] Clean shutdown
- [ ] No orphaned processes

### **Logging Verification**

- [ ] Startup logs show version info
- [ ] Packaged mode detected correctly
- [ ] Server startup logs visible
- [ ] Overlay operations logged
- [ ] Bridge IPC calls logged
- [ ] Error scenarios logged
- [ ] Shutdown logged

### **User Experience**

- [ ] No console window visible (packaged)
- [ ] Error dialogs are user-friendly
- [ ] Tray menu is functional
- [ ] Hotkeys work globally
- [ ] Overlay positioning works
- [ ] Click-through toggle works
- [ ] Dashboard is responsive

---

## 🐛 Common Issues & Solutions

### **Issue: App won't start**

**Symptoms:**
- Double-click does nothing
- Error dialog immediately
- Process appears then disappears

**Solutions:**
1. Check antivirus logs
2. Run as administrator
3. Check Windows Event Viewer
4. Verify port 3001 available
5. Check disk space

---

### **Issue: Overlay opens as browser window**

**Symptoms:**
- Normal browser window instead of transparent overlay
- Multiple overlay windows
- Overlay has title bar

**Solutions:**
1. Verify running installed app (not browser)
2. Check preload.js loaded
3. Verify window.electronAPI exists
4. Check Electron version

---

### **Issue: Server won't start**

**Symptoms:**
- "Server did not start in time" error
- Health check fails
- Port 3001 already in use

**Solutions:**
1. Kill processes on port 3001
2. Check firewall settings
3. Verify dist/main.js exists
4. Check Node runtime available

---

### **Issue: Settings not persisting**

**Symptoms:**
- Overlay position resets
- Click-through state lost
- Preferences not saved

**Solutions:**
1. Check user data directory writable
2. Verify config.json created
3. Check file permissions
4. Run app as administrator

---

## 📝 Test Report Template

```
# CS2 Clutch Mode - Packaged Build Test Report

**Date:** [Date]
**Tester:** [Name]
**Build:** CS2-Clutch-Mode-Setup-1.0.0.exe
**OS:** Windows [Version]

## Installation
- [ ] NSIS Installer: PASS / FAIL
- [ ] Portable: PASS / FAIL
- Notes: [Any issues]

## Startup
- [ ] First launch: PASS / FAIL
- [ ] Server startup: PASS / FAIL
- [ ] Tray icon: PASS / FAIL
- Notes: [Startup time, errors]

## Overlay
- [ ] Window creation: PASS / FAIL
- [ ] Transparency: PASS / FAIL
- [ ] Always on top: PASS / FAIL
- [ ] Single instance: PASS / FAIL
- [ ] Open Overlay button: PASS / FAIL
- Notes: [Any visual issues]

## Functionality
- [ ] Dashboard access: PASS / FAIL
- [ ] GSI integration: PASS / FAIL
- [ ] Clutch detection: PASS / FAIL
- [ ] Settings persistence: PASS / FAIL
- [ ] Clean shutdown: PASS / FAIL
- Notes: [Feature issues]

## Performance
- Memory usage: [XX MB]
- CPU usage: [XX%]
- Startup time: [XX seconds]
- Notes: [Performance issues]

## Issues Found
1. [Issue description]
2. [Issue description]

## Overall Result
- [ ] PASS - Ready for release
- [ ] FAIL - Needs fixes

## Additional Notes
[Any other observations]
```

---

## 🎉 Success Criteria

The packaged build is **READY FOR RELEASE** if:

✅ All critical features work  
✅ No crashes or errors  
✅ Overlay behaves correctly  
✅ Server starts in packaged mode  
✅ Settings persist  
✅ Clean shutdown  
✅ Performance acceptable  
✅ Logging comprehensive  
✅ User experience smooth  

---

## 📞 Support Information

**If testing reveals issues:**

1. **Collect logs** from console output
2. **Note exact steps** to reproduce
3. **Check Windows Event Viewer**
4. **Verify system requirements**
5. **Document error messages**

**Log locations:**
- Console: Visible during startup (if not hidden)
- Settings: `%APPDATA%\cs2-clutch-mode\config.json`
- Electron logs: `%APPDATA%\cs2-clutch-mode\logs\` (if enabled)

---

**Happy Testing! 🎮**
