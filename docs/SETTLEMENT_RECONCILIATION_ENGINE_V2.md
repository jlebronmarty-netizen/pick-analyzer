# Settlement Reconciliation Engine V2

Last updated: 2026-07-23

## Purpose

Settlement Reconciliation Engine V2 is the deterministic data-quality layer for stored prediction outcomes. It classifies every existing prediction row into an explicit lifecycle state and, when final persisted results are available, grades supported markets through `settlement-core.service.ts`.

The engine does not create predictions, alter model probabilities, call sports providers, fetch odds, generate replay rows, recalculate historical features or change Official Pick policy.

## Execution Contract

Route: `/api/settlement/reconciliation`

Modes:

| Mode | Behavior |
| --- | --- |
| `DRY_RUN` | Read-only full audit and reconciliation plan. |
| `VALIDATE_ONLY` | Local fixture validation for state transitions and idempotency guards. |
| `SINGLE_GAME` | Protected write mode for one exact `gameId`. |
| `RANGE` | Protected write mode bounded by `startDate` and `endDate`. |
| `FULL_RECONCILIATION` | Protected write mode for all loaded rows. |

All write modes are idempotent. Execution writes only settlement/lifecycle metadata on `prediction_history`; it does not mutate Current Board, Learning Brain, replay, historical feature-store rows, market pipelines, probabilities or recommendation policy.

## Data Sources

Allowed persisted sources:

- `prediction_history`
- `sport_events`
- existing settlement columns on `prediction_history`
- existing performance readers

Disallowed sources:

- external sports APIs
- new odds fetches
- paid provider quota
- Phase 2A historical feature snapshots
- inferred scores

## State Machine

V2 lifecycle states:

`Scheduled`, `Locked`, `AwaitingResult`, `Settling`, `Settled`, `Push`, `Cancelled`, `Voided`, `Historical`, `Replay`, `Shadow`, `Ignored`, `Legacy`, `Unknown`.

The production database currently has an older `prediction_history.lifecycle_status` check constraint with values `generated`, `active`, `skipped`, `closed`, `settled` and `void`. To avoid a risky constraint migration, V2 stores the exact lifecycle badge and reconciliation evidence in `settlement_details.settlement_reconciliation_v2`, while using compatible database lifecycle values.

## Reconciliation Metadata

Every V2 classification records:

- `reason`
- `timestamp`
- `source`
- `gameIdentifier`
- `eventIdentifier`
- `settlementVersion`
- `confidence`
- `lifecycle`
- `badge`
- `outcome`
- `marketRuleVersion`
- `providerCallsMade`

## Legacy And Failure Reasons

Supported terminal non-graded reasons:

- `missing_game`
- `duplicate_prediction`
- `missing_result`
- `legacy_data`
- `corrupted_identity`
- `cancelled_event`
- `unknown_mapping`
- `test_or_fixture_data`
- `shadow_prediction`
- `historical_row`
- `replay_row`
- `post_start_prediction`
- `unsupported_market`
- `market_identity_incomplete`

These classifications prevent old rows from remaining an ambiguous Pending bucket while preserving historical evidence.

## Audit Evidence

Read-only production audit on 2026-07-23:

- Predictions audited: 1,327
- Pending-like before protected V2 execution: 356
- Stored wins: 311
- Stored losses: 309
- Stored pushes: 0
- Stored voided/cancelled: 0
- Ignored/test-like by stored flags: 351
- Average stored settlement delay: 295.31 hours
- Oldest unresolved prediction: 2026-06-22T23:00:00+00:00
- External sports API calls: 0
- Remote mutations during audit: 0

Protected write execution was not run in this task. A future approved `FULL_RECONCILIATION`, `RANGE` or `SINGLE_GAME` run should report first-run mutations and a second-run zero-mutation idempotency result.

## Controlled Production Execution

Execution on 2026-07-23 completed the protected reconciliation using only persisted `prediction_history` and `sport_events` data.

- Dry-run pending under V2 definition: 707
- Planned deterministic score settlements: 0
- Planned Legacy classifications: 342
- Planned Ignored classifications: 365
- First write updated: 707
- First write failures: 0
- Second identical write updated: 0
- Pending-like rows after execution: 0
- Provider calls: 0
- External sports API calls: 0

The 707 V2 pending-like rows differ from the earlier 356 generic pending count because V2 includes 351 previously separated active/test-like rows that also required explicit terminal classification.

During execution, 500-ID event lookup batches exceeded Supabase/PostgREST request header limits in local validation. The production service now uses 100-ID event batches for settlement and performance event joins.

## Performance Recalculation

The engine returns recalculated read-side summaries for:

- accuracy
- trust
- calibration
- Brier score
- log loss
- recommendation readiness
- learning progress
- timeline
- sport summaries
- overall health

Values are null or insufficient-sample labeled when the stored data cannot support them.

## Production Isolation

V2 declares and preserves:

- prediction probabilities unchanged
- Current Board unchanged
- historical feature store unchanged
- Learning Brain unchanged
- replay generation unchanged
- Official Pick policy unchanged
- provider calls 0
