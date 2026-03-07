import { EventEmitter } from 'events';
import { createLogger } from '../app/logger';

const logger = createLogger('EventBus');

export enum GameEventType {
  PLAYER_LAST_ALIVE = 'PLAYER_LAST_ALIVE',
  PLAYER_DIED = 'PLAYER_DIED',
  ROUND_STARTED = 'ROUND_STARTED',
  ROUND_ENDED = 'ROUND_ENDED',
  CLUTCH_STARTED = 'CLUTCH_STARTED',
  CLUTCH_ENDED = 'CLUTCH_ENDED',
}

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  data: any;
}

export interface PlayerLastAliveEvent extends GameEvent {
  type: GameEventType.PLAYER_LAST_ALIVE;
  data: {
    playerTeam: string;
    enemyAliveCount: number;
    roundPhase: string;
  };
}

export interface PlayerDiedEvent extends GameEvent {
  type: GameEventType.PLAYER_DIED;
  data: {
    playerTeam: string;
    roundPhase: string;
  };
}

export interface RoundStartedEvent extends GameEvent {
  type: GameEventType.ROUND_STARTED;
  data: {
    roundNumber: number;
  };
}

export interface RoundEndedEvent extends GameEvent {
  type: GameEventType.ROUND_ENDED;
  data: {
    roundPhase: string;
    winningTeam?: string;
  };
}

export interface ClutchStartedEvent extends GameEvent {
  type: GameEventType.CLUTCH_STARTED;
  data: {
    playerTeam: string;
    enemyAliveCount: number;
  };
}

export interface ClutchEndedEvent extends GameEvent {
  type: GameEventType.CLUTCH_ENDED;
  data: {
    reason: 'player_died' | 'round_ended' | 'teammates_alive';
  };
}

export type TypedGameEvent =
  | PlayerLastAliveEvent
  | PlayerDiedEvent
  | RoundStartedEvent
  | RoundEndedEvent
  | ClutchStartedEvent
  | ClutchEndedEvent;

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    const gameEvent = args[0] as GameEvent;
    if (gameEvent && gameEvent.type) {
      logger.debug(`Event emitted: ${gameEvent.type}`);
    }
    return super.emit(event, ...args);
  }

  emitGameEvent(event: TypedGameEvent): void {
    this.emit(event.type, event);
  }

  onGameEvent(eventType: GameEventType, handler: (event: any) => void): void {
    this.on(eventType, handler);
  }

  offGameEvent(eventType: GameEventType, handler: (event: any) => void): void {
    this.off(eventType, handler);
  }
}

export const eventBus = EventBus.getInstance();
