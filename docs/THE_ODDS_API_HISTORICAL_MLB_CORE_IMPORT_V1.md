# The Odds API Historical MLB Core Import V1

Generated: 2026-07-28T03:06:13.871Z

Commit: `faf07ebee0ca6db02898b169c8e2bb42139b3e20`

Status: LIVE_HISTORICAL_MLB_CORE_IMPORT_COMPLETE

## Credit Safety

- Provider calls made: 6
- Requests remaining before: 19673
- Requests remaining after: 19523
- Requests used observed: 150
- Required reserve: 2000

## Persistence

- Historical dates requested: 2026-04-01T12:00:00Z, 2026-05-15T12:00:00Z, 2026-06-15T12:00:00Z, 2026-07-15T12:00:00Z, 2026-07-27T12:00:00Z
- Markets requested: h2h, spreads, totals
- Rows accepted: 3296
- Rows rejected: 0
- Rows inserted: 3296
- Rows updated: 0
- Pre-start rows: 3286
- Post-start rows: 10
- Invalid timestamp rows: 0
- Duplicate deterministic IDs: 0
- Production mutations recorded: 3297

## Safety Notes

- This is a narrow MLB current-season historical core-market import, not broad historical execution.
- Rows are timestamp-classified; only PRE_START rows are eligible for pregame feature and closing-candidate use.
- No prediction generation, feature rebuild, SQL migration, scheduler change, settlement write or recommendation-policy change was executed.
