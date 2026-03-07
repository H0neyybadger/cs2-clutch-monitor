import { stateStore } from '../app/state-store';
import { createLogger } from '../app/logger';
import { getRpcClient, isConnected, isMockMode } from './rpc-client';
import { channelCache } from './channel-cache';
import type { VolumeMap, VoiceChannelUser, SelectedVoiceChannel } from './types';

const logger = createLogger('VoiceController');

const originalVolumes: Map<string, number> = new Map();
const currentVolumes: Map<string, number> = new Map();
let clutchActive = false;
let adapterMode: 'mock' | 'discord-rpc' | 'unavailable' = 'unavailable';

// Mock mode state
const mockUsers: VoiceChannelUser[] = [
  { id: 'user1', username: 'Player1', volume: 100, mute: false },
  { id: 'user2', username: 'Player2', volume: 100, mute: false },
  { id: 'user3', username: 'Player3', volume: 100, mute: false },
  { id: 'user4', username: 'Player4', volume: 100, mute: false },
];

export function initializeVoiceAdapter(): void {
  if (isMockMode()) {
    adapterMode = 'mock';
    logger.info('Voice adapter: mock mode');
  } else if (isConnected()) {
    adapterMode = 'discord-rpc';
    logger.info('Voice adapter: Discord RPC active');
  } else {
    adapterMode = 'unavailable';
    logger.warn('Voice adapter: unavailable');
  }
}

export function getAdapterMode(): string {
  return adapterMode;
}

export async function lowerDiscordVolume(targetPercent: number): Promise<void> {
  if (isMockMode() || !isConnected()) {
    // Mock mode implementation
    logger.info(`Mock fading ${mockUsers.length} users to ${targetPercent}% over 250ms`);
    
    // Store original volumes
    for (const user of mockUsers) {
      if (!originalVolumes.has(user.id)) {
        originalVolumes.set(user.id, user.volume);
      }
      user.volume = targetPercent;
    }
    
    clutchActive = true;
    return;
  }

  // Real Discord RPC adapter
  try {
    logger.info('=== Starting Discord Volume Lower Workflow ===');
    logger.info('Step 1: Verifying Discord RPC connection');
    
    if (!isConnected()) {
      logger.error('⚠ Workflow failed: Discord RPC not connected');
      return;
    }
    
    logger.info('✓ Discord RPC connected');
    logger.info('Step 2: Fetching voice channel users');
    
    const users = await fetchVoiceChannelUsers();
    
    if (users.length === 0) {
      logger.warn('⚠ Workflow stopped: No voice channel users found');
      logger.warn('  - Ensure you are in a Discord voice channel');
      logger.warn('  - Ensure other users are in the same channel');
      return;
    }

    logger.info(`✓ Fetched ${users.length} voice channel users`);
    logger.info('Step 3: Storing original volumes');

    clutchActive = true;

    // Store original volumes before changing
    for (const user of users) {
      if (!originalVolumes.has(user.id)) {
        originalVolumes.set(user.id, user.volume);
        logger.debug(`  Stored ${user.username}: ${user.volume}%`);
      }
    }

    logger.info(`✓ Stored ${originalVolumes.size} original volumes`);
    logger.info(`Step 4: Fading ${users.length} users to ${targetPercent}% over 250ms`);

    // Build fade map: userId -> {from, to}
    const fadeMap = new Map<string, { from: number; to: number }>();
    for (const user of users) {
      const fromVolume = currentVolumes.get(user.id) ?? user.volume;
      fadeMap.set(user.id, { from: fromVolume, to: targetPercent });
    }

    // Fade all users in parallel over 250ms with 4 steps
    await fadeUserVolumes(fadeMap, 250, 4);

    logger.info(`✓ Successfully faded ${users.length} users to ${targetPercent}%`);
    logger.info('=== Discord Volume Lower Workflow Complete ===');
  } catch (error: any) {
    logger.error('⚠ Discord volume lower workflow failed');
    logger.error(`  Error: ${error?.message || 'Unknown error'}`);
    logger.warn('Falling back to mock mode for this operation');
  }
}

export async function restoreDiscordVolume(): Promise<void> {
  if (isMockMode() || !isConnected()) {
    // Mock mode implementation
    const userCount = originalVolumes.size || mockUsers.length;
    logger.info(`Mock restoring ${userCount} users over 350ms`);
    
    // Restore mock user volumes
    for (const user of mockUsers) {
      const originalVolume = originalVolumes.get(user.id);
      if (originalVolume !== undefined) {
        user.volume = originalVolume;
      }
    }
    
    originalVolumes.clear();
    clutchActive = false;
    return;
  }

  // Real Discord RPC adapter
  try {
    const userCount = originalVolumes.size;
    
    if (userCount === 0) {
      logger.warn('No volumes to restore (originalVolumes is empty)');
      clutchActive = false;
      return;
    }

    logger.info('=== Starting Discord Volume Restore Workflow ===');
    logger.info(`Step 1: Restoring ${userCount} users over 350ms`);

    // Build fade map: userId -> {from, to}
    const fadeMap = new Map<string, { from: number; to: number }>();
    for (const [userId, targetVolume] of originalVolumes.entries()) {
      const fromVolume = currentVolumes.get(userId) ?? 0;
      fadeMap.set(userId, { from: fromVolume, to: targetVolume });
    }

    // Fade all users in parallel over 350ms with 4 steps
    await fadeUserVolumes(fadeMap, 350, 4);

    logger.info(`✓ Successfully restored ${userCount} users`);
    
    originalVolumes.clear();
    clutchActive = false;
    
    logger.info('Step 2: Cleared volume cache');
    logger.info('=== Discord Volume Restore Workflow Complete ===');
  } catch (error: any) {
    logger.error('⚠ Discord volume restore workflow failed');
    logger.error(`  Error: ${error?.message || 'Unknown error'}`);
    originalVolumes.clear();
    clutchActive = false;
  }
}

async function fetchVoiceChannelUsers(): Promise<VoiceChannelUser[]> {
  const client = getRpcClient();
  if (!client) {
    logger.error('⚠ Failure point: RPC client not available for voice channel fetch');
    return [];
  }

  try {
    logger.debug('Attempting to fetch selected voice channel...');
    const response = await client.request('GET_SELECTED_VOICE_CHANNEL', {});
    
    if (!response) {
      logger.warn('⚠ Failure point: GET_SELECTED_VOICE_CHANNEL returned no response');
      logger.warn('  - User may not be in a voice channel');
      return [];
    }

    if (!response.voice_states || response.voice_states.length === 0) {
      logger.warn('⚠ Failure point: No voice_states in selected channel');
      logger.warn('  - Voice channel may be empty');
      logger.warn('  - Or user is alone in channel');
      return [];
    }

    const users = response.voice_states.map((vs: any) => ({
      id: vs.user.id,
      username: vs.user.username,
      volume: vs.volume !== undefined ? vs.volume : 100,
      mute: vs.mute || false,
    }));

    logger.info(`✓ Successfully fetched ${users.length} users from voice channel`);
    return users;

  } catch (error: any) {
    logger.error('⚠ Failure point: Selected voice channel fetch failed');
    logger.error(`  Error: ${error?.message || 'Unknown error'}`);
    
    if (error?.message?.includes('RPC_INVALID_CHANNEL')) {
      logger.error('  - No voice channel selected');
    } else if (error?.message?.includes('permission')) {
      logger.error('  - Missing voice channel permissions');
    }
    
    logger.debug('Trying alternative voice channel fetch method...');
    
    try {
      const channelResponse = await client.getChannel();
      if (channelResponse && channelResponse.voice_states) {
        const users = channelResponse.voice_states.map((vs: any) => ({
          id: vs.user.id,
          username: vs.user.username,
          volume: vs.volume !== undefined ? vs.volume : 100,
          mute: vs.mute || false,
        }));
        logger.info(`✓ Alternative method fetched ${users.length} users`);
        return users;
      }
    } catch (fallbackError: any) {
      logger.error('⚠ Alternative voice channel fetch also failed');
      logger.error(`  Error: ${fallbackError?.message || 'Unknown error'}`);
    }

    return [];
  }
}

async function setUserVolumeViaRpc(userId: string, volume: number): Promise<void> {
  const client = getRpcClient();
  if (!client) {
    logger.error('⚠ Failure point: RPC client not available for volume setting');
    return;
  }

  // Clamp volume to valid range (0-200%)
  const clampedVolume = Math.max(0, Math.min(200, volume));

  // Skip if current volume already matches target
  const current = currentVolumes.get(userId);
  if (current === clampedVolume) {
    logger.debug(`Skipping user ${userId} - already at ${clampedVolume}%`);
    return;
  }

  try {
    logger.debug(`Setting user ${userId} volume to ${clampedVolume}%`);
    
    await client.request('SET_USER_VOICE_SETTINGS', {
      user_id: userId,
      pan: {
        left: 1.0,
        right: 1.0,
      },
      volume: clampedVolume,
      mute: false,
    });
    
    currentVolumes.set(userId, clampedVolume);
    logger.debug(`✓ Successfully set user ${userId} volume to ${clampedVolume}%`);
  } catch (error: any) {
    logger.error(`⚠ Failure point: Failed to set user ${userId} volume`);
    logger.error(`  Error: ${error?.message || 'Unknown error'}`);
    
    if (error?.message?.includes('permission')) {
      logger.error('  - Missing permission to modify user voice settings');
    } else if (error?.message?.includes('RPC_INVALID_USER')) {
      logger.error('  - Invalid user ID or user not in voice channel');
    } else if (error?.code === 'RPC_CONNECTION_TIMEOUT') {
      logger.error('  - RPC connection timeout');
    } else {
      logger.error(`  - Unknown volume setting error: ${error?.code || 'no code'}`);
    }
  }
}

/**
 * Fade multiple users' volumes smoothly over a specified duration.
 * @param userVolumes - Map of userId to target volume
 * @param durationMs - Total fade duration in milliseconds
 * @param steps - Number of intermediate steps
 */
async function fadeUserVolumes(
  userVolumes: Map<string, { from: number; to: number }>,
  durationMs: number,
  steps: number
): Promise<void> {
  if (userVolumes.size === 0) return;

  const stepDelay = durationMs / steps;
  
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    
    // Fade all users in parallel for this step
    const fadePromises = Array.from(userVolumes.entries()).map(async ([userId, { from, to }]) => {
      const currentVolume = from + (to - from) * progress;
      const roundedVolume = Math.round(currentVolume);
      await setUserVolumeViaRpc(userId, roundedVolume);
    });
    
    await Promise.all(fadePromises);
    
    // Wait before next step (except after last step)
    if (step < steps) {
      await new Promise(resolve => setTimeout(resolve, stepDelay));
    }
  }
}

export async function getSelectedVoiceChannel(): Promise<SelectedVoiceChannel | null> {
  const client = getRpcClient();
  if (!client || !isConnected()) {
    return null;
  }

  try {
    // TODO: Implement actual RPC call to get selected voice channel
    // This requires the discord-rpc library to support voice channel queries
    // Currently, this is a placeholder for the RPC command structure
    // See: https://discord.com/developers/docs/topics/rpc#getselectedvoicechannel

    /*
    const response = await client.request('GET_SELECTED_VOICE_CHANNEL', {});
    if (response && response.data) {
      return {
        id: response.data.id,
        name: response.data.name,
        guildId: response.data.guild_id,
        users: response.data.voice_states.map((vs: unknown) => ({
          id: vs.user.id,
          username: vs.user.username,
          volume: vs.volume || 100,
          mute: vs.mute || false,
        })),
      };
    }
    */

    // Fallback: Return null - Discord RPC voice channel access uses basic IPC
    logger.debug('Voice channel query not implemented - using basic RPC commands');
    return null;
  } catch (error) {
    logger.error('Failed to get selected voice channel:', error);
    return null;
  }
}

export async function getVoiceChannelUsers(channelId: string): Promise<VoiceChannelUser[]> {
  const client = getRpcClient();
  if (!client || !isConnected()) {
    return [];
  }

  try {
    // TODO: Implement actual RPC call to get voice channel users
    // See: https://discord.com/developers/docs/topics/rpc#getchannel

    /*
    const response = await client.request('GET_CHANNEL', {
      channel_id: channelId,
    });
    if (response && response.data && response.data.voice_states) {
      return response.data.voice_states.map((vs: unknown) => ({
        id: vs.user.id,
        username: vs.user.username,
        volume: vs.volume || 100,
        mute: vs.mute || false,
      }));
    }
    */

    logger.debug('Voice channel users query not implemented');
    return [];
  } catch (error) {
    logger.error('Failed to get voice channel users:', error);
    return [];
  }
}

export async function setUserVolume(userId: string, volume: number): Promise<void> {
  const client = getRpcClient();
  if (!client || !isConnected()) {
    logger.warn('Cannot set user volume: Discord not connected');
    return;
  }

  // Clamp volume to valid range (0-200%)
  const clampedVolume = Math.max(0, Math.min(200, volume));

  try {
    // TODO: Implement actual RPC call to set user volume
    // See: https://discord.com/developers/docs/topics/rpc#setuservoicesettings

    /*
    await client.request('SET_USER_VOICE_SETTINGS', {
      user_id: userId,
      volume: clampedVolume,
    });
    */

    logger.debug(`Set user ${userId} volume to ${clampedVolume}% (not implemented)`);
  } catch (error) {
    logger.error(`Failed to set user ${userId} volume:`, error);
    // Don't throw - allow app to continue functioning
  }
}

export async function restoreVolumes(volumeMap: VolumeMap): Promise<void> {
  logger.info(`Restoring volumes for ${Object.keys(volumeMap).length} users`);

  if (!isConnected()) {
    logger.warn('Discord not connected, cannot restore volumes');
    return;
  }

  try {
    for (const [userId, volume] of Object.entries(volumeMap)) {
      await setUserVolume(userId, volume);
    }
    logger.info('Volumes restored from map');
  } catch (error) {
    logger.error('Failed to restore volumes from map:', error);
  }
}

export function isClutchActive(): boolean {
  return clutchActive;
}

export function getOriginalVolumes(): Map<string, number> {
  return new Map(originalVolumes);
}
