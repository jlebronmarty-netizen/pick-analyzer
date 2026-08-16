# NBA-03A Two-Run Canary Review And Continuation

Status: `NBA_03A_REPAIRED_RUNTIME_VERIFICATION_CONTINUATION_CERTIFIED_READY_FOR_PUBLICATION`

## Existing Canary Evidence

The original two-run activation canary is operationally valid:

- Run 1: natural Vercel Cron, 3 inserts, 2 The Odds API calls, isolation pass.
- Run 2: natural Vercel Cron, 3 inserts, 2 The Odds API calls, isolation pass.

Run 2 completed before the Run 2 cardinality repair was deployed. It proves the
automation and bounded persistence path, but it does not naturally prove the
repaired `ALREADY_EXISTS` revalidation behavior.

## Failed Old-Code Attempt

Job `4dc3c613-b53b-45c4-b52f-146ec97a7e9c` failed with
`WRITE_CARDINALITY_NOT_ONE` after selecting 3 candidates. The later repair keeps
the writer strict while treating one exact already-persisted candidate key as
idempotent `ALREADY_EXISTS`.

## Continuation Contract

No reset is required. The six existing `CURRENT_ERA_SHADOW` rows remain intact,
and the historical scheduler audit rows remain unchanged.

The additive continuation gate is default-off:

`NBA_CURRENT_ERA_SHADOW_REPAIRED_VERIFICATION_ENABLED=true`

When enabled after the two-run review pause, the scheduler may perform exactly
one additional natural run with:

- run purpose: `REPAIRED_RUNTIME_VERIFICATION_RUN`;
- max 3 new rows;
- max 2 The Odds API calls;
- SportsDataIO 0;
- historical odds 0;
- full isolation.

After one successful repaired verification run, the review-required pause is
restored automatically. This does not activate continuous scheduling.

## Next Gate

Publish the continuation mechanism, align production, then separately authorize
setting the repaired-verification flag and observing one natural Vercel Cron run.
