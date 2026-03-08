import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../app/logger';
import type { GsiConfig } from '../shared/types';

const logger = createLogger('GSI-AutoSetup');
const CS2_APP_ID = '730';
const DEFAULT_STEAM_ROOT = 'C:\\Program Files (x86)\\Steam';
const GSI_FILE_NAME = 'gamestate_integration_clutchmode.cfg';

interface SetupTarget {
  libraryPath: string;
  cfgDirectory: string;
}

export interface GsiAutoSetupResult {
  foundInstall: boolean;
  created: string[];
  updated: string[];
  unchanged: string[];
  searchedLibraries: string[];
  errors: Array<{ path: string; message: string }>;
}

function getSteamRootCandidates(): string[] {
  const candidates = [
    DEFAULT_STEAM_ROOT,
    process.env['ProgramFiles(x86)'] ? join(process.env['ProgramFiles(x86)'] as string, 'Steam') : '',
    process.env.ProgramFiles ? join(process.env.ProgramFiles, 'Steam') : '',
  ].filter(Boolean);

  return Array.from(new Set(candidates.map(candidate => candidate.trim()))).filter(candidate => existsSync(candidate));
}

function parseLibraryFolders(content: string): string[] {
  const matches = Array.from(content.matchAll(/"path"\s*"([^"]+)"/g));
  return matches
    .map(match => match[1].replace(/\\\\/g, '\\'))
    .filter(Boolean);
}

function parseInstallDir(content: string): string | null {
  const match = content.match(/"installdir"\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function getSteamLibraries(): string[] {
  const libraries = new Set<string>();

  for (const steamRoot of getSteamRootCandidates()) {
    libraries.add(steamRoot);

    const libraryFoldersPath = join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    if (!existsSync(libraryFoldersPath)) {
      continue;
    }

    try {
      const content = readFileSync(libraryFoldersPath, 'utf8');
      for (const libraryPath of parseLibraryFolders(content)) {
        if (existsSync(libraryPath)) {
          libraries.add(libraryPath);
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to read Steam library folders from ${libraryFoldersPath}: ${error?.message || 'Unknown error'}`);
    }
  }

  return Array.from(libraries);
}

function getCfgDirectory(gameRoot: string): string | null {
  const primary = join(gameRoot, 'game', 'csgo', 'cfg');
  if (existsSync(join(gameRoot, 'game', 'csgo'))) {
    return primary;
  }

  const legacy = join(gameRoot, 'csgo', 'cfg');
  if (existsSync(join(gameRoot, 'csgo'))) {
    return legacy;
  }

  return null;
}

function findCs2Targets(libraryPaths: string[]): SetupTarget[] {
  const targets: SetupTarget[] = [];

  for (const libraryPath of libraryPaths) {
    const manifestPath = join(libraryPath, 'steamapps', `appmanifest_${CS2_APP_ID}.acf`);
    if (!existsSync(manifestPath)) {
      continue;
    }

    try {
      const manifest = readFileSync(manifestPath, 'utf8');
      const installDir = parseInstallDir(manifest);
      if (!installDir) {
        continue;
      }

      const gameRoot = join(libraryPath, 'steamapps', 'common', installDir);
      const cfgDirectory = getCfgDirectory(gameRoot);
      if (!cfgDirectory) {
        continue;
      }

      targets.push({ libraryPath, cfgDirectory });
    } catch (error: any) {
      logger.warn(`Failed to inspect CS2 manifest at ${manifestPath}: ${error?.message || 'Unknown error'}`);
    }
  }

  return targets;
}

function buildGsiFileContents(config: GsiConfig): string {
  const uri = `http://${config.host}:${config.port}${config.endpoint}`;

  return [
    '"CS2 Clutch Mode Integration"',
    '{',
    `  "uri" "${uri}"`,
    '  "timeout" "5.0"',
    '  "buffer" "0.1"',
    '  "throttle" "0.1"',
    '  "heartbeat" "30.0"',
    '  "data"',
    '  {',
    '    "provider" "1"',
    '    "map" "1"',
    '    "round" "1"',
    '    "player_id" "1"',
    '    "player_state" "1"',
    '    "player_match_stats" "1"',
    '    "allplayers" "1"',
    '    "allplayers_id" "1"',
    '    "allplayers_state" "1"',
    '    "allplayers_match_stats" "1"',
    '  }',
    '}',
    '',
  ].join('\r\n');
}

export function ensureCs2GsiConfig(config: GsiConfig): GsiAutoSetupResult {
  const result: GsiAutoSetupResult = {
    foundInstall: false,
    created: [],
    updated: [],
    unchanged: [],
    searchedLibraries: [],
    errors: [],
  };

  if (process.platform !== 'win32') {
    return result;
  }

  const libraryPaths = getSteamLibraries();
  result.searchedLibraries = libraryPaths;

  const targets = findCs2Targets(libraryPaths);
  if (targets.length === 0) {
    logger.warn('No CS2 installation was found while attempting automatic GSI setup');
    return result;
  }

  result.foundInstall = true;
  const fileContents = buildGsiFileContents(config);

  for (const target of targets) {
    const targetFile = join(target.cfgDirectory, GSI_FILE_NAME);

    try {
      mkdirSync(target.cfgDirectory, { recursive: true });
      if (!existsSync(targetFile)) {
        writeFileSync(targetFile, fileContents, 'utf8');
        result.created.push(targetFile);
        continue;
      }

      const existing = readFileSync(targetFile, 'utf8');
      if (existing === fileContents) {
        result.unchanged.push(targetFile);
        continue;
      }

      writeFileSync(targetFile, fileContents, 'utf8');
      result.updated.push(targetFile);
    } catch (error: any) {
      result.errors.push({ path: targetFile, message: error?.message || 'Unknown error' });
    }
  }

  if (result.created.length > 0) {
    logger.info(`Created CS2 GSI config in ${result.created.length} location(s)`);
    for (const filePath of result.created) {
      logger.info(`  Created: ${filePath}`);
    }
  }

  if (result.updated.length > 0) {
    logger.info(`Updated CS2 GSI config in ${result.updated.length} location(s)`);
    for (const filePath of result.updated) {
      logger.info(`  Updated: ${filePath}`);
    }
  }

  if (result.unchanged.length > 0) {
    logger.info(`CS2 GSI config already up to date in ${result.unchanged.length} location(s)`);
    for (const filePath of result.unchanged) {
      logger.info(`  Unchanged: ${filePath}`);
    }
  }

  if (result.errors.length > 0) {
    logger.warn(`Failed to write CS2 GSI config in ${result.errors.length} location(s)`);
    for (const entry of result.errors) {
      logger.warn(`  ${entry.path}: ${entry.message}`);
    }
  }

  return result;
}
