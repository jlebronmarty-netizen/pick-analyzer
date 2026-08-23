# MLB-04D-D1 Bounded Forward Automation Implementation

Classification: `MLB_04D_D1_BOUNDED_FORWARD_AUTOMATION_IMPLEMENTATION_CERTIFIED`

MLB-04D-D1 adds the first executable-but-default-off runtime shell for MLB forward research orchestration. It plans `MORNING` capture, `FINAL_PREGAME` capture, frozen V2 scorecard evaluation, forward-ledger freezing, stored canonical result checks and postgame research evaluation. It does not activate cron, does not persist snapshots, does not create Observation #4, does not apply the forward-ledger migration and does not write predictions, Official Picks, settlement, learning, calibration, product, bankroll or notification rows.

## Execution Modes

The service supports `DRY_RUN`, `PREVIEW` and `EXECUTE` planning modes. `DRY_RUN` is the default. `PREVIEW` returns the same no-write plan surface for operator review. `EXECUTE` is intentionally unavailable in this phase and returns a fail-closed blocker even if future kill-switch names are present.

Future execution remains gated behind all of these default-off controls:

- `MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED`
- `MLB_MORNING_CAPTURE_ENABLED`
- `MLB_FINAL_PREGAME_CAPTURE_ENABLED`
- `MLB_RESEARCH_SCORECARD_ENABLED`
- `MLB_FORWARD_LEDGER_ENABLED`
- `MLB_RESEARCH_RESULT_EVALUATION_ENABLED`

All are false or unset by default. No environment values or secret values are exposed by certification artifacts.

## Planner Contracts

Per event the planner emits:

- `MORNING_CAPTURE`
- `FINAL_PREGAME_CAPTURE`
- `SCORECARD_EVALUATION`
- `LEDGER_FREEZE`
- `RESULT_CHECK`
- `RESULT_EVALUATION`

The snapshot planner reuses MLB-04B deterministic snapshot identity. For each event/snapshot type: `0` matching snapshots means `WOULD_INSERT`, `1` means `REUSE_NO_OP`, and more than `1` means `BLOCK_DUPLICATE_DEFECT` for that event. The queue is stable by start time and event id, uses per-event isolation and never broad-upserts.

The scorecard planner only becomes ready after a frozen snapshot exists. It records the MLB-04C V2 scorecard version, consumes frozen fields only and emits no probability output. Component states remain explicit for `STARTER_EDGE`, `OFFENSE_EDGE`, `BULLPEN_EDGE`, `LINEUP_EDGE`, `SPLIT_EDGE`, `CONTEXT_EDGE` and `MARKET_VALUE`; missing data is never coerced to zero.

Park identity may improve context transparency, but park identity alone must not falsely create `CONTEXT_EDGE` availability. Projected lineup evidence remains projected and must not be promoted to confirmed lineup evidence by the planner.

The certified current real completeness remains `3 / 7 = 0.4286`. The Package A automation path may plan toward `5 / 7 = 0.7143`, but that value is projected only until future persisted forward evidence proves the extra components.

## Forward Ledger Contract

D1 prepares an additive research-ledger contract and migration file at:

`supabase/migrations/202608230001_mlb_forward_research_ledger_v1.sql`

The migration is not applied in this phase. It is additive, RLS-enabled, service-role-only for writes, product-invisible and has no learning or calibration trigger.

The deterministic ledger identity includes sport, event, snapshot identity, market, selection, exact line, sportsbook, methodology version and scorecard version. Moneyline uses `line = null`; run line and total use exact numeric line identity.

Immutable pregame fields include event, snapshot, market, odds, raw probability, calibrated probability, component states/values, composite score, completeness and methodology/scorecard versions. Lifecycle fields include result, result id, settled timestamp, flat-unit profit, raw/calibrated Brier, raw/calibrated log loss and Chat directional result.

## Result And Cohort Planning

Result checks read only stored `sport_events` and `game_results`. The planner classifies rows as `WAITING_RESULT`, `RESULT_AVAILABLE`, `ALREADY_EVALUATED`, `BLOCKED_RESULT_LINKAGE` or `BLOCKED_OTHER`.

Research evaluation supports moneyline, run line and total semantics with flat 100-unit profit and raw/calibrated Brier/log loss. The Chat-Method score is directional only and is not treated as a probability, so Chat Brier/log loss remain forbidden.

Cohort checkpoints are `5`, `10`, `25`, `50` and `100`, segmented by scorecard version, market and snapshot type. Directional result ratios must not be called accuracy, and no 80% claim may be made without frozen ledger evidence.

## Isolation

Package A compatibility is preserved for starter identity/context, projected lineup context, park identity, offense context, bullpen context and market evidence. Package B and Package C extension points remain versioned and inactive for weather, injuries, props and NRFI/YRFI.

Observations #1, #2 and #3 remain frozen. Raw model, calibrated model, product recommendations, Official Pick policy, learning, settlement, SportsDataIO, NFL and NBA behavior are unchanged.
