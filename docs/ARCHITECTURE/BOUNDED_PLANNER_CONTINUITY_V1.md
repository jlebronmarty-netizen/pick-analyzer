# Bounded Planner Continuity V1

Status: implemented for OR-01F.

## Policy

`planner_continuity_v1` allows one protected operating-day invocation to execute the selected action and then continue only through immediately due internal closure work.

Caps:

| Cap | Value |
| --- | --- |
| Max actions per invocation | 3 |
| Max provider actions per invocation | 1 |
| Max repeated same action identity | 1 |
| Max duration | 300000 ms |
| Max mutations per invocation | 500 |

Provider-backed actions are not chained after the first action. If planner recomputation selects another provider action, the chain stops with `SECOND_PROVIDER_ACTION_REQUIRED`.

## Action Classes

| Action | Class | Safe Continuation |
| --- | --- | --- |
| `status_refresh` | `PROVIDER_ACQUISITION` | no |
| `morning_sync` | `PROVIDER_ACQUISITION` | no second provider action |
| `midday_refresh` | `PROVIDER_ACQUISITION` | only to internal `settle` when immediately due |
| `final_refresh` | `PROVIDER_ACQUISITION` | no second provider action |
| `sync_results` | `PROVIDER_ACQUISITION` | only to internal `settle` when immediately due |
| `settle` | `INTERNAL_CLOSURE` | yes, bounded |
| `learning` | `INTERNAL_CLOSURE` derived from settlement | no standalone planner action |
| `performance` | `INTERNAL_CLOSURE` derived after settlement | no standalone planner action |
| `lock` | `INTERNAL_DERIVATION` | not enabled as OR-01F chained action |
| `replay` | `WAIT_TERMINAL` for this policy | no |
| `calibrate` | `WAIT_TERMINAL` for this policy | no |
| `no_action` | `WAIT_TERMINAL` | no |

## State Change Contract

Continuation requires material state change:

- `PRODUCT_DATA_CHANGED`: provider action changed stored product data.
- `INTERNAL_STATE_CHANGED`: internal closure changed settlement or derived state.
- `NO_MATERIAL_CHANGE`: stop.
- `UNKNOWN`: stop unless explicitly approved later.

A heartbeat-only update is not material work for planner continuation.

## Repeated Action Guard

Each action in an invocation chain has an identity:

`action:selectedDate:baseball_mlb`

If planner recomputation returns an identity that already executed in the same invocation, the route stops with `REPEATED_ACTION_GUARD`.

## Safe Chains

Market preparation:

`market refresh -> stored-market normalization/prediction generation in existing service -> recompute -> stop before second provider action or continue only to immediately due internal settle`

Result closure:

`sync_results -> settle -> derived learning/performance -> stop`

Settlement-only:

`settle -> derived learning/performance -> stop`

Internal recovery:

`stored evidence complete -> immediately due internal closure -> stop`

Do not broaden settlement eligibility. Do not settle Preview, Legacy, Replay or diagnostic rows as production. Do not change prediction formulas, Official Pick policy, Current Era, Replay or provider budgets.
