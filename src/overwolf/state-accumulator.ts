import { createLogger } from '../app/logger';
import type { GameState } from '../gsi/types';
import type { OverwolfBridgeMessage, OverwolfEventSnapshot, OverwolfPlayerSnapshot } from './types';

const logger = createLogger('OverwolfState');

type TeamCode = 'CT' | 'T';

interface ParsedScoreState {
  left: number;
  right: number;
  signature: string;
  total: number;
}

interface MutablePlayerSnapshot extends OverwolfPlayerSnapshot {
  slot: string;
  totalDeaths: number | null;
  baselineDeaths: number | null;
  includedInRound: boolean;
  lastSeenAt: number;
}

interface OverwolfAccumulatorState {
  connected: boolean;
  statusText: string;
  mapName: string | null;
  gameMode: string | null;
  modeName: string | null;
  gamePhase: string | null;
  roundPhase: string | null;
  roundNumber: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  localSteamId: string | null;
  localPlayerId: string | null;
  teamScores: Partial<Record<TeamCode, number>>;
  roster: Record<string, MutablePlayerSnapshot>;
  pseudoMatchId: string | null;
  scoreSignature: string | null;
  hasReliableRoundBoundary: boolean;
  recentKillFeed: Map<string, number>;
}

export interface OverwolfIngestResult {
  changed: boolean;
  gameState: GameState | null;
  rosterAvailable: boolean;
  rosterStatus: string;
  playerStatsAvailable: boolean;
  playerStatsStatus: string;
  eventType: string;
  summary: string;
}

const RECENT_KILL_FEED_WINDOW_MS = 20000;

const initialState = (): OverwolfAccumulatorState => ({
  connected: false,
  statusText: 'Waiting for Overwolf GEP data',
  mapName: null,
  gameMode: null,
  modeName: null,
  gamePhase: null,
  roundPhase: null,
  roundNumber: 0,
  kills: null,
  deaths: null,
  assists: null,
  localSteamId: null,
  localPlayerId: null,
  teamScores: {},
  roster: {},
  pseudoMatchId: null,
  scoreSignature: null,
  hasReliableRoundBoundary: false,
  recentKillFeed: new Map(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLooseValue(value: unknown): unknown {
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

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function normalizeIdentifier(value: unknown): string | null {
  const text = toStringValue(value);
  if (!text) {
    return null;
  }

  return text.trim().toLowerCase();
}

function normalizeTeam(value: unknown): TeamCode | null {
  const text = toStringValue(value)?.toUpperCase();
  if (!text) return null;
  if (text === 'CT' || text === 'COUNTER_TERRORIST' || text === 'COUNTER-TERRORIST') return 'CT';
  if (text === 'T' || text === 'TERRORIST' || text === 'TERRORISTS') return 'T';
  return null;
}

function normalizePhase(value: unknown): string | null {
  const text = toStringValue(value);
  if (!text) return null;

  const normalized = text.toLowerCase();
  if (normalized.includes('freeze')) return 'freezetime';
  if (normalized === 'live' || normalized.includes('in_progress')) return 'live';
  if (normalized === 'over' || normalized.includes('round_end')) return 'over';
  if (normalized.includes('warmup')) return 'warmup';
  return normalized;
}

function normalizeInfoPayload(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {};
  }

  if (isRecord(payload.info)) {
    return payload.info;
  }

  if (isRecord(payload.data)) {
    return payload.data;
  }

  return payload;
}

function normalizeEvents(payload: unknown): OverwolfEventSnapshot[] {
  if (Array.isArray(payload)) {
    return payload.map((entry, index) => toEventSnapshot(entry, String(index))).filter(Boolean) as OverwolfEventSnapshot[];
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.events)) {
      return payload.events.map((entry, index) => toEventSnapshot(entry, String(index))).filter(Boolean) as OverwolfEventSnapshot[];
    }

    const direct = toEventSnapshot(payload, '0');
    return direct ? [direct] : [];
  }

  return [];
}

function toEventSnapshot(value: unknown, fallbackName: string): OverwolfEventSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = toStringValue(value.name ?? value.event ?? value.type ?? fallbackName);
  if (!name) {
    return null;
  }

  const rawData = parseLooseValue(value.data ?? value.payload ?? value.value ?? {});
  return {
    name,
    data: isRecord(rawData) ? rawData : {},
  };
}

function resolvePlayerIdentifier(data: Record<string, unknown>, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    const candidates = [
      `${prefix}_steam_id`,
      `${prefix}SteamId`,
      `${prefix}_id`,
      `${prefix}Id`,
      prefix,
      `${prefix}_name`,
      `${prefix}Name`,
    ];

    for (const key of candidates) {
      const value = toStringValue(data[key]);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function parseScoreFromGameMode(gameMode: string | null): ParsedScoreState | null {
  if (!gameMode) {
    return null;
  }

  const match = gameMode.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);
  if (!match) {
    return null;
  }

  const left = Number(match[1]);
  const right = Number(match[2]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  return {
    left,
    right,
    signature: `${left}:${right}`,
    total: left + right,
  };
}

function shouldIgnoreRosterEntry(snapshot: { steamId?: string; name?: string | null }): boolean {
  const steamId = snapshot.steamId?.trim();
  const normalizedName = normalizeIdentifier(snapshot.name);
  return steamId === '0' || normalizedName === 'demorecorder';
}

function stripScoreSuffix(gameMode: string | null): string | null {
  if (!gameMode) {
    return null;
  }

  const stripped = gameMode.replace(/\s*\[\s*\d+\s*:\s*\d+\s*\]\s*$/, '').trim();
  return stripped || gameMode;
}

function buildKillFeedKey(data: Record<string, unknown>): string | null {
  const attacker = normalizeIdentifier(resolvePlayerIdentifier(data, ['killer', 'attacker'])) || '?';
  const victim = normalizeIdentifier(resolvePlayerIdentifier(data, ['victim', 'target', 'dead']));
  if (!victim) {
    return null;
  }

  const weapon = normalizeIdentifier(data.weapon) || '?';
  const assister = normalizeIdentifier(data.assister) || '?';
  const headshot = toBoolean(data.headshot) ? 'hs' : 'body';
  const suicide = toBoolean(data.suicide) ? 'suicide' : 'normal';
  return `${attacker}|${assister}|${victim}|${weapon}|${headshot}|${suicide}`;
}

class OverwolfStateAccumulator {
  private state: OverwolfAccumulatorState = initialState();

  reset(reason: string): void {
    this.state = initialState();
    this.state.statusText = reason;
  }

  ingest(message: OverwolfBridgeMessage): OverwolfIngestResult {
    switch (message.kind) {
      case 'reset':
        this.reset('Overwolf GEP reset pending a new Counter-Strike 2 session');
        return this.buildResult(true, 'OVERWOLF_RESET', 'Overwolf state reset');
      case 'status':
        return this.applyStatus(message.payload);
      case 'events':
        return this.applyEvents(message.payload);
      case 'info':
      default:
        return this.applyInfo(message.payload);
    }
  }

  private applyStatus(payload: unknown): OverwolfIngestResult {
    let changed = false;

    if (isRecord(payload)) {
      const connected = toBoolean(payload.connected ?? payload.available ?? payload.running);
      if (connected !== null && connected !== this.state.connected) {
        this.state.connected = connected;
        changed = true;
      }

      const text = toStringValue(payload.status ?? payload.message ?? payload.error);
      if (text && text !== this.state.statusText) {
        this.state.statusText = text;
        changed = true;
      }
    }

    return this.buildResult(changed, 'OVERWOLF_STATUS', this.state.statusText);
  }

  private applyInfo(payload: unknown): OverwolfIngestResult {
    const info = normalizeInfoPayload(payload);
    let changed = false;

    for (const [rawKey, rawValue] of Object.entries(info)) {
      const key = rawKey.toLowerCase();
      const value = parseLooseValue(rawValue);

      if (key.startsWith('roster_')) {
        changed = this.upsertRoster(rawKey, value) || changed;
        continue;
      }

      if (key === 'map_name') {
        const nextMapName = toStringValue(value);
        if (nextMapName && this.state.mapName && nextMapName !== this.state.mapName) {
          this.resetMatchState(`map_name ${this.state.mapName} -> ${nextMapName}`);
          changed = true;
        }
        if (nextMapName !== this.state.mapName) {
          this.state.mapName = nextMapName;
          changed = true;
        }
        continue;
      }

      if (key === 'mode_name') {
        const nextModeName = toStringValue(value);
        if (nextModeName !== this.state.modeName) {
          this.state.modeName = nextModeName;
          changed = true;
        }
        continue;
      }

      if (key === 'game_mode') {
        const nextGameMode = toStringValue(value);
        const currentBaseMode = stripScoreSuffix(this.state.gameMode);
        const nextBaseMode = stripScoreSuffix(nextGameMode);
        if (nextBaseMode && currentBaseMode && nextBaseMode !== currentBaseMode) {
          this.resetMatchState(`game_mode ${currentBaseMode} -> ${nextBaseMode}`);
          changed = true;
        }
        if (nextGameMode !== this.state.gameMode) {
          this.state.gameMode = nextGameMode;
          changed = true;
        }

        const parsedScore = parseScoreFromGameMode(nextGameMode);
        changed = this.applyRoundScore(parsedScore) || changed;
        continue;
      }

      if (key === 'game_phase') {
        const nextGamePhase = normalizePhase(value) || toStringValue(value);
        if (nextGamePhase !== this.state.gamePhase) {
          this.state.gamePhase = nextGamePhase;
          changed = true;
        }
        continue;
      }

      if (key === 'round_phase') {
        const nextRoundPhase = normalizePhase(value) || toStringValue(value);
        if (nextRoundPhase && nextRoundPhase !== this.state.roundPhase) {
          this.state.roundPhase = nextRoundPhase;
          changed = true;
        }
        continue;
      }

      if (key === 'round_number') {
        const roundNumber = toNumber(value);
        if (roundNumber !== null && roundNumber !== this.state.roundNumber) {
          this.state.roundNumber = roundNumber;
          this.beginNewRound('round_number');
          changed = true;
        }
        continue;
      }

      if (key === 'pseudo_match_id') {
        const nextMatchId = toStringValue(value);
        if (nextMatchId && this.state.pseudoMatchId && nextMatchId !== this.state.pseudoMatchId) {
          this.resetMatchState(`pseudo_match_id ${this.state.pseudoMatchId} -> ${nextMatchId}`);
          changed = true;
        }
        if (nextMatchId !== this.state.pseudoMatchId) {
          this.state.pseudoMatchId = nextMatchId;
          changed = true;
        }
        continue;
      }

      if (key === 'steam_id') {
        const nextSteamId = toStringValue(value);
        if (nextSteamId !== this.state.localSteamId) {
          this.state.localSteamId = nextSteamId;
          changed = true;
        }
        continue;
      }

      if (key === 'kills') {
        const nextKills = toNumber(value);
        if (nextKills !== this.state.kills) {
          this.state.kills = nextKills;
          changed = true;
        }
        continue;
      }

      if (key === 'deaths') {
        const nextDeaths = toNumber(value);
        if (nextDeaths !== this.state.deaths) {
          this.state.deaths = nextDeaths;
          changed = true;
        }
        continue;
      }

      if (key === 'assists') {
        const nextAssists = toNumber(value);
        if (nextAssists !== this.state.assists) {
          this.state.assists = nextAssists;
          changed = true;
        }
        continue;
      }

      changed = this.applyScoreValue(rawKey, value) || changed;
    }

    if (this.state.localSteamId) {
      for (const player of Object.values(this.state.roster)) {
        if (player.steamId === this.state.localSteamId && !player.isLocal) {
          player.isLocal = true;
          changed = true;
        }
      }
    }

    changed = this.refreshLocalPlayerIdentity() || changed;
    return this.buildResult(changed, 'OVERWOLF_INFO', `Overwolf info update - ${this.state.mapName || stripScoreSuffix(this.state.gameMode) || '?'} R${this.state.roundNumber || 0} (${this.state.roundPhase || '?'})`);
  }

  private applyEvents(payload: unknown): OverwolfIngestResult {
    const events = normalizeEvents(payload);
    let changed = false;

    for (const event of events) {
      const name = event.name.toLowerCase();
      if (name === 'round_start') {
        this.beginNewRound('round_start');
        changed = true;
        continue;
      }

      if (name === 'round_end') {
        if (this.state.roundPhase !== 'over') {
          this.state.roundPhase = 'over';
          changed = true;
        }
        continue;
      }

      if (name === 'match_start') {
        if (this.state.gamePhase !== 'live') {
          this.state.gamePhase = 'live';
          changed = true;
        }
        continue;
      }

      if (name === 'match_end') {
        if (this.state.gamePhase !== 'over' || this.state.roundPhase !== 'over') {
          this.state.gamePhase = 'over';
          this.state.roundPhase = 'over';
          changed = true;
        }
        continue;
      }

      if (name === 'kill_feed') {
        changed = this.applyKillFeed(event.data || {}) || changed;
      }
    }

    return this.buildResult(changed, 'OVERWOLF_EVENTS', changed ? 'Overwolf live event update received' : 'Overwolf event received with no state change');
  }

  private applyScoreValue(rawKey: string, value: unknown): boolean {
    const key = rawKey.toLowerCase();
    let changed = false;

    if (key === 'score' && isRecord(value)) {
      const ct = toNumber(value.CT ?? value.ct ?? value.counter_terrorists ?? value.counterTerrorists);
      const t = toNumber(value.T ?? value.t ?? value.terrorists ?? value.terrorist);
      if (ct !== null && this.state.teamScores.CT !== ct) {
        this.state.teamScores.CT = ct;
        changed = true;
      }
      if (t !== null && this.state.teamScores.T !== t) {
        this.state.teamScores.T = t;
        changed = true;
      }
      if (ct !== null && t !== null) {
        changed = this.applyRoundScore({
          left: ct,
          right: t,
          signature: `${ct}:${t}`,
          total: ct + t,
        }) || changed;
      }
      return changed;
    }

    if (key.includes('score') && key.includes('ct')) {
      const parsed = toNumber(value);
      if (parsed !== null && this.state.teamScores.CT !== parsed) {
        this.state.teamScores.CT = parsed;
        return true;
      }
      return false;
    }

    if (key.includes('score') && (key.endsWith('_t') || key.includes('terror'))) {
      const parsed = toNumber(value);
      if (parsed !== null && this.state.teamScores.T !== parsed) {
        this.state.teamScores.T = parsed;
        return true;
      }
    }

    return false;
  }

  private applyRoundScore(score: ParsedScoreState | null): boolean {
    if (!score) {
      return false;
    }

    const nextRoundNumber = score.total + 1;
    let changed = false;

    if (this.state.roundNumber !== nextRoundNumber) {
      this.state.roundNumber = nextRoundNumber;
      changed = true;
    }

    if (!this.state.scoreSignature) {
      this.state.scoreSignature = score.signature;
      this.beginNewRound('initial_score_sync');
      return true;
    }

    if (this.state.scoreSignature !== score.signature) {
      logger.info(`Detected Overwolf score change ${this.state.scoreSignature} -> ${score.signature}; starting new round baseline`);
      this.state.scoreSignature = score.signature;
      this.state.hasReliableRoundBoundary = true;
      this.beginNewRound('score_change');
      return true;
    }

    return changed;
  }

  private upsertRoster(slot: string, value: unknown): boolean {
    const parsedValue = isRecord(value) ? value : parseLooseValue(value);
    const parsed = isRecord(parsedValue) ? parsedValue : null;
    if (!parsed) {
      return false;
    }

    const steamId = toStringValue(parsed.steamid ?? parsed.steam_id) || undefined;
    const name = toStringValue(parsed.nickname ?? parsed.name ?? parsed.player) || slot;
    if (shouldIgnoreRosterEntry({ steamId, name })) {
      return false;
    }

    const id = toStringValue(parsed.steamid ?? parsed.steam_id ?? parsed.player_id ?? parsed.id ?? slot) || slot;
    const existing = this.state.roster[id];
    const explicitAlive =
      toBoolean(parsed.alive) ??
      (toBoolean(parsed.dead) === null ? null : !toBoolean(parsed.dead)) ??
      (toNumber(parsed.health) === null ? null : (toNumber(parsed.health) || 0) > 0);
    const totalDeaths = toNumber(parsed.deaths ?? parsed.death ?? parsed.total_deaths) ?? existing?.totalDeaths ?? null;

    let baselineDeaths = existing?.baselineDeaths ?? totalDeaths;
    let includedInRound = existing?.includedInRound ?? (!this.state.hasReliableRoundBoundary || this.state.roundPhase !== 'live');
    let forceAlive = false;

    if (totalDeaths !== null) {
      if (baselineDeaths === null) {
        baselineDeaths = totalDeaths;
        forceAlive = true;
      } else if (totalDeaths < baselineDeaths) {
        baselineDeaths = totalDeaths;
        forceAlive = true;
      }

      if (typeof existing?.totalDeaths === 'number' && totalDeaths < existing.totalDeaths) {
        baselineDeaths = totalDeaths;
        forceAlive = true;
      }
    }

    let alive = explicitAlive ?? existing?.alive ?? true;
    if (forceAlive) {
      alive = true;
    } else if (totalDeaths !== null && baselineDeaths !== null && totalDeaths > baselineDeaths) {
      alive = false;
      if (this.state.roundPhase !== 'live') {
        this.state.roundPhase = 'live';
      }
    }

    const snapshot: MutablePlayerSnapshot = {
      id,
      slot,
      steamId: steamId || existing?.steamId,
      name,
      team: normalizeTeam(parsed.team ?? parsed.side) || existing?.team || null,
      isLocal: toBoolean(parsed.is_local ?? parsed.local) ?? existing?.isLocal ?? false,
      alive,
      totalDeaths,
      baselineDeaths,
      includedInRound,
      lastSeenAt: Date.now(),
    };

    if (snapshot.isLocal) {
      snapshot.includedInRound = true;
    } else if (!existing) {
      snapshot.includedInRound = !this.state.hasReliableRoundBoundary || this.state.roundPhase !== 'live';
    } else if (!existing.includedInRound && (this.state.roundPhase !== 'live' || !this.state.hasReliableRoundBoundary)) {
      snapshot.includedInRound = Boolean(snapshot.team);
    }

    const changed = !existing ||
      existing.name !== snapshot.name ||
      existing.team !== snapshot.team ||
      existing.isLocal !== snapshot.isLocal ||
      existing.alive !== snapshot.alive ||
      existing.totalDeaths !== snapshot.totalDeaths ||
      existing.baselineDeaths !== snapshot.baselineDeaths ||
      existing.includedInRound !== snapshot.includedInRound ||
      existing.steamId !== snapshot.steamId;

    this.state.roster[id] = snapshot;

    if (snapshot.isLocal) {
      this.state.localPlayerId = id;
      this.state.localSteamId = snapshot.steamId || this.state.localSteamId;
    }

    return changed;
  }

  private applyKillFeed(data: Record<string, unknown>): boolean {
    this.refreshLocalPlayerIdentity();
    this.pruneRecentKillFeed();

    const eventKey = buildKillFeedKey(data);
    if (eventKey && this.state.recentKillFeed.has(eventKey)) {
      return false;
    }

    if (eventKey) {
      this.state.recentKillFeed.set(eventKey, Date.now());
    }

    let changed = false;
    if (this.state.roundPhase !== 'live') {
      this.state.roundPhase = 'live';
      changed = true;
    }

    const victimId = resolvePlayerIdentifier(data, ['victim', 'target', 'dead']);
    const victim = victimId ? this.findRosterPlayer(victimId) : null;
    if (!victim || !victim.alive) {
      return changed;
    }

    victim.alive = false;
    logger.debug(`Marked ${victim.name} as dead via kill_feed hint (${victim.team || '?'})`);
    return true;
  }

  private findRosterPlayer(idOrName: string): MutablePlayerSnapshot | null {
    const exact = this.state.roster[idOrName];
    if (exact) {
      return exact;
    }

    const normalized = normalizeIdentifier(idOrName);
    if (!normalized) {
      return null;
    }

    for (const player of Object.values(this.state.roster)) {
      if (
        normalizeIdentifier(player.id) === normalized ||
        normalizeIdentifier(player.steamId) === normalized ||
        normalizeIdentifier(player.name) === normalized ||
        normalizeIdentifier(player.slot) === normalized
      ) {
        return player;
      }
    }

    return null;
  }

  private refreshLocalPlayerIdentity(): boolean {
    if (this.state.localPlayerId && this.state.roster[this.state.localPlayerId]) {
      return false;
    }

    for (const player of Object.values(this.state.roster)) {
      if (player.isLocal || (this.state.localSteamId && player.steamId === this.state.localSteamId)) {
        const changed = !player.isLocal || this.state.localPlayerId !== player.id || this.state.localSteamId !== player.steamId;
        player.isLocal = true;
        this.state.localPlayerId = player.id;
        this.state.localSteamId = player.steamId || this.state.localSteamId;
        return changed;
      }
    }

    return false;
  }

  private beginNewRound(source: string): void {
    for (const player of Object.values(this.state.roster)) {
      player.baselineDeaths = player.totalDeaths ?? player.baselineDeaths ?? 0;
      player.alive = true;
    }

    this.state.recentKillFeed.clear();
    if (this.state.gamePhase !== 'over') {
      this.state.roundPhase = 'freezetime';
    }

    logger.debug(`Reset Overwolf alive baselines for new round (${source})`);
  }

  private resetMatchState(reason: string): void {
    const connected = this.state.connected;
    const statusText = this.state.statusText;
    const localSteamId = this.state.localSteamId;
    this.state = {
      ...initialState(),
      connected,
      statusText,
      localSteamId,
    };
    logger.info(`Reset Overwolf match state (${reason})`);
  }

  private pruneRecentKillFeed(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.state.recentKillFeed.entries()) {
      if ((now - timestamp) > RECENT_KILL_FEED_WINDOW_MS) {
        this.state.recentKillFeed.delete(key);
      }
    }
  }

  private buildResult(changed: boolean, eventType: string, summary: string): OverwolfIngestResult {
    const rosterPlayers = this.getCountablePlayers();
    const teamCounts = rosterPlayers.reduce<Record<TeamCode, number>>((acc, player) => {
      if (player.team) {
        acc[player.team] += 1;
      }
      return acc;
    }, { CT: 0, T: 0 });
    const rosterAvailable = Boolean(this.getLocalPlayer()) && teamCounts.CT > 0 && teamCounts.T > 0;
    const playerStatsAvailable = [this.state.kills, this.state.deaths, this.state.assists].some((value) => value !== null);

    let rosterStatus = 'Waiting for Overwolf roster data from Counter-Strike 2.';
    if (rosterAvailable) {
      rosterStatus = this.state.hasReliableRoundBoundary
        ? 'Live Counter-Strike 2 roster received from Overwolf GEP (alive counts synced from round score and roster deaths).'
        : 'Overwolf roster received. Alive counts become fully reliable after the next round score change.';
    }

    return {
      changed,
      gameState: changed ? this.buildGameState() : null,
      rosterAvailable,
      rosterStatus,
      playerStatsAvailable,
      playerStatsStatus: playerStatsAvailable
        ? 'Live player match stats received from Overwolf GEP'
        : 'Waiting for Overwolf player match stats from Counter-Strike 2.',
      eventType,
      summary,
    };
  }

  private getCountablePlayers(): MutablePlayerSnapshot[] {
    const rosterPlayers = Object.values(this.state.roster);
    if (!this.state.hasReliableRoundBoundary) {
      return rosterPlayers;
    }

    return rosterPlayers.filter((player) => player.includedInRound || player.isLocal);
  }

  private getLocalPlayer(): MutablePlayerSnapshot | null {
    this.refreshLocalPlayerIdentity();
    if (this.state.localPlayerId && this.state.roster[this.state.localPlayerId]) {
      return this.state.roster[this.state.localPlayerId];
    }

    return Object.values(this.state.roster).find((player) => player.isLocal) || null;
  }

  private buildGameState(): GameState | null {
    const rosterPlayers = this.getCountablePlayers();
    if (rosterPlayers.length === 0) {
      return null;
    }

    const localPlayer = this.getLocalPlayer() || rosterPlayers[0];
    if (!localPlayer) {
      return null;
    }

    const allPlayers = Object.fromEntries(
      rosterPlayers.map((player) => [
        player.id,
        {
          steamid: player.steamId,
          name: player.name,
          team: player.team || undefined,
          state: {
            health: player.alive ? 100 : 0,
          },
        },
      ])
    );

    return {
      provider: {
        name: 'overwolf',
        timestamp: Date.now(),
        steamid: this.state.localSteamId || undefined,
      },
      player: {
        steamid: localPlayer.steamId,
        name: localPlayer.name,
        team: localPlayer.team || undefined,
        state: {
          health: localPlayer.alive ? 100 : 0,
        },
        match_stats: {
          kills: this.state.kills ?? undefined,
          deaths: this.state.deaths ?? undefined,
          assists: this.state.assists ?? undefined,
        },
      },
      team: {
        CT: { score: this.state.teamScores.CT ?? undefined },
        T: { score: this.state.teamScores.T ?? undefined },
      },
      round: {
        phase: this.state.roundPhase || undefined,
      },
      map: {
        mode: stripScoreSuffix(this.state.gameMode) || this.state.modeName || undefined,
        name: this.state.mapName || undefined,
        phase: this.state.gamePhase || undefined,
        round: this.state.roundNumber || undefined,
      },
      allPlayers,
      raw: {
        overwolf: {
          statusText: this.state.statusText,
          scoreSignature: this.state.scoreSignature,
          hasReliableRoundBoundary: this.state.hasReliableRoundBoundary,
          pseudoMatchId: this.state.pseudoMatchId,
        },
      },
    };
  }
}

export const overwolfStateAccumulator = new OverwolfStateAccumulator();
