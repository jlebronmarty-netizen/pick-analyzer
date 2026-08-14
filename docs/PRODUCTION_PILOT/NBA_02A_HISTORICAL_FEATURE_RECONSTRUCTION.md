# NBA-02A Historical Feature Reconstruction

Status: `NBA_02A_HISTORICAL_FEATURE_RECONSTRUCTION_PASS_READY_FOR_REPLAY_CANARY`

NBA-02A converts the certified NBA historical foundation into a replay input
contract. It does not run bulk replay, create NBA Current Era predictions,
activate the NBA scheduler, create Official Picks, call BallDontLie, call The
Odds API historical endpoints or call SportsDataIO.

## Starting Evidence

- Starting commit: `a39ce4899180f40f2e8b055149a085784ffb8f93`
- Production commit: `a39ce4899180f40f2e8b055149a085784ffb8f93`
- Production `/api/system/version`: HTTP 200, provider calls 0
- Provider calls during NBA-02A: BallDontLie 0, The Odds API historical 0,
  SportsDataIO 0
- Production database mutations during certification: 0

## Foundation Reconciliation

Current read-only evidence preserves the NBA historical foundation:

| Domain | Count | Notes |
| --- | ---: | --- |
| Canonical games | 3,710 | BallDontLie canonical completed games |
| Final results | 3,710 | Scores stored on canonical events / results |
| Team-game stats | 7,420 | Two rows per canonical game |
| Quarter-score rows | 7,420 | Period evidence present on team-game rows |
| Players | 6,191 | Current live count including historical and legacy/trial identities |
| Player-stat rows | 487,466 | Live total across game and advanced rows |
| Certified player-game stats | 128,353 | From NBA-01C deterministic import certification |
| Certified advanced stats | 358,195 | From NBA-01C deterministic import certification |
| Box scores | 0 | Dedicated normalized box-score table remains empty |
| Lineups | 758 | Legacy/trial context only; not historical pregame-certified |
| Historical odds rows | 29,754 | Stored total |
| Historical odds rows audited | 29,214 | 2024-25 persisted safe rows |
| Historical odds events | 1,196 | Price-aware events |
| Full-core price-aware events | 1,196 | Moneyline, spread and total present |

The larger `sport_events` total includes canonical BallDontLie games and
The Odds API event rows used for crosswalk/price evidence. Duplicate all-provider
matchup/date groups are therefore expected and are not treated as duplicate
canonical replay games.

## Feature Contract

NBA-02A adds a bounded contract in
`src/services/nba-historical-feature-reconstruction.service.ts`.

The current NBA model supports:

- Moneyline
- Spread
- Total
- First Half

Required replay features are reconstructable from stored pregame-safe evidence:

- event context
- team record to date
- recent form last 10
- home/away splits
- scoring profile

Optional or degraded features:

- first-half scoring context: available from prior period/team-game rows, but
  current engine can also use its certified 0.49 full-game projection split.
- player stats context: available only as prior-game rolling context; never
  same-game participation.
- injury context: not historically pregame-certified; unavailable warning and
  penalty only.
- lineup context: not historically pregame-certified; unavailable warning and
  penalty only.
- market odds: required only for price-aware replay.

## Temporal Contract

Every historical replay feature snapshot must obey:

`feature_as_of < game_start_time`

Team, player, advanced, quarter and result rows from the target game may only
be used after the game as labels or future-game history. Same-game stats, final
scores, full-season averages, player participation and post-start odds are not
valid pregame inputs.

Historical odds must obey:

`snapshot_time < game_start_time`

The 2024-25 odds audit accepted 29,214 pregame rows and rejected 738 post-start
rows. Rejected rows are leakage-protected exclusions, not accepted failures.

## Replay Universes

`MODEL_REPLAY_READY` means the game has enough pregame-safe historical features
to run the current NBA engine without stored sportsbook price evidence.

`PRICE_AWARE_REPLAY_READY` means:

- `MODEL_REPLAY_READY`
- exact event / market / selection / line / sportsbook identity exists
- odds snapshot time is before game start

NBA-02A quantifies:

- Model replay ready events: 3,710
- Model replay predictions expected: 14,840
- Price-aware moneyline events: 1,196
- Price-aware spread events: 1,196
- Price-aware total events: 1,196
- Price-aware first-half events: 0

First-half model replay is supported, but first-half price-aware replay is not
available from stored odds evidence.

## Persistence Decision

NBA-02A does not persist historical feature snapshots. The existing
`historical_feature_snapshots` table is adequate for NBA-02B canary and bulk
replay because it already supports deterministic keys, feature lineage,
as-of timestamps, leakage status and replay isolation flags. No migration is
required.

Future snapshot identity:

`basketball_nba|event|market|model|feature|NBA_HISTORICAL_REPLAY_SHADOW|feature_as_of`

Future replay predictions must remain shadow/replay rows and must not become
Current Era rows, Official Picks, production calibration rows or production
learning writes.

## Data Limitations

Box scores required for current replay: NO. Player-game, advanced and
team-game stat rows cover the current engine's required features.

Lineups required for current replay: NO. Historical pregame lineups are not
certified and must not be inferred from postgame participation.

Injuries required for current replay: NO. Historical injury state is not
certified and remains an unavailable/degraded context, not a confidence lift.

BallDontLie GOAT requirement: historical bootstrap only. The Odds API remains
the NBA odds authority for historical price evidence and future market work.

## MLB Parallel Status

MLB remains on commit `a39ce4899180f40f2e8b055149a085784ffb8f93`.
Read-only observation showed 49 bootstrap-marked rows, 0 settled bootstrap
rows, 0 calibration samples, SportsDataIO routine external calls 0 and
operations health HEALTHY. NBA-02A did not modify MLB runtime behavior.

## Next Phase

Next recommended phase:

`NBA-02B1_REPLAY_CANARY`

The canary should run a small chronological sample across early, mid and late
seasons, all supported model markets, and both model-only and price-aware
cases where available. Bulk replay should not begin until the canary proves
feature inference, persistence, settlement preview, idempotency and regime
isolation.
