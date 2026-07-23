# Historical Feature Backfill Operations

Status: local operator workflow implemented.

## Operating Model

The Retrosheet feature backfill is an operator-controlled local CLI. It is not a Vercel job and should not be run inside serverless infrastructure.

Run from:

`C:\Projects\pick-analyzer`

The worker reads `.env.local`, certifies the configured Supabase project, and uses the existing Phase 2A service for point-in-time snapshot generation.

## Recommended Sequence

1. `npm run historical:features:validate -- --limit 1`
2. `npm run historical:features:dry-run`
3. `npm run historical:features:backfill`
4. `npm run historical:features:idempotency`
5. `npm run historical:features:resume` only when a prior local job remains `running`

## Checkpoints

Each confirmed game batch writes a `historical_import_checkpoints` row with:

- checkpoint key `local_game_batch_{n}`
- game count
- first and last game ID
- snapshot count
- inserted, updated, skipped counters
- checksum of deterministic snapshot keys
- worker version

Resume mode skips completed checkpoints and retries only incomplete batches.

## Logging

The worker prints JSON lines for:

- connection certification
- baseline counts
- dry-run batch progress
- write batch progress
- checkpoint IDs
- inserted/skipped counts
- ETA
- memory RSS
- final summary

Log output redacts URLs, JWTs, long secrets, and local host identity.

## Hard Stops

Stop if:

- host does not match `ynuocvexviorgdjrfthw.supabase.co`
- leakage failures are detected
- deterministic key collisions are detected
- checkpoint state cannot prove a batch completed
- provider calls occur
- production flags are not isolated
- the protected execution approval rejects the write
