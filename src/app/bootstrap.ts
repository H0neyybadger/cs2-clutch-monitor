import path from 'path';
import express from 'express';
import { startGsiServer } from '../gsi/server';
import { initializeDiscordRpc, isConnected, isMockMode } from '../discord/rpc-client';
import { initializeVoiceAdapter, getAdapterMode } from '../discord/voice-controller';
import { ClutchEngine } from '../clutch/clutch-engine';
import { actionHandlerRegistry } from '../actions/action-handler';
import { DiscordVoiceActionHandler } from '../actions/discord-voice-action';
import { DiscordPresenceActionHandler } from '../actions/discord-presence-action';
import { createLogger } from './logger';
import { loadConfig } from '../shared/utils';
import { stateStore } from './state-store';
import { mountApiRoutes } from '../ui/api-routes';
import { mountSseEndpoint } from '../ui/sse';

const logger = createLogger('Bootstrap');

interface RpcModuleInfo {
  installed: boolean;
  resolvedPath: string | null;
  isLocal: boolean;
}

async function checkRpcPackageInstalled(): Promise<RpcModuleInfo> {
  const projectRoot = process.cwd();
  
  try {
    // Try to resolve the module path
    const resolvedPath = require.resolve('discord-rpc');
    const normalizedProjectRoot = require('path').normalize(projectRoot);
    const normalizedResolvedPath = require('path').normalize(resolvedPath);
    const isLocal = normalizedResolvedPath.startsWith(normalizedProjectRoot);

    // Try to load it
    // @ts-ignore - discord-rpc is optional
    await import('discord-rpc');
    
    return {
      installed: true,
      resolvedPath,
      isLocal,
    };
  } catch (error) {
    return {
      installed: false,
      resolvedPath: null,
      isLocal: false,
    };
  }
}

async function fetchVoiceChannelStatus(): Promise<{ available: boolean; userCount: number }> {
  if (isMockMode() || !isConnected()) {
    return { available: false, userCount: 0 };
  }

  try {
    const { getRpcClient } = await import('../discord/rpc-client');
    const client = getRpcClient();
    if (!client) {
      return { available: false, userCount: 0 };
    }

    const response = await client.request('GET_SELECTED_VOICE_CHANNEL', {});
    if (response && response.voice_states) {
      return { available: true, userCount: response.voice_states.length };
    }
  } catch (error) {
    // Voice channel not available
  }

  return { available: false, userCount: 0 };
}

async function logStartupDiagnostics(): Promise<void> {
  logger.info('\n=== Startup Diagnostics ===');

  const rpcModuleInfo = await checkRpcPackageInstalled();
  const rpcConnected = isConnected();
  const adapterMode = getAdapterMode();
  const voiceStatus = await fetchVoiceChannelStatus();

  logger.info(`Discord RPC package installed locally: ${rpcModuleInfo.installed ? 'yes' : 'no'}`);
  
  if (rpcModuleInfo.installed && rpcModuleInfo.resolvedPath) {
    logger.info(`Discord RPC module path: ${rpcModuleInfo.resolvedPath}`);
    
    if (!rpcModuleInfo.isLocal) {
      logger.warn('⚠️  WARNING: discord-rpc is resolving from outside the project!');
      logger.warn('Consider installing it locally: npm install discord-rpc');
    }
  }
  
  logger.info(`Discord RPC connected: ${rpcConnected ? 'yes' : 'no'}`);
  logger.info(`Voice adapter mode: ${adapterMode}`);
  logger.info(`Selected voice channel available: ${voiceStatus.available ? 'yes' : 'no'}`);
  logger.info(`Number of voice users detected: ${voiceStatus.userCount}`);
  logger.info('===========================\n');
}

export async function bootstrap(): Promise<void> {
  const config = loadConfig();
  logger.info('Configuration loaded');

  const clutchEngine = new ClutchEngine(config);
  logger.info('Clutch engine initialized');

  await initializeDiscordRpc(config.discord);
  logger.info('Discord RPC client initialized');

  initializeVoiceAdapter();

  // Register action handlers
  const discordVoiceAction = new DiscordVoiceActionHandler(config);
  actionHandlerRegistry.register(discordVoiceAction);

  const discordPresenceAction = new DiscordPresenceActionHandler();
  actionHandlerRegistry.register(discordPresenceAction);

  // Initialize all action handlers
  await actionHandlerRegistry.initializeAll();

  await logStartupDiagnostics();

  const app = await startGsiServer(config.gsi, clutchEngine);
  logger.info('GSI server started on %s:%d%s', config.gsi.host, config.gsi.port, config.gsi.endpoint);

  // Track mock mode in state store
  stateStore.mockMode = isMockMode();

  // Serve the UI static files
  const uiPublicPath = path.resolve(process.cwd(), 'src', 'ui', 'public');
  app.use('/ui', express.static(uiPublicPath));

  // Mount API routes and SSE
  mountApiRoutes(app, config, clutchEngine);
  mountSseEndpoint(app);

  // Serve overlay page at /overlay
  app.get('/overlay', (_req, res) => {
    res.sendFile(path.resolve(uiPublicPath, 'overlay.html'));
  });

  // Redirect root to dashboard
  app.get('/', (_req, res) => {
    res.redirect('/ui');
  });

  logger.info('Dashboard UI available at http://%s:%d/ui', config.gsi.host, config.gsi.port);
  logger.info('Overlay available at http://%s:%d/overlay', config.gsi.host, config.gsi.port);

  // Push startup event for UI
  stateStore.pushEvent('system', 'info', 'APP_STARTED', 'CS2 Clutch Mode application started');
}
