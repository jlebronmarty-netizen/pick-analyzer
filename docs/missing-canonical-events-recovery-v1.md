# Missing Canonical Events Recovery V1

Last updated: 2026-07-21

## Certification

`MISSING_CANONICAL_EVENTS_RECOVERY_BLOCKED`

## Production Distribution

Read-only production audit of the 342 `EVENT_NOT_IMPORTED` prediction rows found:

- Unique missing event IDs: 171
- Season: 2026
- Market: moneyline, 342 rows
- Mode: champion, 342 rows
- Game ID format: 32-character hex, 342 rows
- Rows with `odds_snapshot_id`: 0
- Stored odds rows matching missing event IDs: 0
- Stored result rows matching missing event IDs: 0
- Rows with usable stored source lineage: 0
- Exact canonical team-name coverage: 0 of 342 rows
- Provider calls: 0
- Remote mutations: 0

Sports:

- `americanfootball_nfl`: 190
- `americanfootball_ncaaf`: 122
- `soccer_epl`: 20
- `baseball_mlb`: 10

Sportsbooks:

- DraftKings: 248
- FanDuel: 82
- MyBookie.ag: 12

Generated dates:

- 2026-07-12: 332
- 2026-07-16: 10

Scheduled dates span 2026-07-16 through 2026-11-28.

## Recovery Result

No canonical events were created. No provider mappings were created. No prediction links were repaired. No settlement rows were mutated.

The current rows do not contain enough stored exact source evidence to create canonical `sport_events` safely. Their IDs appear to be source IDs, but the stored rows do not retain provider/source payload metadata, linked odds snapshots or result source rows. Team identity is also unresolved for the affected sports in the canonical team catalog.

## Blocker

Recovery is blocked by:

- no stored exact source payload for the missing event IDs
- no linked odds snapshots
- no result source identity
- no exact canonical team identity coverage for affected teams
- provider entitlement not proven for the non-MLB affected sports

Names and dates are not enough to import or link events.
