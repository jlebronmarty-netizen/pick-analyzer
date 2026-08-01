# Live Slate Rules

Status: RELEASE 13B

## Active Betting Board

The active Betting Workspace board may show only current pregame opportunities for the current `America/Puerto_Rico` operating day.

Allowed active rows:

- current board rows;
- pregame state;
- event start time is still in the future;
- event belongs to the current Puerto Rico day;
- one canonical row per event, market and selection.

Excluded active rows:

- historical predictions;
- all-stored explorer rows;
- duplicate snapshots;
- started games;
- live games;
- final games;
- cancelled or postponed games;
- stale snapshots;
- unsupported hidden records.

## Canonicalization

When multiple rows exist for the same event, market and selection, the workspace keeps the newest valid pregame row based on available update timestamps. Historical rows are never used to fill an empty active slate.

## Empty Slate

When no active pregame rows remain, the workspace shows:

- `No pregame opportunities remain today.`
- `Today's slate has concluded.` when available state evidence says every row is final.

Users can inspect historical rows in History, but those rows are read-only and cannot be added to the bet slip.
