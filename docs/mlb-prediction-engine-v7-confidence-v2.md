# MLB Prediction Engine V7 And Confidence Engine V2

## Scope

MLB Prediction Engine V7 is a challenger/shadow-ready integration over the existing prospective prediction path. It reuses the V6 versioning and persistence machinery, preserves champion rows, writes only immutable challenger rows when explicitly confirmed, and makes zero provider calls.

Confidence Engine V2 separates:

- model confidence
- data confidence
- market confidence
- recommendation confidence

It does not collapse these into one unexplained score.

## Inputs Used

- verified starter evidence from stored GamesByDate verification
- starter identity/certainty
- starter cached-stat match coverage where available
- weather, wind and StadiumID
- persisted odds price and market stability
- feature quality and data sufficiency
- source freshness and no-leakage cutoff context
- player identity readiness for resolution only

## Inputs Excluded Or Penalized

- bullpen game-level workload: unavailable, so no positive bullpen edge is allowed
- season-level relief rows: context only, not workload readiness
- confirmed lineups: blocker
- injuries: blocker
- handedness: blocker
- stadium metadata/park factors beyond StadiumID: neutral until cached

## Official Pick Safety

V7 remains challenger by default and does not alter official recommendation thresholds. Official consideration still requires positive EV, positive edge, sufficient data confidence, sufficient market confidence, sufficient recommendation confidence and no critical blocker.

Passing remains a valid recommendation when no wager qualifies.

## Evaluation Status

V7 output is structural and behavioral comparison only until settled samples exist. It must not be described as performance-improved until settlement and calibration support that claim.

