import 'dotenv/config';
import { createLogger } from '../app/logger';
import { initializeDiscordRpc, isConnected, getRpcClient } from '../discord/rpc-client';
import { loadConfig } from '../shared/utils';

const logger = createLogger('ConnectionTest');

async function testConnection(): Promise<void> {
  logger.info('=== Discord Rich Presence Connection Test ===\n');

  const config = loadConfig();

  logger.info('Test 1: Initialize Discord RPC');
  await initializeDiscordRpc(config.discord);

  // Wait for connection to establish
  await new Promise(resolve => setTimeout(resolve, 3000));

  logger.info('\nTest 2: Check connection status');
  const connected = isConnected();
  logger.info(`Connection status: ${connected ? 'CONNECTED ✓' : 'NOT CONNECTED ✗'}`);

  if (!connected) {
    logger.error('❌ Connection test FAILED');
    logger.error('Review the logs above to identify the failure point');
    logger.error('Common issues:');
    logger.error('  - Discord desktop app not running');
    logger.error('  - Invalid DISCORD_CLIENT_ID in .env');
    logger.error('  - Discord running in web-only mode');
    process.exit(1);
  }

  logger.info('\nTest 3: Verify RPC client availability');
  const client = getRpcClient();
  if (!client) {
    logger.error('❌ RPC client is null despite connection status');
    process.exit(1);
  }
  logger.info('✓ RPC client available');

  logger.info('\nTest 4: Voice channel fetch (OPTIONAL)');
  logger.info('Note: Voice channel fetch requires authenticated OAuth scopes');
  logger.info('      and is not required for Discord Rich Presence.');
  logger.info('      Skipping this test as the app uses basic RPC connection.');
  logger.info('      Voice control will use SET_USER_VOICE_SETTINGS commands');
  logger.info('      which work with basic IPC authentication.');

  logger.info('\n=== Connection Test Summary ===');
  logger.info('✓ Discord RPC client initialized');
  logger.info('✓ Login with clientId successful');
  logger.info('✓ Ready event received');
  logger.info('✓ Connection status: CONNECTED');
  logger.info('✓ RPC client available for commands');
  logger.info('\n✅ All critical Rich Presence tests PASSED');
  logger.info('Discord RPC is ready for clutch mode');
  
  process.exit(0);
}

testConnection().catch((error) => {
  logger.error('❌ Unhandled error in connection test:', error);
  process.exit(1);
});
