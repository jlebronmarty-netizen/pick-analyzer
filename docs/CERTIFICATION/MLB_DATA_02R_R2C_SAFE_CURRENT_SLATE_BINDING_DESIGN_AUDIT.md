# MLB R2C Safe Current-Slate Binding Design Audit

Certification: `MLB_DATA_02R_R2C_SAFE_DESIGN_SPLIT_BINDING_INVENTORY_CERTIFIED`

READ-ONLY DESIGN PHASE.

- Executor audited: `scripts/mlb-data-02r-r2a-live-refresh-executor.mjs`
- Executor changed: NO
- Provider calls: 0
- Odds calls: 0
- Production DML: 0
- Production DDL: 0
- Official Pick writes: 0
- Cron changes: 0
- Automation changes: 0
- Synthetic PASS paths: NO

## Design Finding

The R2A executor is not safe for R2B live execution as-is. The hidden global hold
`MLB_DATA_02R_R2_ALLOW_CERTIFIED_COMPONENT_EXECUTION` can unlock broad component
commands, including `02H --execute-ingest --r2-resume`, `02H --execute-features`,
and downstream persistence scripts that do not accept an executor-provided frozen
`game_pk` allowlist.

## Required Repair Shape

R2B should use a frozen context carrying `run_id`, `run_date`, `run_as_of`,
`execution_package_sha`, `eligible_game_pks`, `blocked_game_pks`,
`game_start_times`, `starter_states`, contract digests, provider budget, per-stage
DML caps and checkpoint state.

Every production-capable stage needs a thin wrapper that proves all planned rows
are contained in the frozen `eligible_game_pks` set before any live write can be
authorized. Broad legacy component commands must remain inventory-only until
wrapped.

## Retry Readiness

`MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_RETRY_READY = NO`

R2B should not be retried until the wrapper implementation and real non-synthetic
scope tests are separately authorized and certified.
