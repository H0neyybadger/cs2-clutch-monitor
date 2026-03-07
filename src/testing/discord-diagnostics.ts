import 'dotenv/config';
import { createLogger } from '../app/logger';
import { initializeDiscordRpc, getRpcClient, isConnected, isMockMode } from '../discord/rpc-client';
import { initializeVoiceAdapter, getAdapterMode } from '../discord/voice-controller';
import { loadConfig } from '../shared/utils';

const logger = createLogger('Discord-Diagnostics');

interface DiagnosticResult {
  rpcPackageInstalled: boolean;
  rpcConnected: boolean;
  connectionResult: 'connected' | 'failed' | 'timed out';
  adapterMode: string;
  voiceChannelAvailable: boolean;
  voiceUserCount: number;
  testPassed: boolean;
}

async function checkRpcPackageInstalled(): Promise<boolean> {
  try {
    // @ts-ignore - discord-rpc is optional
    await import('discord-rpc');
    logger.info('✓ Discord RPC package detected');
    return true;
  } catch (error) {
    logger.warn('✗ Discord RPC package not installed');
    return false;
  }
}

async function fetchVoiceChannelInfo(): Promise<{ available: boolean; userCount: number; users: any[] }> {
  const client = getRpcClient();
  if (!client || !isConnected()) {
    return { available: false, userCount: 0, users: [] };
  }

  try {
    const response = await client.request('GET_SELECTED_VOICE_CHANNEL', {});
    
    if (response && response.voice_states) {
      const users = response.voice_states.map((vs: any) => ({
        id: vs.user.id,
        username: vs.user.username,
        volume: vs.volume !== undefined ? vs.volume : 100,
        mute: vs.mute || false,
      }));
      
      logger.info(`✓ Selected voice channel found`);
      logger.info(`✓ Fetched ${users.length} users`);
      return { available: true, userCount: users.length, users };
    }

    logger.warn('✗ No selected voice channel available');
    return { available: false, userCount: 0, users: [] };
  } catch (error) {
    logger.warn('✗ No selected voice channel available');
    return { available: false, userCount: 0, users: [] };
  }
}

async function testVolumeControl(users: any[]): Promise<boolean> {
  const client = getRpcClient();
  if (!client || users.length === 0) {
    return false;
  }

  // Find a non-self user to test on (first user in the list)
  const testUser = users[0];
  const originalVolume = testUser.volume;

  try {
    logger.info(`Testing temporary volume adjustment on user ${testUser.username}`);
    
    // Temporarily set to 80%
    await client.request('SET_USER_VOICE_SETTINGS', {
      user_id: testUser.id,
      pan: {
        left: 1.0,
        right: 1.0,
      },
      volume: 80,
      mute: false,
    });

    logger.info(`✓ Volume adjusted to 80% for ${testUser.username}`);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 500));

    // Restore original volume
    await client.request('SET_USER_VOICE_SETTINGS', {
      user_id: testUser.id,
      pan: {
        left: 1.0,
        right: 1.0,
      },
      volume: originalVolume,
      mute: false,
    });

    logger.info(`✓ Restored original volume for ${testUser.username}`);
    return true;
  } catch (error) {
    logger.error(`✗ Failed to test volume control:`, error);
    return false;
  }
}

async function attemptRpcConnection(): Promise<'connected' | 'failed' | 'timed out'> {
  const config = loadConfig();
  
  logger.info('Forcing Discord RPC initialization...');
  
  if (!config.discord.clientId) {
    logger.warn('No DISCORD_CLIENT_ID configured in .env');
    return 'failed';
  }

  const CONNECTION_TIMEOUT_MS = 8000;
  
  try {
    // Start connection attempt
    const connectionPromise = initializeDiscordRpc(config.discord);
    
    // Create timeout promise
    const timeoutPromise = new Promise<'timed out'>((resolve) => {
      setTimeout(() => {
        logger.warn(`Connection attempt timed out after ${CONNECTION_TIMEOUT_MS}ms`);
        resolve('timed out');
      }, CONNECTION_TIMEOUT_MS);
    });

    // Race between connection and timeout
    await Promise.race([connectionPromise, timeoutPromise]);

    // Wait a bit for ready event to fire
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if connected
    if (isConnected()) {
      logger.info('✓ Discord RPC connection successful');
      return 'connected';
    } else {
      logger.warn('✗ Discord RPC connection failed (no ready event)');
      return 'failed';
    }
  } catch (error) {
    logger.error('✗ Discord RPC connection error:', error);
    return 'failed';
  }
}

async function runDiagnostics(): Promise<DiagnosticResult> {
  logger.info('=== Discord Diagnostics ===\n');

  const result: DiagnosticResult = {
    rpcPackageInstalled: false,
    rpcConnected: false,
    connectionResult: 'failed',
    adapterMode: 'unavailable',
    voiceChannelAvailable: false,
    voiceUserCount: 0,
    testPassed: false,
  };

  // Check if RPC package is installed
  result.rpcPackageInstalled = await checkRpcPackageInstalled();

  // Attempt RPC connection
  result.connectionResult = await attemptRpcConnection();
  
  // Initialize voice adapter after connection attempt
  initializeVoiceAdapter();

  // Check if RPC is connected
  result.rpcConnected = isConnected();
  
  logger.info(`Discord RPC connect attempt result: ${result.connectionResult}`);

  // Check adapter mode
  result.adapterMode = getAdapterMode();
  logger.info(`Voice adapter mode: ${result.adapterMode}`);

  // If mock mode, skip real Discord tests
  if (isMockMode() || !result.rpcConnected) {
    logger.warn('Discord RPC unavailable, using mock diagnostics');
    logger.info('\n=== Diagnostic Summary ===');
    logger.info(`RPC Package Installed: ${result.rpcPackageInstalled ? 'yes' : 'no'}`);
    logger.info(`RPC Connected: ${result.rpcConnected ? 'yes' : 'no'}`);
    logger.info(`Connection Result: ${result.connectionResult}`);
    logger.info(`Voice Adapter Mode: ${result.adapterMode}`);
    logger.info(`Selected Voice Channel: no`);
    logger.info(`Voice Users Detected: 0`);
    logger.info(`Test Status: skipped (mock mode)`);
    return result;
  }

  // Fetch voice channel info
  const voiceInfo = await fetchVoiceChannelInfo();
  result.voiceChannelAvailable = voiceInfo.available;
  result.voiceUserCount = voiceInfo.userCount;

  // If we have users, test volume control
  if (voiceInfo.users.length > 0) {
    result.testPassed = await testVolumeControl(voiceInfo.users);
  }

  // Print summary
  logger.info('\n=== Diagnostic Summary ===');
  logger.info(`RPC Package Installed: ${result.rpcPackageInstalled ? 'yes' : 'no'}`);
  logger.info(`RPC Connected: ${result.rpcConnected ? 'yes' : 'no'}`);
  logger.info(`Connection Result: ${result.connectionResult}`);
  logger.info(`Voice Adapter Mode: ${result.adapterMode}`);
  logger.info(`Selected Voice Channel: ${result.voiceChannelAvailable ? 'yes' : 'no'}`);
  logger.info(`Voice Users Detected: ${result.voiceUserCount}`);
  logger.info(`Test Status: ${result.testPassed ? 'PASSED' : 'FAILED'}`);

  return result;
}

async function main(): Promise<void> {
  try {
    await runDiagnostics();
    process.exit(0);
  } catch (error) {
    logger.error('Diagnostics failed:', error);
    process.exit(1);
  }
}

main();
