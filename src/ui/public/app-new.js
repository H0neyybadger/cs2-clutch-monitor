/* ============================================
   CS2 Clutch Mode — Enhanced Dashboard Frontend
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

// Session tracking state
let sessionClutchHistory = [];
let sessionHighlights = [];
let currentClutchTimeline = [];
let sessionStats = {
  attempts: 0,
  won: 0,
  lost: 0,
  highestClutch: null
};

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
      
      // Track clutch events for history and timeline
      trackClutchEvent(evt);
      
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

// ============ SESSION TRACKING ============
function trackClutchEvent(evt) {
  // Track clutch start
  if (evt.type === 'CLUTCH_STARTED' || evt.type === 'TEST_CLUTCH') {
    const scenario = evt.summary.match(/1v(\d)/)?.[0] || evt.summary;
    const enemyCount = parseInt(evt.summary.match(/1v(\d)/)?.[1]) || 0;
    
    // Add to timeline
    currentClutchTimeline = [{
      timestamp: evt.timestamp,
      event: 'Clutch Started',
      scenario: scenario,
      enemyCount: enemyCount
    }];
    
    // Track highest clutch
    if (!sessionStats.highestClutch || enemyCount > sessionStats.highestClutch) {
      sessionStats.highestClutch = enemyCount;
    }
    
    sessionStats.attempts++;
    updateSessionStats();
    renderClutchTimeline();
  }
  
  // Track clutch end
  if (evt.type === 'CLUTCH_ENDED' || evt.type === 'ROUND_END') {
    if (currentClutchTimeline.length > 0) {
      currentClutchTimeline.push({
        timestamp: evt.timestamp,
        event: 'Clutch Ended',
        scenario: evt.summary
      });
      
      // Add to history
      const clutchRecord = {
        timestamp: currentClutchTimeline[0].timestamp,
        scenario: currentClutchTimeline[0].scenario,
        map: lastGameState.mapName || 'Unknown',
        round: lastGameState.roundNumber || '?',
        outcome: 'Unknown', // We don't have win/loss tracking yet
        timeline: [...currentClutchTimeline]
      };
      
      sessionClutchHistory.unshift(clutchRecord);
      if (sessionClutchHistory.length > 20) sessionClutchHistory.length = 20;
      
      renderClutchHistory();
      renderClutchTimeline();
    }
  }
  
  // Track enemy eliminations during clutch
  if (evt.category === 'clutch' && evt.summary.includes('now 1v')) {
    const newScenario = evt.summary.match(/now (1v\d)/)?.[1];
    if (newScenario && currentClutchTimeline.length > 0) {
      currentClutchTimeline.push({
        timestamp: evt.timestamp,
        event: 'Enemy Down',
        scenario: newScenario
      });
      renderClutchTimeline();
    }
  }
}

// ============ UPDATE STATUS ============
function updateStatus(data) {
  lastStatus = data;

  // Update top summary cards
  document.getElementById('stat-clutches-session').textContent = sessionStats.attempts;
  document.getElementById('stat-current-scenario').textContent = data.currentScenario || 'Monitoring';
  document.getElementById('stat-highest-clutch').textContent = sessionStats.highestClutch ? `1v${sessionStats.highestClutch}` : '—';
  
  const winRate = sessionStats.attempts > 0 ? Math.round((sessionStats.won / sessionStats.attempts) * 100) : 0;
  document.getElementById('stat-win-rate').textContent = sessionStats.attempts > 0 ? `${winRate}%` : '—';

  // Update current clutch card
  const clutchCard = document.getElementById('current-clutch-card');
  const currentScenarioEl = document.getElementById('stat-current-scenario');
  if (data.clutchActive) {
    clutchCard.classList.add('clutch-active');
    currentScenarioEl.className = 'stat-value orange';
  } else {
    clutchCard.classList.remove('clutch-active');
    currentScenarioEl.className = 'stat-value blue';
  }

  // Update clutch status panel
  updateClutchStatus(data);

  // Update header indicators
  if (data.mockMode) {
    updateHeaderIndicator('ind-discord', 'orange');
    document.getElementById('ind-discord-label').textContent = 'Mock';
  } else if (data.discordConnected) {
    updateHeaderIndicator('ind-discord', 'green');
    document.getElementById('ind-discord-label').textContent = 'Discord';
  } else {
    updateHeaderIndicator('ind-discord', 'red');
    document.getElementById('ind-discord-label').textContent = 'Discord';
  }

  // GSI
  if (data.gsiActive) {
    updateHeaderIndicator('ind-gsi', 'green');
  } else if (data.lastGameStateTime > 0) {
    updateHeaderIndicator('ind-gsi', 'orange');
  } else {
    updateHeaderIndicator('ind-gsi', '');
  }

  // Server indicator
  updateHeaderIndicator('ind-server', sseConnected ? 'green' : 'orange');

  // Update detection health
  updateDetectionHealth(data);

  // Update overlay controls
  updateOverlayControls(data);

  updateLastUpdateTime();
}

// ============ UPDATE CLUTCH STATUS PANEL ============
function updateClutchStatus(data) {
  const badge = document.getElementById('clutch-status-badge');
  const card = document.getElementById('clutch-status-card');
  const scenarioDisplay = document.getElementById('clutch-scenario-display');
  const threatLevel = document.getElementById('clutch-threat-level');
  
  if (data.clutchActive) {
    badge.textContent = 'ACTIVE';
    badge.className = 'card-badge badge-critical';
    card.classList.add('clutch-active');
    
    const scenario = data.currentScenario || '1v?';
    const enemyCount = parseInt(scenario.match(/1v(\d)/)?.[1]) || 0;
    
    scenarioDisplay.innerHTML = `<div class="scenario-text active">${scenario}</div>`;
    
    // Determine threat level
    let threat = 'Unknown';
    let threatClass = '';
    if (enemyCount === 1) {
      threat = 'Low';
      threatClass = 'threat-low';
    } else if (enemyCount === 2) {
      threat = 'Medium';
      threatClass = 'threat-medium';
    } else if (enemyCount === 3) {
      threat = 'High';
      threatClass = 'threat-high';
    } else if (enemyCount >= 4) {
      threat = 'Critical';
      threatClass = 'threat-critical';
    }
    
    threatLevel.innerHTML = `
      <span class="threat-label">Threat Level:</span>
      <span class="threat-value ${threatClass}">${threat}</span>
    `;
  } else {
    badge.textContent = 'Monitoring';
    badge.className = 'card-badge badge-inactive';
    card.classList.remove('clutch-active');
    
    scenarioDisplay.innerHTML = `<div class="scenario-text">Waiting for clutch...</div>`;
    threatLevel.innerHTML = `
      <span class="threat-label">Threat Level:</span>
      <span class="threat-value">—</span>
    `;
  }
  
  // Update clutch stats
  document.getElementById('clutch-round-timer').textContent = lastGameState.roundTimeRemaining 
    ? formatRoundTime(lastGameState.roundTimeRemaining) 
    : '—';
  document.getElementById('clutch-team-alive').textContent = lastGameState.teamAliveCount ?? '—';
  document.getElementById('clutch-enemy-alive').textContent = lastGameState.enemyAliveCount ?? '—';
}

// ============ UPDATE LIVE MATCH PANEL ============
function updateLiveMatch(data) {
  const container = document.getElementById('live-match-content');
  const badge = document.getElementById('match-badge');

  if (!data.lastPayloadTime) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎮</div>
        <div class="empty-state-text">Waiting for match data...</div>
      </div>`;
    badge.textContent = 'No Data';
    badge.className = 'card-badge badge-inactive';
    return;
  }

  const isRecent = data.lastPayloadTime && (Date.now() - data.lastPayloadTime) < 30000;
  badge.textContent = isRecent ? 'Live' : 'Stale';
  badge.className = 'card-badge ' + (isRecent ? 'badge-healthy' : 'badge-warning');

  container.innerHTML = `
    <div class="match-grid">
      <div class="match-item">
        <span class="match-label">Map</span>
        <span class="match-value">${escHtml(data.mapName || 'Unknown')}</span>
      </div>
      <div class="match-item">
        <span class="match-label">Round</span>
        <span class="match-value">${data.roundNumber || '?'}</span>
      </div>
      <div class="match-item">
        <span class="match-label">Phase</span>
        <span class="match-value">${escHtml(data.roundPhase || '?')}</span>
      </div>
      <div class="match-item">
        <span class="match-label">Team</span>
        <span class="match-value">${escHtml(data.playerTeam || '?')}</span>
      </div>
      <div class="match-item">
        <span class="match-label">Team Alive</span>
        <span class="match-value ${data.teamAliveCount === 1 ? 'orange' : ''}">${data.teamAliveCount ?? '?'}</span>
      </div>
      <div class="match-item">
        <span class="match-label">Enemy Alive</span>
        <span class="match-value ${data.enemyAliveCount > 0 ? 'orange' : ''}">${data.enemyAliveCount ?? '?'}</span>
      </div>
      <div class="match-item">
        <span class="match-label">Player Status</span>
        <span class="match-value ${data.playerAlive ? 'green' : 'red'}">${data.playerAlive ? 'Alive' : 'Dead'}</span>
      </div>
      <div class="match-item">
        <span class="match-label">Last Update</span>
        <span class="match-value">${formatTime(data.lastPayloadTime)}</span>
      </div>
    </div>
  `;
}

// ============ UPDATE SESSION STATS ============
function updateSessionStats() {
  document.getElementById('session-attempts').textContent = sessionStats.attempts;
  document.getElementById('session-won').textContent = sessionStats.won;
  document.getElementById('session-lost').textContent = sessionStats.lost;
  
  const winRate = sessionStats.attempts > 0 
    ? Math.round((sessionStats.won / sessionStats.attempts) * 100) 
    : 0;
  document.getElementById('session-winrate').textContent = sessionStats.attempts > 0 ? `${winRate}%` : '—';
}

// ============ RENDER CLUTCH HISTORY ============
function renderClutchHistory() {
  const container = document.getElementById('clutch-history-content');
  
  if (sessionClutchHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No clutches yet this session</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="history-list">
      ${sessionClutchHistory.map(clutch => `
        <div class="history-entry">
          <div class="history-time">${formatTime(clutch.timestamp)}</div>
          <div class="history-scenario ${clutch.outcome === 'Won' ? 'green' : clutch.outcome === 'Lost' ? 'red' : ''}">${escHtml(clutch.scenario)}</div>
          <div class="history-map">${escHtml(clutch.map)}</div>
          <div class="history-round">R${clutch.round}</div>
          <div class="history-outcome">${clutch.outcome}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============ RENDER CLUTCH TIMELINE ============
function renderClutchTimeline() {
  const container = document.getElementById('clutch-timeline-content');
  const badge = document.getElementById('timeline-badge');
  
  if (currentClutchTimeline.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No active clutch</div>
      </div>
    `;
    badge.textContent = '—';
    badge.className = 'card-badge badge-inactive';
    return;
  }
  
  badge.textContent = 'Active';
  badge.className = 'card-badge badge-healthy';
  
  container.innerHTML = `
    <div class="timeline-list">
      ${currentClutchTimeline.map((item, idx) => `
        <div class="timeline-entry">
          <div class="timeline-dot ${idx === 0 ? 'start' : ''}"></div>
          <div class="timeline-content">
            <div class="timeline-event">${escHtml(item.event)}</div>
            <div class="timeline-scenario">${escHtml(item.scenario || '')}</div>
            <div class="timeline-time">${formatTime(item.timestamp)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============ UPDATE DETECTION HEALTH ============
function updateDetectionHealth(data) {
  const badge = document.getElementById('detection-health-badge');
  
  // Determine overall health
  let health = 'High';
  let healthClass = 'badge-healthy';
  
  if (!data.gsiActive && data.lastGameStateTime > 0) {
    health = 'Medium';
    healthClass = 'badge-warning';
  } else if (!data.gsiActive && data.lastGameStateTime === 0) {
    health = 'Low';
    healthClass = 'badge-error';
  }
  
  badge.textContent = health;
  badge.className = `card-badge ${healthClass}`;
  
  // Update health items
  document.getElementById('health-gsi').textContent = data.gsiActive ? 'Active' : 'Inactive';
  document.getElementById('health-gsi-icon').className = 'health-icon ' + (data.gsiActive ? 'green' : 'red');
  
  const feedStatus = data.gsiActive ? 'Fresh' : data.lastGameStateTime > 0 ? 'Stale' : 'No Data';
  document.getElementById('health-feed').textContent = feedStatus;
  document.getElementById('health-feed-icon').className = 'health-icon ' + 
    (data.gsiActive ? 'green' : data.lastGameStateTime > 0 ? 'orange' : 'red');
  
  const lastUpdate = data.lastGameStateTime ? formatTimeSince(data.lastGameStateTime) : 'Never';
  document.getElementById('health-latency').textContent = lastUpdate;
  document.getElementById('health-latency-icon').className = 'health-icon ' + 
    (data.gsiActive ? 'green' : 'orange');
  
  document.getElementById('health-confidence').textContent = health;
  document.getElementById('health-confidence-icon').className = 'health-icon ' + 
    (health === 'High' ? 'green' : health === 'Medium' ? 'orange' : 'red');
}

// ============ UPDATE OVERLAY CONTROLS ============
function updateOverlayControls(data) {
  // Note: We don't have overlay state in status API yet, so show placeholders
  document.getElementById('overlay-visible').textContent = '—';
  document.getElementById('overlay-clickthrough').textContent = '—';
  document.getElementById('overlay-mode').textContent = data.clutchActive ? 'Clutch Active' : 'Monitoring';
  
  const badge = document.getElementById('overlay-status-badge');
  badge.textContent = 'Available';
  badge.className = 'card-badge badge-healthy';
}

// ============ UPDATE PRESENCE ============
function updatePresence(data) {
  lastPresence = data;
  const container = document.getElementById('presence-content');
  const badge = document.getElementById('presence-badge');
  const keysContainer = document.getElementById('presence-keys');

  // Update header Presence indicator
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

  // Elapsed
  const elapsed = formatElapsed(data.startTimestamp);

  // Discord-style presence card
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
  
  // Update live match panel
  updateLiveMatch(data);
  
  // Update clutch status with latest game data
  updateClutchStatus(lastStatus);
}

// ============ RENDER HIGHLIGHT MARKERS ============
function renderHighlightMarkers() {
  const container = document.getElementById('highlight-markers-content');
  
  if (sessionHighlights.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No highlights marked yet</div>
        <div class="empty-state-hint">Click "Mark Highlight" to save a moment</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="highlights-list">
      ${sessionHighlights.map((hl, idx) => `
        <div class="highlight-entry">
          <div class="highlight-number">#${sessionHighlights.length - idx}</div>
          <div class="highlight-time">${formatTime(hl.timestamp)}</div>
          <div class="highlight-context">${escHtml(hl.context)}</div>
          <button class="highlight-remove" onclick="removeHighlight(${idx})">×</button>
        </div>
      `).join('')}
    </div>
  `;
}

function markHighlight() {
  const context = lastStatus.clutchActive 
    ? `${lastStatus.currentScenario} on ${lastGameState.mapName || 'Unknown'}`
    : `Round ${lastGameState.roundNumber || '?'} on ${lastGameState.mapName || 'Unknown'}`;
  
  sessionHighlights.unshift({
    timestamp: Date.now(),
    context: context,
    gameState: {...lastGameState},
    clutchActive: lastStatus.clutchActive
  });
  
  if (sessionHighlights.length > 50) sessionHighlights.length = 50;
  
  renderHighlightMarkers();
  toast('Highlight marked!', 'success');
}

function removeHighlight(idx) {
  sessionHighlights.splice(idx, 1);
  renderHighlightMarkers();
}

function clearClutchHistory() {
  sessionClutchHistory = [];
  renderClutchHistory();
  toast('Clutch history cleared', 'info');
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
  
  // Update audio control values
  document.getElementById('audio-clutch-vol').textContent = `${data.clutchVolumePercent}%`;
  document.getElementById('audio-restore-vol').textContent = `${data.restoreVolumePercent}%`;
  document.getElementById('audio-fade-dur').textContent = `${data.fadeDurationMs}ms`;

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

function formatTimeSince(ts) {
  if (!ts) return 'Never';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function formatRoundTime(seconds) {
  if (seconds == null || seconds < 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
