# MLB Player Prop Readiness V1

Certification: `MLB_PLAYER_PROP_MARKET_PROVIDER_BLOCKED`

Date: 2026-07-21

## Scope

This contract prepares future provider-independent player prop odds support without activating prop betting recommendations.

Primary market type:

- `PITCHER_RECORDED_OUTS`

## Current Status

Current production market status is `NO_MARKET`.

Stored pitcher recorded-outs prop odds rows: 0.

Because no verified player-prop line and odds are stored, model-only pitcher outs projections cannot produce:

- edge
- EV
- Kelly stake
- Official Pick
- Best Bet
- recommendation language

## Required Provider Contract

Future player prop snapshots must preserve:

- provider
- sportsbook
- event ID
- player provider ID
- canonical player ID when resolved
- market type
- line
- over odds
- under odds
- snapshot timestamp
- opening and closing line when legitimately supplied
- source lineage
- market status

## Blockers

- MLB player prop odds endpoint is not confirmed for the current subscription.
- MLB player prop odds entitlement is not confirmed.
- No stored MLB player prop odds snapshots exist.
- Player prop settlement rules are not production-active.

No sportsbook scraping, hidden endpoint probing or fabricated prop fixtures are allowed as production data.
