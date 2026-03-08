import { countAlivePlayers, isPlayerAlive, getEnemyTeam } from '../gsi/evaluator';
import type { GameState } from '../gsi/types';

export function getThreatLevel(enemyCount: number): string {
  if (enemyCount === 1) return 'low';
  if (enemyCount === 2) return 'medium';
  return 'high';
}

export function evaluateGameState(gameState: GameState): string {
  const player = gameState.player;
  const allPlayers = gameState.allPlayers;
  const round = gameState.round;

  if (!player || !allPlayers) {
    return '[GSI] team=? alive=? teamAlive=? enemyAlive=? round=? clutch=false (no data)';
  }

  const playerTeam = player.team || '?';
  const playerAlive = isPlayerAlive(player);
  const teamAliveCount = playerTeam !== '?' ? countAlivePlayers(allPlayers, playerTeam) : 0;
  const enemyTeam = playerTeam !== '?' ? getEnemyTeam(playerTeam) : '?';
  const enemyAliveCount = enemyTeam !== '?' ? countAlivePlayers(allPlayers, enemyTeam) : 0;
  const roundPhase = round?.phase || '?';
  const isClutch = shouldEnableClutch(gameState);
  const threatLevel = enemyAliveCount > 0 ? getThreatLevel(enemyAliveCount) : 'none';

  return `[GSI] team=${playerTeam} alive=${playerAlive} teamAlive=${teamAliveCount} enemyAlive=${enemyAliveCount} round=${roundPhase} clutch=${isClutch} threat=${threatLevel}`;
}

export function shouldEnableClutch(gameState: GameState): boolean {
  const player = gameState.player;
  const allPlayers = gameState.allPlayers;
  const round = gameState.round;

  // Check 1: Data exists
  if (!player || !allPlayers) {
    console.log('[CLUTCH DIAGNOSTIC] ❌ No player or allPlayers data');
    return false;
  }

  // Check 2: Round phase is live (must be live before checking counts)
  const roundPhase = round?.phase || '?';
  const isRoundLive = roundPhase === 'live';
  if (!isRoundLive) {
    console.log(`[CLUTCH DIAGNOSTIC] ❌ Round phase is "${roundPhase}" (not "live")`);
    return false;
  }

  // Check 3: Player is alive
  const playerAlive = isPlayerAlive(player);
  if (!playerAlive) {
    console.log('[CLUTCH DIAGNOSTIC] ❌ Player is dead');
    return false;
  }

  // Check 4: Player has a team
  const playerTeam = player.team;
  if (!playerTeam) {
    console.log('[CLUTCH DIAGNOSTIC] ❌ Player has no team');
    return false;
  }

  // Check 5: Team alive count is exactly 1
  const teamAliveCount = countAlivePlayers(allPlayers, playerTeam);
  if (teamAliveCount !== 1) {
    console.log(`[CLUTCH DIAGNOSTIC] ❌ Team alive count is ${teamAliveCount} (need exactly 1)`);
    return false;
  }

  // Check 6: At least 1 enemy alive
  const enemyTeam = getEnemyTeam(playerTeam);
  const enemyAliveCount = countAlivePlayers(allPlayers, enemyTeam);
  if (enemyAliveCount < 1) {
    console.log(`[CLUTCH DIAGNOSTIC] ❌ Enemy alive count is ${enemyAliveCount} (need at least 1)`);
    return false;
  }

  // All checks passed!
  const threatLevel = getThreatLevel(enemyAliveCount);
  console.log(`[CLUTCH DIAGNOSTIC] ✅ CLUTCH ACTIVATED: 1v${enemyAliveCount} (${playerTeam}) - Threat: ${threatLevel}`);
  return true;
}
