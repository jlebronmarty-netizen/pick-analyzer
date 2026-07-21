# Analyst Evidence Contract

Analyst-facing text must be grounded in stored fields or explicit derived math.

## Allowed Evidence

- Stored event and prediction identity.
- Stored model probability, confidence and data sufficiency.
- Stored market price, implied probability, edge and EV.
- Shared classification and blocker codes.
- Stored player stat rows and recorded-outs conversion.

## Disallowed Claims

- Fabricated lineups, injuries, weather or starters.
- Unverified player props.
- Multi-book movement from consensus-only prices.
- Team advantages without a validated sample window.
- Actionable EV from stale, expired, unknown, quarantined or unaligned markets.

## Price Targets

- Break-even probability from American odds:
  - Positive odds: `100 / (odds + 100)`.
  - Negative odds: `abs(odds) / (abs(odds) + 100)`.
- Fair American odds from model probability.
- Official-policy targets are labels only; the analyst does not change policy.
