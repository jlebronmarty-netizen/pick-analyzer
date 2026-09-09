# MLB operational recovery

The coordinator is **disabled** until a genuine nonempty pregame refresh and a subsequent real refresh certify repeatability. Dry fixtures never satisfy these gates. The prepared runner is single-host; do not deploy independent coordinators on multiple ephemeral hosts.

## Before each invocation

1. Inspect HEAD, origin/main, ancestry and the worktree. Preserve unrelated changes and never touch `.tmp/` or `.worktrees/`. Freeze the chosen validated commit; do not fetch, integrate or switch packages during a run.
2. Use the authorized Supabase connector to execute `scripts/mlb-operational-schema-preflight.sql` on project `ynuocvexviorgdjrfthw`. This is SELECT-only. Save the returned `evidence` object outside the public repository.
3. Pipe that exact fresh JSON to `node scripts/mlb-operational-preflight.mjs --accept-read-only-catalog`. The tool checks the physical contracts and refuses evidence older than 15 minutes. Never replace its timestamp, fabricate catalog evidence, or bypass the check. The coordinator needs this read-only connector step before each scheduled invocation; the service-role REST credential alone cannot inspect indexes.
4. Verify the existing private mission ledger, run journal and checkpoint directory survive between invocations. Do not initialize a missing ledger after recorded usage. Restore the exact trusted private evidence backup before retrying.

## Next genuine pregame slate

Run `node --env-file=.env.local scripts/mlb-operational-manual-refresh.mjs --execute-current-slate --package-sha=<frozen validated HEAD>` under the applicable live authorization. Freeze actual Puerto Rico date and actual start time. One Odds request maximum. Empty eligibility is a clean terminal outcome; never substitute started games.

After the first nonempty run, independently verify persisted native/raw/features, all six snapshot FKs, the 76-vector, Champion probabilities, markets, values, decisions, board, provider ledger and write journal. A subsequent genuinely valid refresh must prove immutable reuse, no duplicates, correct new evidence revisions and zero conflicts before `MLB_DATA_02R_REPEATABILITY_CERTIFIED` is issued.

## Prepared automation schedule (not installed)

Use one coordinator with a persistent private OS-temp run directory and the connector preflight step above. The command is `node --env-file=.env.local --loader ./scripts/local-ts-loader.mjs scripts/mlb-operational-tick.mjs --execute-tick --mode=<mode> --package-sha=<frozen validated HEAD>`.

| Mode | Proposed Puerto Rico cadence | Binding |
|---|---|---|
| INITIALIZE | 08:00 once daily | Certified R2 current-day initialization |
| PREGAME | Every 15 minutes, 08:15–23:45 | Certified R2 executor; eligibility filters started games |
| STARTER_CHANGE | Replace the pending pregame tick when a starter change is observed | New R2 freeze; original snapshots preserved |
| ODDS_FRESHNESS | Replace the pending pregame tick when market freshness expires | Same R2 path; at most one Odds request |
| INCREMENTAL | Every 15 minutes while stored/Official scope has live games | Existing shared Statcast reconciliation |
| POSTGAME | Hourly after games finish | Shared Statcast then authoritative final settlement |
| OVERNIGHT | 04:00 | Previous operating-day final-game reconciliation |

Starter/odds triggers replace a daily tick rather than launching parallel prediction runs. The durable mission-wide Odds limit remains 20; stop before exhausting it and do not silently reset it for a new day. Live/pitch scheduling does not confer pregame eligibility. No historical/full-season scan is permitted.

Activation requires the exact nonempty and repeatability evidence in `MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json`, source-hash verification, dry certification, one coordinator host, existing credentials and the read-only schema-preflight channel. Enabling a scheduler without that connector channel is prohibited. No cron, environment or scheduler configuration was changed during preparation.

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
