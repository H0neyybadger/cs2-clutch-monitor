export interface GsiConfig {
  port: number;
  host: string;
  endpoint: string;
}

export interface DiscordConfig {
  clientId: string;
  rpcTimeout: number;
}

export interface ClutchConfig {
  volumePercent: number;
  restoreVolumePercent: number;
  fadeDurationMs: number;
  restoreDelayMs: number;
}

export interface LoggingConfig {
  level: string;
  timestamp: boolean;
}

export interface AppConfig {
  gsi: GsiConfig;
  discord: DiscordConfig;
  clutch: ClutchConfig;
  logging: LoggingConfig;
}
