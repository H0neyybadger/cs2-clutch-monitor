import http from 'http';

interface TestPayload {
  name: string;
  description: string;
  payload: unknown;
}

const PAYLOADS: Record<string, TestPayload> = {
  normal: {
    name: 'Normal - Multiple teammates alive',
    description: 'Player and multiple teammates alive, should not trigger clutch',
    payload: {
      provider: {
        name: 'Counter-Strike: Global Offensive',
        appid: 730,
        version: 1,
        steamid: '76561198000000000',
        timestamp: Date.now(),
      },
      map: {
        mode: 'competitive',
        name: 'de_dust2',
        phase: 'live',
        round: 5,
      },
      round: {
        phase: 'live',
      },
      player: {
        steamid: '76561198000000000',
        name: 'TestPlayer',
        team: 'CT',
        state: {
          health: 75,
          armor: 50,
          helmet: true,
          flashed: 0,
          smoked: 0,
          burning: 0,
          money: 4500,
          round_kills: 1,
          round_killhs: 0,
        },
        match_stats: {
          kills: 8,
          assists: 2,
          deaths: 4,
          mvps: 1,
          score: 18,
        },
      },
      team: {
        CT: {
          score: 3,
          consecutive_round_losses: 0,
          timeouts_remaining: 1,
          matches_won_this_series: 0,
        },
        T: {
          score: 2,
          consecutive_round_losses: 1,
          timeouts_remaining: 1,
          matches_won_this_series: 0,
        },
      },
      allplayers: {
        '76561198000000000': {
          team: 'CT',
          state: { health: 75 },
        },
        '76561198000000001': {
          team: 'CT',
          state: { health: 100 },
        },
        '76561198000000003': {
          team: 'CT',
          state: { health: 0 },
        },
        '76561198000000004': {
          team: 'CT',
          state: { health: 100 },
        },
        '76561198000000005': {
          team: 'CT',
          state: { health: 50 },
        },
        '76561198000000010': {
          team: 'T',
          state: { health: 100 },
        },
        '76561198000000011': {
          team: 'T',
          state: { health: 100 },
        },
      },
    },
  },
  clutch: {
    name: 'Clutch Situation - 1v3',
    description: 'Player is last alive on team with 3 enemies alive - SHOULD trigger clutch',
    payload: {
      provider: {
        name: 'Counter-Strike: Global Offensive',
        appid: 730,
        version: 1,
        steamid: '76561198000000000',
        timestamp: Date.now(),
      },
      map: {
        mode: 'competitive',
        name: 'de_mirage',
        phase: 'live',
        round: 12,
      },
      round: {
        phase: 'live',
        bomb: 'planted',
      },
      player: {
        steamid: '76561198000000000',
        name: 'TestPlayer',
        team: 'CT',
        state: {
          health: 35,
          armor: 0,
          helmet: false,
          flashed: 50,
          smoked: 0,
          burning: 0,
          money: 1200,
          round_kills: 2,
          round_killhs: 1,
        },
        match_stats: {
          kills: 15,
          assists: 3,
          deaths: 8,
          mvps: 3,
          score: 33,
        },
      },
      team: {
        CT: {
          score: 7,
          consecutive_round_losses: 2,
          timeouts_remaining: 0,
          matches_won_this_series: 0,
        },
        T: {
          score: 5,
          consecutive_round_losses: 0,
          timeouts_remaining: 1,
          matches_won_this_series: 0,
        },
      },
      allplayers: {
        '76561198000000000': {
          team: 'CT',
          state: { health: 35 },
        },
        '76561198000000001': {
          team: 'CT',
          state: { health: 0 },
        },
        '76561198000000003': {
          team: 'CT',
          state: { health: 0 },
        },
        '76561198000000004': {
          team: 'CT',
          state: { health: 0 },
        },
        '76561198000000005': {
          team: 'CT',
          state: { health: 0 },
        },
        '76561198000000010': {
          team: 'T',
          state: { health: 100 },
        },
        '76561198000000011': {
          team: 'T',
          state: { health: 85 },
        },
        '76561198000000012': {
          team: 'T',
          state: { health: 42 },
        },
      },
    },
  },
  death: {
    name: 'Player Dead',
    description: 'Player is dead, should not trigger clutch',
    payload: {
      provider: {
        name: 'Counter-Strike: Global Offensive',
        appid: 730,
        version: 1,
        steamid: '76561198000000000',
        timestamp: Date.now(),
      },
      map: {
        mode: 'competitive',
        name: 'de_ancient',
        phase: 'live',
        round: 8,
      },
      round: {
        phase: 'live',
      },
      player: {
        steamid: '76561198000000000',
        name: 'TestPlayer',
        team: 'T',
        state: {
          health: 0,
          armor: 0,
        },
      },
      allplayers: {
        '76561198000000000': {
          team: 'T',
          state: { health: 0 },
        },
        '76561198000000001': {
          team: 'T',
          state: { health: 25 },
        },
        '76561198000000010': {
          team: 'CT',
          state: { health: 100 },
        },
      },
    },
  },
  roundend: {
    name: 'Round Over',
    description: 'Round has ended - should restore volume',
    payload: {
      provider: {
        name: 'Counter-Strike: Global Offensive',
        appid: 730,
        version: 1,
        steamid: '76561198000000000',
        timestamp: Date.now(),
      },
      map: {
        mode: 'competitive',
        name: 'de_mirage',
        phase: 'live',
        round: 12,
      },
      round: {
        phase: 'over',
        win_team: 'CT',
      },
      player: {
        steamid: '76561198000000000',
        name: 'TestPlayer',
        team: 'CT',
        state: {
          health: 100,
        },
      },
      allplayers: {
        '76561198000000000': {
          team: 'CT',
          state: { health: 100 },
        },
      },
    },
  },
  casual: {
    name: 'Casual 10v10 - 1v4',
    description: 'Casual alias mode with a 10v10-style roster, should trigger clutch when the player is last alive',
    payload: {
      provider: {
        name: 'Counter-Strike: Global Offensive',
        appid: 730,
        version: 1,
        steamid: '76561198000000000',
        timestamp: Date.now(),
      },
      map: {
        mode: 'casual10v10',
        name: 'de_inferno',
        phase: 'live',
        round: 9,
      },
      round: {
        phase: 'live',
      },
      player: {
        steamid: '76561198000000000',
        name: 'TestPlayer',
        team: 'CT',
        state: {
          health: 48,
          armor: 32,
          helmet: true,
        },
      },
      allplayers: {
        '76561198000000000': { team: 'CT', state: { health: 48 } },
        '76561198000000001': { team: 'CT', state: { health: 0 } },
        '76561198000000002': { team: 'CT', state: { health: 0 } },
        '76561198000000003': { team: 'CT', state: { health: 0 } },
        '76561198000000004': { team: 'CT', state: { health: 0 } },
        '76561198000000005': { team: 'CT', state: { health: 0 } },
        '76561198000000006': { team: 'CT', state: { health: 0 } },
        '76561198000000007': { team: 'CT', state: { health: 0 } },
        '76561198000000008': { team: 'CT', state: { health: 0 } },
        '76561198000000009': { team: 'CT', state: { health: 0 } },
        '76561198000000010': { team: 'T', state: { health: 100 } },
        '76561198000000011': { team: 'T', state: { health: 92 } },
        '76561198000000012': { team: 'T', state: { health: 70 } },
        '76561198000000013': { team: 'T', state: { health: 18 } },
        '76561198000000014': { team: 'T', state: { health: 0 } },
        '76561198000000015': { team: 'T', state: { health: 0 } },
        '76561198000000016': { team: 'T', state: { health: 0 } },
        '76561198000000017': { team: 'T', state: { health: 0 } },
        '76561198000000018': { team: 'T', state: { health: 0 } },
        '76561198000000019': { team: 'T', state: { health: 0 } },
      },
    },
  },
  wingman: {
    name: 'Wingman 2v2 - 1v1',
    description: 'Wingman alias mode with a 2v2 roster, should trigger clutch when the teammate is dead',
    payload: {
      provider: {
        name: 'Counter-Strike: Global Offensive',
        appid: 730,
        version: 1,
        steamid: '76561198000000000',
        timestamp: Date.now(),
      },
      map: {
        mode: 'scrimcomp2v2',
        name: 'de_vertigo',
        phase: 'live',
        round: 6,
      },
      round: {
        phase: 'live',
      },
      player: {
        steamid: '76561198000000000',
        name: 'TestPlayer',
        team: 'T',
        state: {
          health: 61,
          armor: 100,
          helmet: true,
        },
      },
      allplayers: {
        '76561198000000000': { team: 'T', state: { health: 61 } },
        '76561198000000001': { team: 'T', state: { health: 0 } },
        '76561198000000010': { team: 'CT', state: { health: 44 } },
        '76561198000000011': { team: 'CT', state: { health: 0 } },
      },
    },
  },
};

function sendPayload(payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/cs2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`\nServer Response: ${res.statusCode}`);
        console.log(responseData);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('Error sending payload:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2] || 'normal';

  const testPayload = PAYLOADS[mode];
  if (!testPayload) {
    console.error(`Unknown test mode: ${mode}`);
    console.error(`Available modes: ${Object.keys(PAYLOADS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n=== ${testPayload.name} ===`);
  console.log(`Description: ${testPayload.description}\n`);

  try {
    await sendPayload(testPayload.payload);
    console.log('\nPayload sent successfully!\n');
  } catch (error) {
    console.error('\nFailed to send payload');
    process.exit(1);
  }
}

main();
