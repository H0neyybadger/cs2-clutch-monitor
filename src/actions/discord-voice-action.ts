import { createLogger } from '../app/logger';
import { eventBus, GameEventType, type TypedGameEvent, type ClutchStartedEvent, type ClutchEndedEvent } from '../events/event-bus';
import { lowerDiscordVolume, restoreDiscordVolume } from '../discord/voice-controller';
import type { ActionHandler } from './action-handler';
import type { AppConfig } from '../shared/types';

const logger = createLogger('DiscordVoiceAction');

export class DiscordVoiceActionHandler implements ActionHandler {
  name = 'DiscordVoiceAction';
  private config: AppConfig;
  private clutchActive = false;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    eventBus.onGameEvent(GameEventType.CLUTCH_STARTED, this.handleClutchStarted.bind(this));
    eventBus.onGameEvent(GameEventType.CLUTCH_ENDED, this.handleClutchEnded.bind(this));
    logger.info('Discord voice action handler initialized');
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
    if (this.clutchActive) {
      return;
    }

    this.clutchActive = true;
    logger.info('Applying clutch voice mode');

    try {
      await lowerDiscordVolume(this.config.clutch.volumePercent);
    } catch (error) {
      logger.error('Failed to apply clutch voice mode:', error);
    }
  }

  private async handleClutchEnded(event: ClutchEndedEvent): Promise<void> {
    if (!this.clutchActive) {
      return;
    }

    this.clutchActive = false;
    logger.info('Restoring normal voice mode');

    setTimeout(async () => {
      try {
        await restoreDiscordVolume();
      } catch (error) {
        logger.error('Failed to restore normal voice mode:', error);
      }
    }, this.config.clutch.restoreDelayMs);
  }

  async shutdown(): Promise<void> {
    eventBus.offGameEvent(GameEventType.CLUTCH_STARTED, this.handleClutchStarted.bind(this));
    eventBus.offGameEvent(GameEventType.CLUTCH_ENDED, this.handleClutchEnded.bind(this));
    logger.info('Discord voice action handler shutdown');
  }
}
