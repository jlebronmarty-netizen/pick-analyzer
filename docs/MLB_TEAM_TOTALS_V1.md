# MLB Team Totals V1

Status: Provider-independent architecture implemented. Live provider activation remains blocked until real stored Team Total odds with line, price, sportsbook, timestamp and canonical team side are verified.

## Scope

- Canonical market key: `team_total`
- Period: full game
- Entity: one MLB team
- Supported selections: `Over`, `Under`
- Required live inputs: event ID, team side, line, sportsbook price, snapshot timestamp and pregame cutoff
- Settlement basis: final selected team score only
- Push rule: final team score equals listed team-total line
- Official Picks: disabled

## Readiness Gate

The readiness service `/api/mlb/markets/team-totals` and `npm.cmd run mlb:team-totals:readiness` audit stored data only. They do not call SportsDataIO, mutate Supabase, write predictions, write labels, retrain models, promote weights, update Official Picks or alter replay artifacts.

The gate verifies:

- Real stored Team Total market coverage
- Canonical event and market mapping
- Team identity and side mapping
- Line and sportsbook price availability
- Market timestamp and cutoff contract
- Final team-score settlement support
- Historical outcome availability
- Feature readiness
- Push-aware semantics
- Prediction, learning, calibration and Performance compatibility

## Product Semantics

Team Totals are not added to Current Board, Most Likely, Best Value or Official Picks as actionable candidates unless real odds coverage exists. AI Operations surfaces the readiness status and blocker. Best Value must not display `Odds Pending` as an opportunity for Team Totals; EV is blocked until model probability, sportsbook price and implied probability are all present.

## Certifications

- `MLB_TEAM_TOTALS_ARCHITECTURE_PASS`: requires canonical contract and readiness diagnostics.
- `MLB_TEAM_TOTALS_SETTLEMENT_PASS`: requires deterministic Over, Under and Push fixture validation.
- `MLB_TEAM_TOTALS_SHADOW_PASS`: requires shadow-only activation posture with no production promotion.
- `MLB_TEAM_TOTALS_MARKET_SEMANTICS_PASS`: requires binary and push-capable semantics.
- `TEAM_TOTALS_PROVIDER_READINESS_PASS`: withheld unless real stored Team Total coverage with line and price exists.
