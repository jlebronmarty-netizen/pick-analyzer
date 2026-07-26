# MLB Historical Foundation V2

Status: Locally implemented as a read-only audit and fill plan.

`GET /api/data-foundation/mlb` certifies the current stored MLB historical foundation without executing provider calls, production mutations, historical odds or retrospective prediction generation.

## Current Evidence

The audit composes Sports Data Coverage Audit V2 with MLB-specific checks for:

- 2025 previous completed season coverage
- 2026 current season coverage
- teams
- players
- events
- results
- standings
- team/player/game stats
- lineups/starters
- odds snapshots
- player props
- prediction history
- feature snapshots
- provider mappings

Local validation on 2026-07-27:

- validation checks: 8/8 passed
- provider calls: 0
- remote mutations: 0
- event mappings observed: 878
- player mappings observed: 71
- stored recorded-outs prop rows: 11
- pitcher projections observed: 18
- current season coverage: available
- previous season coverage: available

Remaining honest blockers:

- `PLAYER_PROP_COMPARISON_REMAINS_SAME_EVENT_PROJECTION_GATED`
- `MLB_INJURY_COVERAGE_NOT_AVAILABLE_IN_STORED_DATA`

## Safety Position

- Production fill is not executed in this autonomous run.
- Historical odds are not called.
- Retrospective predictions are not generated.
- Same-event validation for player-prop comparisons remains enforced.
- Stored prop rows are not attached across events.

## Fill Plan

1. Prefer stored Retrosheet and SportsDataIO evidence.
2. Use Historical Import Orchestrator V2 in `PLAN_ONLY` or `DRY_RUN` mode to inspect missing windows.
3. Persist only deterministic event, team, player and starter identities after explicit approval.
4. Keep historical odds excluded unless a separate bounded entitlement/call plan is approved.
5. Reconcile inserted/updated/skipped rows and duplicate indicators after any future approved write.

## Certification

Certification markers:

`MLB_HISTORICAL_FOUNDATION_V2_PASS`

`MLB_IDENTITY_RECONCILIATION_PASS`

`MLB_NO_TEMPORAL_LEAKAGE_PASS`
