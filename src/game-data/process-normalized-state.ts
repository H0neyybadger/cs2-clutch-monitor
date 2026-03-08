import type { ClutchEngine } from '../clutch/clutch-engine';
import { classifyGameMode, isClutchEligible } from '../clutch/mode-classifier';
import { stateStore } from '../app/state-store';
import { countAlivePlayers, getEnemyTeam, isPlayerAlive } from '../gsi/evaluator';
import type { GameState } from '../gsi/types';

export interface ProcessNormalizedGameStateOptions {
  source: 'gsi' | 'overwolf' | 'simulator';
  gameState: GameState;
  clutchEngine: ClutchEngine;
  rosterAvailable?: boolean;
  rosterStatus?: string;
  playerStatsAvailable?: boolean;
  playerStatsStatus?: string;
  eventType?: string;
  eventSummary?: string;
}

function getDefaultRosterStatus(source: ProcessNormalizedGameStateOptions['source'], hasRoster: boolean): string {
  if (hasRoster) {
    return source === 'overwolf'
      ? 'Live roster data received from Overwolf GEP'
      : 'Live roster data received from the game feed';
  }

  return source === 'overwolf'
    ? 'Waiting for Overwolf roster data from Counter-Strike 2.'
    : 'Waiting for roster data from the game feed.';
}

function getDefaultPlayerStatsStatus(source: ProcessNormalizedGameStateOptions['source'], hasPlayerStats: boolean): string {
  if (hasPlayerStats) {
    return source === 'overwolf'
      ? 'Live player match stats received from Overwolf GEP'
      : 'Live player match stats received from the game feed';
  }

  return source === 'overwolf'
    ? 'Waiting for Overwolf player match stats from Counter-Strike 2.'
    : 'Waiting for player match stats from the game feed.';
}

export function processNormalizedGameState(options: ProcessNormalizedGameStateOptions): void {
  const { source, gameState, clutchEngine } = options;
  const newRoundNumber = gameState.map?.round || 0;
  const newPhase = gameState.round?.phase || '?';

  if (newRoundNumber > 0 && newPhase !== '?') {
    stateStore.handleRoundTransition(newRoundNumber, newPhase);
  }

  clutchEngine.processGameState(gameState);

  const partial: Record<string, any> = {
    lastPayloadTime: Date.now(),
    dataSource: source,
    dataSourceStatus: source === 'overwolf' ? 'Receiving live Counter-Strike 2 data from Overwolf GEP' : 'Receiving live Counter-Strike 2 data from GSI',
  };

  const player = gameState.player;
  const allPlayers = gameState.allPlayers;
  const hasRoster = options.rosterAvailable ?? Boolean(allPlayers && Object.keys(allPlayers).length > 1);
  const matchStats = player?.match_stats;
  const hasMatchStats = options.playerStatsAvailable ?? Boolean(
    matchStats && (
      typeof matchStats.kills === 'number' ||
      typeof matchStats.deaths === 'number' ||
      typeof matchStats.assists === 'number'
    )
  );

  partial.rosterAvailable = hasRoster;
  partial.rosterStatus = options.rosterStatus || getDefaultRosterStatus(source, hasRoster);
  partial.playerStatsAvailable = hasMatchStats;
  partial.playerStatsStatus = options.playerStatsStatus || getDefaultPlayerStatsStatus(source, hasMatchStats);

  if (player) {
    if (player.team) {
      partial.playerTeam = player.team;
    }
    partial.playerAlive = isPlayerAlive(player);
  }

  if (gameState.round?.phase) partial.roundPhase = gameState.round.phase;
  if (gameState.map?.phase) partial.mapPhase = gameState.map.phase;
  if (gameState.map?.name) partial.mapName = gameState.map.name;
  if (newRoundNumber > 0) partial.roundNumber = newRoundNumber;

  const gameMode = gameState.map?.mode;
  if (gameMode) {
    partial.gameMode = gameMode;
    const modeClassification = classifyGameMode(gameMode);
    partial.modeSupported = modeClassification.supported;
    partial.modeReason = modeClassification.reason;
  }

  const playerTeam = player?.team || stateStore.gameState.playerTeam;
  if (allPlayers && hasRoster && playerTeam && playerTeam !== '?') {
    const enemyTeam = getEnemyTeam(playerTeam);
    partial.teamAliveCount = countAlivePlayers(allPlayers as Record<string, unknown>, playerTeam);
    partial.enemyAliveCount = countAlivePlayers(allPlayers as Record<string, unknown>, enemyTeam);
  } else if (source !== 'overwolf') {
    partial.teamAliveCount = null;
    partial.enemyAliveCount = null;
  }

  const effectiveRoundPhase = newPhase !== '?' ? newPhase : stateStore.gameState.roundPhase;
  const effectiveMode = gameMode || stateStore.gameState.gameMode;
  const eligibility = isClutchEligible(effectiveMode, effectiveRoundPhase);
  partial.clutchEligible = eligibility.eligible && (hasRoster || (source === 'overwolf' && stateStore.gameState.rosterAvailable));
  partial.clutchEligibilityReason = hasRoster || (source === 'overwolf' && stateStore.gameState.rosterAvailable)
    ? eligibility.reason
    : source === 'overwolf'
      ? 'Waiting for Overwolf roster data so clutch detection can track live alive counts.'
      : 'Automatic clutch detection requires roster data from the game feed.';

  stateStore.updateGameState(partial);
  stateStore.confirmRoundData();
  stateStore.updateSessionStats(gameState);

  if (options.eventType && options.eventSummary) {
    stateStore.pushEvent(source === 'gsi' ? 'gsi' : 'system', 'info', options.eventType, options.eventSummary);
  }
}