# SportsDataIO Capability Matrix

The typed source of truth is `src/config/sportsdataio-endpoint-catalog.ts`.

| Sport | Catalog Status | Trial Persistence | Odds Snapshot Status | Next Blocker |
| --- | --- | --- | --- | --- |
| NBA | Cataloged and partially implemented | Teams, players, injuries, lineups, player stats | BettingEvents discovery confirmed; no sportsbook-priced snapshots | Confirm exact priced market/outcome endpoint |
| MLB | Discovery Lab Fantasy + Odds endpoints confirmed; Batch V1 persisted quarantined teams, players, events, stats and odds | 30 teams, 7,258 players, 15 events, 30 team game stats, 463 player game stats, 36,532 odds rows, 45 feature snapshots, 45 linked predictions and 7,796 mappings | `GameOddsLineMovement` now covers all 15 `2026-JUL-12` events: 36,442 line-movement rows, 25,498 cutoff-safe rows, 45 settled technical predictions | Production promotion rules, closing-line policy and larger-sample approval |
| NFL | Cataloged | Pending | Pending | Build season/week fixture normalizers before any calls |
| NHL | Cataloged | Pending | Pending | Build goalie/line fixture normalizers before any calls |
| Soccer | Cataloged | Pending | Pending | Select one competition and build scoped fixtures |

Shared betting normalization now supports deterministic zero-call fixtures for discovery-only events, market-index records, priced outcomes, consensus outcomes, unlisted outcomes, entitlement-blocked statuses and archive-required routing.

No catalog entry authorizes production use by itself. Production eligibility still requires entitlement, payload validation, persistence validation, trial isolation, data-quality checks and explicit production approval.

MLB Discovery Lab notes:

- Active variant: `sportsdataio_discovery_lab`.
- Route family: `/api/mlb/{product}/json/{endpoint}` under `https://api.sportsdata.io`.
- Confirmed endpoints: Fantasy `CurrentSeason`, `Teams`, `Players`, `FreeAgents`, `Standings`, DFS slates, player stats/projections; Odds `GamesByDate`, `GameOddsByDate`, `GameOddsLineMovement`, `Games`, `Stadiums`, team stats.
- Batch V1 calls returned HTTP 200 for all called endpoints, but `2026-07-13` had no games/stats/odds. A reserved `GamesByDate/2026-JUL-12` call returned 15 games. The corrected `2026-JUL-12` retry reached HTTP 200 transport for the planned one-date feeds and Players, then persisted quarantined event/stat/player rows after fixing the `sport_player_stats` preflight chunk size. The line-movement probe and expansion proved timestamp-safe historical pregame odds for all 15 events, and bounded lineage validation inserted/reused 45 quarantined feature snapshots plus 45 linked settled technical predictions with 0 production leakage. No production gate opened.
- Enterprise `/v3/mlb/...` entries are not automatically available to the Discovery Lab key and must not be selected for live MLB imports under that variant.
