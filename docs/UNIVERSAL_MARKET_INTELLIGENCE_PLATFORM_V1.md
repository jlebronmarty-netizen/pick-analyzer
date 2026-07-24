# Universal Market Intelligence Platform V1

Status: Provider-independent inventory, readiness and diagnostics layer implemented.

## Scope

This phase captures and classifies markets without activating unsupported prediction or recommendation paths.

The platform covers:

- Moneyline
- Run Line
- Totals
- Team Totals
- First Five Moneyline
- First Five Run Line
- First Five Total
- First Inning / NRFI / YRFI
- Alternate Lines
- Winning Margin
- Race To Runs
- Pitcher Props
- Batter Props
- SGP Legs
- Unknown future provider markets

## Canonical Contract

Every stored odds row or cataloged market receives:

- canonical ID
- sport
- league
- event
- market family
- market type
- selection
- line
- odds
- sportsbook
- timestamp
- cutoff placeholder
- push support
- outcome count
- settlement support
- prediction support
- learning support
- provider
- provider market key
- canonical market key
- readiness
- blockers

## Readiness

Readiness states:

- `COLLECT_ONLY`
- `NORMALIZED`
- `SETTLEMENT_READY`
- `FEATURE_READY`
- `PREDICTION_READY`
- `SHADOW_READY`
- `PRODUCTION_READY`
- `BLOCKED`

Unsupported and unavailable markets stay blocked or shadow-only until real odds, settlement, features, historical evidence, calibration and explicit promotion are available.

## APIs

- `/api/markets/inventory`
- `/api/markets/readiness`
- `/api/markets/provider-coverage`
- `/api/markets/diagnostics`

All V1 endpoints are read-only and report `providerCallsMade=0` and `remoteMutationsMade=0`.

## Product Integration

- AI Operations includes a Universal Market Intelligence panel.
- Dashboard Advanced Details > Markets includes a Market Coverage panel.
- Existing Current Board, Most Likely, Best Value and Official Picks remain limited to supported markets.

## Guardrails

- No unsupported market activation.
- No invented odds, lines, props or implied probabilities.
- No Official Pick policy change.
- No production model weight change.
- No provider call during diagnostics.
- No Supabase mutation during diagnostics.
