import { z } from 'zod';

export const PlayerStateSchema = z.object({
  steamid: z.string().optional(),
  name: z.string().optional(),
  team: z.enum(['CT', 'T']).optional(),
  health: z.number().optional(),
  state: z.object({
    health: z.number().optional(),
    armor: z.number().optional(),
    helmet: z.boolean().optional(),
    flashed: z.number().optional(),
    smoked: z.number().optional(),
    burning: z.number().optional(),
    money: z.number().optional(),
    round_kills: z.number().optional(),
    round_killhs: z.number().optional(),
  }).optional(),
  match_stats: z.object({
    kills: z.number().optional(),
    assists: z.number().optional(),
    deaths: z.number().optional(),
    mvps: z.number().optional(),
    score: z.number().optional(),
  }).optional(),
});

export const GameStateSchema = z.object({
  provider: z.object({
    name: z.string().optional(),
    appid: z.number().optional(),
    version: z.number().optional(),
    steamid: z.string().optional(),
    timestamp: z.number().optional(),
  }).optional(),
  player: PlayerStateSchema.optional(),
  team: z.object({
    CT: z.object({
      score: z.number().optional(),
      consecutive_round_losses: z.number().optional(),
      timeouts_remaining: z.number().optional(),
      matches_won_this_series: z.number().optional(),
    }).optional(),
    T: z.object({
      score: z.number().optional(),
      consecutive_round_losses: z.number().optional(),
      timeouts_remaining: z.number().optional(),
      matches_won_this_series: z.number().optional(),
    }).optional(),
  }).optional(),
  round: z.object({
    phase: z.enum(['live', 'freezetime', 'over']).optional(),
    win_team: z.enum(['CT', 'T']).optional(),
    bomb: z.enum(['planted', 'exploded', 'defused']).optional(),
  }).optional(),
  map: z.object({
    mode: z.string().optional(),
    name: z.string().optional(),
    phase: z.enum(['warmup', 'live', 'intermission', 'gameover']).optional(),
    round: z.number().optional(),
    num_matches_to_win_series: z.number().optional(),
    current_spectators: z.number().optional(),
    souvenirs_total: z.number().optional(),
  }).optional(),
  allPlayers: z.record(PlayerStateSchema).optional(),
  raw: z.unknown(),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
