# NBA archived player materializer V1

## Cause and scope

The existing NBA pipeline stores final player boxes in `nba_game_context_v2`, but did not have a writer that continuously derived `nba_goat_player_game_research_v1` and its seasonal archive manifest. The November 22 audit found 6,463 compact rows for 225 games; the last materialization was November 20 at 19:03:12 America/Puerto_Rico. Several later original boxes existed, so provider access was not the missing step.

This adapter runs at the end of `/api/cron/nba-current-era-shadow`. It uses only already stored boxes and independently archived final schedules. It adds no schedule, sports provider call, forecast, outcome, or model promotion. `JUGADA` and all existing quality gates remain unchanged.

## Data and time contract

1. Read a unique canonical `bdl_nba_<id>` context, its real provider/version and original capture time. Require a unique matching final in an archived `nba_market_schedules_v1` snapshot that was received and recorded by the run cutoff.
2. Reconcile final identity, points, Q1–Q4 and any played overtime. Validate every player identity, game, unique player ID, team and opponent, minutes and seven compact components. Sum each team's player points against the independent final and player minutes against 240 regulation minutes plus 25 per overtime (at most one minute rounding tolerance per team). Preserve known DNP nulls; do not turn absent data into zero.
3. Write a canonical copy of the stored operational JSON, including explicit `STORED_OPERATIONAL_JSON` provenance, to the existing private bucket. The SHA256 identifies these newly archived canonical bytes. It does **not** pretend to be the original provider response's byte hash. The content-addressed gzip object is uploaded with `upsert:false` and downloaded again; compressed size, expanded size, gzip and SHA256 must all match before the RPC is called.
4. The private `SECURITY INVOKER` RPC independently verifies the SHA256, stored context, independent final, identities, components and totals. It checks the private object metadata and commits the manifest, all player rows and job ledger atomically. Source capture time remains original; `materialized_at` is the current database time, never a historical freeze time. Existing readers' as-of guard prevents the new compact from filling an earlier frozen prediction retroactively.

The database checks stored object existence and size. Byte verification occurs in the service's authenticated Storage readback; PostgreSQL does not read the gzip object itself. This distinction is explicit, and the RPC remains executable only by `service_role`.

## Bounds, recovery and observability

- At most three newly materialized games per existing 30-minute pipeline slot. The deterministic job key, row lock, advisory game lock and durable per-game ledger enforce the cap despite concurrency or a lost response.
- At most 12 candidate contexts are examined per run. A cursor in the prior job summary rotates through rejected contexts so invalid older boxes do not permanently block later games.
- Both metadata scans have a hard 1,000-row limit and fail closed at that limit. Only the most recent 61 days are eligible. Extending coverage requires a reviewed change, not silently truncating history.
- Default disabled: `NBA_ARCHIVED_PLAYER_MATERIALIZATION_ENABLED` must equal `true` to write. No job is claimed when disabled or when less than 20 seconds of cron budget remains.
- A private client limits each HTTP request to at most eight seconds, with a run maximum of 55 seconds and eight seconds reserved for reading/finalizing the ledger. The cron gives the adapter only its remaining budget through second 280 of the existing 300-second limit.
- Existing manifests or partial compact rows are never repaired or overwritten. Invalid boxes and source conflicts remain visible as explicit skipped reasons for manual review.
- An upload followed by a failed RPC can leave an unreferenced immutable object. A later retry reuses that content-addressed object only after validating its bytes. It does not cause a partial manifest or compact transaction.
- If an invocation ends abruptly, its job may remain `running`; the next slot uses a different claim and independently checks manifests and compacts. The previous job remains an observable incomplete attempt. A lost response never resets the RPC's durable inserted-row count.
- `NBA_ARCHIVED_PLAYER_MATERIALIZATION`, the cron response and `sports_sync_jobs.metadata.summary` expose materialized games, row count, skipped reasons, pending contexts, remaining contexts, scan cursor and zero provider calls. Completed runs with rejected boxes use the existing `partial` job status.

## Verification

The synthetic unit and service suites cover incomplete sources, source timing, IDs, missing/fractional/negative components, DNP treatment, point/minute reconciliation, corrupt immutable objects, lost RPC responses, cap enforcement and scan rotation. Run:

```sh
node --test tests/nba-archived-player-materializer.test.mjs tests/nba-archived-player-materializer.service.test.mjs
```

The standalone PostgreSQL integration suite accepts only a loopback connection and a fresh database named `nba_materializer_test_*`. It exercises permissions, actual server SHA256, all-or-nothing failure, partial/conflicting data, concurrent commits, idempotence and database-generated knowledge time. Optional audit fixture files are local evidence and are never fetched by the tests.

The audit's ten archived contexts were replayed locally against PostgreSQL 17.12. Eight passed the strict validator and transaction, producing 278 proposed compact rows. GSW–Dallas (`21718140`, Golden State 68 vs final 94) and LAC–Dallas (`21718158`, Clippers 93 vs final 100) were rejected. No production data was written by this validation. The eight games are a bounded replay result, not a claim of complete season coverage.

## Activation and rollback

Apply `20261123004359_nba_archived_player_materializer_v1.sql`, review effective `service_role` privileges and deploy with the flag initially disabled. The function adds only `SELECT, INSERT` grants on the two derived tables and an execution grant for `service_role`; `PUBLIC`, `anon` and `authenticated` cannot execute it. Existing rights must allow reading and locking operational sources, reading schedule/object metadata, and claiming/updating the job ledger. The production read-only preflight on November 22 confirmed those rights and the private bucket. The role already had UPDATE on both derived tables; this migration does not introduce or use that capability. Append-only describes this RPC and service, not the role globally.

After the authorized flag activation, observe the next existing cron: at most three new games, original captures unchanged, current materialization time, verified hashes, no duplicates, unchanged frozen predictions and no additional provider calls. Continue observing later slots until valid pending contexts are consumed. Disputed sources remain excluded. Disable the flag to stop further writes; keep committed source evidence and frozen history intact.

This materializer does not repair previously existing compact disagreements, certify other sports, validate a model's probabilities, change a forecast or unlock `JUGADA`.
