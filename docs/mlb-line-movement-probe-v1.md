# MLB Line Movement Probe V1

Last updated: 2026-07-14

## Scope

- Provider: SportsDataIO Discovery Lab MLB Odds
- Endpoint: `GET /api/mlb/odds/json/GameOddsLineMovement/78723`
- Provider calls: 1
- Concurrency: 1
- Retries: 0
- Timeout: 15 seconds
- Selected event: `baseball_mlb:mlb:sportsdataio:event:78723`
- Provider GameId: `78723`
- Event: MIL at PIT, completed, PIT 14 - MIL 5
- Event start: `2026-07-12T12:15:00+00:00`
- Candidate prediction cutoff: `2026-07-12T12:05:00.000Z`

## Sanitized Shape

- top-level type: array
- top-level count: 1
- top-level fields: `AwayRotationNumber`, `AwayTeamId`, `AwayTeamName`, `AwayTeamScore`, `DateTime`, `Day`, `GameId`, `HomeRotationNumber`, `HomeTeamId`, `HomeTeamName`, `HomeTeamScore`, `PregameOdds`, `Season`, `SeasonType`, `Status`, `TotalScore`
- nested path: `PregameOdds` array with 624 records
- timestamp fields: `DateTime`, `PregameOdds[].Created`, `PregameOdds[].Updated`
- sportsbook fields: `PregameOdds[].Sportsbook`, `PregameOdds[].SportsbookId`
- price/line fields: moneyline, point spread, point spread payout, over/under, over payout, under payout
- oldest timestamp: `2026-07-11T18:06:11.000Z`
- newest timestamp: `2026-07-12T16:14:44.000Z`

No raw provider records or secrets were stored in documentation.

## Normalization Result

- returned line-movement snapshots: 624
- normalized rows: 3,720
- inserted: 3,720
- updated/reused: 0
- rejected: 24
- duplicate logical rows: 0
- unresolved events: 0
- missing timestamps: 0
- sportsbook: `Consensus`
- unique market-selection identities: 16
- market rows:
  - moneyline: 1,248
  - run_line: 1,224
  - total: 1,248

Rows were persisted to `sports_odds_snapshots` with source-aware deterministic IDs under `sportsdataio:line_movement`, preserving the existing 90 `GameOddsByDate` rows.

## Timestamp Classification

- timestamped rows: 3,720
- safely before cutoff: 2,586
- exactly at cutoff: 0
- after cutoff but before event start: 48
- at or after event start: 1,086
- missing/ambiguous timestamp: 0
- cutoff-safe rows: 2,586
- pre-event rows: 2,634

Cutoff policy: provider timestamp `<= prediction_cutoff < event_start` is cutoff-safe.

## Downstream Lineage Validation

The approved one-game downstream validation used the existing Feature Store route actions and made 0 provider calls.

- Feature snapshots inserted on first run: 3
- Feature snapshots reused on rerun: 3
- Predictions inserted on first run: 3
- Predictions reused on rerun: 3
- Settlement: 3 wins, 0 losses, 0 pushes, 0 voids
- Duplicate deterministic keys: 0
- Duplicate prediction identities: 0
- Orphan prediction links: 0
- Recommended picks: 0
- Production-eligible rows: 0
- Production leakage rows: 0
- CLV rows claimed: 0

Selected prediction-time odds:

- moneyline: `Consensus`, home, price `-126`, timestamp `2026-07-12T12:04:59.000Z`, 1 second before cutoff
- run line: `Consensus`, home `-1.5`, price `+165`, timestamp `2026-07-12T12:04:59.000Z`, stored as shared `spread` market with `providerMarket=run_line`
- total: `Consensus`, over `7.5`, price `-118`, timestamp `2026-07-12T12:04:59.000Z`, 1 second before cutoff

Reason: the bounded validation proves the durable Feature Store -> Prediction History -> Settlement handoff can operate on timestamp-safe MLB odds for one game. It remains a quarantined technical validation sample and does not create production performance evidence, recommendations, CLV, calibration, model promotion or bankroll action.

## Expansion Packet

Recommended later expansion: yes, with explicit approval.

- maximum additional provider calls: 14
- eligible events estimate: 14
- expected rows per event from probe: about 3,720
- estimated maximum rows: about 52,080
- persistence targets: `sports_odds_snapshots`, `sports_sync_jobs`
- rollback/quarantine plan: no destructive action; rows are identifiable by `metadata.sourceEndpoint`, deterministic `line_movement` IDs and `production_eligible=false`

## Daily Pregame Capture Plan

- Morning schedule sync: 1 call for `GamesByDate`.
- Initial odds capture after markets open: 15 calls for line movement if probing each game individually, or 1 date-level `GameOddsByDate` snapshot for current consensus.
- Pregame refresh windows: 2-3 conservative passes, focused on scheduled games only.
- Final capture: one pass 10-15 minutes before first pitch by game, skipping started games.
- Injuries/availability refresh: one roster/player availability pass if approved for the day.
- Postgame results/stats: one games/results call plus team/player stats calls after completion.
- Estimated daily call envelope for a 15-game slate: about 50-70 calls, well under a 1,000-call daily limit.
- Duplicate prevention: deterministic provider-game, sportsbook, market, selection, line and provider-timestamp IDs.
- Degraded behavior: skip missing-timestamp rows, stop on non-200/transport errors, preserve existing rows and record sync-job metadata.
- Gate: keep rows quarantined until explicit production promotion approval.

Do not use 30-second polling.
