import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { AppConfig } from './types';

export function loadConfig(): AppConfig {
  const defaultConfigPath = resolve(process.cwd(), 'config', 'default.json');
  const defaultConfig = JSON.parse(readFileSync(defaultConfigPath, 'utf-8')) as AppConfig;

  return {
    gsi: {
      port: parseInt(process.env.GSI_PORT || String(defaultConfig.gsi.port), 10),
      host: process.env.GSI_HOST || defaultConfig.gsi.host,
      endpoint: defaultConfig.gsi.endpoint,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || defaultConfig.discord.clientId || '',
      rpcTimeout: defaultConfig.discord.rpcTimeout,
    },
    clutch: {
      volumePercent: parseInt(process.env.CLUTCH_VOLUME_PERCENT || String(defaultConfig.clutch.volumePercent), 10),
      restoreVolumePercent: parseInt(process.env.RESTORE_VOLUME_PERCENT || String(defaultConfig.clutch.restoreVolumePercent), 10),
      fadeDurationMs: defaultConfig.clutch.fadeDurationMs,
      restoreDelayMs: defaultConfig.clutch.restoreDelayMs,
    },
    logging: {
      level: process.env.LOG_LEVEL || defaultConfig.logging.level,
      timestamp: defaultConfig.logging.timestamp,
    },
  };
}
