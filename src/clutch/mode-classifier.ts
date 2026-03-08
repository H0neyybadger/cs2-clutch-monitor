/**
 * Game Mode Classification
 * Determines if a game mode supports clutch detection
 */

export type ModeType = 'round-based' | 'respawn' | 'unknown';

export interface ModeClassification {
  type: ModeType;
  supported: boolean;
  reason: string;
}

/**
 * Known round-based modes that support clutch detection
 */
const ROUND_BASED_MODES = [
  'competitive',
  'casual',
  'premier',
  'wingman',
  'scrimmage',
  'scrimcomp2v2',
  'gungame',
  'gungametrbomb',
];

/**
 * Known respawn modes that do NOT support clutch detection
 */
const RESPAWN_MODES = [
  'deathmatch',
  'teamdeathmatch',
  'gungameprogressive',
  'armsrace',
  'training',
  'custom',
];

const ROUND_BASED_MODE_HINTS = [
  'competitive',
  'comp',
  'premier',
  'casual',
  'wingman',
  '2v2',
  'scrim',
  'gungametrbomb',
];

const RESPAWN_MODE_HINTS = [
  'deathmatch',
  'teamdeathmatch',
  'gungameprogressive',
  'armsrace',
  'training',
];

function normalizeMode(mode: string): string {
  return mode.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Classify a game mode to determine if it supports clutch detection
 */
export function classifyGameMode(mode: string | undefined): ModeClassification {
  // No mode provided
  if (!mode) {
    return {
      type: 'unknown',
      supported: true,
      reason: 'No mode provided - relying on round-state behavior',
    };
  }

  const modeLower = mode.toLowerCase();
  const normalizedMode = normalizeMode(mode);

  // Check if it's a known round-based mode
  if (ROUND_BASED_MODES.includes(modeLower)) {
    return {
      type: 'round-based',
      supported: true,
      reason: `Round-based mode: ${mode}`,
    };
  }

  // Check if it's a known respawn mode
  if (RESPAWN_MODES.includes(modeLower)) {
    return {
      type: 'respawn',
      supported: false,
      reason: `Respawn mode not supported: ${mode}`,
    };
  }

  if (RESPAWN_MODE_HINTS.some(hint => normalizedMode.includes(normalizeMode(hint)))) {
    return {
      type: 'respawn',
      supported: false,
      reason: `Respawn mode not supported: ${mode}`,
    };
  }

  if (ROUND_BASED_MODE_HINTS.some(hint => normalizedMode.includes(normalizeMode(hint)))) {
    return {
      type: 'round-based',
      supported: true,
      reason: `Round-based mode: ${mode}`,
    };
  }

  // Unknown mode - default to supported if round-state logic passes
  return {
    type: 'unknown',
    supported: true,
    reason: `Unknown mode "${mode}" - relying on round-state behavior`,
  };
}

/**
 * Check if clutch detection is eligible based on mode and round state
 */
export function isClutchEligible(
  mode: string | undefined,
  roundPhase: string | undefined
): { eligible: boolean; reason: string } {
  const classification = classifyGameMode(mode);

  // Explicitly unsupported mode
  if (!classification.supported) {
    return {
      eligible: false,
      reason: classification.reason,
    };
  }

  // Round must be live for clutch
  if (roundPhase !== 'live') {
    return {
      eligible: false,
      reason: `Round phase is "${roundPhase}" (not "live")`,
    };
  }

  // Mode is supported and round is live
  return {
    eligible: true,
    reason: classification.reason,
  };
}
