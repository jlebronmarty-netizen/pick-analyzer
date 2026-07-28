# The Odds API Market History Materialization V1

Generated: 2026-07-28T03:13:15.934Z

Commit: `480cc298d8bbab26aacf514088b0b23b98f84d2c`

Status: READ_ONLY_MARKET_HISTORY_MATERIALIZED

## Stored Snapshot Evidence

- Provider calls made: 0
- Production mutations: 0
- The Odds API snapshots read: 7435
- Events represented: 216
- Market-history groups: 7337
- Closing-candidate groups: 7158
- Pre-start rows: 7190
- Post-start or unknown rows: 234
- Invalid timestamp rows: 0

## Sport Coverage

| Sport | Snapshots | Events | Markets | Bookmakers | Pre-start | Post-start/unknown | Closing candidates |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| americanfootball_nfl | 1978 | 75 | moneyline, spread, total | 11 | 1978 | 0 | 1978 |
| baseball_mlb | 4411 | 69 | moneyline, player_props:pitcher_outs_recorded, spread, total | 17 | 4166 | 234 | 4134 |
| icehockey_nhl | 426 | 32 | moneyline, spread, total | 7 | 426 | 0 | 426 |
| mma_ufc | 360 | 32 | moneyline, total | 8 | 360 | 0 | 360 |
| soccer | 260 | 8 | moneyline, spread, total | 8 | 260 | 0 | 260 |

## Safety Notes

- This checkpoint derives read-only market-history and closing-candidate evidence from stored snapshots.
- It does not duplicate raw snapshots or create provider calls.
- Closing candidates are latest stored PRE_START rows by exact sport/event/market/outcome/line/bookmaker group.
- No estimated opening line, fake closing line, cross-event attachment, cross-side attachment or post-start pregame feature use is introduced.
