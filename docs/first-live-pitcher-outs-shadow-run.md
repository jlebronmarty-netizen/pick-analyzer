# First Live Pitcher Outs Shadow Run

The first live shadow run is controlled by two endpoints.

## Evidence Refresh

Use:

`POST /api/mlb/pregame-starter-evidence`

Dry-run mode is default and makes zero provider calls. Live provider refresh requires:

- `refreshProvider=true`
- `confirmed=true`
- `dryRun=false`
- existing protected authorization
- provider budget AVAILABLE/VALID

The route stores eligible starters in `sport_lineups`.

## Shadow Generation

Use:

`POST /api/mlb/learning-brain`

Dry-run mode previews eligible pitcher-outs snapshots and shadow projections. Non-dry execution persists to `universal_projection_history` only when exact pregame starter evidence and sufficient pitcher history exist.

## Current Limitation

If no current eligible starters exist, the system reports `NO_ELIGIBLE_PREGAME_STARTERS`, creates no snapshots, creates no projections and does not fabricate rows.

## Market Policy

Pitcher recorded-outs outputs stay `NO_MARKET`. No prop lines, EV, edge, Kelly, stake or Official Pick can be generated without verified player-prop market odds and settlement support.
