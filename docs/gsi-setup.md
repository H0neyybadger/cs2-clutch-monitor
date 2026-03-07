# CS2 Game State Integration Setup

This guide explains how to configure Counter-Strike 2 to send game state data to the CS2 Discord Clutch application.

## Overview

CS2 Discord Clutch uses CS2's Game State Integration (GSI) feature to receive real-time game data. This allows the application to detect when you're in a clutch situation and automatically lower Discord voice chat volume.

## Configuration File Location

Create a GSI configuration file in one of the following locations:

### Windows
```
C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\
```

Create a file named `gamestate_integration_cs2discordclutch.cfg`

## Configuration File Content

Create a new file with the following content:

```
"CS2 Discord Clutch"
{
    "uri"       "http://127.0.0.1:3001/cs2"
    "timeout"   "5.0"
    "buffer"    "0.1"
    "throttle"  "0.1"
    "heartbeat" "30.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "round"         "1"
        "player_id"     "1"
        "player_state"  "1"
        "player_match_stats" "1"
        "allplayers_id" "1"
        "allplayers_state" "1"
        "allplayers_match_stats" "1"
    }
}
```

## Configuration Options

| Option | Description |
|--------|-------------|
| `uri` | The endpoint where CS2 sends game state data. Must match the `GSI_HOST` and `GSI_PORT` in your `.env` file. |
| `timeout` | Timeout for HTTP requests in seconds. |
| `buffer` | Buffer time before sending updates. |
| `throttle` | Minimum time between updates. |
| `heartbeat` | Interval for heartbeat packets when no data changes. |

## Data Fields

The `data` section specifies which game state information to include:

- `provider`: Game information (name, app ID, version)
- `map`: Map name, game mode, current round
- `round`: Round phase, win team, bomb status
- `player_id`: Current player's Steam ID
- `player_state`: Player health, armor, weapons, etc.
- `player_match_stats`: Kills, deaths, assists, MVPs
- `allplayers_id`: All players' Steam IDs
- `allplayers_state`: All players' health and status
- `allplayers_match_stats`: All players' match statistics

## Verification

After placing the configuration file:

1. Restart CS2 if it's running
2. Start the CS2 Discord Clutch application (`npm run dev`)
3. Launch a game in CS2
4. Check the console output - you should see GSI payload logs

## Troubleshooting

### No data received
- Verify the configuration file is in the correct location
- Check that the URI matches your application settings
- Ensure CS2 was restarted after adding the config file

### Connection refused
- Make sure the application is running before launching CS2
- Check that port 3001 is not in use by another application
- Verify Windows Firewall is not blocking the connection

### Partial data
- Ensure all required data fields are enabled in the config
- Check that you're in an actual match (not just menu)

## Security Note

The GSI endpoint only accepts connections from localhost (127.0.0.1) by default. Do not expose this endpoint to the internet.
