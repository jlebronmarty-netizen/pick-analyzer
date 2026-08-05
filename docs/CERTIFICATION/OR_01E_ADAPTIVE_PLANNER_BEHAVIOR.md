# OR-01E Adaptive Planner Behavioral Audit

Status: `MIXED_SCHEDULER_AND_PLANNER_DEFECT`

Starting commit: `52942fd141f55823903220eeaf1340435792cfb5`

## Verdict

OR-01E proves that Pick Analyzer has both a scheduler delivery problem and a planner continuity problem.

GitHub scheduled delivery remains irregular after OR-01D. Separately, the protected operating-day route intentionally executes a bounded planner loop that continues only after `sync_results` or `settle`. Market actions such as `midday_refresh`, `morning_sync` and `final_refresh` stop after one action, so they depend on the next external scheduler tick for downstream result sync, settlement, learning and Performance continuity.

No scheduler migration was started. No provider budget, scheduler cadence, prediction formula, Official Pick policy, settlement rule, learning rule or model behavior changed.

## Planner Actions

| Action | Class | Provider | Normally Followed By |
| --- | --- | --- | --- |
| `status_refresh` | external status/results | `mlb_stats_api` | `sync_results` or `settle` |
| `morning_sync` | external market acquisition | `sportsdataio` | later market/result action |
| `midday_refresh` | external market acquisition | `sportsdataio` | external wait or result sync |
| `pregame_refresh` | compatibility alias | mapped to canonical refresh actions | canonical refresh evidence |
| `final_refresh` | external market acquisition | `sportsdataio` | lock or live/final monitoring |
| `sync_results` | external result import | `mlb_stats_api` | `settle` |
| `settle` | internal settlement | internal | learning and Performance update |
| `learning` | derived post-settlement evidence | internal | `performance` |
| `performance` | derived post-settlement evidence | internal | archive/no action |
| `prewarm` | unsupported observational alias | none | `morning_sync` when active |
| `no_action` | terminal fallback | none | next scheduler observation |

Canonical intended lifecycle:

`discovery -> market_refresh -> prediction_generation -> lock -> live_or_final -> result_sync -> settlement -> learning -> performance -> archive`

## Selection Algorithm

Canonical function: `src/services/adaptive-refresh-orchestrator.service.ts` `executableActionFromStatus`.

The planner selects exactly one global action from the current status snapshot. Priority is:

1. settlement
2. active market refresh preempting older missing-result recovery when no settlement-ready rows exist
3. results
4. pregame odds
5. odds
6. schedule
7. supported fallback `nextAction`
8. `no_action`

Event-level planning exists for market refresh, but execution collapses into one date-level canonical acquisition.

## Route Execution Policy

Protected route: `/api/cron/operating-day`

Maximum actions per invocation: `3`.

Continuation-eligible actions: `sync_results`, `settle`.

Market-refresh actions are not continuation eligible. This is safe under a reliable 10-minute scheduler, but incompatible with the observed 1-3 hour GitHub delivery gaps because every market action can consume a whole external tick before the next downstream action is even considered.

## Recent Invocation Finding

Recent ledger evidence from OR-01B through OR-01D repeatedly showed `midday_refresh` as the selected protected action, including the scheduled proof invocation `2b3900d1-4789-414d-9116-3bd151e07ae5` at `2026-08-05T14:27:33.731+00:00`. This supports the mixed finding: scheduler delivery is unreliable, and market-refresh completion does not continue the route into the next planner step.

## Starvation Findings

| Scenario | Expected Selection | Risk |
| --- | --- | --- |
| active odds stale + old missing results | `midday_refresh` | Known |
| active odds fresh + old missing results | `sync_results` | Low |
| active markets closed + results missing | `sync_results` | Low |
| results imported + settlement ready | `settle` | Low |
| settlement complete + learning due | `no_action` or post-settlement derived update | Medium |
| heartbeat due only | `no_action` | Low |
| future slate prewarm | `morning_sync` when active | Medium |
| multiple dates with recovery debt | oldest ready/missing unless active preemption applies | Medium |

## One-Action Policy

Classification: `INTENTIONAL_BUT_INCOMPATIBLE_WITH_REQUIRED_CADENCE`.

At a strict 10-minute cadence, a five-step lifecycle can require roughly 40-50 minutes when each step needs a separate external tick.

At the observed GitHub cadence of 1-3 hours, the same lifecycle can stretch to 5-15 hours, before skipped ticks.

## Action Trace API

New protected read-only route:

`/api/operations/planner-trace`

The route requires bearer authorization when `CRON_SECRET` is configured. It does not accept secrets in query parameters. Reads are bounded and expose planner state, action inventory, route policy, recent invocation summaries, starvation warnings and deterministic simulations.

Provider calls: `0`.

Remote mutations: `0`.

## Repair Decision

Planner behavior was not changed in OR-01E. The phase adds traceability and certification evidence only because changing continuity for provider-backed actions would be a separate architecture decision. A future bounded repair may safely target internal/postgame chaining or a scheduler migration, but Production Pilot Week remains blocked until sustained execution is healthy.

## Mission Control

MC-08H remains `PRODUCTION_READINESS_BLOCKED`.

Production Pilot Week remains `NOT_READY`.

MC-03 remains `NOT_STARTED`.

Final classification: `MIXED_SCHEDULER_AND_PLANNER_DEFECT`.
