# CS2 Clutch Mode - Windows Installer Build Instructions

## 🎯 Build Output Summary

### **Build Completed Successfully! ✅**

**Date:** March 7, 2026  
**Build Command:** `npm run electron:build`  
**Build Time:** ~60 seconds  
**Output Directory:** `dist-electron/`

---

## 📦 Generated Files

### **1. NSIS Installer (Recommended)**
```
📁 dist-electron/
  📄 CS2-Clutch-Mode-Setup-1.0.0.exe
  📄 CS2-Clutch-Mode-Setup-1.0.0.exe.blockmap
```

**File:** `CS2-Clutch-Mode-Setup-1.0.0.exe`  
**Type:** Windows NSIS Installer  
**Size:** ~150-200 MB  

**Features:**
- ✅ Installation wizard
- ✅ Choose installation directory
- ✅ Desktop shortcut creation
- ✅ Start menu shortcut
- ✅ Proper uninstaller
- ✅ Windows registry integration

**Install Location (default):**
```
C:\Users\<username>\AppData\Local\Programs\cs2-clutch-mode\
```

**User Data Location:**
```
C:\Users\<username>\AppData\Roaming\cs2-clutch-mode\
```

---

### **2. Portable Executable**
```
📁 dist-electron/
  📄 CS2-Clutch-Mode-1.0.0-portable.exe
```

**File:** `CS2-Clutch-Mode-1.0.0-portable.exe`  
**Type:** Portable Windows Executable  
**Size:** ~150-200 MB  

**Features:**
- ✅ No installation required
- ✅ Run from any location
- ✅ USB drive compatible
- ✅ No registry changes
- ✅ Settings stored in app directory

**Use Cases:**
- Testing without installation
- Running from USB drive
- Portable deployment
- No admin rights needed

---

### **3. Unpacked Application**
```
📁 dist-electron/win-unpacked/
  📄 CS2 Clutch Mode.exe
  📁 resources/
    📁 app/
      📁 src/
      📁 dist/
      📁 config/
      📁 node_modules/
      📄 package.json
  📁 locales/
  📄 [various DLLs and resources]
```

**Directory:** `dist-electron/win-unpacked/`  
**Main Executable:** `CS2 Clutch Mode.exe`  

**Use Cases:**
- Quick testing without installation
- Debugging packaged app
- Inspecting app structure
- Development validation

---

## 🔨 Build Process

### **What Happens During Build**

1. **Clean:** Removes old `dist/` directory
2. **TypeScript Compilation:** `tsc` compiles `src/**/*.ts` → `dist/**/*.js`
3. **Electron Builder:** Packages app with electron-builder
4. **NSIS Creation:** Builds Windows installer
5. **Portable Creation:** Builds portable executable
6. **Unpacked Output:** Creates unpacked app directory

### **Build Configuration**

**File:** `electron-builder.json`

```json
{
  "appId": "com.cs2clutchmode.overlay",
  "productName": "CS2 Clutch Mode",
  "directories": {
    "output": "dist-electron"
  },
  "win": {
    "target": ["nsis", "portable"]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  },
  "asar": false,
  "npmRebuild": false
}
```

**Key Settings:**
- `asar: false` - Files not packed into archive (easier debugging)
- `npmRebuild: false` - Skip native module rebuild (discord-rpc prebuilt)
- `target: ["nsis", "portable"]` - Build both installer types

---

## 🚀 Installation & Testing

### **Option 1: NSIS Installer (Recommended)**

**Steps:**
1. Navigate to `dist-electron/`
2. Double-click `CS2-Clutch-Mode-Setup-1.0.0.exe`
3. Follow installation wizard
4. Choose installation directory (or use default)
5. Enable desktop shortcut
6. Click "Install"
7. Launch from desktop shortcut or Start menu

**Installed Files:**
```
C:\Users\<username>\AppData\Local\Programs\cs2-clutch-mode\
├── CS2 Clutch Mode.exe
├── resources\
│   └── app\
│       ├── src\
│       ├── dist\
│       ├── config\
│       └── node_modules\
└── [Electron runtime files]
```

**Settings Storage:**
```
C:\Users\<username>\AppData\Roaming\cs2-clutch-mode\
└── config.json
```

---

### **Option 2: Portable Executable**

**Steps:**
1. Copy `CS2-Clutch-Mode-1.0.0-portable.exe` to desired location
2. Double-click to run
3. App runs without installation

**Portable Mode:**
- Settings stored in app directory
- No registry modifications
- Can run from USB drive
- No admin rights required

---

### **Option 3: Unpacked (Testing)**

**Steps:**
1. Navigate to `dist-electron/win-unpacked/`
2. Double-click `CS2 Clutch Mode.exe`
3. App runs directly from unpacked directory

**Use for:**
- Quick testing
- Debugging
- Inspecting app structure

---

## 📋 Validation Checklist

### **Quick Validation (5 minutes)**

After installation, verify:

1. **Launch:**
   - [ ] App starts without errors
   - [ ] System tray icon appears
   - [ ] No error dialogs

2. **Overlay:**
   - [ ] Right-click tray → "Show Overlay"
   - [ ] Overlay appears as transparent window
   - [ ] Overlay is frameless (no title bar)
   - [ ] Overlay stays on top

3. **Dashboard:**
   - [ ] Right-click tray → "Open Dashboard"
   - [ ] Browser opens to dashboard
   - [ ] All panels load correctly
   - [ ] "Open Overlay" button works

4. **Shutdown:**
   - [ ] Right-click tray → "Exit"
   - [ ] App closes cleanly
   - [ ] No orphaned processes

**If all checks pass:** ✅ Build is working correctly!

---

### **Full Validation**

See `PACKAGED_BUILD_TESTING.md` for comprehensive testing guide.

---

## 🔍 Logging & Debugging

### **Console Output**

When running the packaged app, you'll see detailed logs:

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
[Electron] Starting backend server...
[Electron] Server startup (packaged mode):
[Electron]   Command: C:\...\CS2 Clutch Mode.exe
[Electron]   Args: [ 'C:\\...\\resources\\app\\dist\\main.js' ]
[Electron]   Main script: C:\...\resources\app\dist\main.js
[Electron] Server process spawned successfully (PID: xxxxx)
[Server] Starting CS2 Discord Clutch Mode...
[Server] GSI server listening on http://127.0.0.1:3002/gsi
[Server] UI server listening on http://127.0.0.1:3001
[Electron] Server is ready!
[Electron] Creating system tray icon...
[Electron] [Overlay] createOverlayWindow() called
[Electron] [Overlay] Loading overlay URL: http://127.0.0.1:3001/overlay
[Electron] [Overlay] Content loaded successfully
[Electron] ============================================================
[Electron] Startup complete!
[Electron] Dashboard URL: http://127.0.0.1:3001/ui
[Electron] Overlay URL: http://127.0.0.1:3001/overlay
[Electron] ============================================================
```

### **Log Prefixes**

- `[Electron]` - Main process events
- `[Server]` - Backend server output
- `[Overlay]` - Overlay window operations
- `[Bridge]` - Dashboard IPC communication

### **Viewing Logs**

**During Development:**
- Console output visible in terminal

**Packaged App:**
- Console output may not be visible
- Use Windows Event Viewer for errors
- Check `%APPDATA%\cs2-clutch-mode\` for settings

---

## 🔧 Rebuilding

### **Full Rebuild**

```bash
npm run electron:build
```

**Steps:**
1. Clean old `dist/` directory
2. Compile TypeScript (`tsc`)
3. Package with electron-builder
4. Create NSIS installer
5. Create portable executable

**Time:** ~60 seconds

---

### **Quick Rebuild (TypeScript only)**

```bash
npm run build:ts
```

**Use when:**
- Only TypeScript files changed
- Testing backend changes
- No Electron changes needed

**Time:** ~5 seconds

---

### **Pack Only (No Installer)**

```bash
npm run electron:pack
```

**Output:** Only `dist-electron/win-unpacked/`  
**Use for:** Quick testing without installer creation  
**Time:** ~30 seconds

---

## 📊 Build Statistics

### **File Sizes**

- **NSIS Installer:** ~150-200 MB
- **Portable Executable:** ~150-200 MB
- **Unpacked Directory:** ~300-400 MB

### **Included Dependencies**

- Electron 28.0.0 runtime
- Node.js modules (express, body-parser, etc.)
- TypeScript compiled output
- UI assets (HTML, CSS, JS)
- Configuration files
- Icon assets

### **Excluded from Build**

- TypeScript source files (`*.ts`)
- Source maps (`*.map`)
- Type definitions (`*.d.ts`)
- Testing files (`src/testing/`)
- Development dependencies

---

## 🐛 Troubleshooting

### **Build Fails**

**Error:** `electron-builder not found`
```bash
npm install --save-dev electron-builder
```

**Error:** `tsc not found`
```bash
npm install --save-dev typescript
```

**Error:** `Port 3001 in use`
- Kill processes on port 3001
- Close any running instances

---

### **Installer Won't Run**

**Issue:** Antivirus blocks installer

**Solution:**
1. Add exception for `dist-electron/` folder
2. Temporarily disable antivirus
3. Run as administrator

---

### **App Won't Start After Install**

**Check:**
1. Port 3001 available
2. Disk space sufficient
3. Windows Event Viewer for errors
4. Run as administrator

---

## 📝 Distribution

### **Distributing the Installer**

**Recommended:** `CS2-Clutch-Mode-Setup-1.0.0.exe`

**Why:**
- Professional installation experience
- Proper uninstaller
- Desktop/Start menu shortcuts
- User-friendly for end users

**Distribution Methods:**
- Direct download link
- GitHub Releases
- File sharing service
- Company intranet

---

### **Distributing the Portable**

**Alternative:** `CS2-Clutch-Mode-1.0.0-portable.exe`

**Why:**
- No installation required
- USB drive compatible
- Quick testing
- No admin rights needed

**Use Cases:**
- LAN parties
- Temporary installations
- Testing environments
- Restricted systems

---

## 🔐 Code Signing (Future)

**Current Status:** Not code signed

**Impact:**
- Windows SmartScreen warning on first run
- Users must click "More info" → "Run anyway"

**Future Enhancement:**
- Obtain code signing certificate
- Sign installer with `electron-builder`
- Remove SmartScreen warnings

**Configuration (when ready):**
```json
{
  "win": {
    "certificateFile": "path/to/cert.pfx",
    "certificatePassword": "password"
  }
}
```

---

## 📚 Additional Resources

- **Testing Guide:** `PACKAGED_BUILD_TESTING.md`
- **Overlay Behavior:** `OVERLAY_LAUNCH_BEHAVIOR.md`
- **Network Prevention:** `NETWORK_PREVENTION_GUIDE.md`
- **electron-builder docs:** https://www.electron.build/

---

## ✅ Build Success Confirmation

Your Windows installer build is **COMPLETE** and **READY FOR TESTING**!

**Next Steps:**
1. Navigate to `dist-electron/`
2. Run `CS2-Clutch-Mode-Setup-1.0.0.exe`
3. Follow testing checklist in `PACKAGED_BUILD_TESTING.md`
4. Verify all features work correctly
5. Distribute to users if tests pass

**Build Output:**
```
✅ NSIS Installer: dist-electron/CS2-Clutch-Mode-Setup-1.0.0.exe
✅ Portable: dist-electron/CS2-Clutch-Mode-1.0.0-portable.exe
✅ Unpacked: dist-electron/win-unpacked/CS2 Clutch Mode.exe
```

**Happy Testing! 🎮**
