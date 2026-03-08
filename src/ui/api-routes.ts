import type { Express, Request, Response } from 'express';
import { stateStore } from '../app/state-store';
import { createLogger } from '../app/logger';
import { isConnected, isMockMode } from '../discord/rpc-client';
import { setNormalPresence, clearPresence } from '../discord/presence-controller';
import { eventBus, GameEventType } from '../events/event-bus';
import type { ClutchEngine } from '../clutch/clutch-engine';
import type { AppConfig } from '../shared/types';
import { saveRuntimeClutchVolumePercent } from '../shared/runtime-settings';

const logger = createLogger('API-Routes');

function maskClientId(clientId: string): string {
  if (!clientId || clientId.length <= 4) return '****';
  return '****' + clientId.slice(-4);
}

function serializeConfig(config: AppConfig) {
  return {
    clientIdMasked: maskClientId(config.discord.clientId),
    expectedAssets: ['cs2_logo', 'clutch_icon'],
    gsiEndpoint: config.gsi.endpoint,
    gsiPort: config.gsi.port,
    gsiHost: config.gsi.host,
    clutchVolumePercent: config.clutch.volumePercent,
    restoreVolumePercent: config.clutch.restoreVolumePercent,
    fadeDurationMs: config.clutch.fadeDurationMs,
    restoreDelayMs: config.clutch.restoreDelayMs,
    logLevel: config.logging.level,
  };
}
export function mountApiRoutes(app: Express, config: AppConfig, clutchEngine: ClutchEngine): void {

  // ============ GET /api/status ============
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json(stateStore.getStatusSnapshot());
  });

  // ============ GET /api/game-state ============
  app.get('/api/game-state', (_req: Request, res: Response) => {
    res.json(stateStore.gameState);
  });

  // ============ GET /api/presence ============
  app.get('/api/presence', (_req: Request, res: Response) => {
    res.json(stateStore.presence);
  });

  // ============ GET /api/events ============
  app.get('/api/events', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    res.json(stateStore.getEvents(limit));
  });

  // ============ GET /api/diagnostics ============
  app.get('/api/diagnostics', (_req: Request, res: Response) => {
    const diag = stateStore.diagnostics;
    const gameState = stateStore.gameState;
    const sessionStats = stateStore.sessionStats;

    res.json({
      ...diag,
      discordConnected: isConnected(),
      mockMode: isMockMode(),
      gsiListening: true,
      gsiEndpoint: config.gsi.endpoint,
      gsiPort: config.gsi.port,
      clientIdMasked: maskClientId(config.discord.clientId),
      rosterAvailable: gameState.rosterAvailable,
      rosterStatus: gameState.rosterStatus,
      playerStatsAvailable: sessionStats.matchStatsAvailable,
      playerStatsStatus: sessionStats.matchStatsStatus,
      clutchEligibilityReason: gameState.clutchEligibilityReason,
      dataSource: gameState.dataSource,
      dataSourceStatus: gameState.dataSourceStatus,
      overwolfTraceEnabled: Boolean(process.env.CS2_CLUTCH_OVERWOLF_TRACE_PATH),
      overwolfTracePath: process.env.CS2_CLUTCH_OVERWOLF_TRACE_PATH || null,
    });
  });

  // ============ GET /api/config ============
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json(serializeConfig(config));
  });

  // ============ POST /api/config/clutch-volume ============
  app.post('/api/config/clutch-volume', (req: Request, res: Response) => {
    try {
      const requestedVolume = Number(req.body?.volumePercent);
      if (!Number.isFinite(requestedVolume)) {
        return res.status(400).json({ success: false, error: 'volumePercent must be a number' });
      }

      const normalizedVolume = saveRuntimeClutchVolumePercent(requestedVolume);
      config.clutch.volumePercent = normalizedVolume;

      stateStore.pushEvent('system', 'info', 'CONFIG_UPDATED', `Clutch volume updated to ${normalizedVolume}%`);
      logger.info(`Clutch volume updated via dashboard: ${normalizedVolume}%`);

      return res.json(serializeConfig(config));
    } catch (error: any) {
      const message = error?.message || 'Failed to update clutch volume';
      logger.error('Failed to update clutch volume:', error);
      return res.status(500).json({ success: false, error: message });
    }
  });
  // ============ TEST CONTROL ENDPOINTS ============

  // POST /api/test/overlay-only/:count â€” trigger overlay visuals only (no Discord ducking)
  app.post('/api/test/overlay-only/:count', async (req: Request, res: Response) => {
    const count = parseInt(req.params.count);
    if (isNaN(count) || count < 1 || count > 5) {
      return res.status(400).json({ success: false, error: 'Count must be 1-5' });
    }

    try {
      // Update UI state only - no event bus emission (no Discord side effects)
      stateStore.currentScenario = `1v${count} Clutch (Overlay Test)`;
      stateStore.clutchActive = true;

      stateStore.pushEvent('clutch', 'info', 'TEST_OVERLAY_ONLY', `Overlay-only test: 1v${count} (no Discord ducking)`);
      logger.info(`Overlay-only test 1v${count} triggered via UI (no Discord ducking)`);

      // Update game state for the UI
      stateStore.updateGameState({
        playerAlive: true,
        playerTeam: 'CT',
        teamAliveCount: 1,
        enemyAliveCount: count,
        roundPhase: 'live',
        lastPayloadTime: Date.now(),
      });

      res.json({ success: true, scenario: `1v${count}`, mode: 'overlay-only' });
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      stateStore.pushEvent('error', 'error', 'TEST_OVERLAY_FAIL', `Overlay test failed: ${msg}`);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // POST /api/test/clutch/:count â€” trigger FULL clutch simulation (with Discord ducking)
  app.post('/api/test/clutch/:count', async (req: Request, res: Response) => {
    const count = parseInt(req.params.count);
    if (isNaN(count) || count < 1 || count > 5) {
      return res.status(400).json({ success: false, error: 'Count must be 1-5' });
    }

    try {
      stateStore.currentScenario = `1v${count} Clutch (Full Simulation)`;
      stateStore.clutchActive = true;

      // Emit CLUTCH_STARTED event through the real event bus
      // This triggers ALL clutch side effects including Discord voice ducking
      const { getThreatLevel } = require('../clutch/rules');
      eventBus.emitGameEvent({
        type: GameEventType.CLUTCH_STARTED,
        timestamp: Date.now(),
        data: {
          playerTeam: 'CT',
          enemyAliveCount: count,
          threatLevel: getThreatLevel(count),
        },
      });

      stateStore.pushEvent('clutch', 'info', 'TEST_CLUTCH_FULL', `Full clutch simulation: 1v${count} (with Discord ducking)`);
      logger.info(`Full clutch simulation 1v${count} triggered via UI (with Discord ducking)`);

      // Update game state for the UI
      stateStore.updateGameState({
        playerAlive: true,
        playerTeam: 'CT',
        teamAliveCount: 1,
        enemyAliveCount: count,
        roundPhase: 'live',
        lastPayloadTime: Date.now(),
      });

      res.json({ success: true, scenario: `1v${count}` });
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      stateStore.pushEvent('error', 'error', 'TEST_CLUTCH_FAIL', `Test clutch failed: ${msg}`);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // POST /api/test/restore â€” end test clutch and restore normal state
  app.post('/api/test/restore', async (_req: Request, res: Response) => {
    try {
      stateStore.currentScenario = 'Normal';
      const wasClutch = stateStore.clutchActive;

      if (wasClutch) {
        // CLUTCH_ENDED triggers DiscordPresenceActionHandler which calls setNormalPresence
        // This also restores Discord voice volume
        stateStore.clutchActive = false;
        eventBus.emitGameEvent({
          type: GameEventType.CLUTCH_ENDED,
          timestamp: Date.now(),
          data: { reason: 'teammates_alive' },
        });
      } else {
        // No clutch active, set normal presence directly
        await setNormalPresence();
      }

      stateStore.pushEvent('discord', 'info', 'TEST_RESTORE', 'Test ended - normal state restored');
      logger.info('Test ended - normal state restored via UI');
      res.json({ success: true });
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      stateStore.pushEvent('error', 'error', 'TEST_NORMAL_FAIL', `Normal presence failed: ${msg}`);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // POST /api/test/clear â€” clear presence
  app.post('/api/test/clear', async (_req: Request, res: Response) => {
    try {
      stateStore.currentScenario = 'Cleared';

      if (stateStore.clutchActive) {
        stateStore.clutchActive = false;
      }

      await clearPresence();

      stateStore.updatePresence({
        details: '',
        state: '',
        largeImageKey: '',
        smallImageKey: '',
        startTimestamp: null,
        lastSentAt: Date.now(),
        lastResult: 'success',
      });

      stateStore.pushEvent('discord', 'info', 'TEST_CLEAR', 'Presence cleared via UI');
      logger.info('Presence cleared via UI');
      res.json({ success: true });
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      stateStore.pushEvent('error', 'error', 'TEST_CLEAR_FAIL', `Clear presence failed: ${msg}`);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // POST /api/test/round/start â€” simulate round start
  app.post('/api/test/round/start', (_req: Request, res: Response) => {
    try {
      const roundNum = (stateStore.gameState.roundNumber || 0) + 1;
      eventBus.emitGameEvent({
        type: GameEventType.ROUND_STARTED,
        timestamp: Date.now(),
        data: { roundNumber: roundNum },
      });
      stateStore.updateGameState({ roundPhase: 'live', roundNumber: roundNum });
      stateStore.pushEvent('gsi', 'info', 'TEST_ROUND_START', `Simulated round ${roundNum} start`);
      res.json({ success: true, roundNumber: roundNum });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message });
    }
  });

  // POST /api/test/round/end â€” simulate round end
  app.post('/api/test/round/end', (_req: Request, res: Response) => {
    try {
      eventBus.emitGameEvent({
        type: GameEventType.ROUND_ENDED,
        timestamp: Date.now(),
        data: { roundPhase: 'over' },
      });
      stateStore.updateGameState({ roundPhase: 'over' });

      if (stateStore.clutchActive) {
        stateStore.clutchActive = false;
        stateStore.currentScenario = 'Normal';
        eventBus.emitGameEvent({
          type: GameEventType.CLUTCH_ENDED,
          timestamp: Date.now(),
          data: { reason: 'round_ended' },
        });
      }

      stateStore.pushEvent('gsi', 'info', 'TEST_ROUND_END', 'Simulated round end');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message });
    }
  });

  // POST /api/test/simulate â€” full game state simulator
  app.post('/api/test/simulate', (req: Request, res: Response) => {
    try {
      const {
        mapName = 'de_dust2',
        mapPhase = 'live',
        roundPhase = 'live',
        roundNumber = 1,
        playerAlive = true,
        playerTeam = 'CT',
        teamAliveCount = 1,
        enemyAliveCount = 2,
      } = req.body;

      // Build a normalized game state that the clutch engine can process
      const enemyTeam = playerTeam === 'CT' ? 'T' : 'CT';
      const buildPlayers = () => {
        const players: Record<string, any> = {};
        // Local player
        players['sim_local'] = {
          name: 'Simulator',
          team: playerTeam,
          state: { health: playerAlive ? 100 : 0 },
        };
        // Teammates
        for (let i = 1; i < teamAliveCount; i++) {
          players[`sim_team_${i}`] = {
            name: `Teammate ${i}`,
            team: playerTeam,
            state: { health: 100 },
          };
        }
        // Enemies
        for (let i = 0; i < enemyAliveCount; i++) {
          players[`sim_enemy_${i}`] = {
            name: `Enemy ${i + 1}`,
            team: enemyTeam,
            state: { health: 100 },
          };
        }
        return players;
      };

      const simulatedState = {
        player: {
          steamId: 'SIM_PLAYER',
          name: 'Simulator',
          team: playerTeam,
          state: { health: playerAlive ? 100 : 0 },
        },
        allPlayers: buildPlayers(),
        map: { name: mapName, phase: mapPhase, round: roundNumber },
        round: { phase: roundPhase },
      };

      // Feed through the real clutch engine
      clutchEngine.processGameState(simulatedState as any);

      // Update UI game state
      stateStore.updateGameState({
        playerAlive,
        playerTeam,
        teamAliveCount,
        enemyAliveCount,
        roundPhase,
        mapPhase,
        mapName,
        roundNumber,
        lastPayloadTime: Date.now(),
      });

      stateStore.pushEvent('gsi', 'info', 'SIM_STATE', `Simulator: ${mapName} R${roundNumber} â€” ${playerTeam} ${teamAliveCount}v${enemyAliveCount} (${roundPhase})`);
      logger.info(`Simulator state applied: ${teamAliveCount}v${enemyAliveCount} on ${mapName}`);

      res.json({ success: true });
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      stateStore.pushEvent('error', 'error', 'SIM_FAIL', `Simulator failed: ${msg}`);
      res.status(500).json({ success: false, error: msg });
    }
  });

  logger.info('API routes mounted');
}




