export type OverwolfMessageKind = 'status' | 'info' | 'events' | 'reset';

export interface OverwolfBridgeMessage {
  kind: OverwolfMessageKind;
  payload?: unknown;
  receivedAt?: number;
}

export interface OverwolfPlayerSnapshot {
  id: string;
  steamId?: string;
  name: string;
  team: 'CT' | 'T' | null;
  isLocal: boolean;
  alive: boolean;
}

export interface OverwolfEventSnapshot {
  name: string;
  data?: Record<string, unknown>;
}