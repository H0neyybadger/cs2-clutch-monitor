// --- Event log entry for UI ---
export interface UIEvent {
  id: number;
  timestamp: number;
  type: string;
  category: 'discord' | 'clutch' | 'gsi' | 'system' | 'error';
  severity: 'info' | 'warn' | 'error';
  summary: string;
}

// --- Presence snapshot for UI ---
export interface PresenceSnapshot {
  details: string;
  state: string;
  largeImageKey: string;
  largeImageText: string;
  smallImageKey: string;
  smallImageText: string;
  startTimestamp: number | null;
  lastSentAt: number | null;
  lastResult: 'success' | 'error' | 'pending' | null;
  lastError: string | null;
}

// --- Data validation status ---
export type DataStatus = 'stale' | 'pending' | 'confirmed';

// --- Normalized game state for UI ---
export interface UIGameState {
  playerAlive: boolean;
  playerTeam: string;
  teamAliveCount: number;
  enemyAliveCount: number;
  roundPhase: string;
  mapPhase: string;
  mapName: string;
  roundNumber: number;
  lastPayloadTime: number | null;
  dataStatus: DataStatus;
  lastRecalculationTime: number | null;
  currentRoundId: number;
}

// --- Diagnostics for UI ---
export interface Diagnostics {
  lastDiscordReadyTime: number | null;
  lastSetActivitySuccessTime: number | null;
  lastSetActivityFailTime: number | null;
  lastErrorText: string | null;
  recentErrors: string[];
  recentWarnings: string[];
}

// --- Session Stats from GSI ---
export interface SessionStats {
  kills: number;
  deaths: number;
  assists: number;
  roundsPlayed: number;
  roundsWon: number;
  clutchAttempts: number;
  clutchesWon: number;
  highestClutch: number | null;
  sessionStartTime: number;
}

// --- SSE listener type ---
type SSEListener = (event: string, data: any) => void;

interface StateStoreData {
  clutchActive: boolean;
  originalVolumes: Map<string, number>;
  discordConnected: boolean;
  lastGameStateTime: number;
}

const MAX_EVENTS = 200;
const MAX_DIAGNOSTICS_ENTRIES = 50;

class StateStore {
  private data: StateStoreData = {
    clutchActive: false,
    originalVolumes: new Map(),
    discordConnected: false,
    lastGameStateTime: 0,
  };

  // --- UI state ---
  private _events: UIEvent[] = [];
  private _eventIdCounter = 0;
  private _presence: PresenceSnapshot = {
    details: '',
    state: '',
    largeImageKey: '',
    largeImageText: '',
    smallImageKey: '',
    smallImageText: '',
    startTimestamp: null,
    lastSentAt: null,
    lastResult: null,
    lastError: null,
  };
  private _gameState: UIGameState = {
    playerAlive: false,
    playerTeam: '?',
    teamAliveCount: 0,
    enemyAliveCount: 0,
    roundPhase: '?',
    mapPhase: '?',
    mapName: '?',
    roundNumber: 0,
    lastPayloadTime: null,
    dataStatus: 'pending',
    lastRecalculationTime: null,
    currentRoundId: 0,
  };
  private _diagnostics: Diagnostics = {
    lastDiscordReadyTime: null,
    lastSetActivitySuccessTime: null,
    lastSetActivityFailTime: null,
    lastErrorText: null,
    recentErrors: [],
    recentWarnings: [],
  };
  private _currentScenario: string = 'Normal';
  private _appStartTime: number = Date.now();
  private _sseListeners: SSEListener[] = [];
  private _mockMode: boolean = false;
  private readonly _maxSSEConnections = 10; // Limit concurrent connections
  private _sessionStats: SessionStats = {
    kills: 0,
    deaths: 0,
    assists: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    clutchAttempts: 0,
    clutchesWon: 0,
    highestClutch: null,
    sessionStartTime: Date.now(),
  };
  private _lastRoundNumber: number = 0;
  private _lastPlayerStats: { kills: number; deaths: number; assists: number } | null = null;
  private _lastKnownPhase: string = '?';
  private _roundTransitionDetected: boolean = false;

  // ============ Original getters/setters (preserved) ============

  get clutchActive(): boolean {
    return this.data.clutchActive;
  }

  set clutchActive(value: boolean) {
    this.data.clutchActive = value;
    this._broadcast('status', { clutchActive: value });
  }

  get originalVolumes(): Map<string, number> {
    return this.data.originalVolumes;
  }

  setOriginalVolume(userId: string, volume: number): void {
    if (!this.data.originalVolumes.has(userId)) {
      this.data.originalVolumes.set(userId, volume);
    }
  }

  getOriginalVolume(userId: string): number | undefined {
    return this.data.originalVolumes.get(userId);
  }

  clearOriginalVolumes(): void {
    this.data.originalVolumes.clear();
  }

  get discordConnected(): boolean {
    return this.data.discordConnected;
  }

  set discordConnected(value: boolean) {
    const changed = this.data.discordConnected !== value;
    this.data.discordConnected = value;
    if (changed) {
      if (value) {
        this._diagnostics.lastDiscordReadyTime = Date.now();
      }
      this._broadcast('status', { discordConnected: value });
    }
  }

  get lastGameStateTime(): number {
    return this.data.lastGameStateTime;
  }

  set lastGameStateTime(value: number) {
    this.data.lastGameStateTime = value;
  }

  reset(): void {
    this.data.clutchActive = false;
    this.data.originalVolumes.clear();
    this.data.lastGameStateTime = 0;
  }

  /**
   * Detect and handle round transitions
   * Resets alive counts to pending state when entering freeze time of new round
   */
  handleRoundTransition(newRoundNumber: number, newPhase: string): void {
    const roundChanged = newRoundNumber > this._lastRoundNumber && this._lastRoundNumber > 0;
    const phaseChanged = newPhase !== this._lastKnownPhase;

    // Round transition detected
    if (roundChanged) {
      console.log(`[ROUND TRANSITION] Round ${this._lastRoundNumber} → ${newRoundNumber}`);
      this._gameState.currentRoundId = newRoundNumber;
      this._roundTransitionDetected = true;
      
      // Mark data as stale when entering new round
      this._gameState.dataStatus = 'stale';
      this._gameState.teamAliveCount = 0;
      this._gameState.enemyAliveCount = 0;
      this._gameState.playerAlive = false;
      
      console.log('[ROUND TRANSITION] Alive counts reset to 0 (stale data from previous round)');
      this._broadcast('gameState', this._gameState);
    }

    // Phase transition within same round
    if (phaseChanged && !roundChanged) {
      console.log(`[PHASE TRANSITION] ${this._lastKnownPhase} → ${newPhase} (Round ${newRoundNumber})`);
      
      // Entering freeze time - mark as pending
      if (newPhase === 'freezetime') {
        this._gameState.dataStatus = 'pending';
        console.log('[PHASE TRANSITION] Entering freeze time - data marked as pending');
      }
      
      // Entering live phase - data will be confirmed when counts are recalculated
      if (newPhase === 'live') {
        console.log('[PHASE TRANSITION] Entering live phase - awaiting count confirmation');
      }
    }

    this._lastKnownPhase = newPhase;
  }

  /**
   * Confirm current round data as valid
   * Called after alive counts are recalculated during live phase
   */
  confirmRoundData(): void {
    if (this._gameState.roundPhase === 'live') {
      this._gameState.dataStatus = 'confirmed';
      this._gameState.lastRecalculationTime = Date.now();
      console.log('[ROUND DATA] Counts confirmed for live round', this._gameState.roundNumber);
    } else if (this._gameState.roundPhase === 'freezetime') {
      this._gameState.dataStatus = 'pending';
      console.log('[ROUND DATA] Counts marked as pending (freeze time)');
    }
  }

  // ============ Session Stats ============

  get sessionStats(): SessionStats {
    return { ...this._sessionStats };
  }

  updateSessionStats(gsiPayload: any): void {
    if (!gsiPayload || !gsiPayload.player) return;

    const player = gsiPayload.player;
    const match_stats = player.match_stats || {};
    const state = player.state || {};
    const map = gsiPayload.map || {};
    const round = gsiPayload.round || {};

    // Track kills, deaths, assists from GSI
    const currentKills = match_stats.kills || 0;
    const currentDeaths = match_stats.deaths || 0;
    const currentAssists = match_stats.assists || 0;

    // Update stats (GSI provides cumulative match stats)
    this._sessionStats.kills = currentKills;
    this._sessionStats.deaths = currentDeaths;
    this._sessionStats.assists = currentAssists;

    // Track rounds played (when round number changes)
    const currentRound = map.round || 0;
    if (currentRound > this._lastRoundNumber && this._lastRoundNumber > 0) {
      this._sessionStats.roundsPlayed++;
      
      // Check if player's team won the last round
      // This is approximate - we'd need round_win event for accuracy
      if (round.phase === 'over' && round.win_team) {
        const playerTeam = player.team;
        if (round.win_team === playerTeam) {
          this._sessionStats.roundsWon++;
        }
      }
    }
    this._lastRoundNumber = currentRound;

    // Store current stats for delta tracking
    this._lastPlayerStats = { kills: currentKills, deaths: currentDeaths, assists: currentAssists };

    // Broadcast stats update
    this._broadcast('stats', this._sessionStats);
  }

  incrementClutchAttempts(enemyCount: number): void {
    this._sessionStats.clutchAttempts++;
    if (!this._sessionStats.highestClutch || enemyCount > this._sessionStats.highestClutch) {
      this._sessionStats.highestClutch = enemyCount;
    }
    this._broadcast('stats', this._sessionStats);
  }

  incrementClutchesWon(): void {
    this._sessionStats.clutchesWon++;
    this._broadcast('stats', this._sessionStats);
  }

  resetSessionStats(): void {
    this._sessionStats = {
      kills: 0,
      deaths: 0,
      assists: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      clutchAttempts: 0,
      clutchesWon: 0,
      highestClutch: null,
      sessionStartTime: Date.now(),
    };
    this._lastRoundNumber = 0;
    this._lastPlayerStats = null;
    this._broadcast('stats', this._sessionStats);
  }

  // ============ UI Event Log ============

  pushEvent(category: UIEvent['category'], severity: UIEvent['severity'], type: string, summary: string): UIEvent {
    const evt: UIEvent = {
      id: ++this._eventIdCounter,
      timestamp: Date.now(),
      type,
      category,
      severity,
      summary,
    };
    this._events.unshift(evt);
    if (this._events.length > MAX_EVENTS) {
      this._events.length = MAX_EVENTS;
    }
    this._broadcast('event', evt);
    return evt;
  }

  getEvents(limit: number = 100): UIEvent[] {
    return this._events.slice(0, limit);
  }

  clearEvents(): void {
    this._events = [];
  }

  // ============ Presence Snapshot ============

  get presence(): PresenceSnapshot {
    return { ...this._presence };
  }

  updatePresence(partial: Partial<PresenceSnapshot>): void {
    Object.assign(this._presence, partial);
    this._broadcast('presence', this._presence);
  }

  // ============ Game State ============

  get gameState(): UIGameState {
    return { ...this._gameState };
  }

  updateGameState(partial: Partial<UIGameState>): void {
    Object.assign(this._gameState, partial);
    this._broadcast('gameState', this._gameState);
  }

  // ============ Diagnostics ============

  get diagnostics(): Diagnostics {
    return {
      ...this._diagnostics,
      recentErrors: [...this._diagnostics.recentErrors],
      recentWarnings: [...this._diagnostics.recentWarnings],
    };
  }

  addDiagnosticError(text: string): void {
    this._diagnostics.lastErrorText = text;
    this._diagnostics.recentErrors.unshift(`[${new Date().toISOString()}] ${text}`);
    if (this._diagnostics.recentErrors.length > MAX_DIAGNOSTICS_ENTRIES) {
      this._diagnostics.recentErrors.length = MAX_DIAGNOSTICS_ENTRIES;
    }
  }

  addDiagnosticWarning(text: string): void {
    this._diagnostics.recentWarnings.unshift(`[${new Date().toISOString()}] ${text}`);
    if (this._diagnostics.recentWarnings.length > MAX_DIAGNOSTICS_ENTRIES) {
      this._diagnostics.recentWarnings.length = MAX_DIAGNOSTICS_ENTRIES;
    }
  }

  recordSetActivitySuccess(): void {
    this._diagnostics.lastSetActivitySuccessTime = Date.now();
  }

  recordSetActivityFailure(error: string): void {
    this._diagnostics.lastSetActivityFailTime = Date.now();
    this.addDiagnosticError(error);
  }

  // ============ Current Scenario ============

  get currentScenario(): string {
    return this._currentScenario;
  }

  set currentScenario(value: string) {
    this._currentScenario = value;
  }

  // ============ Mock mode ============

  get mockMode(): boolean {
    return this._mockMode;
  }

  set mockMode(value: boolean) {
    this._mockMode = value;
  }

  // ============ App start time ============

  get appStartTime(): number {
    return this._appStartTime;
  }

  // ============ SSE Broadcasting ============

  addSSEListener(listener: SSEListener): boolean {
    if (this._sseListeners.length >= this._maxSSEConnections) {
      console.warn(`[StateStore] SSE connection limit reached (${this._maxSSEConnections})`);
      return false;
    }
    this._sseListeners.push(listener);
    return true;
  }

  removeSSEListener(listener: SSEListener): void {
    this._sseListeners = this._sseListeners.filter(l => l !== listener);
  }

  private _broadcast(event: string, data: any): void {
    // Clean up broken listeners periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      this._sseListeners = this._sseListeners.filter(listener => {
        try {
          listener('ping', {});
          return true;
        } catch {
          return false;
        }
      });
    }

    for (const listener of this._sseListeners) {
      try {
        listener(event, data);
      } catch {
        // ignore broken listeners
      }
    }
  }

  getSSEConnectionCount(): number {
    return this._sseListeners.length;
  }

  // ============ Full status snapshot ============

  getStatusSnapshot(): Record<string, any> {
    return {
      serverRunning: true,
      discordConnected: this.data.discordConnected,
      mockMode: this._mockMode,
      clutchActive: this.data.clutchActive,
      currentScenario: this._currentScenario,
      lastGameStateTime: this.data.lastGameStateTime,
      gsiActive: this.data.lastGameStateTime > 0 && (Date.now() - this.data.lastGameStateTime) < 30000,
      appStartTime: this._appStartTime,
      uptime: Date.now() - this._appStartTime,
    };
  }
}

export const stateStore = new StateStore();
