import { stateStore } from '../app/state-store';
import { createLogger } from '../app/logger';
import type { DiscordConfig } from '../shared/types';

const logger = createLogger('Discord-RPC');

type DiscordRpcClient = any;
let rpcClient: DiscordRpcClient | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;
let useMockMode = false;
let DiscordRPC: any = null;

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectAttempts = 0;

function maskClientId(clientId: string): string {
  if (clientId.length <= 4) {
    return '****';
  }
  return '****' + clientId.slice(-4);
}

function validateClientId(clientId: string | undefined): { valid: boolean; error?: string } {
  if (!clientId) {
    return { valid: false, error: 'Client ID is undefined or null' };
  }

  const trimmed = clientId.trim();
  
  if (trimmed === '') {
    return { valid: false, error: 'Client ID is empty' };
  }

  // Check for placeholder-like values
  const placeholderPatterns = [
    'your_discord_client_id_here',
    'placeholder',
    'example',
    'test',
    'here',
  ];

  const lowerCased = trimmed.toLowerCase();
  for (const pattern of placeholderPatterns) {
    if (lowerCased.includes(pattern)) {
      return { valid: false, error: `Client ID contains placeholder text: "${pattern}"` };
    }
  }

  // Must be numeric only (Discord IDs are numeric strings)
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'Client ID must contain only numeric digits' };
  }

  // Discord IDs are typically 17-19 digits
  if (trimmed.length < 17 || trimmed.length > 20) {
    return { valid: false, error: `Client ID length (${trimmed.length}) is outside expected range (17-20 digits)` };
  }

  return { valid: true };
}

async function loadDiscordRpc(): Promise<boolean> {
  if (DiscordRPC !== null) {
    return !useMockMode;
  }

  logger.info('Attempting to load discord-rpc package...');

  try {
    // @ts-ignore - discord-rpc is optional, dynamic import will fail gracefully if not installed
    const module = await import('discord-rpc');
    DiscordRPC = module.Client;
    useMockMode = false;
    logger.info('✓ discord-rpc package loaded successfully');
    return true;
  } catch (error) {
    logger.warn('✗ discord-rpc package unavailable, falling back to mock mode');
    logger.debug('Import error:', error);
    useMockMode = true;
    DiscordRPC = null;
    return false;
  }
}

export async function initializeDiscordRpc(config: DiscordConfig): Promise<void> {
  logger.info('Initializing Discord RPC...');

  // Log all sources of client ID
  logger.info('Client ID sources:');
  logger.info(`  - process.env.DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID ? maskClientId(process.env.DISCORD_CLIENT_ID) : '(not set)'}`);
  logger.info(`  - config.discord.clientId: ${config.clientId ? maskClientId(config.clientId) : '(not set)'}`);

  // Validate client ID
  const validation = validateClientId(config.clientId);
  
  if (!validation.valid) {
    logger.error('✗ Invalid or missing DISCORD_CLIENT_ID');
    logger.error(`  Reason: ${validation.error}`);
    logger.error('  Expected a numeric Discord Application ID from .env');
    logger.warn('Using mock mode');
    stateStore.discordConnected = false;
    useMockMode = true;
    return;
  }

  logger.info(`✓ Discord client ID validated: ${maskClientId(config.clientId)}`);

  const rpcAvailable = await loadDiscordRpc();
  if (!rpcAvailable) {
    stateStore.discordConnected = false;
    return;
  }

  isShuttingDown = false;
  reconnectAttempts = 0;

  await connect(config);
}

async function connect(config: DiscordConfig): Promise<void> {
  if (isShuttingDown || useMockMode || !DiscordRPC) {
    logger.debug('Skipping connect: shutting down or mock mode');
    return;
  }

  try {
    logger.info('Creating Discord RPC client instance...');

    rpcClient = new DiscordRPC({
      transport: 'ipc',
    });

    logger.info('✓ Client instance created');
    logger.info('Setting up event listeners...');

    rpcClient.on('ready', () => {
      logger.info('✓ Discord RPC ready event fired');
      logger.info('Discord RPC connected successfully');
      stateStore.discordConnected = true;
      reconnectAttempts = 0;
      stateStore.pushEvent('discord', 'info', 'DISCORD_CONNECTED', 'Discord RPC connected successfully');
    });

    rpcClient.on('disconnected', () => {
      logger.warn('✗ Discord RPC disconnected event fired');
      stateStore.discordConnected = false;
      stateStore.pushEvent('discord', 'warn', 'DISCORD_DISCONNECTED', 'Discord RPC disconnected');
      scheduleReconnect(config);
    });

    rpcClient.on('error', (error: Error) => {
      logger.error('✗ Discord RPC error event fired');
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
      stateStore.discordConnected = false;
      stateStore.pushEvent('error', 'error', 'DISCORD_ERROR', `Discord RPC error: ${error.message}`);
      stateStore.addDiagnosticError(`Discord RPC error: ${error.message}`);
    });

    logger.info(`Attempting login with client ID: ${maskClientId(config.clientId)}`);

    await rpcClient.login({
      clientId: config.clientId,
    });

    logger.info('Login call completed (waiting for ready event)');

  } catch (error: any) {
    logger.error('✗ Failed to connect to Discord RPC');
    logger.error('Error type:', error?.constructor?.name || 'Unknown');
    logger.error('Error message:', error?.message || 'No message');
    logger.error('Error code:', error?.code || 'No code');
    
    // Isolate failure point
    if (error?.message?.includes('Could not connect')) {
      logger.error('⚠ Failure point: Discord desktop IPC unreachable');
      logger.error('  - Ensure Discord desktop app is running');
      logger.error('  - Check Discord is not in web-only mode');
    } else if (error?.code === 'INVALID_CLIENTID') {
      logger.error('⚠ Failure point: Invalid client ID');
      logger.error('  - Verify DISCORD_CLIENT_ID in .env is correct');
    } else if (error?.message?.includes('redirect_uri') || error?.message?.includes('OAuth')) {
      logger.error('⚠ Failure point: OAuth/redirect URI error');
      logger.error('  - This should not happen with basic RPC login');
      logger.error('  - Check that login only uses clientId, no scopes');
    } else {
      logger.error('⚠ Failure point: Unknown connection error');
      logger.error('Full error:', error);
    }
    
    stateStore.discordConnected = false;
    stateStore.pushEvent('error', 'error', 'DISCORD_CONNECT_FAIL', `Discord RPC connection failed: ${error?.message || 'Unknown'}`);
    scheduleReconnect(config);
  }
}

function scheduleReconnect(config: DiscordConfig): void {
  if (isShuttingDown) {
    return;
  }

  // Prevent duplicate reconnect timers
  if (reconnectTimeout) {
    logger.debug('Reconnect already scheduled, skipping duplicate');
    return;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
    return;
  }

  reconnectAttempts++;
  logger.info(`Scheduling reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY_MS}ms`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connect(config);
  }, RECONNECT_DELAY_MS);
}

export async function disconnectDiscordRpc(): Promise<void> {
  logger.info('Disconnecting Discord RPC...');
  isShuttingDown = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (rpcClient) {
    try {
      rpcClient.destroy();
    } catch (error) {
      logger.error('Error destroying RPC client:', error);
    }
    rpcClient = null;
  }

  stateStore.discordConnected = false;
  logger.info('Discord RPC disconnected');
}

export function isConnected(): boolean {
  return stateStore.discordConnected && rpcClient !== null && !useMockMode;
}

export function getRpcClient(): DiscordRpcClient | null {
  if (useMockMode) {
    return null;
  }
  return rpcClient;
}

export function isMockMode(): boolean {
  return useMockMode;
}
