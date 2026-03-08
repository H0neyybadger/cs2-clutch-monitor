import express from 'express';
import bodyParser from 'body-parser';
import type { ClutchEngine } from '../clutch/clutch-engine';
import { parseGsiPayload } from './parser';
import { createLogger } from '../app/logger';
import { stateStore } from '../app/state-store';
import type { GsiConfig } from '../shared/types';
import { processNormalizedGameState } from '../game-data/process-normalized-state';
import { overwolfStateAccumulator } from '../overwolf/state-accumulator';
import type { OverwolfBridgeMessage } from '../overwolf/types';

const logger = createLogger('GSI-Server');

export async function startGsiServer(
  config: GsiConfig,
  clutchEngine: ClutchEngine
): Promise<express.Express> {
  const app = express();

  app.use(bodyParser.json({ limit: '1mb' }));

  app.post(config.endpoint, (req, res) => {
    try {
      const gameState = parseGsiPayload(req.body);
      processNormalizedGameState({
        source: 'gsi',
        gameState,
        clutchEngine,
        rosterStatus: gameState.allPlayers && Object.keys(gameState.allPlayers).length > 1
          ? 'Live roster data received from CS2 GSI'
          : 'CS2 does not expose all-player roster data to a normal player client. Team and enemy alive counts require observer or HLTV data.',
        playerStatsStatus: gameState.player?.match_stats
          ? 'Live player match stats received from CS2 GSI'
          : 'player_match_stats not present yet. Restart CS2 after the app updates the GSI config.',
        eventType: 'GSI_PAYLOAD',
        eventSummary: `GSI payload - ${gameState.map?.name || '?'} R${gameState.map?.round || 0} (${gameState.round?.phase || '?'})`,
      });

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Error processing GSI payload:', error);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  });

  app.post('/provider/overwolf', (req, res) => {
    try {
      const result = overwolfStateAccumulator.ingest(req.body as OverwolfBridgeMessage);

      if (result.gameState) {
        processNormalizedGameState({
          source: 'overwolf',
          gameState: result.gameState,
          clutchEngine,
          rosterAvailable: result.rosterAvailable,
          rosterStatus: result.rosterStatus,
          playerStatsAvailable: result.playerStatsAvailable,
          playerStatsStatus: result.playerStatsStatus,
          eventType: result.eventType,
          eventSummary: result.summary,
        });
      } else {
        stateStore.updateGameState({
          dataSource: 'overwolf',
          dataSourceStatus: result.summary,
        } as any);
        stateStore.pushEvent('system', 'info', result.eventType, result.summary);
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Error processing Overwolf payload:', error);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  app.get('/api/stats', (_req, res) => {
    res.json(stateStore.sessionStats);
  });

  app.post('/api/stats/reset', (_req, res) => {
    stateStore.resetSessionStats();
    res.json({ status: 'ok', stats: stateStore.sessionStats });
  });

  return new Promise((resolve, reject) => {
    app.listen(config.port, config.host, () => {
      logger.info('Game data server listening on http://%s:%d%s', config.host, config.port, config.endpoint);
      resolve(app);
    }).on('error', (error) => {
      logger.error('Failed to start game data server:', error);
      reject(error);
    });
  });
}