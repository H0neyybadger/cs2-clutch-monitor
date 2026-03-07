import 'dotenv/config';
import { bootstrap } from './app/bootstrap';
import { createLogger } from './app/logger';

const logger = createLogger('Main');

async function main(): Promise<void> {
  try {
    logger.info('Starting CS2 Discord Clutch...');
    await bootstrap();
    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
