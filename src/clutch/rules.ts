import { countAlivePlayers, isPlayerAlive, getEnemyTeam } from '../gsi/evaluator';
import type { GameState } from '../gsi/types';

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

  return `[GSI] team=${playerTeam} alive=${playerAlive} teamAlive=${teamAliveCount} enemyAlive=${enemyAliveCount} round=${roundPhase} clutch=${isClutch}`;
}

export function shouldEnableClutch(gameState: GameState): boolean {
  const player = gameState.player;
  const allPlayers = gameState.allPlayers;
  const round = gameState.round;

  if (!player || !allPlayers) {
    return false;
  }

  if (!isPlayerAlive(player)) {
    return false;
  }

  const playerTeam = player.team;
  if (!playerTeam) {
    return false;
  }

  const teamAliveCount = countAlivePlayers(allPlayers, playerTeam);
  if (teamAliveCount !== 1) {
    return false;
  }

  const enemyTeam = getEnemyTeam(playerTeam);
  const enemyAliveCount = countAlivePlayers(allPlayers, enemyTeam);
  if (enemyAliveCount < 1) {
    return false;
  }

  const isRoundLive = round?.phase === 'live';
  if (!isRoundLive) {
    return false;
  }

  return true;
}
