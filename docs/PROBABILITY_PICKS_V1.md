# Probability Picks & Parlay Builder V1

Status: Locally implemented.

Date: 2026-07-26

## Scope

Probability Picks V1 is a projection-only AI Operations workspace. It ranks internal model outputs by probability, confidence, quality, starter certainty, feature completeness, freshness and historical reliability signals, then exposes correlation-aware projection parlays.

Supported V1 markets:

- Moneyline
- Run Line
- Totals
- Pitcher Outs

## Boundaries

- No sportsbook lines are read or displayed.
- No implied probability, fair price, EV, Kelly, staking, bankroll, Official Pick or portfolio logic is used.
- No provider calls are made.
- No remote mutations are performed.
- No migration or persistence path was added.
- Current Board, Most Likely, Best Value, Official Pick policy, settlement, scheduler, Learning Brain and Portfolio Intelligence remain unchanged.

## APIs

- `GET /api/probability-picks`
- `GET /api/probability-picks/parlays`
- `GET /api/probability-picks/validation`
- `POST /api/probability-picks/preview`
- `POST /api/probability-picks/generate`

Preview and generate follow dry-run conventions. Generate reports `rowsPersisted: 0` and `persistence: disabled_for_probability_picks_v1`.

## Data Sources

Team markets read `prediction_history` with a projection-only column selection: model probability, confidence, lifecycle, feature snapshot and timing fields. Price, sportsbook, implied probability, edge and EV fields are intentionally omitted.

Pitcher Outs uses the existing MLB Pitcher Projection Engine preview path and its projection-only recorded-outs thresholds. It does not use Player Prop Market Comparison rows.

## Correlation

The parlay builder detects same-event, shared correlation group, moneyline plus run-line, pitcher plus team/total and total shared-game dependencies. A correlation penalty is applied to combined probability, confidence and quality. Combined probability is not a simple multiplication of leg probabilities.

## UI

The `/probability-picks` page contains:

- Highest Probability
- Highest Confidence
- Safest Picks
- Highest Quality
- Highest Pitcher Projection
- Highest Team Projection
- Most Stable
- Upset Candidates
- Projection Only
- Parlay Builder with Conservative, Balanced and Aggressive modes plus MLB Only and Multi-Sport scopes

All cards display `Projection Only | No Betting Recommendation`.

## Validation

Deterministic validation covers:

- Probability normalization
- Post-start exclusion
- Recommendation type lock
- Same-game correlation penalty
- Non-product parlay probability blend
- Zero provider calls
- Zero remote mutations
