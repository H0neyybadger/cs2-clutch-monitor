# Network Issue Prevention Guide

## 🛡️ How to Prevent Future Network Issues

This guide explains the built-in protections and best practices to prevent the CS2 Clutch Mode app from interfering with your network.

---

## **Built-In Protections** ✅

### **1. Connection Limits**
- **Max 8 concurrent SSE connections** (conservative limit)
- **Max 10 total connections** in state store
- **Automatic rejection** of excess connections

### **2. Connection Cleanup**
- **15-second timeout** for idle connections
- **Proper close handling** on disconnect/error/abort
- **Periodic cleanup** of dead listeners
- **TIME_WAIT prevention** with `Connection: close`

### **3. Browser Tab Management**
- **Single active tab** enforcement
- **Automatic tab release** when hidden
- **Multiple tab detection** with warning
- **LocalStorage coordination** between tabs

### **4. Network Monitoring**
- **Real-time connection tracking**
- **Auto-cleanup** on critical connection counts
- **Health status logging**
- **30-second monitoring intervals**

---

## **Safe Usage Practices** 📋

### **✅ DO:**
- Use **only one dashboard tab** at a time
- Close browser tabs when not using the app
- Use the **safe startup scripts**
- Monitor with the **network health monitor**
- Stop the server when done playing

### **❌ DON'T:**
- Open multiple dashboard tabs
- Leave the app running 24/7
- Ignore connection warnings
- Use force-kill unless necessary
- Run multiple instances simultaneously

---

## **Startup Methods** 🚀

### **1. Safest: With Monitor (Recommended)**
```bash
start-with-monitor.bat
```
**Features:**
- Automatic network health check
- Connection cleanup if needed
- Network monitor in separate window
- Real-time connection tracking

### **2. Safe: Standard**
```bash
safe-start.bat
```
**Features:**
- Port availability check
- Basic cleanup
- Safe startup procedures

### **3. Manual: Advanced**
```bash
npm run dev
```
**Use when:**
- You know what you're doing
- Need debugging capabilities
- Monitor connections manually

---

## **Monitoring Tools** 🔍

### **1. Network Health Monitor**
```bash
node network-health-monitor.js
```
**What it monitors:**
- Port 3001 & 3002 connection counts
- Active connection status
- Auto-cleanup on critical levels
- Real-time health logging

### **2. Connection Checker**
```bash
check-connections.bat
```
**What it shows:**
- Current port usage
- TIME_WAIT connections
- Node.js processes
- Connection health status

### **3. Force Cleanup**
```bash
force-cleanup.bat
```
**When to use:**
- Network issues detected
- High connection counts
- App won't start properly

---

## **Warning Signs** ⚠️

### **Early Warning:**
- Multiple dashboard tabs open
- Connection count > 5 per port
- Network monitor shows warnings
- GPT uploads start failing

### **Critical:**
- Connection count > 10 per port
- Auto-cleanup triggers
- Other apps lose connectivity
- TIME_WAIT accumulation

---

## **Emergency Procedures** 🚨

### **Step 1: Quick Fix**
```bash
taskkill /F /IM node.exe
```

### **Step 2: Deep Clean**
```bash
force-cleanup.bat
# (Run as Administrator if needed)
```

### **Step 3: Restart Router**
If issues persist:
1. Unplug router for 30 seconds
2. Plug back in and wait 2 minutes
3. Try upload again

### **Step 4: System Restart**
Last resort:
1. Save all work
2. Restart computer
3. Start CS2 Clutch Mode with monitor

---

## **Configuration Tweaks** ⚙️

### **Conservative Settings** (for sensitive networks)
```javascript
// In src/ui/sse.ts
const MAX_CONNECTIONS = 5;           // Reduced from 8
const CLEANUP_INTERVAL = 30000;     // Faster cleanup
res.setTimeout(10000);               // Shorter timeout
```

### **Aggressive Settings** (for robust networks)
```javascript
const MAX_CONNECTIONS = 15;          // Higher limit
const CLEANUP_INTERVAL = 120000;    // Slower cleanup
res.setTimeout(30000);               // Longer timeout
```

---

## **Browser Settings** 🌐

### **Chrome/Edge:**
- Limit to **1 dashboard tab**
- Enable **tab memory saver**
- Close unused tabs regularly

### **Firefox:**
- Use **container tabs** for isolation
- Enable **automatic tab discard**
- Monitor with **about:performance**

---

## **Network Configuration** 🌍

### **Windows Settings:**
```cmd
# Increase connection limits (optional)
netsh int tcp set global MaxUserPort=65534
netsh int tcp set global TcpTimedWaitDelay=30
```

### **Router Settings:**
- Enable **UPnP** for automatic port management
- Set **reasonable connection limits**
- Monitor **connection table usage**

---

## **Troubleshooting Flowchart** 🔄

```
Network Issue?
    ↓
Check Connections (check-connections.bat)
    ↓
High Count (>10)?
    ↓ YES → Force Cleanup → Restart Monitor
    ↓ NO → Check Browser Tabs
    ↓
Multiple Tabs?
    ↓ YES → Close Extra Tabs → Refresh
    ↓ NO → Check Router
    ↓
Router Issue?
    ↓ YES → Restart Router → Test Upload
    ↓ NO → System Restart
```

---

## **Best Practices Summary** 📝

### **Daily Usage:**
1. Start with `start-with-monitor.bat`
2. Use only one dashboard tab
3. Close app when done playing
4. Monitor network health occasionally

### **Weekly Maintenance:**
1. Run `check-connections.bat`
2. Clear browser cache
3. Restart if high connections detected

### **Monthly:**
1. Update the app
2. Review network monitor logs
3. Check for configuration updates

---

## **Contact & Support** 📞

If issues persist after following this guide:

1. **Check logs** in network monitor
2. **Document** the error messages
3. **Note** what you were doing when it happened
4. **Try** the emergency procedures

The built-in protections should prevent 99% of network issues. The remaining 1% usually require system-level fixes.

---

**Remember:** The app is designed to be network-friendly. Following these best practices ensures it plays nicely with your other applications! 🎮
