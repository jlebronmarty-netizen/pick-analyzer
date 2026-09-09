# R4 unattended schema preflight and automation activation

Starting package: `3f13a5ceca78854824480ccdff91d48c267a93ec`.

Unattended schema access is implemented and production-verified. Full R4 activation is **blocked** pending a verified persistent executor host. The earlier missing schema-connection blocker is resolved; the interactive connector is no longer required for preflight.

## Existing architecture and inventory

| Implementation | Classification | R4 disposition |
|---|---|---|
| `scripts/mlb-operational-tick.mjs`, `mlb-operational-automation.mjs` | CANONICAL_REUSE | Same seven modes and single coordinator; fresh unattended preflight added before execution |
| `scripts/mlb-operational-manual-refresh.mjs`, certified R2B/R2I, production bindings | CANONICAL_REUSE | No prediction, feature, persistence or provider engine fork |
| Private run store and write journal | CANONICAL_REUSE | Filesystem exclusive lock, frozen job, atomic checkpoint, write-ahead recovery and cumulative budget preserved |
| Shared Statcast client and canonical raw target | CANONICAL_REUSE | `public.pick2_raw_mlb_statcast_pitches`; no second store |
| `sports_sync_jobs` operational telemetry | SUPPORTING | Existing bounded telemetry; not a durable replacement for full private checkpoints |
| Vercel `/api/cron/operating-day`, `7-57/10 * * * *` UTC | LEGACY | Existing operating-day route; does not call certified R2 coordinator; not activated as R4 |
| Vercel `/api/cron/mlb-statcast-daily`, `20 12 * * *` UTC | LEGACY | Existing daily refresh/analytics route; not the R4 mission-budget coordinator |
| Vercel NBA shadow cron, `*/30 * * * *` UTC | UNRELATED | Preserved |
| GitHub `production-operating-day.yml`, `7-57/10 * * * *` UTC | LEGACY | Calls existing operating-day fallback; no certified R2 private state |
| GitHub `production-operating-day-heartbeat.yml`, `3,33 * * * *` UTC | SUPPORTING | Observer-only heartbeat, not an R4 executor |
| GitHub `operating-day-refresh.yml` | SUPPORTING | Manual observer dispatch |
| Other MLB validation/audit GitHub workflows | SUPPORTING | Certification tools; not scheduled R2 mutation authority |
| `/api/cron/master-sync`, `/api/cron/daily-sync`, `/api/cron/capture-predictions` | DO_NOT_USE | Broader legacy orchestration outside frozen R4 contracts |
| Existing Supabase `mlb-statcast-gap-fill` function | DO_NOT_USE | Historical gap-fill purpose; not an R4 provider substitute |
| Supabase pg_cron / pg_net | UNRELATED / ABSENT | Fresh extension inventory found neither; no DB scheduler added |
| Historical import checkpoints / recommendation locks | DO_NOT_USE | Different identities and semantics; not reused for private mission state |
| New `mlb-operational-preflight` Edge Function | SUPPORTING | Fixed read-only schema query only; not a refresh engine |
| Protected `/api/admin/mlb-operational-preflight` | SUPPORTING | Server-only preflight and presence-only credential inventory; no live execution |

## Access and security

The existing server service-role key authenticates the fixed Supabase Edge endpoint. The Edge runtime supplies its own `SUPABASE_DB_URL`; that value never leaves the runtime. The connection has underlying database privileges, but this function executes only the reviewed SELECT in a read-only transaction with a 20-second statement timeout. This is application/transaction confinement, not a claim that the underlying credential is a separately provisioned read-only database role.

The endpoint accepts GET only, forbids parameters, requires both gateway JWT verification and constant-time comparison with the existing service key, and returns aggregate structural results. It accepts no SQL or connection configuration from callers. Anonymous/user credentials cannot invoke database work. Driver errors are redacted. The protected Vercel route requires `CRON_SECRET`; it exposes only presence/scope, never secret values. No browser module imports the service.

Local server credentials: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` present. `SUPABASE_URL`, anon keys, direct Postgres URLs, Supabase management token and Vercel token absent locally. Edge database access is independently verified present. Production Vercel inventory is read back through the protected route after publication.

Schema verification reuses the previous pure checker: 406 columns, 116 preserved constraints, all 84 current indexes, six snapshot uniqueness contracts, six-domain orphan checks, and existing positivity-check integrity. The server client verifies the certified Champion, 76-feature count and Policy V1. The original R3 source-hash checker remains required by the executor. A database clock lead of at most 15 seconds is handled by waiting for actual time; larger skew blocks. No timestamp is replaced, backdated or accepted as future evidence.

## Runtime gate and schedule

The current certified executor requires a Git checkout and synchronous private filesystem checkpoints, including large sharded contexts. Its lock is host-local. A Vercel temporary filesystem cannot establish durable cross-instance checkpoint/budget ownership. No persistent production host has yet been identified and verified. R4 therefore refuses activation on Vercel or without a verified host; the host choice is required infrastructure input, not another request to authorize the already-approved mission.

The prepared schedule, not installed, is:

| Mode | Puerto Rico time | UTC cron / trigger |
|---|---|---|
| INITIALIZE | 08:00 | `0 12 * * *` |
| PREGAME | 08:15–23:45 every 15 minutes | `15,30,45 12 * * *`; `*/15 13-23,0-3 * * *` |
| STARTER_CHANGE | Coalesce into next pregame slot | Stored authoritative change trigger; no parallel invocation |
| ODDS_FRESHNESS | Coalesce into next pregame slot | Freshness trigger; same certified R2 path |
| INCREMENTAL | Every 15 minutes when a live scope exists | `*/15 * * * *`, gated/coalesced by the one coordinator |
| POSTGAME | Hourly when final-game scope exists | `0 * * * *`, gated/coalesced by the one coordinator |
| OVERNIGHT | 04:00 | `0 8 * * *` |

Colliding modes serialize under the same coordinator; unfinished frozen jobs block later work. These triggers do not authorize every slot to consume an Odds request. Existing persistent mission budget remains 2/20 consumed, 18 remaining; fail closed when exhausted. Daily refresh retains its stricter maximum one Odds request, below the R4 per-run maximum five. MLB Official <=50, Statcast <=100, substitute providers zero. No new timer, cron or live provider execution was installed or invoked in this phase.

Settlement remains separate. POSTGAME/OVERNIGHT cannot settle unless a future activation manifest explicitly sets `settlementAutomation: ENABLED`; R4 keeps it DISABLED. Original picks are immutable.

## Validation and rollback

26 R4 checks cover missing tables/columns/indexes, invalid indexes, orphan/FK drift, exact SQL/manifest compatibility, authentication, missing credentials, read-only transaction, redaction, Champion/feature/Policy drift, HTTP failure, expiry and clock skew. Existing 16 behavioral groups, five R3 guards and three operational guards also pass, including overlap, checkpoint recovery, pitch reuse, budget persistence and settlement isolation. Production preflight passed without a Codex connector. Final `npm.cmd run build` passed (400 static pages); targeted lint passed.

Rollback: keep activation DISABLED and disable only a future canonical scheduler trigger; retain all private checkpoints, mission budget, write journal and production rows. Do not delete locks until owner exit and pending journal reconciliation are proved. The manual certified path and its original SELECT-catalog acceptance remain available. No rollback DDL is required. The new read-only endpoint alone never starts work.

Final operational certification, scheduled invocation readback, pitch/daily scheduled readback and automation-driven UI freshness are NOT certified by these read-only tests. Next: identify the persistent host, verify its state/credentials/package, conduct unattended full dry certification, then activate and observe an actual scheduled invocation.
