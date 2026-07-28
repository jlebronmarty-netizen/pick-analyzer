# Market Intelligence V1

Status: Foundation, read-only.

Market Intelligence V1 adds stored market movement evidence from `sports_odds_snapshots`.

## Evidence Rules

- Earliest available snapshot is labeled `Earliest stored price`.
- It is not called a true opening line unless opening-line provenance exists.
- Current price is the latest stored aligned snapshot in the group.
- Movement is grouped by sport, event, market and outcome.
- No sharp-money claim is made from stored movement alone.

## Supported Outputs

- Snapshot count.
- Bookmaker coverage.
- Market coverage.
- Earliest stored price.
- Current stored price.
- Price movement.
- Line movement.
- Consensus range and dispersion.
- Synchronized bookmaker movement when deterministic evidence exists.
- Event and side alignment status.

Provider calls: 0.
Remote mutations: 0.
