/**
 * CS2 Clutch Mode — Electron Main Process
 * 
 * Launches the existing backend server, waits for readiness,
 * then opens a frameless transparent overlay window and system tray.
 * 
 * The backend (src/main.ts) runs as a child process — all existing
 * dashboard, API, SSE, simulator, and overlay routes remain intact.
 * 
 * Logging:
 * - [Electron] prefix for main process events
 * - [Server] prefix for backend server output
 * - [Overlay] prefix for overlay window operations
 * - [Preload] prefix for preload script events
 * - [Bridge] prefix for dashboard bridge detection
 */

// Enhanced logging for packaged mode
const LOG_PREFIX = '[Electron]';
function log(...args) {
  console.log(LOG_PREFIX, ...args);
}
function logError(...args) {
  console.error(LOG_PREFIX, ...args);
}
function logWarn(...args) {
  console.warn(LOG_PREFIX, ...args);
}

const { app, BrowserWindow, Tray, Menu, shell, screen, globalShortcut, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const store = require('./store');
const { createTrayIcon, createAppIcon } = require('./icon');

// Log app startup
log('='.repeat(60));
log('CS2 Clutch Mode Starting');
log('Version:', app.getVersion());
log('Electron:', process.versions.electron);
log('Node:', process.versions.node);
log('Packaged:', app.isPackaged);
log('App Path:', app.getAppPath());
log('User Data:', app.getPath('userData'));
log('='.repeat(60));

// ── Configuration ──────────────────────────────────────────
const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 3001;
const HEALTH_URL = `http://${SERVER_HOST}:${SERVER_PORT}/health`;
const OVERLAY_URL = `http://${SERVER_HOST}:${SERVER_PORT}/overlay`;
const DASHBOARD_URL = `http://${SERVER_HOST}:${SERVER_PORT}/ui`;
const HEALTH_POLL_INTERVAL_MS = 500;
const HEALTH_POLL_TIMEOUT_MS = 30000;
const SAVE_DEBOUNCE_MS = 500;
const OVERWOLF_PROVIDER_PATH = '/provider/overwolf';
const OVERWOLF_BRIDGE_TIMEOUT_MS = 3000;
const OVERWOLF_TRACE_MAX_BYTES = 5 * 1024 * 1024;

// ── State ──────────────────────────────────────────────────
let serverProcess = null;
let overlayWindow = null;
let tray = null;
let clickThrough = false;
let isQuitting = false;
let saveTimer = null;
let didSpawnServer = false;
let overwolfBridgeInitialized = false;
let overwolfTracePath = null;

// ── Server Management ──────────────────────────────────────

function isServerAlive() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < HEALTH_POLL_TIMEOUT_MS) {
    if (await isServerAlive()) return true;
    await new Promise(r => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  return false;
}

function isOverwolfRuntime() {
  return Boolean(app.overwolf && app.overwolf.packages);
}

function getOverwolfTracePath() {
  return path.join(app.getPath('userData'), 'logs', 'overwolf-gep.ndjson');
}

function sanitizeTraceValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 500 ? value.slice(0, 500) + '...[truncated]' : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (depth >= 4) {
    return '[max-depth]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeTraceValue(entry, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }

    seen.add(value);
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = sanitizeTraceValue(entry, depth + 1, seen);
    }
    seen.delete(value);
    return out;
  }

  return String(value);
}

function ensureOverwolfTraceFile() {
  if (!overwolfTracePath) {
    overwolfTracePath = getOverwolfTracePath();
  }

  const dir = path.dirname(overwolfTracePath);
  fs.mkdirSync(dir, { recursive: true });
  process.env.CS2_CLUTCH_OVERWOLF_TRACE_PATH = overwolfTracePath;
}

function appendOverwolfTrace(eventType, payload) {
  try {
    ensureOverwolfTraceFile();

    if (fs.existsSync(overwolfTracePath)) {
      const stats = fs.statSync(overwolfTracePath);
      if (stats.size >= OVERWOLF_TRACE_MAX_BYTES) {
        const rotatedPath = overwolfTracePath + '.1';
        if (fs.existsSync(rotatedPath)) {
          fs.rmSync(rotatedPath, { force: true });
        }
        fs.renameSync(overwolfTracePath, rotatedPath);
      }
    }

    const record = {
      timestamp: new Date().toISOString(),
      eventType,
      payload: sanitizeTraceValue(payload),
    };
    fs.appendFileSync(overwolfTracePath, JSON.stringify(record) + '\n', 'utf8');
  } catch (error) {
    logWarn('Failed to write Overwolf trace:', error.message);
  }
}

function postJson(pathname, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });

    req.on('error', reject);
    req.setTimeout(OVERWOLF_BRIDGE_TIMEOUT_MS, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.write(body);
    req.end();
  });
}

async function sendOverwolfBridgeMessage(kind, payload) {
  appendOverwolfTrace(`bridge:${kind}`, payload);
  try {
    return await postJson(OVERWOLF_PROVIDER_PATH, { kind, payload, receivedAt: Date.now() });
  } catch (error) {
    logWarn('Failed to forward Overwolf payload:', error.message);
    return false;
  }
}

function safeParseOverwolfValue(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  return value;
}

function normalizeOverwolfInfoSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {};
  }

  if (snapshot.info && typeof snapshot.info === 'object') {
    return snapshot.info;
  }

  const flattened = {};
  for (const [category, value] of Object.entries(snapshot)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, value);
    } else {
      flattened[category] = value;
    }
  }

  return flattened;
}

let overwolfGepBound = false;

async function bindOverwolfGepPackage(gep) {
  if (!gep || overwolfGepBound) {
    return;
  }

  overwolfGepBound = true;
  const requiredFeatures = ['live_data', 'match_info'];

  gep.on('error', async (_event, gameId, errorText) => {
    appendOverwolfTrace('gep:error', { gameId, errorText });
    logError('Overwolf GEP error:', gameId, errorText);
    await sendOverwolfBridgeMessage('status', {
      connected: false,
      status: `Overwolf GEP error for game ${gameId}: ${errorText}`
    });
  });

  gep.on('elevated-privileges-required', async (_event, gameId, name, pid) => {
    appendOverwolfTrace('gep:elevated-privileges-required', { gameId, name, pid });
    const status = `Overwolf needs elevated privileges for ${name} (${gameId}) pid=${pid}`;
    logWarn(status);
    await sendOverwolfBridgeMessage('status', { connected: false, status });
  });

  gep.on('game-exit', async (_event, gameId, gameName) => {
    appendOverwolfTrace('gep:game-exit', { gameId, gameName });
    log('Overwolf game exit:', gameName, gameId);
    await sendOverwolfBridgeMessage('reset', {
      gameId,
      status: `${gameName} exited`,
    });
  });

  gep.on('new-info-update', async (_event, gameId, data) => {
    appendOverwolfTrace('gep:new-info-update', { gameId, data });
    if (!data || !data.key) {
      return;
    }

    await sendOverwolfBridgeMessage('info', {
      gameId,
      [data.key]: safeParseOverwolfValue(data.value),
    });
  });

  gep.on('new-game-event', async (_event, gameId, data) => {
    appendOverwolfTrace('gep:new-game-event', { gameId, data });
    if (!data || !data.key) {
      return;
    }

    await sendOverwolfBridgeMessage('events', {
      gameId,
      events: [
        {
          name: data.key,
          feature: data.feature,
          data: safeParseOverwolfValue(data.value),
        },
      ],
    });
  });

  gep.on('game-detected', async (gameLaunchEvent, gameId, name) => {
    appendOverwolfTrace('gep:game-detected', { gameId, name });
    log('Overwolf detected game:', name, gameId);

    try {
      if (gameLaunchEvent && typeof gameLaunchEvent.enable === 'function') {
        gameLaunchEvent.enable();
      }

      await gep.setRequiredFeatures(gameId, requiredFeatures);
      const info = await gep.getInfo(gameId);
      appendOverwolfTrace('gep:get-info', { gameId, info });
      await sendOverwolfBridgeMessage('status', {
        connected: true,
        status: `Overwolf GEP enabled for ${name} (${gameId})`,
      });
      await sendOverwolfBridgeMessage('info', normalizeOverwolfInfoSnapshot(info));
    } catch (error) {
      logError('Failed to enable Overwolf GEP features:', error);
      await sendOverwolfBridgeMessage('status', {
        connected: false,
        status: `Overwolf GEP setup failed for ${name}: ${error.message}`
      });
    }
  });

  try {
    const supportedGames = await gep.getSupportedGames();
    appendOverwolfTrace('gep:supported-games', supportedGames);
    const cs2Entry = supportedGames.find((game) => /counter[ -]?strike 2|cs2/i.test(game.name));
    await sendOverwolfBridgeMessage('status', {
      connected: true,
      status: cs2Entry
        ? `Overwolf GEP ready. Waiting for ${cs2Entry.name} (${cs2Entry.id})`
        : 'Overwolf GEP ready. Waiting for a supported game detection event.',
    });
  } catch (error) {
    logWarn('Unable to query supported Overwolf games:', error.message);
    await sendOverwolfBridgeMessage('status', {
      connected: true,
      status: 'Overwolf GEP package ready. Waiting for game detection.',
    });
  }
}

async function initializeOverwolfBridge() {
  if (!isOverwolfRuntime()) {
    log('Overwolf runtime not detected; backend will use GSI mode');
    return;
  }

  if (overwolfBridgeInitialized) {
    return;
  }

  overwolfBridgeInitialized = true;
  const packageManager = app.overwolf.packages;
  log('Overwolf runtime detected; initializing GEP bridge');

  appendOverwolfTrace('bridge:init', { overwolfRuntime: true });
  await sendOverwolfBridgeMessage('status', {
    connected: true,
    status: 'Initializing Overwolf package bridge',
  });

  packageManager.on('failed-to-initialize', async (_event, packageName) => {
    appendOverwolfTrace('package:failed-to-initialize', { packageName });
    const status = `Overwolf package failed to initialize: ${packageName}`;
    logError(status);
    await sendOverwolfBridgeMessage('status', { connected: false, status });
  });

  packageManager.on('ready', async (_event, packageName, version) => {
    appendOverwolfTrace('package:ready', { packageName, version });
    log('Overwolf package ready:', packageName, version);
    if (packageName === 'gep') {
      await bindOverwolfGepPackage(packageManager.gep);
    }
  });

  if (packageManager.gep) {
    appendOverwolfTrace('package:gep-present', { immediate: true });
    await bindOverwolfGepPackage(packageManager.gep);
  }
}

function getProjectRoot() {
  let root;
  if (app.isPackaged) {
    // In packaged mode, resources are at process.resourcesPath/app/
    root = path.join(process.resourcesPath, 'app');
    log('Project root (packaged):', root);
  } else {
    // In dev mode, __dirname is src/electron/ so go up two levels
    root = path.resolve(__dirname, '..', '..');
    log('Project root (dev):', root);
  }
  return root;
}

function startServer() {
  const projectRoot = getProjectRoot();
  const runtimeConfigPath = path.join(app.getPath('userData'), 'runtime-settings.json');
  const tracePath = overwolfTracePath || getOverwolfTracePath();
  let cmd, args, env;

  if (app.isPackaged) {
    // Packaged mode: use Electron's own binary as a Node runtime.
    // Setting ELECTRON_RUN_AS_NODE=1 makes the Electron exe behave
    // identically to plain Node.js — no system Node required.
    cmd = process.execPath;
    const mainPath = path.join(projectRoot, 'dist', 'main.js');
    args = [mainPath];
    env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', CS2_CLUTCH_RUNTIME_CONFIG_PATH: runtimeConfigPath, CS2_CLUTCH_OVERWOLF_TRACE_PATH: tracePath, CS2_CLUTCH_DATA_SOURCE: isOverwolfRuntime() ? 'overwolf' : 'gsi' };
    log('Server startup (packaged mode):');
    log('  Command:', cmd);
    log('  Args:', args);
    log('  Main script:', mainPath);
    log('  Working dir:', projectRoot);
    log('  Runtime config:', runtimeConfigPath);
  } else {
    // Dev mode: use ts-node to run TypeScript source
    cmd = path.join(projectRoot, 'node_modules', '.bin', 'ts-node.cmd');
    const mainPath = path.join(projectRoot, 'src', 'main.ts');
    args = [mainPath];
    env = { ...process.env, CS2_CLUTCH_RUNTIME_CONFIG_PATH: runtimeConfigPath, CS2_CLUTCH_OVERWOLF_TRACE_PATH: tracePath, CS2_CLUTCH_DATA_SOURCE: isOverwolfRuntime() ? 'overwolf' : 'gsi' };
    log('Server startup (dev mode):');
    log('  Command:', cmd);
    log('  Args:', args);
    log('  Main script:', mainPath);
    log('  Runtime config:', runtimeConfigPath);
  }

  serverProcess = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    shell: false,
  });

  didSpawnServer = true;

  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(`[Server] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(`[Server] ${data}`);
  });

  serverProcess.on('spawn', () => {
    log('Server process spawned successfully (PID:', serverProcess.pid, ')');
  });

  serverProcess.on('error', (err) => {
    logError('Failed to start server process:', err);
    logError('  Command:', cmd);
    logError('  Args:', args);
    logError('  Working dir:', projectRoot);
    dialog.showErrorBox(
      'CS2 Clutch Mode — Server Startup Failed',
      `Failed to spawn the backend server process.\n\nError: ${err.message}\n\nCommand: ${cmd}\nArgs: ${args.join(' ')}\n\nThe application will now close.`
    );
    isQuitting = true;
    app.quit();
  });

  serverProcess.on('exit', (code, signal) => {
    log('Server process exited:');
    log('  Exit code:', code);
    log('  Signal:', signal);
    log('  Expected shutdown:', isQuitting);
    if (!isQuitting) {
      logError('Server crashed unexpectedly!');
      dialog.showErrorBox(
        'CS2 Clutch Mode — Server Crashed',
        `The backend server unexpectedly stopped.\n\nExit code: ${code}\nSignal: ${signal}\n\nThe application will now close.`
      );
      isQuitting = true;
      app.quit();
    }
  });
}

function stopServer() {
  if (!serverProcess) {
    log('No server process to stop');
    return;
  }
  log('Stopping server (PID:', serverProcess.pid, ')...');
  
  if (process.platform === 'win32') {
    // Windows: use taskkill to force-kill the process tree
    const { execSync } = require('child_process');
    try {
      execSync(`taskkill /pid ${serverProcess.pid} /f /t`, { stdio: 'ignore' });
      log('Server stopped via taskkill');
    } catch (err) {
      logWarn('taskkill failed:', err.message);
    }
  } else {
    serverProcess.kill('SIGTERM');
    log('Sent SIGTERM to server');
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
        log('Sent SIGKILL to server (timeout)');
      }
    }, 2000);
  }
  
  serverProcess = null;
}

// ── Window Bounds Persistence ─────────────────────────────

function validateBounds(bounds) {
  // Ensure the window is at least partially visible on some display
  const displays = screen.getAllDisplays();
  const minVisible = 50; // at least 50px visible

  const isOnScreen = displays.some((display) => {
    const { x, y, width, height } = display.workArea;
    return (
      bounds.x + bounds.width > x + minVisible &&
      bounds.x < x + width - minVisible &&
      bounds.y + bounds.height > y + minVisible &&
      bounds.y < y + height - minVisible
    );
  });

  return isOnScreen;
}

function debouncedSaveWindowState() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const bounds = overlayWindow.getBounds();
      store.setWindow(bounds);
      console.log(`[Electron] Window state saved: ${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`);
    }
  }, SAVE_DEBOUNCE_MS);
}

// ── Overlay Window ─────────────────────────────────────────

/**
 * Show overlay window - creates if needed, brings to front if exists
 * Implements single instance pattern with visual feedback
 */
function showOverlay() {
  log('[Overlay] showOverlay() called');
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    // Create new overlay window
    log('[Overlay] Creating new overlay window...');
    createOverlayWindow();
    setClickThrough(false); // Start interactive for positioning
    store.setPrefs({ overlayVisible: true });
    log('[Overlay] New overlay window created and shown');
  } else {
    // Overlay already exists - bring to front with visual feedback
    const wasClickThrough = clickThrough;
    
    // Temporarily disable click-through for visibility
    if (clickThrough) {
      setClickThrough(false);
      console.log('[Electron] Temporarily disabled click-through to show overlay');
    }
    
    // Show and focus the overlay
    if (!overlayWindow.isVisible()) {
      overlayWindow.show();
      store.setPrefs({ overlayVisible: true });
    }
    overlayWindow.focus();
    overlayWindow.moveTop();
    
    // Send flash border command for visual feedback
    if (overlayWindow.webContents) {
      overlayWindow.webContents.send('flash-border');
    }
    
    log('[Overlay] Brought existing overlay to front');
    log('[Overlay] Window visible:', overlayWindow.isVisible());
    log('[Overlay] Window focused:', overlayWindow.isFocused());
    
    // Restore click-through state after 2 seconds
    if (wasClickThrough) {
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          setClickThrough(true);
          log('[Overlay] Restored click-through state after 2s');
        }
      }, 2000);
    }
  }
  
  updateTrayMenu();
}

function createOverlayWindow() {
  log('[Overlay] createOverlayWindow() called');
  
  // Load persisted bounds or use defaults
  const saved = store.getWindow();
  const bounds = validateBounds(saved) ? saved : store.DEFAULTS.window;
  log('[Overlay] Window bounds:', bounds);

  overlayWindow = new BrowserWindow({
    width: 360,
    height: 320,
    x: bounds.x,
    y: bounds.y,
    minWidth: 360,
    minHeight: 320,
    maxWidth: 360,
    maxHeight: 360,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    icon: createAppIcon(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  log('[Overlay] Loading overlay URL:', OVERLAY_URL);
  overlayWindow.loadURL(OVERLAY_URL);
  
  overlayWindow.webContents.on('did-finish-load', () => {
    log('[Overlay] Content loaded successfully');
  });
  
  overlayWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logError('[Overlay] Failed to load:', errorCode, errorDescription);
  });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Persist bounds on move/resize
  overlayWindow.on('move', debouncedSaveWindowState);
  overlayWindow.on('resize', debouncedSaveWindowState);

  // Prevent the window from being closed — just hide it
  overlayWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      overlayWindow.hide();
      store.setPrefs({ overlayVisible: false });
      updateTrayMenu();
    }
  });

  overlayWindow.on('closed', () => {
    log('[Overlay] Window closed, clearing reference');
    overlayWindow = null;
  });

  return overlayWindow;
}

// ── Click-Through Toggle ───────────────────────────────────

let isOverHotspot = false;

function setClickThrough(enabled) {
  clickThrough = enabled;
  store.setPrefs({ clickThrough: enabled });
  updateMouseIgnore();
  updateTrayMenu();
}

function updateMouseIgnore() {
  if (!overlayWindow) return;
  
  if (clickThrough) {
    if (isOverHotspot) {
      // Mouse over hotspot - make window clickable
      overlayWindow.setIgnoreMouseEvents(false);
      overlayWindow.setFocusable(true);
    } else {
      // Mouse not over hotspot - enable click-through
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      overlayWindow.setFocusable(false);
    }
  } else {
    // Click-through OFF - make overlay fully interactive
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.setFocusable(true);
  }
}

function toggleClickThrough() {
  setClickThrough(!clickThrough);
}

// ── Tray Menu ──────────────────────────────────────────────

function updateTrayMenu() {
  if (!tray) return;

  const overlayVisible = overlayWindow && overlayWindow.isVisible();
  const ctLabel = clickThrough ? '✓ Click-Through (ON)' : '  Click-Through (OFF)';

  const menu = Menu.buildFromTemplate([
    {
      label: 'CS2 Clutch Mode',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => shell.openExternal(DASHBOARD_URL),
    },
    { type: 'separator' },
    {
      label: overlayVisible ? 'Hide Overlay' : 'Show Overlay',
      click: () => {
        if (!overlayWindow || overlayWindow.isDestroyed()) {
          showOverlay();
        } else if (overlayWindow.isVisible()) {
          overlayWindow.hide();
          store.setPrefs({ overlayVisible: false });
          updateTrayMenu();
        } else {
          showOverlay();
        }
      },
    },
    {
      label: ctLabel,
      click: () => toggleClickThrough(),
    },
    { type: 'separator' },
    {
      label: 'Test 1v3 Clutch',
      click: () => {
        http.request({
          hostname: SERVER_HOST, port: SERVER_PORT,
          path: '/api/test/clutch/3', method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }, () => {}).end('{}');
      },
    },
    {
      label: 'Reset to Normal',
      click: () => {
        http.request({
          hostname: SERVER_HOST, port: SERVER_PORT,
          path: '/api/test/normal', method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }, () => {}).end('{}');
      },
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function createTray() {
  log('Creating system tray icon...');
  tray = new Tray(createTrayIcon());
  tray.setToolTip('CS2 Clutch Mode');
  updateTrayMenu();
  log('System tray created');
}

// ── IPC Handlers ───────────────────────────────────────────

ipcMain.handle('toggle-click-through', () => {
  toggleClickThrough();
  return clickThrough;
});

ipcMain.handle('get-click-through', () => {
  return clickThrough;
});

ipcMain.on('hotspot-enter', () => {
  isOverHotspot = true;
  updateMouseIgnore();
});

ipcMain.on('hotspot-leave', () => {
  isOverHotspot = false;
  updateMouseIgnore();
});

ipcMain.handle('show-overlay', () => {
  log('[Bridge] Dashboard requested overlay show via IPC');
  showOverlay();
  return true;
});


// ── App Lifecycle ──────────────────────────────────────────

app.on('ready', async () => {
  log('='.repeat(60));
  log('App ready event fired');
  log('Checking if server is already running...');
  log('Settings stored at:', store.getStorePath());

  // Load persisted preferences
  const prefs = store.getPrefs();
  clickThrough = prefs.clickThrough;
  log('Restored preferences:');
  log('  clickThrough:', clickThrough);
  log('  overlayVisible:', prefs.overlayVisible);

  ensureOverwolfTraceFile();

  // Check if backend is already running (e.g. started separately)
  let serverAlready = await isServerAlive();

  if (!serverAlready) {
    log('Starting backend server...');
    startServer();
    log('Waiting for server readiness (timeout: 30s)...');
    const ready = await waitForServer();
    if (!ready) {
      logError('Server did not become ready in time!');
      logError('Health check URL:', HEALTH_URL);
      dialog.showErrorBox(
        'CS2 Clutch Mode — Startup Failed',
        'The backend server did not start in time.\n\nPossible causes:\n• Port 3001 is already in use\n• Missing configuration files\n• Antivirus blocking the application\n\nCheck the console logs for details.\n\nThe application will now close.'
      );
      isQuitting = true;
      stopServer();
      app.quit();
      return;
    }
    log('Server is ready!');
    log('Health check passed:', HEALTH_URL);
  } else {
    log('Server already running, attaching to existing instance');
  }

  await initializeOverwolfBridge();

  // Create tray
  createTray();

  // Create overlay (respect saved visibility preference)
  if (prefs.overlayVisible) {
    showOverlay();
  } else {
    createOverlayWindow();
    overlayWindow.hide();
    updateTrayMenu();
  }

  // Register global hotkey: Ctrl+Shift+O to toggle overlay
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      showOverlay();
    } else if (overlayWindow.isVisible()) {
      overlayWindow.hide();
      store.setPrefs({ overlayVisible: false });
      updateTrayMenu();
    } else {
      showOverlay();
    }
  });

  // Register global hotkey: Ctrl+Shift+X to toggle click-through
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    toggleClickThrough();
  });

  const winBounds = store.getWindow();
  log('='.repeat(60));
  log('Startup complete!');
  log('Dashboard URL:', DASHBOARD_URL);
  log('Overlay URL:', OVERLAY_URL);
  log('Overlay position:', `${winBounds.x},${winBounds.y}`);
  log('Overlay size:', `${winBounds.width}x${winBounds.height}`);
  log('Hotkeys:');
  log('  Ctrl+Shift+O - Toggle overlay visibility');
  log('  Ctrl+Shift+X - Toggle click-through');
  log('='.repeat(60));
});

app.on('window-all-closed', (e) => {
  // Don't quit when overlay is hidden — tray keeps app alive
  // Only quit on explicit exit
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  // Only stop server if we spawned it
  if (didSpawnServer) stopServer();
});

app.on('will-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
