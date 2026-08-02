# OE-003 Implementation Roadmap

Status: roadmap plus bounded implementation evidence. OE-003A, OE-003B, OE-003C, OE-003D and OE-003E are production-certified.

## OE-003A - Scheduler And Health Semantics

Scope: split scheduler execution health, market freshness health, provider budget health, settlement health, and product readiness.

Status: production-certified in OE-003A.

Likely files:

- `src/services/operations-health.service.ts`
- `src/services/adaptive-refresh-orchestrator.service.ts`
- MLB Operations Center components
- health validators

Migration: none expected.

Provider-call risk: none.

Mutation risk: none if read-only health contract only.

Stop condition: any required scheduler cadence change.

## OE-003B - Provider Budget Ledger Normalization

Scope: provider-specific budget pools for SportsDataIO, The Odds API, MLB Stats API and BSN source classes.

Status: production-certified in OE-003B.

Likely files:

- `src/services/provider-budget.service.ts`
- The Odds API services
- SportsDataIO services
- optional additive budget ledger migration if no canonical source exists

Migration: none required for OE-003B; existing `operating_day_lifecycle_events` and `sports_sync_jobs` app-ledger evidence is normalized read-only.

Provider-call risk: low; live quota-header proof must be explicitly capped.

Mutation risk: low if budget ledger writes are additive bookkeeping.

Stop condition: unknown reset semantics required for enforcement but not proven.

## OE-003C - Per-Event Lifecycle State

Scope: derive a canonical event lifecycle state for event-level scheduling visibility.

Status: production-certified in OE-003C.

Likely files:

- `src/services/event-lifecycle-state.service.ts`
- `src/app/api/operations/event-lifecycle/route.ts`
- `src/services/mlb-game-lifecycle.service.ts`
- `src/services/mlb-operations-center.service.ts`
- `src/app/mlb-operations/page.tsx`

Migration: none required for OE-003C; lifecycle state is dynamically derived to avoid creating a second event-status source of truth.

Provider-call risk: none.

Mutation risk: none in OE-003C.

Stop condition: any need to execute provider refresh, result import, settlement, learning, prediction generation, scheduler cadence change or destructive schema change.

## OE-003D - Event-Level Refresh Planner

Scope: deterministic event-priority planner with P0-P4 bands.

Status: production-certified in OE-003D shadow mode.

Likely files:

- `src/services/event-refresh-planner.service.ts`
- `src/app/api/operations/event-refresh-plan/route.ts`
- `src/services/adaptive-refresh-orchestrator.service.ts`
- `src/services/mlb-operations-center.service.ts`

Migration: none expected.

Provider-call risk: none in OE-003D because planner mode is `SHADOW`.

Mutation risk: none in OE-003D.

Stop condition: active planner execution would increase cadence before budget proof.

## OE-003E - Canonical Acquisition Deduplication

Scope: activate the canonical acquisition boundary for SportsDataIO MLB current operating-day pregame odds while preserving per-event planning and provider-efficient batching.

Status: production-certified in OE-003E for SportsDataIO MLB current operating-day pregame odds.

Likely files:

- `src/services/canonical-acquisition.service.ts`
- `src/services/event-refresh-planner.service.ts`
- `src/services/adaptive-refresh-orchestrator.service.ts`
- `src/services/mlb-operations-center.service.ts`
- `src/app/mlb-operations/page.tsx`

Migration: none required; existing `sports_odds_snapshots` and `sports_sync_jobs` are reused.

Provider-call risk: bounded to one SportsDataIO MLB date-level odds request during production certification if all guards pass.

Mutation risk: idempotent `sports_odds_snapshots` upsert plus `sports_sync_jobs` evidence only.

Stop condition: provider credentials, budget authorization, deduplication, P0 closure, post-start guard or reserve protection blocks active execution.

Scope: ensure all product surfaces read stored canonical snapshots and do not trigger separate acquisition.

Likely files:

- `src/services/current-board.service.ts`
- `src/services/dashboard-today.service.ts`
- product workspace/home readers

Migration: none expected.

Provider-call risk: none.

Mutation risk: none.

Stop condition: evidence shows a surface requires provider data directly.

## OE-003F - Product Freshness SLA Integration

Scope: apply stale/downgrade/block behavior per surface without changing prediction math.

Status: PASS pending production deployment.

Implemented `product_freshness_sla_v1` across Current Board, Today/Homepage, Rent Play, Moneyline Bet, Smart Parlay, Official Picks, Most Likely, Best Value, Betting Workbench, Game Intelligence, AI Bet Finder and MLB Operations. Market freshness uses stored provider/source timestamps only; page/API fetch time and `generatedAt` are not substituted.

Likely files:

- homepage betting plan
- betting workspace
- Current Board
- Today dashboard

Migration: none.

Provider-call risk: none.

Mutation risk: none.

Stop condition: unsupported markets or live betting would be promoted.

## OE-003G - Multi-Sport Rollout

Scope: extend event lifecycle and budget pools to NBA, NFL, NHL, Soccer, Tennis, UFC and BSN only where canonical events/results exist.

Likely files:

- sports config
- The Odds API services
- multi-sport current board/segments
- source-specific validators

Migration: additive only if canonical event crosswalk fields are missing.

Provider-call risk: medium; must use dry-run and stored evidence first.

Mutation risk: low to medium depending on canonical event creation.

Stop condition: sport lacks canonical event crosswalk.

## OE-003H - Operations Center And Mission Control Integration

Scope: visualize provider pools, event priorities, next action, reserves, and readiness denominators.

Likely files:

- Operations Center components
- dashboard navigation
- operations APIs

Migration: none.

Provider-call risk: none.

Mutation risk: none.

Stop condition: UI requires new operational behavior rather than read-only display.

## OE-003I - Production Certification

Scope: certify end-to-end event-level planning in production without provider waste.

Validation:

- scheduler health;
- adaptive refresh status;
- provider budget status;
- current board freshness;
- Today/Daily Brief;
- settlement guarantee;
- performance;
- per-provider call ledger;
- zero prediction/math/policy changes.

Deployment: required only after runtime changes.

Stop condition: production evidence shows provider budget, scheduler, or settlement regression.
