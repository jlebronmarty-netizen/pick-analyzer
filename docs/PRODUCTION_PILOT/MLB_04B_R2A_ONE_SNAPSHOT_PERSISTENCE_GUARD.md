# MLB-04B-R2A One-Snapshot Persistence Guard Repair

Classification: `MLB_04B_R2A_ONE_SNAPSHOT_PERSISTENCE_GUARD_REPAIR_CERTIFIED`

MLB-04B-R2A repairs the deployment blocker for the first legitimate forward `MORNING` / `FINAL_PREGAME` snapshot persistence proof. It adds a narrow one-snapshot execution path without changing MLB-03 settlement, MLB-04C scorecard rules, predictions, recommendations, learning, calibration, bankroll, notifications, provider authority, NFL or NBA behavior.

## Root Cause

The deployed MLB-04B dry-run runtime was certified, but the public route used for context lineage forced `persist: false`. The older context-lineage persistence helper could write to `mlb_context_snapshots`, but did not enforce the certified MLB-04B explicit authorization guard or exactly-one row scope.

Root cause classification:

- `ROUTE_FORCES_DRY_RUN`
- `MISSING_EXECUTE_MODE`
- `MISSING_AUTH_GUARD`
- `MISSING_ROW_SCOPE`
- `MISSING_READBACK`

## Repair Strategy

The repair adds:

- `executeMlb04bOneSnapshotPersistence(...)` in `src/services/mlb-04b-research-snapshot-runtime.service.ts`
- `/api/mlb/research-snapshot` as a protected route for future bounded proof execution

The route uses the existing stored-evidence context-lineage dry-run to build the candidate snapshot payload with `allowProviderCalls: false` and `persist: false`, then delegates to the MLB-04B one-snapshot guard. The old read-only context-lineage route remains read-only.

## Write Contract

Default mode is dry-run.

Real persistence requires both:

- explicit `execute=true`
- `MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED=true`

Protected route execution also requires the existing `CRON_SECRET` authorization convention when a secret is configured.

If either execute mode or environment authorization is absent, the runtime performs zero mutations.

## Exactly-One Scope

The write path accepts exactly one candidate snapshot. It blocks:

- zero selected rows
- more than one selected row
- missing event scope
- wildcard/broad slate persistence
- unknown snapshot type

`MAX_NEW_SNAPSHOT_ROWS_PER_EXECUTION = 1`.

## Snapshot Types

Allowed write targets:

- `MORNING`
- `FINAL_PREGAME`

Explicitly blocked:

- `CURRENT_PROBE`
- unknown snapshot types

## Temporal Safety

Before any future write, the runtime requires:

- `snapshot_timestamp < target_event_start_time`
- `temporal_status = PREGAME`
- event not final/completed/closed
- event not cancelled
- component source timestamps before event start when present
- no backdating
- no retrospective reconstruction
- no post-start evidence

## Deterministic Identity

The repair uses the MLB-04B deterministic identity:

`MLB_04B_RESEARCH_SNAPSHOT_CONTRACT_V1 | baseball_mlb | event_id | snapshot_type | capture_window | MLB_CHAT_METHOD_RESEARCH_SHADOW_V1`

Pre-read behavior:

- exact matches `0`: may insert when authorized
- exact matches `1`: `ALREADY_EXISTS_REUSE_NO_OP`
- exact matches `>1`: `STOP_DUPLICATE_DEFECT`

## Write Semantics

The repair uses insert plus immediate readback. It does not use broad upsert, update or delete behavior against immutable research snapshot evidence.

## Readback Contract

Future successful insert must read back:

- `id`
- `deterministic_key`
- `event_id`
- `snapshot_type`
- `snapshot_timestamp`
- `target_event_start_time`
- `temporal_status`
- `provider_authority`
- `source_lineage`
- `components`
- `feature_values`
- `feature_lineage`
- `completeness`
- `missing_components`
- `blockers`
- `provider_calls`
- `production_eligible`
- `shadow_only`

## Idempotency

Repeating the same deterministic identity returns:

`ALREADY_EXISTS_REUSE_NO_OP`

with:

- `WOULD_INSERT = 0`
- `WOULD_UPDATE = 0`
- no new UUID row

## MORNING / FINAL Separation

For the same event, `MORNING` and `FINAL_PREGAME` deterministic identities differ because snapshot type and capture window are part of the key. Neither snapshot type can overwrite the other.

## Missing Data

Missing lineup, weather, injury, split and other uncertified evidence remains explicit missing/blocker state. Missing evidence is not converted to neutral zero.

## MLB-04C Consumability

The persisted row remains consumable by MLB-04C for research-only:

- `STARTER_EDGE`
- `OFFENSE_EDGE`
- `BULLPEN_EDGE`
- `SPLIT_EDGE`
- `LINEUP_EDGE`
- `CONTEXT_EDGE`
- `MARKET_VALUE`

MLB-04C scorecard rules were not changed.

## Security / RLS

No RLS change was made. No anon/authenticated write grant was added. The service-role path remains narrow and guarded.

## Certification Safety

Provider calls: 0

Production database mutations: 0

Prediction writes: 0

`CURRENT_ERA_SHADOW` writes: 0

Official Pick writes: 0

Settlement writes: 0

Learning/calibration writes: 0

SportsDataIO calls: 0

NFL and NBA runtime changes: 0
