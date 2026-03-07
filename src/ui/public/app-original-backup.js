/* ============================================
   CS2 Clutch Mode — Dashboard Frontend
   Vanilla JS, SSE-powered, no build tools
   ============================================ */

// ============ STATE ============
let currentFilter = 'all';
let events = [];
let lastStatus = {};
let lastPresence = {};
let lastGameState = {};
let sseConnected = false;
let presenceElapsedInterval = null;

// ============ SVG ICONS ============
const SVG_CS2_LOGO = `<svg viewBox="0 0 40 40" fill="none"><rect x="4" y="4" width="32" height="32" rx="6" stroke="#f97316" stroke-width="2"/><text x="20" y="26" text-anchor="middle" fill="#f97316" font-size="14" font-weight="700">CS2</text></svg>`;
const SVG_CLUTCH_ICON = `<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#f97316" stroke-width="1.5"/><circle cx="7" cy="7" r="2" fill="#f97316"/></svg>`;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  refreshAll();
  connectSSE();
});

// ============ API HELPERS ============
async function api(method, path, body) {
  try {
    const opts = { method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

// ============ REFRESH ALL ============
async function refreshAll() {
  const [statusRes, presenceRes, gameRes, eventsRes, diagRes, configRes] = await Promise.all([
    api('GET', '/api/status'),
    api('GET', '/api/presence'),
    api('GET', '/api/game-state'),
    api('GET', '/api/events?limit=100'),
    api('GET', '/api/diagnostics'),
    api('GET', '/api/config'),
  ]);

  if (statusRes.ok) updateStatus(statusRes.data);
  if (presenceRes.ok) updatePresence(presenceRes.data);
  if (gameRes.ok) updateGameState(gameRes.data);
  if (eventsRes.ok) { events = eventsRes.data; renderEventLog(); }
  if (diagRes.ok) renderDiagnostics(diagRes.data);
  if (configRes.ok) renderSettings(configRes.data);

  updateLastUpdateTime();
}

// ============ SSE ============
function connectSSE() {
  const source = new EventSource('/api/stream');

  source.onopen = () => {
    sseConnected = true;
    updateHeaderIndicator('ind-server', 'green');
  };

  source.addEventListener('status', (e) => {
    try {
      const d = JSON.parse(e.data);
      Object.assign(lastStatus, d);
      updateStatus(lastStatus);
    } catch {}
  });

  source.addEventListener('event', (e) => {
    try {
      const evt = JSON.parse(e.data);
      events.unshift(evt);
      if (events.length > 200) events.length = 200;
      renderEventLog();
    } catch {}
  });

  source.addEventListener('presence', (e) => {
    try {
      const d = JSON.parse(e.data);
      updatePresence(d);
    } catch {}
  });

  source.addEventListener('gameState', (e) => {
    try {
      const d = JSON.parse(e.data);
      updateGameState(d);
    } catch {}
  });

  source.onerror = () => {
    sseConnected = false;
    updateHeaderIndicator('ind-server', 'orange');
  };
}

// ============ UPDATE STATUS ============
function updateStatus(data) {
  lastStatus = data;

  // Discord
  const discordEl = document.getElementById('stat-discord');
  if (data.mockMode) {
    discordEl.textContent = 'Mock';
    discordEl.className = 'stat-value orange';
    updateHeaderIndicator('ind-discord', 'orange');
    document.getElementById('ind-discord-label').textContent = 'Mock';
  } else if (data.discordConnected) {
    discordEl.textContent = 'Connected';
    discordEl.className = 'stat-value green';
    updateHeaderIndicator('ind-discord', 'green');
    document.getElementById('ind-discord-label').textContent = 'Discord';
  } else {
    discordEl.textContent = 'Disconnected';
    discordEl.className = 'stat-value red';
    updateHeaderIndicator('ind-discord', 'red');
    document.getElementById('ind-discord-label').textContent = 'Discord';
  }

  // Clutch
  const clutchEl = document.getElementById('stat-clutch');
  const clutchCard = document.getElementById('clutch-card');
  if (data.clutchActive) {
    clutchEl.textContent = 'ACTIVE';
    clutchEl.className = 'stat-value orange';
    clutchCard.classList.add('clutch-active');
  } else {
    clutchEl.textContent = 'Inactive';
    clutchEl.className = 'stat-value muted';
    clutchCard.classList.remove('clutch-active');
  }

  // Scenario
  const scenarioEl = document.getElementById('stat-scenario');
  scenarioEl.textContent = data.currentScenario || 'Normal';
  scenarioEl.className = 'stat-value ' + (data.clutchActive ? 'orange' : 'blue');

  // GSI
  const gsiEl = document.getElementById('stat-gsi');
  if (data.gsiActive) {
    gsiEl.textContent = 'Active';
    gsiEl.className = 'stat-value green';
    updateHeaderIndicator('ind-gsi', 'green');
  } else if (data.lastGameStateTime > 0) {
    gsiEl.textContent = 'Stale';
    gsiEl.className = 'stat-value orange';
    updateHeaderIndicator('ind-gsi', 'orange');
  } else {
    gsiEl.textContent = 'Waiting';
    gsiEl.className = 'stat-value muted';
    updateHeaderIndicator('ind-gsi', '');
  }

  // Server indicator
  updateHeaderIndicator('ind-server', sseConnected ? 'green' : 'orange');

  updateLastUpdateTime();
}

// ============ UPDATE PRESENCE + HEADER INDICATOR ============
function updatePresence(data) {
  lastPresence = data;
  const container = document.getElementById('presence-content');
  const badge = document.getElementById('presence-badge');
  const keysContainer = document.getElementById('presence-keys');

  // Phase 5: Update header Presence indicator
  updatePresenceIndicator(data);

  if (!data.details && !data.state) {
    container.innerHTML = `
      <div class="presence-empty-state">
        <div class="presence-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" stroke="#3a3f4a" stroke-width="2" stroke-dasharray="4 4"/><text x="24" y="28" text-anchor="middle" fill="#5a6170" font-size="16">?</text></svg>
        </div>
        <div class="presence-empty-text">No Rich Presence active</div>
        <div class="presence-empty-hint">Use Test Controls or start CS2 to see presence</div>
      </div>`;
    badge.textContent = '—';
    badge.className = 'card-badge badge-inactive';
    keysContainer.innerHTML = '';
    clearElapsedInterval();
    return;
  }

  // Badge
  if (data.lastResult === 'success') {
    badge.textContent = 'Sent';
    badge.className = 'card-badge badge-healthy';
  } else if (data.lastResult === 'error') {
    badge.textContent = 'Error';
    badge.className = 'card-badge badge-error';
  } else if (data.lastResult === 'pending') {
    badge.textContent = 'Pending';
    badge.className = 'card-badge badge-warning';
  } else {
    badge.textContent = '—';
    badge.className = 'card-badge badge-inactive';
  }

  // Determine if clutch is active for styling
  const isClutch = data.details && data.details.includes('CLUTCH');

  // Elapsed
  const elapsed = formatElapsed(data.startTimestamp);

  // Phase 3: Discord-style presence card
  container.innerHTML = `
    <div class="presence-discord-card">
      <div class="presence-discord-header">Playing a Game</div>
      <div class="presence-discord-body">
        <div class="presence-img-area">
          <div class="presence-large-img">${SVG_CS2_LOGO}</div>
          ${data.smallImageKey ? `<div class="presence-small-img">${SVG_CLUTCH_ICON}</div>` : ''}
        </div>
        <div class="presence-info">
          <div class="presence-app-name">CS2 Clutch Mode</div>
          <div class="presence-details">${escHtml(data.details || '—')}</div>
          <div class="presence-state">${escHtml(data.state || '—')}</div>
          ${elapsed ? `<div class="presence-elapsed" id="presence-elapsed">${elapsed}</div>` : ''}
        </div>
      </div>
    </div>
  `;

  // Start ticking elapsed timer
  startElapsedInterval(data.startTimestamp);

  // Subtle asset keys for diagnostics
  keysContainer.innerHTML = `
    <div class="presence-keys-subtle">
      <span>large: ${escHtml(data.largeImageKey || '—')}</span>
      <span>small: ${escHtml(data.smallImageKey || '—')}</span>
      ${data.lastSentAt ? `<span>sent: ${formatTime(data.lastSentAt)}</span>` : ''}
      ${data.lastError ? `<span style="color:var(--accent-red)">err: ${escHtml(data.lastError)}</span>` : ''}
    </div>
  `;
}

function updatePresenceIndicator(data) {
  if (data.details || data.state) {
    if (data.lastResult === 'success') {
      updateHeaderIndicator('ind-presence', 'green');
      document.getElementById('ind-presence-label').textContent = 'Presence';
    } else if (data.lastResult === 'error') {
      updateHeaderIndicator('ind-presence', 'red');
      document.getElementById('ind-presence-label').textContent = 'Presence';
    } else {
      updateHeaderIndicator('ind-presence', 'orange');
      document.getElementById('ind-presence-label').textContent = 'Presence';
    }
  } else {
    updateHeaderIndicator('ind-presence', '');
    document.getElementById('ind-presence-label').textContent = 'Presence';
  }
}

function formatElapsed(startTimestamp) {
  if (!startTimestamp) return '';
  const secs = Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} elapsed`;
}

function startElapsedInterval(startTimestamp) {
  clearElapsedInterval();
  if (!startTimestamp) return;
  presenceElapsedInterval = setInterval(() => {
    const el = document.getElementById('presence-elapsed');
    if (el) el.textContent = formatElapsed(startTimestamp);
  }, 1000);
}

function clearElapsedInterval() {
  if (presenceElapsedInterval) {
    clearInterval(presenceElapsedInterval);
    presenceElapsedInterval = null;
  }
}

// ============ UPDATE GAME STATE ============
function updateGameState(data) {
  lastGameState = data;
  const container = document.getElementById('game-state-content');
  const badge = document.getElementById('gs-badge');
  const card = document.getElementById('game-state-card');

  if (!data.lastPayloadTime) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎮</div>
        <div class="empty-state-text">Waiting for CS2 game-state data…</div>
      </div>`;
    badge.textContent = 'No Data';
    badge.className = 'card-badge badge-inactive';
    return;
  }

  const isRecent = data.lastPayloadTime && (Date.now() - data.lastPayloadTime) < 30000;
  badge.textContent = isRecent ? 'Live' : 'Stale';
  badge.className = 'card-badge ' + (isRecent ? 'badge-healthy' : 'badge-warning');

  container.innerHTML = `
    <div class="kv-list">
      <div class="kv-row">
        <span class="kv-key">Player Alive</span>
        <span class="kv-val ${data.playerAlive ? 'green' : 'red'}">${data.playerAlive ? 'Yes' : 'No'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Player Team</span>
        <span class="kv-val">${data.playerTeam || '?'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Team Alive</span>
        <span class="kv-val">${data.teamAliveCount}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Enemy Alive</span>
        <span class="kv-val ${data.enemyAliveCount > 0 ? 'orange' : ''}">${data.enemyAliveCount}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Round Phase</span>
        <span class="kv-val">${data.roundPhase || '?'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Map Phase</span>
        <span class="kv-val">${data.mapPhase || '?'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Map Name</span>
        <span class="kv-val">${data.mapName || '?'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Round</span>
        <span class="kv-val">${data.roundNumber || 0}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Last Payload</span>
        <span class="kv-val">${data.lastPayloadTime ? formatTime(data.lastPayloadTime) : '—'}</span>
      </div>
    </div>
  `;
}

// ============ RENDER EVENT LOG ============
function renderEventLog() {
  const container = document.getElementById('event-log');
  const filtered = currentFilter === 'all'
    ? events
    : currentFilter === 'error'
      ? events.filter(e => e.severity === 'error' || e.category === 'error')
      : events.filter(e => e.category === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="event-empty">No events yet</div>';
    return;
  }

  container.innerHTML = filtered.slice(0, 100).map(e => {
    // Determine highlight class
    let hlClass = `cat-${e.category}`;
    if (e.type === 'CLUTCH_STARTED' || e.type === 'TEST_CLUTCH') hlClass += ' highlight-clutch';
    if (e.severity === 'error') hlClass += ' highlight-error';

    // Severity class for summary text
    let sevClass = '';
    if (e.severity === 'error') sevClass = 'severity-error';
    else if (e.severity === 'warn') sevClass = 'severity-warn';

    return `<div class="event-entry ${hlClass}">
      <span class="event-time">${formatTime(e.timestamp)}</span>
      <span class="event-type-badge ${e.category}">${e.category}</span>
      <span class="event-summary ${sevClass}">${escHtml(e.summary)}</span>
    </div>`;
  }).join('');
}

// ============ RENDER DIAGNOSTICS ============
function renderDiagnostics(data) {
  const container = document.getElementById('diagnostics-content');
  const badge = document.getElementById('diag-badge');

  // Determine health
  let health = 'healthy';
  if (data.recentErrors && data.recentErrors.length > 0) health = 'warning';
  if (!data.discordConnected && !data.mockMode) health = 'error';

  badge.textContent = health === 'healthy' ? 'Healthy' : health === 'warning' ? 'Warning' : 'Error';
  badge.className = 'card-badge ' + (health === 'healthy' ? 'badge-healthy' : health === 'warning' ? 'badge-warning' : 'badge-error');

  const items = [
    { label: 'Discord RPC', value: data.discordConnected ? 'Connected' : (data.mockMode ? 'Mock Mode' : 'Disconnected'), icon: data.discordConnected ? 'ok' : (data.mockMode ? 'warn' : 'err') },
    { label: 'GSI Listening', value: data.gsiListening ? 'Yes' : 'No', icon: data.gsiListening ? 'ok' : 'err' },
    { label: 'GSI Endpoint', value: `${data.gsiEndpoint || '?'} (port ${data.gsiPort || '?'})`, icon: 'neutral' },
    { label: 'Client ID', value: data.clientIdMasked || '—', icon: 'neutral' },
    { label: 'Last Discord Ready', value: data.lastDiscordReadyTime ? formatTime(data.lastDiscordReadyTime) : 'Never', icon: data.lastDiscordReadyTime ? 'ok' : 'neutral' },
    { label: 'Last setActivity OK', value: data.lastSetActivitySuccessTime ? formatTime(data.lastSetActivitySuccessTime) : 'Never', icon: data.lastSetActivitySuccessTime ? 'ok' : 'neutral' },
    { label: 'Last setActivity Fail', value: data.lastSetActivityFailTime ? formatTime(data.lastSetActivityFailTime) : 'Never', icon: data.lastSetActivityFailTime ? 'err' : 'neutral' },
  ];

  if (data.lastErrorText) {
    items.push({ label: 'Last Error', value: data.lastErrorText, icon: 'err' });
  }

  container.innerHTML = items.map(i => `
    <div class="diag-item">
      <span class="diag-icon ${i.icon}"></span>
      <span class="diag-label">${escHtml(i.label)}</span>
      <span class="diag-value">${escHtml(i.value)}</span>
    </div>
  `).join('');

  // Append recent errors if any
  if (data.recentErrors && data.recentErrors.length > 0) {
    container.innerHTML += `
      <div style="margin-top:12px">
        <div style="font-size:0.78rem;color:var(--accent-red);font-weight:600;margin-bottom:6px">Recent Errors</div>
        ${data.recentErrors.slice(0, 5).map(e => `<div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0;word-break:break-word">${escHtml(e)}</div>`).join('')}
      </div>
    `;
  }
}

// ============ RENDER SETTINGS ============
function renderSettings(data) {
  const container = document.getElementById('settings-content');

  const items = [
    ['Discord Client ID', data.clientIdMasked || '—'],
    ['Expected Assets', (data.expectedAssets || []).join(', ')],
    ['GSI Endpoint', data.gsiEndpoint || '?'],
    ['GSI Port', data.gsiPort || '?'],
    ['GSI Host', data.gsiHost || '?'],
    ['Clutch Volume %', data.clutchVolumePercent + '%'],
    ['Restore Volume %', data.restoreVolumePercent + '%'],
    ['Fade Duration', data.fadeDurationMs + 'ms'],
    ['Restore Delay', data.restoreDelayMs + 'ms'],
    ['Log Level', data.logLevel || '?'],
  ];

  container.innerHTML = `<div class="settings-list">
    ${items.map(([k, v]) => `
      <div class="settings-item">
        <span class="settings-key">${escHtml(k)}</span>
        <span class="settings-val">${escHtml(String(v))}</span>
      </div>
    `).join('')}
  </div>`;
}

// ============ TEST ACTIONS ============
async function testClutch(count) {
  const btn = event.currentTarget;
  setLoading(btn, true);
  showResult('');
  const res = await api('POST', `/api/test/clutch/${count}`);
  setLoading(btn, false);
  if (res.ok) {
    showResult(`1v${count} clutch triggered`, 'success');
    toast(`1v${count} clutch triggered`, 'success');
  } else {
    showResult(res.data.error || 'Failed', 'error');
    toast(res.data.error || 'Clutch test failed', 'error');
  }
  setTimeout(refreshAll, 300);
}

async function testAction(action) {
  const btn = event.currentTarget;
  setLoading(btn, true);
  showResult('');
  const res = await api('POST', `/api/test/${action}`);
  setLoading(btn, false);
  const label = action.replace('/', ' ').replace(/^\w/, c => c.toUpperCase());
  if (res.ok) {
    showResult(`${label} — success`, 'success');
    toast(`${label} action completed`, 'success');
  } else {
    showResult(res.data.error || 'Failed', 'error');
    toast(res.data.error || `${label} failed`, 'error');
  }
  setTimeout(refreshAll, 300);
}

// ============ SIMULATOR ============
async function applySimulator() {
  const btn = event.currentTarget;
  setLoading(btn, true);
  const body = {
    mapName: document.getElementById('sim-map').value,
    roundNumber: parseInt(document.getElementById('sim-round').value) || 1,
    roundPhase: document.getElementById('sim-round-phase').value,
    mapPhase: document.getElementById('sim-map-phase').value,
    playerTeam: document.getElementById('sim-team').value,
    playerAlive: document.getElementById('sim-alive').value === 'true',
    teamAliveCount: parseInt(document.getElementById('sim-team-alive').value) || 0,
    enemyAliveCount: parseInt(document.getElementById('sim-enemy-alive').value) || 0,
  };
  const res = await api('POST', '/api/test/simulate', body);
  setLoading(btn, false);
  if (res.ok) {
    toast(`Simulator: ${body.playerTeam} ${body.teamAliveCount}v${body.enemyAliveCount} on ${body.mapName}`, 'success');
  } else {
    toast(res.data.error || 'Simulator failed', 'error');
  }
  setTimeout(refreshAll, 300);
}

function resetSimulator() {
  document.getElementById('sim-map').value = 'de_dust2';
  document.getElementById('sim-round').value = '1';
  document.getElementById('sim-round-phase').value = 'live';
  document.getElementById('sim-map-phase').value = 'live';
  document.getElementById('sim-team').value = 'CT';
  document.getElementById('sim-alive').value = 'true';
  document.getElementById('sim-team-alive').value = '1';
  document.getElementById('sim-enemy-alive').value = '2';
  toast('Simulator reset', 'info');
}

function simPreset(preset) {
  const presets = {
    '1v1': { teamAlive: 1, enemyAlive: 1, roundPhase: 'live', alive: 'true' },
    '1v2': { teamAlive: 1, enemyAlive: 2, roundPhase: 'live', alive: 'true' },
    '1v3': { teamAlive: 1, enemyAlive: 3, roundPhase: 'live', alive: 'true' },
    '1v4': { teamAlive: 1, enemyAlive: 4, roundPhase: 'live', alive: 'true' },
    'over': { teamAlive: 0, enemyAlive: 0, roundPhase: 'over', alive: 'false' },
  };
  const p = presets[preset];
  if (!p) return;
  document.getElementById('sim-team-alive').value = p.teamAlive;
  document.getElementById('sim-enemy-alive').value = p.enemyAlive;
  document.getElementById('sim-round-phase').value = p.roundPhase;
  document.getElementById('sim-alive').value = p.alive;
  // Auto-apply
  const btn = document.querySelector('.sim-actions .btn-clutch');
  if (btn) btn.click();
}

// ============ EVENT LOG CONTROLS ============
function setFilter(filter, btnEl) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderEventLog();
}

function clearEventLog() {
  events = [];
  renderEventLog();
}

// ============ UI HELPERS ============
function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function showResult(text, type) {
  const el = document.getElementById('action-result');
  el.textContent = text;
  el.className = 'btn-result ' + (type || '');
}

function toast(message, type) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
}

function updateHeaderIndicator(id, color) {
  const el = document.getElementById(id);
  if (el) {
    el.className = 'indicator-dot' + (color ? ' ' + color : '');
  }
}

function updateLastUpdateTime() {
  const el = document.getElementById('last-update-time');
  if (el) {
    el.textContent = 'Updated ' + new Date().toLocaleTimeString();
  }
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ AUTO-REFRESH for diagnostics ============
setInterval(async () => {
  const [statusRes, diagRes] = await Promise.all([
    api('GET', '/api/status'),
    api('GET', '/api/diagnostics'),
  ]);
  if (statusRes.ok) updateStatus(statusRes.data);
  if (diagRes.ok) renderDiagnostics(diagRes.data);
}, 10000);
