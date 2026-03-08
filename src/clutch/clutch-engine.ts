import { stateStore } from '../app/state-store';
import { createLogger } from '../app/logger';
import { shouldEnableClutch, evaluateGameState, getThreatLevel } from './rules';
import { eventBus, GameEventType } from '../events/event-bus';
import { detectAndEmitEvents } from '../events/event-detector';
import type { GameState } from '../gsi/types';
import type { AppConfig } from '../shared/types';

const logger = createLogger('ClutchEngine');

export class ClutchEngine {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  processGameState(gameState: GameState): void {
    stateStore.lastGameStateTime = Date.now();

    const evaluation = evaluateGameState(gameState);
    const isClutch = shouldEnableClutch(gameState);
    const currentlyInClutch = stateStore.clutchActive;

    logger.info(evaluation);

    detectAndEmitEvents(gameState);

    if (isClutch && !currentlyInClutch) {
      this.enterClutchMode(gameState);
      return;
    }

    if (currentlyInClutch) {
      if (this.shouldExitActiveClutch(gameState)) {
        this.exitClutchMode(gameState);
      } else {
        this.refreshActiveClutch(gameState);
      }
    }
  }

  private shouldExitActiveClutch(gameState: GameState): boolean {
    const roundPhase = gameState.round?.phase || stateStore.gameState.roundPhase || '?';
    const mapPhase = gameState.map?.phase || '?';

    if (mapPhase === 'over') {
      return true;
    }

    if (roundPhase === 'freezetime' || roundPhase === 'over') {
      return true;
    }

    return false;
  }

  private refreshActiveClutch(gameState: GameState): void {
    const player = gameState.player;
    const allPlayers = gameState.allPlayers;
    const playerTeam = player?.team || stateStore.gameState.playerTeam || '?';

    let enemyAliveCount = stateStore.gameState.enemyAliveCount ?? 0;
    if (playerTeam !== '?' && allPlayers) {
      const { countAlivePlayers, getEnemyTeam } = require('../gsi/evaluator');
      enemyAliveCount = countAlivePlayers(allPlayers, getEnemyTeam(playerTeam));
    }

    const threatLevel = getThreatLevel(Math.max(enemyAliveCount, 1));
    stateStore.currentScenario = `1v${Math.max(enemyAliveCount, 1)} Clutch (${threatLevel} threat)`;
  }

  private enterClutchMode(gameState: GameState): void {
    logger.info('CLUTCH ACTIVE');
    stateStore.clutchActive = true;

    const player = gameState.player;
    const allPlayers = gameState.allPlayers;
    const playerTeam = player?.team || '?';

    let enemyAliveCount = 0;
    if (playerTeam !== '?' && allPlayers) {
      const { countAlivePlayers, getEnemyTeam } = require('../gsi/evaluator');
      const enemyTeam = getEnemyTeam(playerTeam);
      enemyAliveCount = countAlivePlayers(allPlayers, enemyTeam);
    }

    const threatLevel = getThreatLevel(enemyAliveCount);
    stateStore.currentScenario = `1v${enemyAliveCount} Clutch (${threatLevel} threat)`;
    stateStore.pushEvent('clutch', 'info', 'CLUTCH_STARTED', `Clutch started: 1v${enemyAliveCount} (${playerTeam}) - Threat: ${threatLevel}`);
    stateStore.incrementClutchAttempts(enemyAliveCount);

    eventBus.emitGameEvent({
      type: GameEventType.CLUTCH_STARTED,
      timestamp: Date.now(),
      data: {
        playerTeam,
        enemyAliveCount,
        threatLevel,
      },
    });
  }

  private exitClutchMode(gameState: GameState): void {
    const roundPhase = gameState.round?.phase || stateStore.gameState.roundPhase || '?';
    const mapPhase = gameState.map?.phase || '?';
    const reason = mapPhase === 'over' || roundPhase === 'freezetime' || roundPhase === 'over' ? 'round_ended' : 'teammates_alive';

    logger.info('CLUTCH RESTORED');
    stateStore.clutchActive = false;
    stateStore.currentScenario = 'Normal';
    stateStore.pushEvent('clutch', 'info', 'CLUTCH_ENDED', `Clutch ended - ${reason}`);

    eventBus.emitGameEvent({
      type: GameEventType.CLUTCH_ENDED,
      timestamp: Date.now(),
      data: { reason },
    });
  }
}
