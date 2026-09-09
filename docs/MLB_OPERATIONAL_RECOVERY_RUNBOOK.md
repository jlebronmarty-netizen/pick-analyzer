# MLB operational recovery

## Current R6 production contract

The exact eight-file Edge candidate is deployed as version 5 with custom service-only bearer authentication. The production Function passes actual-host dry invocation, lease deferral, concurrent exclusion, durable checkpoint and completed-run reuse. The former endpoint-approval blocker below is resolved. The authoritative state is `public.pick2_mlb_runtime_state`; historical filesystem recovery instructions below apply only to the retained manual-run evidence.

The activated configuration uses one MLB schedule: `/api/cron/mlb-operational` at `*/15 * * * *` UTC. It replaces the legacy operating-day and MLB Statcast cron entries and preserves the NBA cron. GET runs the existing coordinator; authenticated empty POST is a provider-free host probe. Deployment is the activation boundary; observe a real scheduled run before final certification.

Before recovery, read the current RUN, LEASE and MISSION records securely. Never reset counters or clear a pending run. An active lease must defer other hosts. Release/expiry permits the same frozen package and as-of to resume; package/date mismatch is a hard stop. Lost provider acquisition without canonical evidence remains blocked and consumed. Data Health exposes sanitized current durable accounting; mission Odds began this activation at 2/20.

To contain a failure, disable the MLB cron and activation flag in a bounded normal deployment; do not alter the NBA schedule. Preserve the in-flight durable record, all canonical rows and receipts. Read back pending operations before retrying. Do not delete runtime rows, reset budgets, run extra DDL or silently change a frozen package. Settlement automation remains disabled.

Real nonempty production refresh and repeatability are certified. The coordinator remains **disabled** pending a verified persistent executor host. Unattended schema preflight is now production-verified; do not deploy the filesystem-based runner on independent ephemeral hosts.

## Before each invocation

1. Inspect HEAD, origin/main, ancestry and the worktree. Preserve unrelated changes and never touch `.tmp/` or `.worktrees/`. Freeze the chosen validated commit; do not fetch, integrate or switch packages during a run.
2. Run `node --env-file=.env.local --loader ./scripts/local-ts-loader.mjs scripts/mlb-operational-unattended-preflight.mjs --read-only-preflight`. It uses the service-authenticated Edge endpoint, checks the original contracts and freshness, and writes the accepted private preflight. The tick invokes this automatically before execution.
3. The prior SELECT query and `mlb-operational-preflight.mjs --accept-read-only-catalog` remain manual recovery tools. Never alter timestamps or bypass drift checks. Database clock lead up to 15 seconds is handled only by waiting for actual time.
4. Verify the existing private mission ledger, run journal and checkpoint directory survive between invocations. Do not initialize a missing ledger after recorded usage. Restore the exact trusted private evidence backup before retrying.

## Next genuine pregame slate

Run `node --env-file=.env.local scripts/mlb-operational-manual-refresh.mjs --execute-current-slate --package-sha=<frozen validated HEAD>` under the applicable live authorization. Freeze actual Puerto Rico date and actual start time. One Odds request maximum. Empty eligibility is a clean terminal outcome; never substitute started games.

After the first nonempty run, independently verify persisted native/raw/features, all six snapshot FKs, the 76-vector, Champion probabilities, markets, values, decisions, board, provider ledger and write journal. A subsequent genuinely valid refresh must prove immutable reuse, no duplicates, correct new evidence revisions and zero conflicts before `MLB_DATA_02R_REPEATABILITY_CERTIFIED` is issued.

## Prepared Vercel automation schedule (disabled)

The persistent scheduler is Vercel Cron and the executor is the production Function at `/api/cron/mlb-operational`. Shared Supabase runtime state owns the lease, frozen run, checkpoints, provider reservations and business-write accounting. Function-local memory and files are not authoritative. The prepared GET handler invokes the existing `executeProductionTick`; authenticated POST is reserved for a provider-free host probe. Both use the existing server-only `CRON_SECRET`. No request parameters select dates, games, packages or budgets.

R6 deployment is blocked by automatic approval review of the exact fenced business-write Edge handler. The state-only Edge version is deployed, but the new atomic business-write operation is not. Do not activate Cron or substitute unfenced direct writes. The exact reviewed source manifest and required endpoint approval are in `docs/CERTIFICATION/MLB_DATA_02R_R6_DURABLE_RUNTIME_STATE_AND_VERCEL_FUNCTION_ENTRYPOINT.json`. No additional DDL is authorized or required.

On interruption, inspect the service-only RUN and LEASE records. An unexpired lease defers other invocations. After release/expiry, the same compatible package resumes the existing run identity and frozen as-of. Persisted feature UUIDs and market evidence digests must verify before replay. Never reset the mission Odds counter, change a frozen scope, force-release an active lease, or retry an ambiguously consumed provider request as though it never occurred. A stale-date, incompatible-package, provenance, conflict or ambiguous-acquisition error remains a hard stop requiring investigation. Terminal scheduled identities return `REUSE_NO_OP`.

| Mode | Proposed Puerto Rico cadence | Binding |
|---|---|---|
| INITIALIZE | 08:00 once daily | Certified R2 current-day initialization |
| PREGAME | Every 15 minutes, 08:15–23:45 | Certified R2 executor; eligibility filters started games |
| STARTER_CHANGE | Replace the pending pregame tick when a starter change is observed | New R2 freeze; original snapshots preserved |
| ODDS_FRESHNESS | Replace the pending pregame tick when market freshness expires | Same R2 path; at most one Odds request |
| INCREMENTAL | Every 15 minutes while stored/Official scope has live games | Existing shared Statcast reconciliation |
| POSTGAME | Hourly after games finish | Shared Statcast reconciliation; automatic settlement disabled |
| OVERNIGHT | 04:00 | Previous operating-day final-game reconciliation |

Starter/odds triggers replace a daily tick rather than launching parallel prediction runs. The durable mission-wide Odds limit remains 20; stop before exhausting it and do not silently reset it for a new day. Live/pitch scheduling does not confer pregame eligibility. No historical/full-season scan is permitted.

Activation requires the exact nonempty and repeatability evidence in `MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json`, source-hash verification, dry certification, one coordinator host, existing credentials and the read-only schema-preflight channel. Enabling a scheduler without that verified unattended channel is prohibited. No cron, environment or scheduler configuration was changed during preparation.

## Failures and recovery

- Stop on any conflict, scope escape, shape mismatch, invalid snapshot ID, starter/provenance defect, stale schema check or cap overrun. Preserve valid inserted rows.
- An incomplete automation job blocks new slots and modes. Resume its frozen job on the same package and operating date. At most three attempts are permitted; exhausted attempts require diagnosis. Never silently open a new job to reset its budget.
- A daily job records its R2 intent before invocation. Recovery identifies the unique newly created run and reads its saved result or resumes it. Ambiguous intervening manual runs block recovery.
- A raw job saves its exact plan before writes. The existing write journal records intent and distinguishes committed, absent and conflicting writes. Retries classify immutable rows before inserting; readback must yield zero additional inserts.
- Settlement plans are saved before INSERT. Read `pick2_prediction_results` by prediction ID after any timeout. Identical results reuse the original `settled_at`; changed evidence conflicts rather than overwriting original picks/results.
- A stale `mission.lock` is a deliberate hard stop. Confirm its PID is dead and inspect all pending writes before an operator releases that exact lock. Do not recursively delete the evidence directory.

## Rollback

Disable activation and stop future scheduler invocations first. Wait for or inspect the in-flight journal; never terminate a write and assume it failed. Restore a previously certified application deployment using normal compatible Git integration. Preserve all immutable feature/prediction/value/pick/result rows. No data DELETE, reverse UPDATE, automatic DDL rollback or force push is part of operational rollback.

The separately authorized snapshot-index DDL has its own exact rollback SQL and conflict preflight. Do not execute it under this runbook; no additional DDL authorization is implied.

## Verification and evidence

Run `scripts/mlb-pre-nonempty-readiness-validate.mjs` through the local TypeScript loader with an OS-temp `R2S_VALIDATION_DIR`, the full existing disposable feature/persistence validator, R3 guards, lint and `npm.cmd run build`. Verify Today, Value Board, Performance and Data Health in desktop/mobile browsers. Keep raw provider payloads, row samples, screenshots with production evidence and private journals outside Git. Publish only structural checks, aggregate accounting, source digests and conclusions.

Data Health labels its last published certification accounting explicitly. It must not call that snapshot a current live run counter. Current per-stage checkpoints, provider consumption and write intents are authoritative on the coordinator host; loss of that host evidence is a recovery blocker, not a zero-count state.

## September 9 production certification

The first nonempty and subsequent real refresh are certified in `docs/CERTIFICATION/MLB_DATA_02R_REPEATABILITY_CERTIFICATION.json`. Both freeze package `633768729b212746d03a5bf4d2ae542d1d84f945`. All pending snapshot writes were independently recovered and no unresolved journal entries remain. R4 now verifies the unattended schema channel; automation stays disabled until the persistent executor host is verified. Do not weaken preflight or mark the service active without scheduled execution and readback. Resume at the persistent-host/activation gate, preserving mission Odds consumption of 2/20 and all private ledgers.

## R4 persistent-host activation gate

The fixed-query unattended endpoint is verified; no new database credential is needed in Vercel. Full scheduled execution still requires one verified persistent Node/Git/private-checkpoint host. `runtimeHost.verified` must remain false until host identity, durable state, credential access, restart recovery and overlap checks pass. Do not infer this from a successful read-only Vercel preflight. Keep `settlementAutomation` DISABLED. See the R4 audit for exact proposed UTC triggers and the current blocker.

R5 resolves the R4 access caveat: the Production-only server credential was corrected through authenticated management and the same certified application SHA redeployed. Actual Vercel-to-Edge preflight passes HTTP 200. Future credential changes require secure value transfer, Production-scoped configuration readback, redeployment and a fresh protected-route PASS; never print or commit values. Preview/Development remain separate. The remaining blocker is an existing persistent executor host, not Vercel authentication. No self-hosted repository runner or local MLB scheduled service was found; do not invent a host verification or initialize a new zero-usage ledger. Preserve Odds 2/20.
