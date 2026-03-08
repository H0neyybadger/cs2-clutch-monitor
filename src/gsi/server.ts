import express from 'express';
import bodyParser from 'body-parser';
import type { ClutchEngine } from '../clutch/clutch-engine';
import { parseGsiPayload } from './parser';
import { createLogger } from '../app/logger';
import { stateStore } from '../app/state-store';
import { countAlivePlayers, isPlayerAlive, getEnemyTeam } from './evaluator';
import { classifyGameMode, isClutchEligible } from '../clutch/mode-classifier';
import type { GsiConfig } from '../shared/types';

const logger = createLogger('GSI-Server');

export async function startGsiServer(
  config: GsiConfig,
  clutchEngine: ClutchEngine
): Promise<express.Express> {
  const app = express();

  app.use(bodyParser.json());

  app.post(config.endpoint, (req, res) => {
    try {
      const payload = req.body;
      const gameState = parseGsiPayload(payload);

      // Extract round info for transition detection
      const newRoundNumber = gameState.map?.round || 0;
      const newPhase = gameState.round?.phase || '?';
      
      // Handle round transitions BEFORE processing game state
      if (newRoundNumber > 0 && newPhase !== '?') {
        stateStore.handleRoundTransition(newRoundNumber, newPhase);
      }

      // Process game state through clutch engine
      clutchEngine.processGameState(gameState);

      // Update UI game state snapshot
      const partial: Record<string, any> = { lastPayloadTime: Date.now() };

      const player = gameState.player;
      const allPlayers = gameState.allPlayers;

      // Update basic player info
      if (player) {
        if (player.team) partial.playerTeam = player.team;
      }

      // Update map/round info
      if (gameState.round?.phase) partial.roundPhase = gameState.round.phase;
      if (gameState.map?.phase) partial.mapPhase = gameState.map.phase;
      if (gameState.map?.name) partial.mapName = gameState.map.name;
      if (newRoundNumber > 0) partial.roundNumber = newRoundNumber;

      // Track game mode and classification
      const gameMode = gameState.map?.mode;
      if (gameMode) {
        partial.gameMode = gameMode;
        const modeClassification = classifyGameMode(gameMode);
        partial.modeSupported = modeClassification.supported;
        partial.modeReason = modeClassification.reason;
        
        console.log(`[MODE] Game mode: ${gameMode} (${modeClassification.type}) - Supported: ${modeClassification.supported}`);
      }

      // Calculate alive counts and player status
      const playerTeam = player?.team || stateStore.gameState.playerTeam;
      if (player && allPlayers && playerTeam && playerTeam !== '?') {
        const enemyTeam = getEnemyTeam(playerTeam);
        
        // Recalculate current round data
        partial.playerAlive = isPlayerAlive(player);
        partial.teamAliveCount = countAlivePlayers(allPlayers, playerTeam);
        partial.enemyAliveCount = countAlivePlayers(allPlayers, enemyTeam);
        
        console.log(`[GSI] Recalculated counts: playerAlive=${partial.playerAlive} teamAlive=${partial.teamAliveCount} enemyAlive=${partial.enemyAliveCount} phase=${newPhase}`);
      }

      // Calculate clutch eligibility
      const eligibility = isClutchEligible(gameMode, newPhase);
      partial.clutchEligible = eligibility.eligible;
      partial.clutchEligibilityReason = eligibility.reason;

      stateStore.updateGameState(partial);
      
      // Confirm data status after update
      stateStore.confirmRoundData();

      // Update session stats from GSI payload
      stateStore.updateSessionStats(payload);

      // Use merged state for summary so we never show '?' when a known value exists
      const gs = stateStore.gameState;
      stateStore.pushEvent('gsi', 'info', 'GSI_PAYLOAD', `GSI payload — ${gs.mapName} R${gs.roundNumber} (${gs.roundPhase})`);

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Error processing GSI payload:', error);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Session stats endpoint
  app.get('/api/stats', (_req, res) => {
    res.json(stateStore.sessionStats);
  });

  // Reset session stats endpoint
  app.post('/api/stats/reset', (_req, res) => {
    stateStore.resetSessionStats();
    res.json({ status: 'ok', stats: stateStore.sessionStats });
  });

  return new Promise((resolve, reject) => {
    app.listen(config.port, config.host, () => {
      logger.info('GSI server listening on http://%s:%d%s', config.host, config.port, config.endpoint);
      resolve(app);
    }).on('error', (error) => {
      logger.error('Failed to start GSI server:', error);
      reject(error);
    });
  });
}
