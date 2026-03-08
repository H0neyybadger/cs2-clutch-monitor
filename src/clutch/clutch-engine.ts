import { stateStore } from '../app/state-store';
import { createLogger } from '../app/logger';
import { shouldEnableClutch, evaluateGameState, getThreatLevel } from './rules';
import { eventBus, GameEventType } from '../events/event-bus';
import { detectAndEmitEvents } from '../events/event-detector';
import { actionHandlerRegistry } from '../actions/action-handler';
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

    // Emit standardized events from game state
    detectAndEmitEvents(gameState);

    // Emit clutch state changes as events
    if (isClutch && !currentlyInClutch) {
      this.enterClutchMode(gameState);
    } else if (!isClutch && currentlyInClutch) {
      this.exitClutchMode();
    }
  }

  private enterClutchMode(gameState: GameState): void {
    logger.info('🎯 CLUTCH ACTIVE');
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

    // Track clutch attempt in session stats
    stateStore.incrementClutchAttempts(enemyAliveCount);

    // Emit CLUTCH_STARTED event
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

  private exitClutchMode(): void {
    logger.info('✅ CLUTCH RESTORED');
    stateStore.clutchActive = false;
    stateStore.currentScenario = 'Normal';
    stateStore.pushEvent('clutch', 'info', 'CLUTCH_ENDED', 'Clutch ended — restoring normal state');

    // Emit CLUTCH_ENDED event
    eventBus.emitGameEvent({
      type: GameEventType.CLUTCH_ENDED,
      timestamp: Date.now(),
      data: {
        reason: 'teammates_alive',
      },
    });
  }
}
