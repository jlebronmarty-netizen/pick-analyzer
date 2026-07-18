# MLB Odds Coverage Reconciliation V1

## Summary

The 2026-07-17 MLB slate initially showed 15 scheduled SportsDataIO games and 15 provider odds records, but only 6 games had mapped odds. The missing games were not provider omissions. They were lost during stored event resolution because the repair path used a UTC calendar day instead of the America/Puerto_Rico operating day.

For local `2026-07-17`, the safe query interval is:

- UTC start: `2026-07-17T04:00:00.000Z`
- UTC end exclusive: `2026-07-18T04:00:00.000Z`

## Repair

`sportsdataio-mlb-prospective-preview.service.ts` now loads persisted MLB events with the Puerto Rico operating-day interval and no longer treats partial odds checkpoints as completed odds coverage.

The bounded repair used 1 additional `GameOddsByDate/2026-07-17` call because the prior partial checkpoint did not retain a reusable raw provider payload. Schedule and projection checkpoints were reused.

## Final Local State

- scheduled games: 15
- provider odds records: 15
- mapped games: 15
- unmapped games: 0
- unresolved provider IDs: 0
- feature snapshots: 45
- prospective predictions: 45
- Current Board actionable candidates: 21
- Current Board game entries: 7
- positive-value previews: 2
- official picks: 0
- settlement run: no

Current Board is intentionally stricter than stored analysis coverage. It removes stale, historical, superseded, invalid-price and non-actionable rows before ranking.

## Diagnostic Route

`GET /api/mlb/odds/coverage?date=2026-07-17&includeValidation=true`

The route is read-only and returns `providerCallsMade: 0`. It reports schedule provider IDs, internal event IDs, matchup, start time, mapping state, normalized odds rows, feature counts, prediction counts, Current Board candidate count and exact blocking reason.

## Missing Inputs

`PlayerGameProjectionStatsByDate/2026-JUL-17` returned HTTP 200 with zero projection rows. Starting pitcher, lineup, injury and weather readiness remain false. Do not label MLB coverage excellent until these critical inputs are actually present.
