# OE-003 Implementation Roadmap

Status: roadmap only. OE-003A has not started.

## OE-003A - Scheduler And Health Semantics

Scope: split scheduler execution health, market freshness health, provider budget health, settlement health, and product readiness.

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

Likely files:

- `src/services/provider-budget.service.ts`
- The Odds API services
- SportsDataIO services
- optional additive budget ledger migration if no canonical source exists

Migration: additive only, if needed.

Provider-call risk: low; live quota-header proof must be explicitly capped.

Mutation risk: low if budget ledger writes are additive bookkeeping.

Stop condition: unknown reset semantics required for enforcement but not proven.

## OE-003C - Per-Event Lifecycle State

Scope: persist or derive a canonical event lifecycle state for event-level scheduling.

Likely files:

- `src/services/mlb-game-lifecycle.service.ts`
- `src/services/adaptive-refresh-orchestrator.service.ts`
- `sport_events` metadata readers

Migration: additive only if existing metadata cannot hold lifecycle evidence.

Provider-call risk: none.

Mutation risk: possible lifecycle metadata writes.

Stop condition: any destructive schema change.

## OE-003D - Event-Level Refresh Planner

Scope: deterministic event-priority planner with P0-P4 bands.

Likely files:

- `src/services/adaptive-refresh-orchestrator.service.ts`
- new event planner service
- operating-day route integration

Migration: none expected.

Provider-call risk: bounded and budget-guarded.

Mutation risk: existing operating-day writes only.

Stop condition: planner would increase cadence before budget proof.

## OE-003E - Canonical Acquisition Deduplication

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
