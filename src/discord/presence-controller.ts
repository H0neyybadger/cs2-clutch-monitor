import { createLogger } from '../app/logger';
import { getRpcClient, isConnected } from './rpc-client';
import { stateStore } from '../app/state-store';

const logger = createLogger('PresenceController');

interface PresenceActivity {
  details?: string;
  state?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  partyId?: string;
  partySize?: number;
  partyMax?: number;
  matchSecret?: string;
  joinSecret?: string;
  spectateSecret?: string;
  instance?: boolean;
}

export async function setPresence(activity: PresenceActivity): Promise<void> {
  const client = getRpcClient();
  
  if (!client || !isConnected()) {
    logger.warn('Cannot set presence: RPC client not connected');
    return;
  }

  try {
    logger.info('=== Setting Discord Rich Presence ===');
    logger.info('Activity payload:');
    logger.info(`  details: ${activity.details || '(none)'}`);
    logger.info(`  state: ${activity.state || '(none)'}`);
    logger.info(`  largeImageKey: ${activity.largeImageKey || '(none)'}`);
    logger.info(`  largeImageText: ${activity.largeImageText || '(none)'}`);
    logger.info(`  smallImageKey: ${activity.smallImageKey || '(none)'}`);
    logger.info(`  smallImageText: ${activity.smallImageText || '(none)'}`);
    
    if (activity.startTimestamp) {
      logger.info(`  startTimestamp: ${activity.startTimestamp}`);
    }
    
    logger.debug('Full activity object:', JSON.stringify(activity, null, 2));

    // Update presence snapshot for UI before sending
    stateStore.updatePresence({
      details: activity.details || '',
      state: activity.state || '',
      largeImageKey: activity.largeImageKey || '',
      largeImageText: activity.largeImageText || '',
      smallImageKey: activity.smallImageKey || '',
      smallImageText: activity.smallImageText || '',
      startTimestamp: activity.startTimestamp || null,
      lastSentAt: Date.now(),
      lastResult: 'pending',
      lastError: null,
    });

    await client.setActivity(activity);
    
    logger.info('✓ Discord Rich Presence updated successfully');
    stateStore.updatePresence({ lastResult: 'success' });
    stateStore.recordSetActivitySuccess();
    stateStore.pushEvent('discord', 'info', 'PRESENCE_UPDATED', `Presence updated: ${activity.details || '(no details)'}`);
  } catch (error: any) {
    logger.error('✗ Failed to set Discord Rich Presence');
    logger.error(`  Error: ${error?.message || 'Unknown error'}`);
    logger.error(`  Error code: ${error?.code || 'No code'}`);
    
    const errMsg = error?.message || 'Unknown error';
    stateStore.updatePresence({ lastResult: 'error', lastError: errMsg });
    stateStore.recordSetActivityFailure(errMsg);
    stateStore.pushEvent('error', 'error', 'PRESENCE_FAILED', `Presence update failed: ${errMsg}`);

    if (error?.message?.includes('asset')) {
      logger.error('  - Asset key not found in Discord application');
      logger.error('  - Upload assets at: https://discord.com/developers/applications');
      stateStore.addDiagnosticWarning('Missing Discord asset key — upload at discord.com/developers');
    }
  }
}

export async function clearPresence(): Promise<void> {
  const client = getRpcClient();
  
  if (!client || !isConnected()) {
    return;
  }

  try {
    logger.info('Clearing Discord Rich Presence');
    await client.clearActivity();
    logger.info('✓ Discord Rich Presence cleared');
    stateStore.pushEvent('discord', 'info', 'PRESENCE_CLEARED', 'Discord Rich Presence cleared');
  } catch (error: any) {
    logger.error('Failed to clear Discord Rich Presence:', error?.message);
    stateStore.pushEvent('error', 'error', 'PRESENCE_CLEAR_FAIL', `Clear presence failed: ${error?.message}`);
  }
}

export async function setClutchPresence(enemyCount: number): Promise<void> {
  await setPresence({
    details: '🎯 CLUTCH MODE ACTIVE',
    state: `1v${enemyCount} situation`,
    largeImageKey: 'cs2_logo',
    largeImageText: 'Counter-Strike 2',
    smallImageKey: 'clutch_icon',
    smallImageText: 'Clutch Mode',
    startTimestamp: Date.now(),
  });
}

export async function setNormalPresence(): Promise<void> {
  await setPresence({
    details: 'Playing CS2',
    state: 'In Match',
    largeImageKey: 'cs2_logo',
    largeImageText: 'Counter-Strike 2',
  });
}
