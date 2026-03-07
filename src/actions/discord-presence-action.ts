import { createLogger } from '../app/logger';
import { eventBus, GameEventType, type TypedGameEvent, type ClutchStartedEvent, type ClutchEndedEvent } from '../events/event-bus';
import { setClutchPresence, setNormalPresence } from '../discord/presence-controller';
import type { ActionHandler } from './action-handler';

const logger = createLogger('DiscordPresenceAction');

export class DiscordPresenceActionHandler implements ActionHandler {
  name = 'DiscordPresenceAction';

  async initialize(): Promise<void> {
    eventBus.onGameEvent(GameEventType.CLUTCH_STARTED, this.handleClutchStarted.bind(this));
    eventBus.onGameEvent(GameEventType.CLUTCH_ENDED, this.handleClutchEnded.bind(this));
    logger.info('Discord presence action handler initialized');
  }

  async handleEvent(event: TypedGameEvent): Promise<void> {
    switch (event.type) {
      case GameEventType.CLUTCH_STARTED:
        await this.handleClutchStarted(event as ClutchStartedEvent);
        break;
      case GameEventType.CLUTCH_ENDED:
        await this.handleClutchEnded(event as ClutchEndedEvent);
        break;
    }
  }

  private async handleClutchStarted(event: ClutchStartedEvent): Promise<void> {
    logger.info('Updating Discord presence for clutch mode');
    
    try {
      await setClutchPresence(event.data.enemyAliveCount);
    } catch (error) {
      logger.error('Failed to update Discord presence for clutch:', error);
    }
  }

  private async handleClutchEnded(event: ClutchEndedEvent): Promise<void> {
    logger.info('Restoring Discord presence to normal');
    
    try {
      await setNormalPresence();
    } catch (error) {
      logger.error('Failed to restore Discord presence:', error);
    }
  }

  async shutdown(): Promise<void> {
    eventBus.offGameEvent(GameEventType.CLUTCH_STARTED, this.handleClutchStarted.bind(this));
    eventBus.offGameEvent(GameEventType.CLUTCH_ENDED, this.handleClutchEnded.bind(this));
    logger.info('Discord presence action handler shutdown');
  }
}
