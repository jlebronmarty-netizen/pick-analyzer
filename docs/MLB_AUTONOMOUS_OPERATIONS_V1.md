# MLB Autonomous Operations V1

Date: 2026-07-29

Status: COMPLETE

MLB core operations are automated through the existing protected operating-day pipeline. The write-capable scheduler is GitHub Actions on `*/10 * * * *`, calling `/api/cron/operating-day?dryRun=false`. Vercel crons remain disabled.

## Scope

- Sport: MLB only.
- Execution owner: GitHub Actions Production Operating Day Scheduler.
- Observer owner: GitHub Actions Production Operating Day Heartbeat and `/api/operations/mlb-autonomous-operations`.
- Runtime owner: adaptive refresh execution bridge over the existing operating-day service.
- Provider calls: only when adaptive status marks a provider-backed domain `DUE_NOW` and provider budget allows.

## Daily Operation

MLB daily operation is currently possible for core workflows: slate discovery, odds freshness, feature/prediction refresh through the existing pipeline, Current Board read-through, AI Briefing read-through, result sync, settlement, derived learning evidence and Performance visibility.

Automatic model training does not occur.

## Recovery

If the computer restarts, cron misses, network fails or a provider outage occurs, the next scheduler tick reconstructs state from stored events, odds snapshots, predictions, results and lifecycle ledger rows. Provider action locks expire, deterministic snapshot IDs prevent duplicate odds rows, `game_results` upserts prevent duplicate finals, and already-settled guards prevent duplicate settlement.

## Certification Markers

- `MLB_AUTONOMOUS_OPERATIONS_PASS`
- `ADAPTIVE_REFRESH_ENGINE_PASS`
- `DAILY_CONTINUITY_PASS`
- `PROVIDER_BUDGET_PASS`
- `SYSTEM_HEALTH_PASS`
- `NO_MODEL_TRAINING_PASS`
- `NO_MODEL_WEIGHT_MUTATION_PASS`
- `NO_PROBABILITY_CHANGE_PASS`
- `NO_TRUST_CHANGE_PASS`
- `NO_SETTLEMENT_CHANGE_PASS`
- `NO_PROVIDER_WASTE_PASS`
- `NO_CERTIFIED_PLATFORM_REGRESSION_PASS`

No prediction engine, settlement rule, probability, confidence, Trust, Official Pick policy, model weight or retrospective prediction behavior was changed.
