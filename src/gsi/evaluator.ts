import type { GameState } from './types';

export function countAlivePlayers(allPlayers: Record<string, unknown>, team: string): number {
  let count = 0;

  for (const steamId in allPlayers) {
    const player = allPlayers[steamId] as { team?: string; state?: { health?: number } };
    if (player.team === team && (player.state?.health ?? 0) > 0) {
      count++;
    }
  }

  return count;
}

export function isPlayerAlive(player: { state?: { health?: number } } | undefined): boolean {
  return (player?.state?.health ?? 0) > 0;
}

export function getEnemyTeam(team: string): string {
  return team === 'CT' ? 'T' : 'CT';
}
