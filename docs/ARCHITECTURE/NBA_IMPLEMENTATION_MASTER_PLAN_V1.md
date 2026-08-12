# NBA Implementation Master Plan V1

Status: NBA_01A_BOOTSTRAP_READY_PENDING_STAT_SOURCE_ACCESS

Selected by: Multi-Sport Handoff V1

## Objective

Make NBA the next sport after MLB by reusing the existing NBA architecture and applying the MLB production lessons: official/free non-odds source, The Odds API exact-line odds, cutoff-safe Current Era predictions, deterministic settlement, learning closure, Current Board consistency and coverage-aware operations health.

No implementation is started by this plan.

## Reuse Summary

| Subsystem | Action |
| --- | --- |
| Sport registry | REUSE_WITH_CERTIFICATION |
| Provider adapters | REPAIR |
| Canonical teams | REUSE_WITH_CERTIFICATION |
| Players | REPAIR |
| Events | REPAIR |
| Historical importer | EXTEND |
| Feature store | EXTEND |
| Prediction engine | REUSE_WITH_CERTIFICATION |
| Calibration | REUSE_WITH_CERTIFICATION |
| Odds acquisition | EXTEND |
| Event mapping | EXTEND |
| Current Board | EXTEND |
| Line versioning | EXTEND |
| Settlement | REUSE_WITH_CERTIFICATION |
| Learning | EXTEND |
| Performance | EXTEND |
| Scheduler | REPAIR |
| Health | EXTEND |
| Provider budget | EXTEND |
| Operations UI | EXTEND |

## Phase 1 - Data Foundation + Provider Independence

Preconditions: current MLB production remains stable; no SportsDataIO reactivation.

Output: NBA source map, dependency audit, official/free source contract, read-only data inventory, SportsDataIO dependency removal plan.

NBA-01 result: `NBA_DATA_FOUNDATION_PARTIAL_MORE_IMPORT_REQUIRED`. Existing NBA work is reusable, but full historical replay remains blocked by incomplete target-season schedule/results/stats/period-score history and unapproved official/free source import.

NBA-01A result: `NBA_HISTORICAL_BOOTSTRAP_READY_PENDING_STAT_SOURCE_ACCESS`. The Odds API NBA historical coverage and conservative cost model are documented; NBA Stats public endpoints are selected as the primary non-odds stat-source candidate pending access/terms approval; NBA-02 replay scope is deterministic but no import or replay was executed.

NBA-01C-PREP result: `BALLDONTLIE_GOAT_TRIAL_EXTRACTION_READY`. BallDontLie is prepared as the candidate NBA non-odds source with a GOAT 48-hour historical bootstrap plan, 4 req/min trial-safe profile, durable raw payload manifest, checkpoint/resume contract and START boundary. No trial was activated, no API key was required, no provider call was made, no import or replay was executed and production NBA inactive remains the operating state.

Provider calls required: no, unless explicitly authorized for bounded source proof.

DB migration required: no.

Production config required: no.

Push/deploy required: docs/certification only unless runtime repair is proven.

## Phase 2 - Canonical Identity + Feature Store

Output: certified NBA team/player/event crosswalks, alias collision checks, feature snapshot contract, critical missing feature gates.

Blockers: official/free player and schedule source must be certified.

DB migration required: maybe, only for additive identity/feature lineage if existing generic tables are insufficient.

## Phase 3 - Historical Import / Reconstruction

Output: leakage-safe NBA historical events, results, team-game stats and player-game stats from approved source.

Historical scope: 2024-25 completed season first.

Provider calls required: no paid calls without authorization; prefer official/free or operator-owned data.

## Phase 4 - Progressive Historical Replay

Output: model replay for ML / Spread / Total using pregame-safe features.

Blockers: no price-aware EV/ROI unless legitimate historical price evidence exists.

## Phase 5 - Model / Calibration Certification

Output: shadow calibration, Brier/calibration buckets, market-specific sample sufficiency, reject/approve model evolution criteria.

Production promotion: no.

## Phase 6 - The Odds API Product Integration

Output: NBA core odds acquisition for ML / Spread / Total, exact-line binding, book coverage, freshness SLA, provider budget ledger.

Provider calls required: yes, requires explicit bounded authorization.

## Phase 7 - Current Era Prediction + Line Versioning

Output: NBA Current Era activation in shadow/preview, cutoff-safe persisted predictions, line-versioned re-prediction when product authority is ready.

No post-start predictions.

## Phase 8 - Results / Settlement / Learning

Output: deterministic settlement for ML / Spread / Total; first-half only after period scores certified; deduped learning labels.

## Phase 9 - Current Board / Performance / Operations

Output: NBA Current Board, Performance default scope, coverage-aware health, provider budget, scheduler status and settlement guarantee.

## Phase 10 - Natural Production Pilot + Final Autonomy Certification

Output: multi-day NBA pilot with natural scheduler proof, no hidden provider spend, no stale actionability, settlement closure and rollback readiness.

## First Executable Master Block

`NBA-01_DATA_FOUNDATION_PROVIDER_INDEPENDENCE_AND_HISTORICAL_READINESS`

This block should:

- Re-audit actual NBA runtime and database state.
- Replace or isolate SportsDataIO-era assumptions.
- Certify official/free source contracts.
- Certify canonical teams/events/player identity.
- Prepare the historical foundation for safe replay.
- Keep all prediction/recommendation surfaces preview-only.

## Product Contract

NBA product surfaces must distinguish:

- events/games
- predictions
- current candidates
- positive-EV evidence
- recommendation eligible
- Official Picks
- skipped events

Not recommended must never mean no event.

## Fail-Closed Policy

Missing mapping, missing odds, stale odds, missing critical feature, missing result, provider outage, scheduler miss and line movement without current prediction all fail closed. No old-line probability may be rebound to a new-line price.

## Budget Safety

Core odds budget: MODERATE. The Odds API only after explicit bounded call authorization.

Extra markets budget: HIGH, deferred.

Player props budget: HIGH, PHASE_AFTER_CORE.

## Retention Plan

HOT: current odds, current predictions, current scheduler evidence.

WARM: active-season features, current season results and player stats.

HISTORICAL: reconstructed seasons, replay predictions, historical feature snapshots.

ARCHIVAL: raw source snapshots and certification captures.
