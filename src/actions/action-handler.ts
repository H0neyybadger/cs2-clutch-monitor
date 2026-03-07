import { createLogger } from '../app/logger';
import type { TypedGameEvent } from '../events/event-bus';

const logger = createLogger('ActionHandler');

export interface ActionHandler {
  name: string;
  initialize(): Promise<void>;
  handleEvent(event: TypedGameEvent): Promise<void>;
  shutdown(): Promise<void>;
}

export class ActionHandlerRegistry {
  private static instance: ActionHandlerRegistry;
  private handlers: Map<string, ActionHandler> = new Map();

  private constructor() {}

  static getInstance(): ActionHandlerRegistry {
    if (!ActionHandlerRegistry.instance) {
      ActionHandlerRegistry.instance = new ActionHandlerRegistry();
    }
    return ActionHandlerRegistry.instance;
  }

  register(handler: ActionHandler): void {
    this.handlers.set(handler.name, handler);
    logger.info(`Registered action handler: ${handler.name}`);
  }

  unregister(handlerName: string): void {
    this.handlers.delete(handlerName);
    logger.info(`Unregistered action handler: ${handlerName}`);
  }

  async initializeAll(): Promise<void> {
    logger.info(`Initializing ${this.handlers.size} action handlers...`);
    for (const handler of this.handlers.values()) {
      try {
        await handler.initialize();
        logger.info(`✓ Initialized handler: ${handler.name}`);
      } catch (error) {
        logger.error(`✗ Failed to initialize handler ${handler.name}:`, error);
      }
    }
  }

  async shutdownAll(): Promise<void> {
    logger.info('Shutting down action handlers...');
    for (const handler of this.handlers.values()) {
      try {
        await handler.shutdown();
      } catch (error) {
        logger.error(`Error shutting down handler ${handler.name}:`, error);
      }
    }
  }

  async dispatchEvent(event: TypedGameEvent): Promise<void> {
    for (const handler of this.handlers.values()) {
      try {
        await handler.handleEvent(event);
      } catch (error) {
        logger.error(`Error in handler ${handler.name} for event ${event.type}:`, error);
      }
    }
  }

  getHandler(name: string): ActionHandler | undefined {
    return this.handlers.get(name);
  }
}

export const actionHandlerRegistry = ActionHandlerRegistry.getInstance();
