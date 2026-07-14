# SportsDataIO MLB Catalog

Status: Discovery Lab endpoint catalog confirmed. MLB Real Data Validation Batch V1 persisted quarantined teams, players, events, stats and odds. All 15 `2026-JUL-12` events now have line-movement coverage and bounded quarantined feature/prediction lineage validation; production promotion remains blocked.

## Provider Variants

SportsDataIO MLB has two distinct route families:

- Enterprise: `https://api.sportsdata.io/v3/mlb/...`
- Discovery Lab: `https://api.sportsdata.io/api/mlb/{product}/json/{endpoint}`

The purchased personal-use MLB subscription is modeled as `sportsdataio_discovery_lab`. Its key is read server-side from `SPORTSDATAIO_MLB_API_KEY`, trimmed before use and sent through `Ocp-Apim-Subscription-Key`. The NBA key is not used for MLB, secrets are never logged, and Discovery Lab does not fall back to enterprise `/v3/mlb/...`.

## Confirmed Discovery Lab Endpoints

| Product | Method | Path | Domain | Destination | Batch V1 status |
| --- | --- | --- | --- | --- | --- |
| Fantasy | GET | `/api/mlb/fantasy/json/CurrentSeason` | metadata | none | HTTP 200 auth probe |
| Fantasy | GET | `/api/mlb/fantasy/json/Players` | players | `sport_players`, mappings | confirmed, excluded |
| Fantasy | GET | `/api/mlb/fantasy/json/FreeAgents` | players | `sport_players`, mappings | confirmed, excluded |
| Fantasy | GET | `/api/mlb/fantasy/json/Standings/{season}` | standings | `sport_standings`, mappings | HTTP 200, 30 records |
| Fantasy | GET | `/api/mlb/fantasy/json/Teams` | teams | `sports_teams`, mappings | HTTP 200, 30 records |
| Fantasy | GET | `/api/mlb/fantasy/json/DfsSlatesByDate/{date}` | metadata | none | confirmed, excluded |
| Fantasy | GET | `/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}` | player stats | `sport_player_stats`, mappings | HTTP 200, 0 records for `2026-JUL-13` |
| Fantasy | GET | `/api/mlb/fantasy/json/PlayerSeasonStats/{season}` | player stats | `sport_player_stats`, mappings | confirmed, excluded |
| Fantasy | GET | `/api/mlb/fantasy/json/PlayerGameProjectionStatsByDate/{date}` | projections | none | confirmed, optional only |
| Fantasy | GET | `/api/mlb/fantasy/json/PlayerSeasonProjectionStats/{season}` | projections | none | confirmed, excluded |
| Odds | GET | `/api/mlb/odds/json/GamesByDate/{date}` | games/results | `sport_events`, mappings | HTTP 200, 0 records for `2026-JUL-13`; HTTP 200, 15 records for `2026-JUL-12` |
| Odds | GET | `/api/mlb/odds/json/GameOddsByDate/{date}` | odds | `sports_odds_snapshots` | HTTP 200, 15 records for `2026-07-12`; 90 quarantined full-game odds rows persisted |
| Odds | GET | `/api/mlb/odds/json/GameOddsLineMovement/{gameid}` | line movement | `sports_odds_snapshots` | HTTP 200 for GameId `78723`; 624 movement snapshots, 3,720 quarantined odds rows persisted |
| Odds | GET | `/api/mlb/odds/json/Games/{season}` | season games | `sport_events`, mappings | confirmed, excluded |
| Odds | GET | `/api/mlb/odds/json/Stadiums` | stadiums | event/team metadata | HTTP 200, 97 records |
| Odds | GET | `/api/mlb/odds/json/TeamGameStatsByDate/{date}` | team game stats | `sport_game_stats` | HTTP 200, 0 records for `2026-JUL-13` |
| Odds | GET | `/api/mlb/odds/json/TeamSeasonStats/{season}` | team season stats | `team_stats` | confirmed, excluded |

Continuation result for `2026-JUL-12`: GamesByDate, TeamGameStatsByDate, PlayerGameStatsByDate, GameOddsByDate and Players all passed provider transport with HTTP 200. After the `sport_player_stats` preflight chunking fix, the corrected retry inserted 30 teams, 7,258 players, 15 events, 30 team game stats, 463 player game stats, 7,796 provider mappings and 1 sync job as quarantined non-production rows. The approved odds-only retry fixed `GameId`/`GameID` and nested `PregameOdds` normalization, called `GameOddsByDate/2026-07-12` once, returned HTTP 200 with 15 records, flattened 15 `PregameOdds`, inserted 90 `sports_odds_snapshots` rows and completed sync job `4214c5a3-38de-41c8-9f53-7eab1714a34f`.

Line Movement Probe V1 selected completed mapped GameId `78723` and called `GameOddsLineMovement/78723` once. The endpoint returned HTTP 200 with 1 top-level game record and 624 nested `PregameOdds` movement records. The normalizer inserted 3,720 source-aware `line_movement` odds rows, found 2,586 cutoff-safe rows before the 10-minute pregame cutoff, preserved the existing 90 `GameOddsByDate` rows, and completed sync job `56db235c-8837-426f-8e84-e6e0ebc70a97`.

Bounded Feature/Prediction Lineage V1 used zero provider calls after the line-movement probe. The existing Feature Store route selected the `Consensus` odds rows at `2026-07-12T12:04:59.000Z`, one second before the `2026-07-12T12:05:00.000Z` cutoff: moneyline home `-126`, run line home `-1.5` at `+165` mapped internally to `spread`, and total over `7.5` at `-118`. It inserted 3 quarantined feature snapshots on first run, reused all 3 on rerun, inserted 3 linked predictions on first run, reused all 3 on rerun, settled them as 3 wins and verified 0 duplicate identities, 0 orphan links, 0 recommended picks, 0 production-eligible rows, 0 production leakage and 0 CLV rows claimed.

Line Movement Expansion Batch V1 called the same `GameOddsLineMovement/{gameid}` endpoint once for each remaining persisted `2026-JUL-12` GameId: `78729`, `78724`, `78730`, `78732`, `78731`, `78722`, `78725`, `78727`, `78726`, `78733`, `78734`, `78735`, `78728`, `78736`. All 14 calls returned HTTP 200, inserted 32,722 new quarantined line-movement rows, and brought the full date to 36,442 line-movement rows with 25,498 cutoff-safe rows. The multi-game lineage batch inserted 42 new feature snapshots and reused 3, inserted 42 new linked predictions and reused 3, then reran idempotently with 45 reused rows. Settlement completed for all 45 technical predictions as 21 wins and 24 losses, with 0 pushes, 0 voids, 0 production recommendations and 0 production leakage.

Date formats observed from provider docs remain endpoint-specific. Most Fantasy and game/stat feeds use `YYYY-MMM-DD`, for example `2026-JUL-13`. `GameOddsByDate` documentation also shows `YYYY-MM-DD`; do not assume the formats are interchangeable.

## Batch V1 Stop

The first selected date, `2026-07-13`, was chosen because it was the most recent non-today date. It returned no games, stats or odds and therefore failed the 5-15 completed-games requirement. One reserved validation call confirmed `2026-07-12` has 15 games, but the provider-call budget was already mostly consumed. The safe outcome is to stop before persistence and rerun a second bounded batch on `2026-07-12` with a fresh approved cap.

No raw payloads were stored and no production promotion occurred.

The next executable step is not a broad provider retry or production promotion. The full `2026-JUL-12` line-movement and quarantined technical lineage batch is complete. Next steps require explicit approval for production-promotion rules, a closing-line policy and a larger-sample validation plan.

## Data Promotion

Future Discovery Lab rows start as:

- `trial=false`
- `scrambled=false`
- `production_eligible=false`
- quarantine status in row metadata unless an additive `validation_status='quarantined'` schema path is approved

A paid key does not make rows production-eligible. Production promotion still requires endpoint-shape validation, mapping validation, persistence validation, leakage checks and explicit approval under `docs/first-real-data-validation-plan-v1.md`.
