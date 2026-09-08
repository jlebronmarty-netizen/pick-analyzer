# MLB autonomous operational mission: authorized DDL and sanitized repair

The exact feature-snapshot uniqueness DDL is applied and certified. The operational mission and R2T-R3 remain incomplete; live containment stays active.

## Implementation and validation

The existing R2I adapter preserves real physical feature columns and native provenance. It resolves each planned entity snapshot to an independently read canonical UUID, rejects ambiguous game-level binding, verifies entity/version/date/payload, and rejects missing readback. Real private replay verifies 76-value persistence parity, unchanged Champion inference, legitimate empty batter behavior, zero-insert reuse and containment. No source rows or feature-value arrays are included here.

The original 51 checks passed before authorization. Two additional disposable PostgreSQL checks validate exact rollback before revisions and atomic rollback rejection after conflicting revisions. A separate private historical batter input tests that domain's schema without adding batter dependence to moneyline V1. These inputs remain outside the repository.

The public structural schema manifest contains only table/column/index/constraint definitions required to reproduce the SQL tests. It contains no database connection identity, raw samples, player records, sample payloads or full operational query results.

## Authorized production DDL

The user authorized the exact file [MLB_OPERATIONAL_FEATURE_SNAPSHOT_UNIQUENESS_PROPOSED.sql](MLB_OPERATIONAL_FEATURE_SNAPSHOT_UNIQUENESS_PROPOSED.sql). Its SHA256 remains `3f2df0f2baf8b4cd405bc10560c47eadc143198df85a80fb3577b4b03d5b1f46`; no material or byte changes were made.

Fresh preflight matched all expected original indexes and constraints. The atomic migration replaced only documented uniqueness constraints/indexes. Independent readback verifies 118,064 rows before and after with unchanged full-row digests, zero orphan snapshot references, all 40 foreign-key/primary-key/check constraints preserved, and all 23 resulting indexes valid. Six indexes enforce native per-snapshot uniqueness; four preserve legacy NULL-target uniqueness; seven retain native lookups.

No table/column drop, TRUNCATE, DELETE, data rewrite, feature/model/preprocessing/policy change or row DML occurred. Production DDL consists of this one authorized migration. [DDL certification](MLB_OPERATIONAL_FEATURE_SNAPSHOT_UNIQUENESS_DDL.json) contains only aggregate/structural results.

## Reproduction

Use an OS temporary validation directory containing pinned `@electric-sql/pglite@0.3.14`. Set `R2S_VALIDATION_DIR` to that absolute path, `R1_READ_CACHE` to an authorized external certified raw-read cache, and `BATTER_READ_CACHE` to an authorized external schema sample containing the daily row and corresponding snapshot. Do not put either private input in the worktree. The R1 replay validates the existing certification digest. Run:

```powershell
node --import ./scripts/mlb-data-02r-r2s-certification-guard.mjs scripts/mlb-data-02r-r2t-real-persistence-validate.mjs
node --import ./scripts/mlb-data-02r-r2s-certification-guard.mjs scripts/mlb-operational-feature-schema-validate.mjs
npm.cmd run build
```

The guard directs generated evidence to the external directory and blocks production writes/provider calls. Missing private inputs fail closed; there is no synthetic substitute for the real replay. The structural revision probes run only in disposable PostgreSQL and are not live evidence.

## Publication and preservation

The user explicitly authorizes an amended/replacement sanitized commit and normal push. Remove the raw sample from the unpublished commit's tree and ancestry before publication; do not publish the formerly blocked commit as a parent. Preserve the implementation, SQL, validators, audit conclusions and existing 19 inherited changes. No production data is changed for sanitization. No force push is authorized.

All sports-provider calls in this mission remain zero; the Odds API mission budget remains 20. Live refresh, settlement and automation have not run. Existing Champion V1, the exact 76-feature contract and Policy V1 remain unchanged.

## Rollback and recovery

The [rollback SQL](MLB_OPERATIONAL_FEATURE_SNAPSHOT_UNIQUENESS_ROLLBACK.sql) is validated locally. It recreates original singleton constraints/indexes and removes only their replacements in one bounded transaction. Before revision rows exist, tests confirm exact catalog restoration and unchanged data. After conflicting revisions exist, unique-index creation fails and the transaction preserves all rows.

Production read-only rollback preflight currently finds zero conflicts across the eleven restored uniqueness definitions. No production rollback was executed. Recheck this immediately before any separately authorized rollback; never delete immutable rows to make rollback succeed.

Continue the existing mission after sanitized publication: bind revision-aware snapshot-pinned reads and deterministic identities, finish all-game real execution/checkpoints, eliminate the contained fixture call graph, and certify R3 before any live run. DDL success alone does not certify live readiness. Thereafter follow the standing live/repeatability/automation/settlement/Today order with the original budgets and guards.
