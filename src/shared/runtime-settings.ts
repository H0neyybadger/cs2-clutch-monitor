import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

interface RuntimeSettings {
  clutch?: {
    volumePercent?: number;
  };
}

function clampVolumePercent(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function getRuntimeSettingsPath(): string {
  return process.env.CS2_CLUTCH_RUNTIME_CONFIG_PATH || resolve(process.cwd(), 'config', 'runtime-settings.json');
}

function loadRuntimeSettings(): RuntimeSettings {
  const runtimeSettingsPath = getRuntimeSettingsPath();

  try {
    if (!existsSync(runtimeSettingsPath)) {
      return {};
    }

    const raw = readFileSync(runtimeSettingsPath, 'utf-8');
    return JSON.parse(raw) as RuntimeSettings;
  } catch {
    return {};
  }
}

function saveRuntimeSettings(settings: RuntimeSettings): void {
  const runtimeSettingsPath = getRuntimeSettingsPath();
  mkdirSync(dirname(runtimeSettingsPath), { recursive: true });
  writeFileSync(runtimeSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export function loadRuntimeClutchVolumePercent(): number | undefined {
  const settings = loadRuntimeSettings();
  return clampVolumePercent(settings.clutch?.volumePercent);
}

export function saveRuntimeClutchVolumePercent(volumePercent: number): number {
  const normalizedVolume = clampVolumePercent(volumePercent) ?? 0;
  const settings = loadRuntimeSettings();

  settings.clutch = {
    ...settings.clutch,
    volumePercent: normalizedVolume,
  };

  saveRuntimeSettings(settings);
  return normalizedVolume;
}
