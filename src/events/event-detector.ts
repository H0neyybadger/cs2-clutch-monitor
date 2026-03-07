import { createLogger } from '../app/logger';
import { eventBus, GameEventType } from './event-bus';
import type { GameState } from '../gsi/types';
import { countAlivePlayers, isPlayerAlive, getEnemyTeam } from '../gsi/evaluator';

const logger = createLogger('EventDetector');

interface PreviousState {
  playerAlive: boolean;
  teamAliveCount: number;
  roundPhase: string | null;
  roundNumber: number;
}

let previousState: PreviousState = {
  playerAlive: false,
  teamAliveCount: 0,
  roundPhase: null,
  roundNumber: 0,
};

export function detectAndEmitEvents(gameState: GameState): void {
  const player = gameState.player;
  const allPlayers = gameState.allPlayers;
  const round = gameState.round;
  const map = gameState.map;

  if (!player || !allPlayers) {
    return;
  }

  const currentPlayerAlive = isPlayerAlive(player);
  const playerTeam = player.team || '?';
  const currentTeamAliveCount = playerTeam !== '?' ? countAlivePlayers(allPlayers, playerTeam) : 0;
  const currentRoundPhase = round?.phase || null;
  const currentRoundNumber = map?.round || 0;

  // Detect ROUND_STARTED
  if (currentRoundNumber > previousState.roundNumber && currentRoundPhase === 'live') {
    eventBus.emitGameEvent({
      type: GameEventType.ROUND_STARTED,
      timestamp: Date.now(),
      data: {
        roundNumber: currentRoundNumber,
      },
    });
  }

  // Detect ROUND_ENDED
  if (previousState.roundPhase === 'live' && currentRoundPhase === 'over') {
    eventBus.emitGameEvent({
      type: GameEventType.ROUND_ENDED,
      timestamp: Date.now(),
      data: {
        roundPhase: currentRoundPhase,
      },
    });
  }

  // Detect PLAYER_DIED
  if (previousState.playerAlive && !currentPlayerAlive) {
    eventBus.emitGameEvent({
      type: GameEventType.PLAYER_DIED,
      timestamp: Date.now(),
      data: {
        playerTeam,
        roundPhase: currentRoundPhase || '?',
      },
    });
  }

  // Detect PLAYER_LAST_ALIVE
  if (currentPlayerAlive && currentTeamAliveCount === 1 && currentRoundPhase === 'live') {
    const enemyTeam = playerTeam !== '?' ? getEnemyTeam(playerTeam) : '?';
    const enemyAliveCount = enemyTeam !== '?' ? countAlivePlayers(allPlayers, enemyTeam) : 0;

    if (enemyAliveCount >= 1) {
      eventBus.emitGameEvent({
        type: GameEventType.PLAYER_LAST_ALIVE,
        timestamp: Date.now(),
        data: {
          playerTeam,
          enemyAliveCount,
          roundPhase: currentRoundPhase,
        },
      });
    }
  }

  // Update previous state
  previousState = {
    playerAlive: currentPlayerAlive,
    teamAliveCount: currentTeamAliveCount,
    roundPhase: currentRoundPhase,
    roundNumber: currentRoundNumber,
  };
}

export function resetEventDetector(): void {
  previousState = {
    playerAlive: false,
    teamAliveCount: 0,
    roundPhase: null,
    roundNumber: 0,
  };
  logger.debug('Event detector state reset');
}
