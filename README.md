# CS2 Clutch Mode

> **Automatic Discord volume control for Counter-Strike 2 clutch situations**

CS2 Clutch Mode is a desktop application that automatically lowers Discord voice chat volume when you're in a clutch situation in Counter-Strike 2, helping you focus on the game when it matters most.

![CS2 Clutch Mode](https://img.shields.io/badge/CS2-Clutch%20Mode-orange)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-28.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🎮 **Automatic Clutch Detection**
- Detects 1vX situations in real-time using CS2 Game State Integration (GSI)
- Automatically lowers Discord voice chat volume during clutch moments
- Restores volume when clutch ends or round completes

### 🖥️ **Transparent In-Game Overlay**
- Frameless, transparent overlay window
- Always-on-top display for clutch status
- Click-through mode for unobtrusive gameplay
- Visual feedback with orange glow during clutch

### 📊 **Live Dashboard**
- Real-time game state monitoring
- Session statistics tracking (kills, deaths, clutch attempts)
- Discord presence integration
- Event feed with clutch history
- Game state simulator for testing

### ⚙️ **System Tray Integration**
- Runs in background with system tray icon
- Quick access to overlay and dashboard
- Global hotkeys for easy control
- Clean shutdown management

---

## 🚀 Quick Start

### **Download & Install**

1. Download the latest release:
   - **NSIS Installer (Recommended):** `CS2-Clutch-Mode-Setup-1.0.0.exe`
   - **Portable:** `CS2-Clutch-Mode-1.0.0-portable.exe`

2. Run the installer and follow the setup wizard

3. Launch CS2 Clutch Mode from desktop shortcut or Start menu

4. Configure CS2 Game State Integration (see [Setup Guide](#setup))

---

## 📋 Setup

### **1. CS2 Game State Integration**

Create a GSI configuration file for CS2:

**File Location:**
```
C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\gamestate_integration_clutchmode.cfg
```

**File Contents:**
```
"CS2 Clutch Mode Integration"
{
  "uri" "http://127.0.0.1:3002/gsi"
  "timeout" "5.0"
  "buffer" "0.1"
  "throttle" "0.1"
  "heartbeat" "30.0"
  "data"
  {
    "provider" "1"
    "map" "1"
    "round" "1"
    "player_id" "1"
    "player_state" "1"
    "allplayers" "1"
  }
}
```

### **2. Discord Setup**

- Ensure Discord is running
- CS2 Clutch Mode will automatically connect to Discord RPC
- Volume control works with Discord voice channels

### **3. First Launch**

1. System tray icon appears when app starts
2. Right-click tray icon → "Show Overlay" to display in-game overlay
3. Right-click tray icon → "Open Dashboard" to access web dashboard
4. Launch CS2 and start playing!

---

## 🎯 Usage

### **Overlay Controls**

- **Show/Hide:** Right-click tray → "Show Overlay" or press `Ctrl+Shift+O`
- **Click-Through:** Press `Ctrl+Shift+X` to toggle click-through mode
- **Move:** Drag overlay to desired position (position is saved)

### **Dashboard Access**

- **Open:** Right-click tray → "Open Dashboard"
- **URL:** `http://127.0.0.1:3001/ui`
- **Features:**
  - Live match statistics
  - Clutch performance tracking
  - Discord presence status
  - Event feed
  - Game state simulator

### **Hotkeys**

- `Ctrl+Shift+O` - Toggle overlay visibility
- `Ctrl+Shift+X` - Toggle click-through mode

---

## 🛠️ Development

### **Prerequisites**

- Node.js 18+ (LTS recommended)
- npm or yarn
- Git
- Windows 10/11

### **Clone & Install**

```bash
git clone https://github.com/yourusername/cs2-discord-clutch.git
cd cs2-discord-clutch
npm install
```

### **Development Mode**

**Run backend server only:**
```bash
npm run dev
```

**Run with Electron overlay:**
```bash
npm run electron:dev
```

### **Building**

**Compile TypeScript:**
```bash
npm run build:ts
```

**Build Windows installer:**
```bash
npm run electron:build
```

**Output:** `dist-electron/CS2-Clutch-Mode-Setup-1.0.0.exe`

### **Project Structure**

```
cs2-discord-clutch/
├── src/
│   ├── electron/          # Electron main process
│   │   ├── main.js        # Entry point
│   │   ├── preload.js     # Preload script
│   │   ├── store.js       # Settings persistence
│   │   └── icon.js        # Icon generation
│   ├── app/               # Core application
│   │   ├── bootstrap.ts   # App initialization
│   │   ├── state-store.ts # State management
│   │   └── logger.ts      # Logging
│   ├── gsi/               # Game State Integration
│   │   ├── server.ts      # GSI server
│   │   └── parser.ts      # Payload parsing
│   ├── clutch/            # Clutch detection
│   │   └── clutch-engine.ts
│   ├── discord/           # Discord integration
│   │   ├── rpc-client.ts
│   │   ├── presence-controller.ts
│   │   └── volume-controller.ts
│   ├── ui/                # Web UI
│   │   ├── api-routes.ts  # REST API
│   │   ├── sse.ts         # Server-Sent Events
│   │   └── public/        # Frontend assets
│   └── main.ts            # Backend entry point
├── config/                # Configuration files
├── assets/                # Icons and images
├── dist/                  # Compiled TypeScript (gitignored)
├── dist-electron/         # Built installers (gitignored)
└── docs/                  # Documentation
```

---

## 📖 Documentation

- **[Build Instructions](BUILD_INSTRUCTIONS.md)** - How to build Windows installer
- **[Testing Guide](PACKAGED_BUILD_TESTING.md)** - Comprehensive testing checklist
- **[Overlay Behavior](OVERLAY_LAUNCH_BEHAVIOR.md)** - Overlay window management
- **[Network Prevention](NETWORK_PREVENTION_GUIDE.md)** - Network issue prevention

---

## 🔧 Configuration

### **Settings Location**

**User Data:**
```
C:\Users\<username>\AppData\Roaming\cs2-clutch-mode\config.json
```

**Configuration Options:**
- Overlay position and size
- Click-through state
- Visibility preferences
- Discord volume levels

### **Config File Example**

```json
{
  "discord": {
    "normalVolume": 100,
    "clutchVolume": 30,
    "enabled": true
  },
  "overlay": {
    "enabled": true,
    "position": { "x": 100, "y": 100 },
    "size": { "width": 360, "height": 320 }
  }
}
```

---

## 🐛 Troubleshooting

### **App Won't Start**

- Check port 3001 is not in use
- Run as administrator
- Check antivirus isn't blocking
- Verify Windows Event Viewer for errors

### **GSI Not Working**

- Verify GSI config file location
- Check file contents match exactly
- Restart CS2 after creating config
- Check dashboard shows "GSI: Connected"

### **Overlay Not Appearing**

- Press `Ctrl+Shift+O` to toggle
- Check system tray menu
- Verify overlay not hidden off-screen
- Try "Show Overlay" from tray menu

### **Discord Volume Not Changing**

- Ensure Discord is running
- Check Discord RPC connection in dashboard
- Verify Discord voice channel active
- Check config file volume settings

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### **Development Workflow**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Code Style**

- TypeScript for backend
- ESLint configuration included
- Follow existing code patterns
- Add comments for complex logic

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **CS2 Game State Integration** - Valve's GSI system
- **Discord RPC** - Discord Rich Presence integration
- **Electron** - Cross-platform desktop framework
- **Express** - Web server framework

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/cs2-discord-clutch/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/cs2-discord-clutch/discussions)

---

## 🎮 Features in Detail

### **Clutch Detection**

The app monitors CS2 game state and detects clutch situations based on:
- Player alive status
- Team composition
- Enemy count
- Round phase

**Supported Scenarios:**
- 1v1, 1v2, 1v3, 1v4, 1v5
- Both CT and T side
- Bomb plant situations
- Retake scenarios

### **Discord Integration**

- Automatic Discord RPC connection
- Voice channel detection
- Volume control via Discord API
- Presence updates with game status

### **Overlay System**

- Transparent, frameless window
- Always-on-top display
- Click-through mode for gameplay
- Visual feedback (orange glow)
- Position persistence
- Single instance management

### **Dashboard Features**

- **Live Match Panel:** Real-time game state
- **Session Stats:** Kills, deaths, assists, rounds
- **Clutch Performance:** Attempts, wins, highest clutch
- **Discord Presence:** Connection status, activity
- **Event Feed:** Clutch history with timestamps
- **Simulator:** Test clutch scenarios without CS2

---

## 🔒 Privacy & Security

- **Local Only:** All processing happens locally
- **No Telemetry:** No data sent to external servers
- **No Account Required:** Works completely offline
- **Open Source:** Full source code available for review

---

## 🚀 Roadmap

- [ ] Multi-monitor support
- [ ] Custom overlay themes
- [ ] Advanced statistics tracking
- [ ] Replay system for clutch moments
- [ ] Team-based clutch detection
- [ ] Configurable volume curves
- [ ] Auto-updater
- [ ] Linux/Mac support

---

## 📊 Stats

- **Languages:** TypeScript, JavaScript, HTML, CSS
- **Framework:** Electron 28.0.0
- **Backend:** Node.js, Express
- **UI:** Vanilla JavaScript, SSE
- **Build:** electron-builder

---

**Made with ❤️ for the CS2 community**

*Focus on your clutch, we'll handle the noise.*
