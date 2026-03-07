export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

export interface DiscordVoiceState {
  userId: string;
  channelId: string;
  mute: boolean;
  deaf: boolean;
  selfMute: boolean;
  selfDeaf: boolean;
  suppress: boolean;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  guildId?: string;
}

export interface VoiceSettings {
  userId: string;
  volume: number;
  mute: boolean;
}

export interface VoiceChannelUser {
  id: string;
  username: string;
  volume: number;
  mute: boolean;
}

export interface SelectedVoiceChannel {
  id: string;
  name: string;
  guildId?: string;
  users: VoiceChannelUser[];
}

export interface VolumeMap {
  [userId: string]: number;
}

