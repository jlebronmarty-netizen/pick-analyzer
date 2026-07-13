# NBA Steam Move Detection V1

NBA Steam Move Detection V1 scans stored NBA odds snapshots for aligned multi-book line movement. It does not call external providers.

## Scope

- Read persisted rows from `sports_odds_snapshots`.
- Group by event, market, outcome and line.
- Compare each sportsbook's first and latest stored snapshot inside the group.
- Detect movement direction and magnitude.
- Require repeated snapshots before producing a movement signal.
- Require aligned movement across multiple books before producing a steam signal.
- Return typed empty or insufficient-history responses when data is sparse.

## Provider Boundary

The module makes zero provider calls.

The response includes:

- `providerUsage.externalProviderCallsMade`
- `providerUsage.source`

For V1, `externalProviderCallsMade` must remain `0`.

## Signal Rules

For each group, the detector builds book-level movement:

```text
moveCents = latestOdds - openingOdds
```

Direction:

- `toward_outcome`: move is `<= -5`
- `away_from_outcome`: move is `>= 5`
- `flat`: move is between those bounds

Group signal:

- `INSUFFICIENT_HISTORY`: fewer than two books have repeated snapshots
- `STEAM_MOVE`: at least three aligned books, max move at least 12 cents and confidence at least 65
- `MARKET_DRIFT`: movement exists but does not meet steam thresholds

## Confidence

Confidence combines:

- aligned book ratio
- maximum move size
- movement speed inside the observed window

The score is capped at 100.

## API

`GET /api/nba/markets/steam`

Query parameters:

- `limit`: maximum groups returned, capped at 100
- `market`: optional market filter

## Dashboard

`NbaSteamMovePanel` shows:

- stored snapshot count
- sportsbook count
- groups analyzed
- confirmed steam moves
- provider calls made
- warnings
- top detected movement groups

## Empty Data Behavior

When no stored NBA odds snapshots exist, the module returns:

- `success: true`
- `status: empty`
- zero summary counts
- a warning that no stored snapshots are available
- an empty `signals` array

## Future Work

Future provider-backed execution should first populate odds snapshots through approved capped sync jobs. This detector can then operate without changing its API contract.
