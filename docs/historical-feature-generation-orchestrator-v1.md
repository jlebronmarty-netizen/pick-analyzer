# Historical Feature Generation Orchestrator V1

## Status

Completed as a provider-independent historical feature contract with runtime schema-probed durable persistence and a bounded trial write path. Dry-run planning makes zero provider calls; the approved write-mode pilot also made zero provider calls and persisted only normalized trial snapshots from existing stored records.

## Implementation

- Service: `src/services/historical-feature-generation.service.ts`
- Existing validation API extended: `GET /api/features/store/validation`
- Existing handoffs extended:
  - `/api/historical-import/plan`
  - NBA daily sync contract through `getNbaDailySyncOrchestrationContract()`
  - Daily Sync V2 through `runDailySyncOrchestratorV2()`
  - NBA backtest/calibration responses
- Persistence migration: `supabase/migrations/202607140001_historical_feature_snapshots_v1.sql`

## Snapshot Contract

The orchestrator plans deterministic historical feature snapshots with:

- sport, league, event and market
- prediction cutoff and as-of timestamp
- model version and feature-set version
- deterministic snapshot ID
- provider/source as normalized stored records only
- trial, scrambled and production eligibility flags
- feature lineage, source tables and source record IDs
- typed sections for event, team, player, standings, form, rest, injuries, lineups, odds, freshness, sufficiency, quality, unresolved mappings and production eligibility

Durable feature snapshot persistence is represented by migration `202607140001_historical_feature_snapshots_v1.sql`. Runtime readiness is based on server-side schema probing, not migration filename presence. When the configured Supabase project exposes the required table and columns, service readiness reports `ready`.

The existing `/api/features/store` route now supports a bounded `historical_feature_snapshot_write_pilot` action. The pilot is server-side, insert-only for new deterministic keys, reuses identical existing snapshots on rerun and refuses changed-lineage overwrites. It preserves season in snapshot metadata because the deployed `historical_feature_snapshots` table has no top-level `season` column. The initial verified NBA trial run inserted 15 snapshots on first execution and reused all 15 on the idempotency rerun. NBA Trial Validation Batch V1 used the same action with a 50-snapshot cap, inserted 27 market-specific trial snapshots across 9 events and reused all 27 on immediate rerun.

## Leakage Policy

Cutoff equality is inclusive: a source record observed exactly at `prediction_cutoff` is allowed. Any record observed after the cutoff is rejected. Records at or after event start are rejected.

The deterministic fixture suite covers:

- pregame record before cutoff: allowed
- record exactly at cutoff: allowed
- record one second after cutoff: rejected
- final score after event start: rejected
- postgame player stat: rejected
- injury updated after cutoff: rejected
- lineup confirmed after cutoff: rejected
- odds snapshot before cutoff: allowed
- closing line after cutoff: rejected
- trial row in production generation: rejected
- production row in trial fixture: allowed
- missing source timestamp: unavailable/unsafe
- identical regeneration: one logical deterministic persistence key
- changed lineage: distinct deterministic persistence key
- linked snapshot overwrite: rejected by policy
- trial snapshot linked to production prediction: rejected
- prediction without durable snapshot: not backtest eligible
- settled prediction with durable snapshot and valid odds: eligible when migration is applied
- ROI without price and CLV without genuine closing snapshot: blocked
- batch duplicate inputs: deduped
- partial batch failure and cancellation/resume: deterministic checkpoints preserved

Missing or ambiguous timestamps are not silently used. They produce unavailable/unsafe results and lower sufficiency.

## Handoffs

Historical Import now exposes `featureGenerationHandoff` with eligibility, required source domains, blocking missing domains, cutoff strategy, estimated counts, batch size, checkpoint strategy, persistence readiness, leakage validation readiness and backtest readiness.

Backtest input readiness is typed but blocked until durable historical feature snapshots and sufficient settled production predictions exist. Trial/scrambled rows remain excluded from real ROI, CLV, calibration and promotion metrics. Inline `prediction_history.feature_snapshot` remains legacy context, not the canonical immutable lineage store.

Daily Sync V2 now reports historical feature eligibility, write-pilot availability and immutable pregame snapshot policy. Postgame results, stats and settlement may prepare performance inputs, but they must not overwrite the original prediction-time feature snapshot.

The bounded trial prediction lineage pilot is also exposed through the existing Feature Store route. It links predictions only when a trial snapshot has valid lineage and a genuine offered price. After corrected SportsDataIO priced odds were available, runtime verification inserted 5 trial/scrambled/non-production linked predictions, settled them locally and reused all 5 on immediate rerun with 0 provider calls. NBA Trial Validation Batch V1 then scaled the same path to 27 linked, settled trial predictions across moneyline, spread and total. Production metrics remain blocked for trial rows and missing genuine closing snapshots.

## Provider Calls

Provider calls: 0.

Historical feature generation must use persisted normalized records only.
