# R6 durable runtime state: Gate 2 stop

Verdict: **MLB_DATA_02R_R6_BLOCKED_DDL_REQUIRED**.

Starting package: `661377ed7f08838033c71bb426be4b6c03892238`. Vercel Cron and Vercel Production Functions remain the selected scheduler and host. No alternate host, scheduler or business-logic engine was introduced.

## Existing durable-state inventory

Production catalog inspection used SELECT only, including columns, constraints, RLS, effective privileges and candidate tables. No production row samples were read or published.

| Candidate | Classification | Finding |
| --- | --- | --- |
| `sports_sync_jobs` existing operational telemetry | REUSE_DIRECTLY | Existing bounded telemetry remains valid for aggregate observability. |
| `sports_sync_jobs.metadata` as private lease/checkpoint/budget authority | REQUIRES_ADDITIVE_SCHEMA | JSONB and primary key are structurally usable, but RLS is disabled, authenticated has SELECT, and anon/authenticated retain TRUNCATE. A private server-only state boundary cannot be established by application code alone. Securing this shared table requires DDL and may affect existing consumers. |
| `historical_import_checkpoints` | NOT_SUITABLE | Historical import/file semantics, constrained checkpoint levels and registry FKs; same unprotected client privileges. Do not repurpose historical import state. |
| `operating_day_recommendation_locks` | NOT_SUITABLE | Immutable recommendation lock data, not an execution lease; preserve original decisions. |
| `pick2_model_training_runs`, `pick2_model_validation_runs`, `mlb_forward_research_ledger` | NOT_SUITABLE | Dedicated model/research records, not scheduler coordination; preserve semantics and histories. |
| Supabase-managed `auth` state tables | NOT_SUITABLE | Platform-owned authentication data; unrelated to MLB execution. |
| Canonical raw/native/feature tables | REUSE_DIRECTLY | Retain authoritative evidence and deterministic identities here; checkpoints reference them rather than duplicate raw payloads. |
| Existing `provider-budget.service.ts` action locks | NOT_SUITABLE | Process-local Map, not a cross-instance lease. |
| Existing R2 private filesystem run store | NOT_SUITABLE | Proven isolated-instance lock/budget/checkpoint incompatibility; private evidence is preserved for trusted migration/recovery. |
| Existing telemetry/UI projections | EXTEND_APPLICATION_LOGIC_ONLY | After durable state is available, expose sanitized aggregates without parallel calculation logic. |

This is not a claim that Postgres JSONB or compare-and-swap cannot represent the state. The rejected no-DDL path cannot provide the required private authority using the audited shared tables' current security boundary. Changing their grants/RLS would itself be production DDL. The least disruptive proposal adds one dedicated table and leaves every existing table and grant intact.

## Exact proposed migration

`supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql`

Normalized SHA-256: `b8e140c04fdb20404380d368e7ed27ba592934d369072aea3be1785df5331036`.

The migration creates only `public.pick2_mlb_runtime_state` and its primary key/check constraints, enables RLS, removes all default privileges on that new table from PUBLIC/anon/authenticated/service_role, then grants service_role SELECT/INSERT/UPDATE. Production confirms service_role has BYPASSRLS. No client policy, RPC, trigger, extension, scheduler, provider, model, feature or existing-table change is included. The file runs in one transaction and intentionally fails if the target already exists.

The table supports one mission identity, one global coordinator lease identity, and deterministic per-run identities. It includes revision/fence columns, holder and lease times, frozen package/date/as-of, counters, compact checkpoint metadata and DML accounting. Lease duration is limited to 15 minutes. Checkpoint JSON is limited to 65,536 serialized PostgreSQL text bytes and DML metadata to 16,384 bytes. Per-run ceilings are MLB 50, Statcast 100 and Odds 1; mission Odds is constrained to 2..20. These are storage constraints, not a claim of implemented atomic reservations or runtime fencing.

No seed DML is included. The production Odds ledger remains 2/20 in its existing trusted private evidence. Initial durable seeding must later verify that evidence and preserve its value, with bounded DML/readback. The proposal does not copy production samples, raw Statcast, credentials or large checkpoint payloads.

## Local validation

`scripts/mlb-operational-r6-schema-validate.mjs` applies the exact SQL to disposable PGlite PostgreSQL with realistic default client grants. **32 checks pass**: existing sentinel preserved, no migration seed rows, RLS, denial of client SELECT/INSERT/UPDATE/DELETE/TRUNCATE, service-only intended operations, no service DELETE/TRUNCATE, mission reset/cap rejection, run identity, provider ceilings, object/size limits and lease shape/duration constraints.

Reproduce with `R6_PGLITE_MODULE` set to the absolute path of the existing external PGlite `dist/index.js`, then `node scripts/mlb-operational-r6-schema-validate.mjs`. Inputs are synthetic test-only metadata; no provider or production connection exists in the validator. Results are retained in a private OS-temp directory.

Production SELECT confirms the proposed table is still absent. Production DDL, production DML and sports-provider calls in this phase are all zero. No lease, cross-instance resume, representative full-run checkpoint, Function entrypoint, production dry invocation or Cron activation is certified by this test.

## Approval and recovery boundary

The user's R6 Gate 2 says: “If additive production DDL is truly necessary: prepare exact migration and STOP for separate authorization before applying it.” This audit stops at that boundary. Gates 3–21 remain pending.

After authorization: recheck the exact migration digest, target absence and privileges; apply only this SQL; read back schema/RLS/grants/zero seed rows; then implement and certify the durable transaction adapter and the existing R2 Function binding. Fencing must cover lease recovery, provider reservations, checkpoints and write intent, not merely lock acquisition. Canonical evidence hydration/chunking and deployment-manifest package verification still require implementation and regression certification.

Rollback before COMMIT is transactional. After successful creation, the non-destructive rollback is to keep activation disabled and leave the empty or subsequently populated table intact while disabling its application use. Do not DROP, TRUNCATE, reset counters or delete recovery state. Any later schema removal requires separate authorization. This phase does not weaken the existing activation gate.
