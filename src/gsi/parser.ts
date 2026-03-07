import { z } from 'zod';
import type { GameState } from './types';

const PlayerSchema = z.object({
  steamid: z.string().optional(),
  name: z.string().optional(),
  observer_slot: z.number().optional(),
  team: z.enum(['CT', 'T']).optional(),
  activity: z.string().optional(),
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

const TeamSchema = z.object({
  score: z.number().optional(),
  consecutive_round_losses: z.number().optional(),
  timeouts_remaining: z.number().optional(),
  matches_won_this_series: z.number().optional(),
});

const RoundSchema = z.object({
  phase: z.enum(['live', 'freezetime', 'over']).optional(),
  win_team: z.enum(['CT', 'T']).optional(),
  bomb: z.enum(['planted', 'exploded', 'defused']).optional(),
});

const GsiPayloadSchema = z.object({
  provider: z.object({
    name: z.string().optional(),
    appid: z.number().optional(),
    version: z.number().optional(),
    steamid: z.string().optional(),
    timestamp: z.number().optional(),
  }).optional(),
  player: PlayerSchema.optional(),
  team: z.object({
    CT: TeamSchema.optional(),
    T: TeamSchema.optional(),
  }).optional(),
  round: RoundSchema.optional(),
  map: z.object({
    mode: z.string().optional(),
    name: z.string().optional(),
    phase: z.enum(['warmup', 'live', 'intermission', 'gameover']).optional(),
    round: z.number().optional(),
    num_matches_to_win_series: z.number().optional(),
    current_spectators: z.number().optional(),
    souvenirs_total: z.number().optional(),
  }).optional(),
  allplayers: z.record(PlayerSchema).optional(),
  previously: z.any().optional(),
  added: z.any().optional(),
});

export function parseGsiPayload(payload: unknown): GameState {
  const parsed = GsiPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(`Invalid GSI payload: ${parsed.error.message}`);
  }

  const data = parsed.data;

  return {
    provider: data.provider,
    player: data.player,
    team: data.team,
    round: data.round,
    map: data.map,
    allPlayers: data.allplayers,
    raw: payload,
  };
}
