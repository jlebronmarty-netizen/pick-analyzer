# E2E Data Lineage V2

Status: PI-03 audit artifact

## Canonical Data Source Map

| Table / entity | Writer(s) | Reader(s) | Identity | Latest row rule | Production scope |
|---|---|---|---|---|---|
| `sport_events` | provider sync, scheduler/import paths | Current Board, dashboard-today, lifecycle, planner, settlement, performance | `id`; provider IDs in `provider_ids` | Event `start_time` and provider status | Canonical schedule/event identity. |
| `sports_odds_snapshots` | `canonical-acquisition.service.ts`, provider import paths | Current Board, market alignment, freshness, closing-line, coverage | `id`; event/market/outcome/line/sportsbook/timestamp | `snapshot_time desc`, bounded by current display window for Current Board | Canonical market evidence store. |
| `prediction_history` | prediction generation / prospective preview / current epoch flows | Current Board, Performance, settlement, learning, dashboard | `id`; versioning fields `is_current`, `prediction_group_key`, epoch keys | Current Board filters `is_current=true`, active epoch, non-null probability and odds | Canonical persisted production prediction store. |
| `game_results` | result sync / result import | settlement guarantee, lifecycle, settlement state | game/event ID | authoritative result row with scores/status | Canonical result evidence for settlement. |
| `sports_sync_jobs` | scheduler/provider/result jobs | operations health, provider budget, learning lifecycle | job ID / metadata | latest completed job by job type and provider | Execution evidence ledger. |
| `historical_feature_snapshots` | feature generation / historical/replay paths | prediction history refs, model intelligence | deterministic key, ID | immutable snapshots | Feature evidence and replay history; production rows link when available. |
| `ai_performance_snapshots` | performance daily update | performance services | scope/sport/date/model | latest snapshot date | Durable performance memory when present. |
| `prediction_epochs` | migration seed / governance | Current Board, Performance, Mission Control | `epoch_key`, `id` | active epoch status | Current V2 production era boundary. |
| `universal_projection_history` | projection engines/replay | replay and projection surfaces | idempotency key | latest generated/projection metadata | Separate from Current Board production predictions. |
| `user_wagers`, `user_wager_legs` | authenticated user APIs | betting workspace | user ownership + client ID | user-owned rows only | Personal ledger; not model lineage. |

## Provider Acquisition Path

`Vercel Cron -> /api/cron/operating-day -> adaptive-refresh-orchestrator -> event-refresh-planner -> provider-budget.service -> canonical-acquisition.service -> SportsDataIO GameOddsByDate -> sportsdataio-mlb-normalization.service -> sports_odds_snapshots upsert -> sports_sync_jobs/provider budget evidence -> Current Board read-through`.

Repository evidence:

- `.github/workflows/production-operating-day.yml` remains fallback.
- `vercel.json` defines primary cron.
- `canonical-acquisition.service.ts` limits MLB active acquisition to SportsDataIO, one date-level GameOddsByDate request, budget lock, normalization, and `sports_odds_snapshots` upsert.
- `current-board.service.ts` reads `sports_odds_snapshots` after loading current `prediction_history` rows.

Production evidence from August 8, 2026:

- Current Board `latestOddsTimestamp`: `2026-08-08T20:37:19.390Z`.
- Current Board `latestOddsSourceTimestamp`: `2026-08-08T16:37:01.000Z`.
- Event refresh plan reports 15 active events, all due now, with source market ages around 1120 minutes for event-plan source timestamps.
- Provider budget endpoint returned HTTP 200 and no certification provider calls were made.

## Market Identity Contract

Canonical MLB market identity requires:

`sport_key + game_id/event_id + market + period + normalized selection/side + exact line + sportsbook scope`.

Current implementation details:

- Prediction market `run_line` is canonicalized to product `spread`.
- Odds market `spread` is canonicalized back to `run_line` for odds lookup.
- Moneyline requires `line === null`.
- Spread/run line and total require exact numeric line match within `0.001`.
- Selection must match normalized side/outcome (`home`, `away`, `over`, `under`) or the literal selection.
- Current Board chooses latest safe odds only after excluding invalid price, invalid line, post-cutoff, live, alternate, stale, or post-start evidence.

## Exact Market Trace Findings

### ARI Run Line Candidate

Production example:

- Event: `baseball_mlb:mlb:sportsdataio:event:79041`
- Matchup: `LAD @ ARI`
- Displayed candidate: `ARI +1.5 Run Line`
- Prediction ID: `5c2a4e28-3afe-54cf-83da-89cdee66f9b3`
- Displayed probability: `74.86`
- Displayed odds: `null`
- Source selection in market alignment: `LAD -1.5`
- Source odds: `+111`
- Odds snapshot ID: `baseball_mlb:mlb:sportsdataio:game_odds:79041:22:36151122:spread:away:-1.5:2026-08-08t16_37_01.000z`
- Provider source timestamp: `2026-08-08T16:37:01.000Z`
- Snapshot ingested around: `2026-08-08T20:37:19Z`

Classification: `PRICE_EXISTS_DIFFERENT_SIDE`.

Why Odds N/A: Current Board stores and price-binds the source prediction side. The product then displays the higher-probability binary complement as the canonical outcome, but `attachCanonicalOutcomeContracts` sets `canonicalPrice` to `NO_OPPOSITE_PRICE` for complement-derived outcomes instead of looking up the opposite-side odds row.

### Priced Total Candidate

Production example:

- Event: `baseball_mlb:mlb:sportsdataio:event:79044`
- Matchup: `TOR @ PHI`
- Market: `total`
- Selection: `Under`
- Line: `10`
- Odds: `-117`
- Prediction ID: `7699896f-b3cf-5d0d-9f94-324e9d723fcc`
- Probability: `41.28`
- Confidence: `43.64`

Classification: `IDENTITY_MATCH` when the displayed side equals the stored prediction side and exact line.

### Moneyline Odds N/A Candidate

Production example:

- Event: `baseball_mlb:mlb:sportsdataio:event:79041`
- Matchup: `LAD @ ARI`
- Displayed candidate: `ARI Moneyline`
- Prediction ID: `51ad15d4-f618-5d0e-9e64-8c67e6d9bcf5`
- Displayed probability: `70.97`
- Displayed odds: `null`
- Source selection: `LAD`
- Source odds: `-199`

Classification: `PRICE_EXISTS_DIFFERENT_SIDE`.

## Prediction Rebinding Behavior

Current behavior:

1. `prediction_history` stores the model row, original side, odds, line, and `odds_timestamp`.
2. Current Board reads only rows with non-null stored `prediction_history.odds`.
3. Current Board attempts to rebind a newer safe `sports_odds_snapshots` row using the stored prediction side and exact line.
4. If the computed highest-probability canonical outcome is the binary complement, product display flips the side.
5. The complement side does not receive a second price lookup.

Result: some candidates correctly retain model probability but show `Odds N/A` even though the market has a price for the opposite/source side and may also have a provider price for the displayed complement side.

## Freshness Lineage

Canonical timestamp lineage:

`provider/source market timestamp -> sports_odds_snapshots.provider_timestamp/snapshot_time -> snapshot capture metadata -> Current Board selected market evidence -> market alignment display freshness -> product freshness SLA actionability -> UI`.

Competing contracts:

| Contract | Timestamp basis | Consumer | Actionability effect |
|---|---|---|---|
| Snapshot/display freshness | `metadata.capturedAt`, `created_at`, `updated_at`, then source timestamp | Current Board display summary, market alignment | Can show `FRESH` when capture is recent. |
| Product Freshness SLA | provider/source market timestamp | Homepage, Current Board, Most Likely, Best Value, Betting Workspace, Official Pick surfaces | Blocks stale rows as `WAIT_FOR_REFRESH`. |
| Operations freshness | planner/lifecycle source timestamps | MLB Operations, event refresh plan | Drives refresh urgency. |

Safety result: stale provider/source evidence was not actionable in production evidence. Product Freshness SLA reported 36 of 36 current candidates as `STALE` and `WAIT_FOR_REFRESH`, including decision surfaces.

## Result, Settlement, Learning, Performance

Production Performance evidence:

- Current Era canonical predictions: `234`.
- Current Era settled canonical rows: `171`.
- Today canonical predictions: `45`, settled: `0`, pending: `45`.
- Yesterday canonical predictions: `42`, settled: `24`, pending: `18`, wins: `13`, losses: `11`, pushes: `0`.
- Recommendation eligible: `0`.
- Actionable: `0`.
- Official Pick eligible: `0`.

Settlement guarantee evidence:

- Endpoint returned HTTP 200.
- `providerCallsMade: 0`.
- `remoteMutationsMade: 0`.
- Settlement guarantee exposes blocked/ready/silent-pending counters.

The current audit did not prove a silent pending settlement defect. The unresolved prior-day rows require lifecycle classification in settlement guarantee/performance scope rather than manual settlement.

