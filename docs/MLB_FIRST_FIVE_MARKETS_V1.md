# MLB First Five Markets V1

Status: Provider-independent architecture implemented. Live provider activation remains blocked until real stored First Five odds and approved listed-starter/no-action rules are verified.

## Scope

- Canonical market family: `first_five`
- Period: first five completed innings
- Market keys: `first_five_moneyline`, `first_five_run_line`, `first_five_total`
- Required live inputs: event ID, team side where applicable, line where applicable, sportsbook price, snapshot timestamp and pregame cutoff
- Settlement basis: away/home score after exactly five completed innings
- Official Picks: disabled

## Settlement

- First Five Moneyline: selected side leads after five innings; tied score pushes under the two-way F5 contract.
- First Five Run Line: selected first-five score plus line is compared to opponent first-five score.
- First Five Total: combined first-five score is compared to the listed total.
- Push: whole-number run line/total lands exactly on the line, or first-five moneyline ties under the current two-way shadow contract.
- Pending: first-five score basis is unavailable or the event is not final.
- Void: postponed/canceled event or invalid selection/line contract.

## Readiness Gate

The readiness service `/api/mlb/markets/first-five` and `npm.cmd run mlb:first-five:readiness` audit stored data only. They make 0 provider calls, perform 0 remote mutations and do not write predictions, labels, settlements, model weights or Official Picks.

The gate verifies:

- Real stored First Five market coverage
- Canonical event and market mapping
- Team identity and side mapping
- Line and sportsbook price availability
- Market timestamp and cutoff contract
- First-five score settlement support
- Historical outcome availability from Retrosheet inning-level play data
- Feature readiness
- Push-aware semantics
- Prediction, learning, calibration and Performance compatibility
- Listed-starter/no-action rules

## Product Semantics

First Five markets are not added to Current Board, Most Likely, Best Value or Official Picks as actionable candidates unless real odds coverage and starter-change rules exist. Best Value is blocked until model probability, sportsbook price and implied probability are all present. AI Operations exposes the readiness status and blocker.

## Certifications

- `MLB_FIRST_FIVE_ARCHITECTURE_PASS`: requires canonical contract and readiness diagnostics.
- `MLB_FIRST_FIVE_SETTLEMENT_PASS`: requires deterministic F5 Moneyline, Run Line and Total fixture validation plus historical first-five score basis.
- `MLB_FIRST_FIVE_SHADOW_PASS`: requires shadow-only activation posture with no production promotion.
- `MLB_FIRST_FIVE_MARKET_SEMANTICS_PASS`: requires binary and push-capable semantics.
- `FIRST_FIVE_PROVIDER_READINESS_PASS`: withheld unless real stored First Five odds with price are verified.
- `FIRST_FIVE_STARTER_RULES_PASS`: withheld until listed-starter/opener/no-action policy is explicitly approved.
