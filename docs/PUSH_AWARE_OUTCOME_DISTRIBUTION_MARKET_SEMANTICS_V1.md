# Push-Aware Outcome Distribution & Market Semantics V1

Date: 2026-07-24

## Scope

This pass corrects product market semantics without changing prediction probabilities, Learning Brain weights, Official Pick policy, settlement outcomes, scheduler behavior, Historical Replay or Historical Feature Store Phase 2A.

## Market Classification

- Moneyline is binary: outcome A plus outcome B equals 100%.
- Run Line and spread at fractional lines such as `+1.5` and `-1.5` are binary.
- Run Line and spread at whole-number lines such as `+1` and `-1` are push-capable.
- Totals at whole-number lines such as `7`, `8` and `9` are push-capable.
- Totals at fractional lines such as `7.5`, `8.5` and `9.5` are binary.

## Product Semantics

- Current Board exposes `marketSemantics`, `binary`, `pushCapable`, `outcomeCount` and `supportsPush` at candidate level and in the response semantics summary.
- Binary Most Likely uses the stored selected-side probability and its derived complement to rank the highest-probability outcome.
- Push-capable Most Likely does not reconstruct the opposite side as `100 - selected probability`; it shows the stored selected-side probability with unknown push probability semantics.
- Best Value ranks only actionable positive EV and positive edge. Push-capable markets with unknown push probability are blocked from actionable EV ranking with `UNKNOWN_PUSH_PROBABILITY`.
- AI Feed carries the same semantics and explains binary versus Win/Push/Loss markets.
- Performance scope counts pushes as settled outcomes but excludes pushes from win/loss accuracy and Brier scoring denominators.
- Settlement Core already grades whole-number spreads/totals as push when the result lands exactly on the line; no settlement logic was changed.

## Validation

- `validateMarketSemanticsFixtures()` covers Moneyline, Run Line `+1.5`, `-1.5`, `+1`, `-1`, and Totals `7`, `7.5`, `8`, `8.5`, `9`, `9.5`.
- `validateMarketAlignmentFixtures()` verifies push-capable markets with unknown push probability are not actionable EV.
- `validatePerformanceScopeV2Fixtures()` verifies pushes count as settled but are excluded from accuracy and Brier scoring.
- `npm.cmd run build` passed.

## Certifications

- `MARKET_SEMANTICS_PASS`
- `PUSH_AWARE_DISTRIBUTION_PASS`
- `SETTLEMENT_PUSH_PASS`
- `PERFORMANCE_PUSH_PASS`
- `PRODUCT_MARKET_SEMANTICS_COMPLETE`
