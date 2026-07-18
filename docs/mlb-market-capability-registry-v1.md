# MLB Market Capability Registry V1

Route:

`GET /api/mlb/markets/capabilities`

The registry exposes only verified support. It does not infer odds or route unsupported markets through the moneyline model.

## Capability Matrix

Fully supported for current production analysis:

- `moneyline`
- `run_line`
- `total`

Ingestion-only or unavailable until verified provider payload, features, settlement and calibration exist:

- `team_total`
- `alternate_run_line`
- `alternate_total`
- `first_five_moneyline`
- `first_five_run_line`
- `first_five_total`
- `first_inning_moneyline`
- `first_inning_total`
- `nrfi_yrfi`
- `pitcher_props`
- `batter_props`

Do not expose these as supported recommendation tabs in production. They may be shown only as unavailable or blocked capability rows with explicit requirements.

## Model Input Completeness

The 2026-07-17 projection check returned HTTP 200 with zero `PlayerGameProjectionStatsByDate` rows. Current MLB readiness is therefore:

- starting pitcher ready: false
- lineup ready: false
- injury ready: false
- weather ready: false
- projection ready: false

These missing domains reduce data sufficiency and must not be hidden behind an "Excellent" coverage label.

Arbitrage:

- visible as a scanner surface;
- unavailable until fresh simultaneous prices from at least two distinct sportsbooks exist;
- consensus-only rows cannot generate arbitrage.

## Doubleheader Rule

TB @ BOS on `2026-07-17` has two stored SportsDataIO events:

- `78741`
- `79725`

They have distinct provider IDs and distinct start times, so they are treated as legitimate separate events. They must not be merged solely by team/date.

## Validation

Deterministic validation confirms:

- full-game core markets are the only fully supported recommendation markets;
- props are not user-visible as supported;
- arbitrage requires multi-book pricing;
- validation makes zero provider calls.
