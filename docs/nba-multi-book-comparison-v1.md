# NBA Multi-Book Comparison V1

NBA Multi-Book Comparison V1 is a stored-data market intelligence layer. It compares existing rows in `sports_odds_snapshots` and does not call external providers.

## Scope

- Group NBA odds by event, market, outcome and line.
- Keep only the latest stored snapshot per sportsbook inside each group.
- Rank sportsbooks by best available American price.
- Compute consensus odds from average decimal odds.
- Detect single-book, multi-book and stale stored markets.
- Return typed empty responses when no NBA odds snapshots exist.
- Surface results in the NBA dashboard.

## Data Sources

- `sports_odds_snapshots`
- `sport_events`

The service uses `NBA_SPORT_KEY` and `NBA_LEAGUE_KEY` from the existing NBA prediction validation module and `resolveNbaSeason()` from NBA Data Sync V1.

## Provider Boundary

This module makes zero provider calls.

The response includes:

- `providerUsage.externalProviderCallsMade`
- `providerUsage.source`

For V1, `externalProviderCallsMade` must remain `0`.

## Staleness Rules

The API accepts `staleMinutes`, defaulting to `120`.

A book price is stale when:

```text
now - snapshot_time > staleMinutes
```

A comparison group is stale when every book in that group is stale.

## Price Ranking

American odds are converted to decimal odds for comparison. The book with the highest decimal price is the best book for the selected outcome.

The module reports:

- best book
- worst book
- consensus odds
- book count
- price spread in American cents
- stale book count
- recommendation

## API

`GET /api/nba/markets/multi-book`

Query parameters:

- `limit`: maximum comparison groups, capped at 100
- `market`: optional market filter
- `staleMinutes`: freshness threshold, capped between 15 and 1440

## Dashboard

`NbaMultiBookComparisonPanel` shows:

- sportsbook count
- comparison groups
- best-price opportunities
- external provider calls made
- warnings
- top comparison groups

The dashboard has no provider execution control.

## Empty Data Behavior

When no stored NBA odds snapshots exist, the module returns:

- `success: true`
- `status: empty`
- zero summary counts
- a warning that no stored snapshots are available
- an empty `comparisons` array

## Future Work

This module enables later work but does not implement:

- provider-backed odds refresh
- arbitrage scanning
- steam move detection
- live betting
- paid player prop feeds

Those modules should consume this stored comparison layer where appropriate.
