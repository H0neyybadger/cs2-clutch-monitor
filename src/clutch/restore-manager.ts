import { stateStore } from '../app/state-store';
import { createLogger } from '../app/logger';

const logger = createLogger('RestoreManager');

export class RestoreManager {
  private restoreTimeout: ReturnType<typeof setTimeout> | null = null;

  scheduleRestore(delayMs: number, restoreFn: () => Promise<void>): void {
    this.cancelRestore();

    this.restoreTimeout = setTimeout(() => {
      restoreFn()
        .then(() => {
          stateStore.clearOriginalVolumes();
          logger.info('Volume restored successfully');
        })
        .catch((error: Error) => {
          logger.error('Failed to restore volume:', error);
        });
    }, delayMs);
  }

  cancelRestore(): void {
    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
      this.restoreTimeout = null;
    }
  }
}
