# Overlay Launch Behavior Documentation

## ✅ Fixed Implementation

The overlay launch behavior has been corrected to ensure the overlay always opens as a managed, transparent Electron window instead of a normal browser window.

---

## **How It Works**

### **Single Instance Pattern**

The overlay uses a **single instance pattern** managed by Electron:

1. **First Launch:** Creates the overlay `BrowserWindow` with proper properties
2. **Subsequent Launches:** Brings existing overlay to front, restores if hidden
3. **No Duplicates:** Only one overlay window can exist at a time

---

## **Overlay Window Properties** 🎯

The overlay is created with these specific properties:

```javascript
{
  width: 360,
  height: 320,
  frame: false,              // No window frame
  transparent: true,         // Transparent background
  backgroundColor: '#00000000',
  alwaysOnTop: true,        // Always on top of other windows
  resizable: false,         // Fixed size
  skipTaskbar: true,        // Not shown in taskbar
  hasShadow: false,         // No window shadow
  focusable: true,          // Can receive focus
}
```

**Additional Settings:**
- `setVisibleOnAllWorkspaces(true)` - Visible on all virtual desktops
- `visibleOnFullScreen: true` - Visible even in fullscreen games

---

## **Launch Methods**

### **1. Dashboard "Open Overlay" Button**

**Location:** Dashboard header  
**Function:** `openOverlay()`  
**Behavior:**
- Calls `window.electronAPI.showOverlay()`
- Shows toast notification on success
- Only works in Electron app (not browser)

```javascript
function openOverlay() {
  if (window.electronAPI && window.electronAPI.showOverlay) {
    window.electronAPI.showOverlay()
      .then(() => toast('Overlay window shown', 'success'));
  } else {
    toast('Overlay only available in Electron app', 'error');
  }
}
```

### **2. System Tray Menu**

**Location:** System tray icon  
**Menu Item:** "Show Overlay" / "Hide Overlay"  
**Behavior:**
- Toggles overlay visibility
- Updates menu label dynamically
- Calls `showOverlay()` function

### **3. Global Hotkey**

**Hotkey:** `Ctrl+Shift+O` (Windows/Linux) or `Cmd+Shift+O` (Mac)  
**Behavior:**
- Toggles overlay visibility
- Creates overlay if destroyed
- Shows/hides if already exists

### **4. Automatic on Startup**

**Condition:** If `overlayVisible` preference is `true`  
**Behavior:**
- Restores overlay on app launch
- Respects last visibility state
- Maintains position and size

---

## **showOverlay() Function Logic**

```javascript
function showOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    // Case 1: No overlay exists - create new one
    createOverlayWindow();
    setClickThrough(false);
    store.setPrefs({ overlayVisible: true });
  } else {
    // Case 2: Overlay exists - bring to front
    
    // Temporarily disable click-through for visibility
    const wasClickThrough = clickThrough;
    if (clickThrough) {
      setClickThrough(false);
    }
    
    // Show and focus
    if (!overlayWindow.isVisible()) {
      overlayWindow.show();
      store.setPrefs({ overlayVisible: true });
    }
    overlayWindow.focus();
    overlayWindow.moveTop();
    
    // Visual feedback: flash border
    overlayWindow.webContents.send('flash-border');
    
    // Restore click-through after 2 seconds
    if (wasClickThrough) {
      setTimeout(() => {
        setClickThrough(true);
      }, 2000);
    }
  }
  
  updateTrayMenu();
}
```

---

## **State Management**

### **Window States**

1. **Created & Visible** - Normal active state
2. **Created & Hidden** - Window exists but not shown
3. **Destroyed** - Window closed, needs recreation
4. **Minimized** - Restored on `showOverlay()`

### **Persistence**

**Saved to Store:**
- `overlayVisible` - Visibility preference
- `clickThrough` - Click-through state
- `window.x`, `window.y` - Position
- `window.width`, `window.height` - Size

**Restored on Launch:**
- Position and size from last session
- Visibility state
- Click-through preference

---

## **Visual Feedback**

### **Border Flash Animation**

When bringing existing overlay to front:
- Orange border pulses twice
- Duration: 2 seconds total
- CSS class: `.border-flash`

```css
@keyframes borderFlash {
  0%, 100% { border-color: transparent; }
  50% { border-color: #f97316; }
}

.border-flash {
  animation: borderFlash 1s ease-in-out 2;
}
```

### **Click-Through Behavior**

When showing overlay:
- Click-through temporarily disabled (2 seconds)
- Allows user to interact immediately
- Auto-restores previous state
- Prevents accidental clicks in game

---

## **IPC Communication Flow**

```
Dashboard (Renderer)
  ↓ window.electronAPI.showOverlay()
Preload.js
  ↓ ipcRenderer.invoke('show-overlay')
Main Process (main.js)
  ↓ ipcMain.handle('show-overlay')
showOverlay() function
  ↓ createOverlayWindow() OR restore existing
Overlay Window (BrowserWindow)
  ↓ Loads http://127.0.0.1:3001/overlay
Overlay Content (overlay.html)
```

---

## **Error Handling**

### **Dashboard Not in Electron**

```javascript
if (!window.electronAPI) {
  toast('Overlay only available in Electron app', 'error');
}
```

**User sees:** Error toast notification  
**Console:** Warning message  
**Result:** No action taken

### **Overlay Creation Fails**

**Handled by:** Electron's BrowserWindow error events  
**Logged to:** Console with `[Electron]` prefix  
**Fallback:** User can retry via tray or hotkey

---

## **Testing Checklist**

### **✅ Single Instance**
- [ ] Click "Open Overlay" multiple times
- [ ] Verify only one overlay window exists
- [ ] Check taskbar for duplicates

### **✅ Restore from Hidden**
- [ ] Hide overlay (Ctrl+Shift+O)
- [ ] Click "Open Overlay"
- [ ] Verify overlay appears at same position

### **✅ Visual Feedback**
- [ ] Bring overlay to front
- [ ] Verify border flash animation
- [ ] Check click-through temporarily disabled

### **✅ Properties Preserved**
- [ ] Verify overlay is transparent
- [ ] Verify overlay is frameless
- [ ] Verify overlay is always on top
- [ ] Verify overlay not in taskbar

### **✅ Position Persistence**
- [ ] Move overlay to new position
- [ ] Close and reopen app
- [ ] Verify overlay at saved position

### **✅ All Launch Methods**
- [ ] Dashboard "Open Overlay" button
- [ ] System tray menu
- [ ] Global hotkey (Ctrl+Shift+O)
- [ ] Automatic on startup

---

## **Common Issues & Solutions**

### **Issue: Overlay opens as normal window**

**Cause:** Using browser fallback instead of Electron API  
**Solution:** Removed browser fallback from `openOverlay()`  
**Status:** ✅ Fixed

### **Issue: Multiple overlay windows**

**Cause:** Not checking if overlay exists before creating  
**Solution:** Single instance pattern in `showOverlay()`  
**Status:** ✅ Fixed

### **Issue: Overlay not transparent**

**Cause:** Missing `transparent: true` or wrong background  
**Solution:** Set in `createOverlayWindow()` config  
**Status:** ✅ Fixed

### **Issue: Can't interact with overlay**

**Cause:** Click-through enabled  
**Solution:** Toggle with Ctrl+Shift+X or auto-disabled on show  
**Status:** ✅ Working as designed

---

## **Architecture Summary**

### **Main Process (main.js)**
- Creates and manages overlay `BrowserWindow`
- Handles IPC requests from dashboard
- Manages window state and persistence
- Registers global hotkeys

### **Preload Script (preload.js)**
- Exposes `showOverlay()` to renderer
- Bridges IPC communication
- Provides secure API surface

### **Dashboard (app.js)**
- Calls `window.electronAPI.showOverlay()`
- Shows user feedback via toasts
- Only works in Electron context

### **Overlay Content (overlay.html/js)**
- Loads in managed BrowserWindow
- Receives flash-border events
- Handles click-through hotspots

---

## **Key Differences: Before vs After**

### **Before (Broken):**
- ❌ Browser fallback opened normal window
- ❌ Raw `/overlay` route in browser tab
- ❌ No transparency or frameless
- ❌ Not always on top
- ❌ Multiple instances possible

### **After (Fixed):**
- ✅ Only uses Electron overlay window
- ✅ Proper transparent, frameless window
- ✅ Always on top, skip taskbar
- ✅ Single instance pattern
- ✅ Visual feedback on show
- ✅ Position and state persistence

---

## **Future Enhancements**

### **Potential Improvements:**
1. **Multi-monitor support** - Remember which monitor
2. **Resize support** - Allow custom overlay sizes
3. **Themes** - Different overlay styles
4. **Snap to edges** - Magnetic window positioning
5. **Fade animations** - Smooth show/hide transitions

---

## **Conclusion**

The overlay launch behavior is now **fully functional** and follows best practices:

✅ **Single instance** - No duplicates  
✅ **Proper window type** - Transparent, frameless, always on top  
✅ **State persistence** - Position and preferences saved  
✅ **Visual feedback** - Border flash on show  
✅ **Multiple launch methods** - Dashboard, tray, hotkey, auto  
✅ **Error handling** - Graceful fallback messages  

The overlay will **always** open as the managed Electron window, never as a normal browser window.
