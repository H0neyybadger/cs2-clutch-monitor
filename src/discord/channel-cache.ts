import { createLogger } from '../app/logger';
import { getSelectedVoiceChannel, getVoiceChannelUsers } from './voice-controller';
import type { SelectedVoiceChannel, VoiceChannelUser } from './types';

const logger = createLogger('ChannelCache');

interface CachedVoiceChannel extends SelectedVoiceChannel {
  cachedAt: number;
}

class ChannelCache {
  private currentChannel: CachedVoiceChannel | null = null;
  private cacheExpiryMs = 30000; // 30 seconds

  async refresh(): Promise<void> {
    try {
      const channel = await getSelectedVoiceChannel();
      if (channel) {
        this.currentChannel = {
          ...channel,
          cachedAt: Date.now(),
        };
        logger.debug(`Cached voice channel: ${channel.name} (${channel.id})`);
      } else {
        this.currentChannel = null;
      }
    } catch (error) {
      logger.error('Failed to refresh channel cache:', error);
    }
  }

  getCurrentChannel(): SelectedVoiceChannel | null {
    if (!this.currentChannel) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - this.currentChannel.cachedAt > this.cacheExpiryMs) {
      logger.debug('Channel cache expired');
      return null;
    }

    return {
      id: this.currentChannel.id,
      name: this.currentChannel.name,
      guildId: this.currentChannel.guildId,
      users: this.currentChannel.users,
    };
  }

  isInVoiceChannel(): boolean {
    return this.currentChannel !== null;
  }

  getCachedUsers(): VoiceChannelUser[] {
    if (!this.currentChannel) {
      return [];
    }
    return [...this.currentChannel.users];
  }

  clear(): void {
    this.currentChannel = null;
    logger.debug('Channel cache cleared');
  }

  async updateUsers(): Promise<void> {
    if (!this.currentChannel) {
      return;
    }

    try {
      const users = await getVoiceChannelUsers(this.currentChannel.id);
      this.currentChannel.users = users;
      this.currentChannel.cachedAt = Date.now();
      logger.debug(`Updated ${users.length} users in cache`);
    } catch (error) {
      logger.error('Failed to update channel users:', error);
    }
  }

  setCacheExpiry(expiryMs: number): void {
    this.cacheExpiryMs = expiryMs;
  }
}

export const channelCache = new ChannelCache();
