/* ============================================
   CS2 Clutch Mode — Overlay Frontend
   Lightweight, SSE-powered, self-contained
   Designed for: floating window, stream source, Electron
   ============================================ */

let ovStatus = {};
let ovGameState = {};
let ovClutchActive = false;
let ovClickThrough = false;
const isElectron = !!(window.electronAPI && window.electronAPI.isElectron);

document.addEventListener('DOMContentLoaded', () => {
  if (isElectron) {
    document.body.classList.add('electron');
    initElectronControls();
    initElectronListeners();
  }
  fetchInitial();
  connectOverlaySSE();
});

async function fetchInitial() {
  try {
    const [statusRes, gameRes] = await Promise.all([
      fetch('/api/status').then(r => r.json()),
      fetch('/api/game-state').then(r => r.json()),
    ]);
    ovStatus = statusRes;
    ovGameState = gameRes;
    renderOverlay();
  } catch {}
}

function connectOverlaySSE() {
  const source = new EventSource('/api/stream');

  source.addEventListener('status', (e) => {
    try {
      const d = JSON.parse(e.data);
      Object.assign(ovStatus, d);
      renderOverlay();
    } catch {}
  });

  source.addEventListener('gameState', (e) => {
    try {
      ovGameState = JSON.parse(e.data);
      renderOverlay();
    } catch {}
  });

  source.onerror = () => {
    // Will auto-reconnect
  };
}

// ============ ELECTRON IPC LISTENERS ============
function initElectronListeners() {
  if (!window.electronAPI || !window.electronAPI.onFlashBorder) return;
  
  // Listen for flash-border command from main process
  window.electronAPI.onFlashBorder(() => {
    flashBorder();
  });
}

function flashBorder() {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  
  // Add flash class
  overlay.classList.add('border-flash');
  
  // Remove after animation completes
  setTimeout(() => {
    overlay.classList.remove('border-flash');
  }, 1000);
}

function renderOverlay() {
  const overlay = document.getElementById('overlay');
  const dot = document.getElementById('ov-dot');
  const titleEl = document.getElementById('ov-title');
  const stateEl = document.getElementById('ov-state');
  const timerEl = document.getElementById('ov-timer');
  const countsEl = document.getElementById('ov-counts');
  const metaEl = document.getElementById('ov-meta');

  const clutchActive = ovStatus.clutchActive || false;
  const gs = ovGameState;

  // Clutch active toggle
  if (clutchActive) {
    overlay.classList.add('clutch-active');
    dot.className = 'overlay-dot active';
    titleEl.textContent = 'CLUTCH MODE';
    stateEl.textContent = 'Last alive. Stay sharp.';
    stateEl.className = 'overlay-state active';
  } else {
    overlay.classList.remove('clutch-active');
    dot.className = 'overlay-dot standby';
    titleEl.textContent = 'CLUTCH MONITOR';
    stateEl.textContent = 'Waiting for last-alive detection.';
    stateEl.className = 'overlay-state standby';
  }

  // Round timer (MM:SS format)
  if (gs.roundTimeRemaining != null && gs.roundTimeRemaining >= 0) {
    const totalSeconds = Math.floor(gs.roundTimeRemaining);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    timerEl.textContent = '--:--';
  }

  // Player counts
  if (gs.lastPayloadTime || clutchActive) {
    const playerAlive = gs.playerAlive ? 'Alive' : 'Dead';
    const teamCount = gs.teamAliveCount != null ? gs.teamAliveCount : '?';
    const enemyCount = gs.enemyAliveCount != null ? gs.enemyAliveCount : '?';
    countsEl.innerHTML = `<span class="alive-team">Team ${teamCount}</span> &bull; <span class="alive-enemy">Enemy ${enemyCount}</span>`;
  } else {
    countsEl.textContent = 'Waiting for game data…';
  }

  // Map / round meta
  if (gs.mapName && gs.mapName !== '?') {
    const round = gs.roundNumber || '?';
    const phase = gs.roundPhase || '';
    metaEl.textContent = `${gs.mapName} • Round ${round}${phase ? ' • ' + phase : ''}`;
  } else {
    metaEl.textContent = '';
  }
}

// ── Electron-specific controls ─────────────────

function initElectronControls() {
  if (!window.electronAPI) return;

  const hotspot = document.getElementById('ov-hotspot');
  
  if (hotspot) {
    // Right-click to toggle click-through
    hotspot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      toggleClickThroughMode();
    });
    
    // Left-click also works
    hotspot.addEventListener('click', () => {
      toggleClickThroughMode();
    });
    
    // Track mouse enter/leave for smart click-through
    hotspot.addEventListener('mouseenter', () => {
      if (window.electronAPI && window.electronAPI.hotspotEnter) {
        window.electronAPI.hotspotEnter();
      }
    });
    
    hotspot.addEventListener('mouseleave', () => {
      if (window.electronAPI && window.electronAPI.hotspotLeave) {
        window.electronAPI.hotspotLeave();
      }
    });
  }

  // Sync initial state
  window.electronAPI.getClickThrough().then((ct) => {
    ovClickThrough = ct;
    updateClickThroughUI();
  }).catch(() => {});
}

function toggleClickThroughMode() {
  if (!window.electronAPI) return;
  
  window.electronAPI.toggleClickThrough().then((newState) => {
    ovClickThrough = newState;
    updateClickThroughUI();
    showNotification(newState ? 'Click-Through Enabled' : 'Overlay Unlocked');
  }).catch(() => {});
}

function showNotification(message) {
  const notification = document.getElementById('ov-notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.classList.remove('fade-out');
  notification.classList.add('show');
  
  // Fade out after 1.5 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    notification.classList.remove('show');
  }, 1500);
}

function updateClickThroughUI() {
  // Toggle body class for drag region control
  if (ovClickThrough) {
    document.body.classList.remove('interactive');
  } else {
    document.body.classList.add('interactive');
  }
}
