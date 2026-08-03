# P2.1 Supported-Market Prediction Coverage

Status: `LOCAL_VALIDATION_PASS_PENDING_PRODUCTION`

## Mission

P2.1 closes the gap between canonical market availability and persisted Current V2 production predictions.

The current 24-row contract is explained by prior row selection that chose one preferred odds row per event and normalized market. For 8 events and 3 supported markets, that produced 24 rows.

P2.1 makes the expected universe explicit:

- moneyline home and away;
- spread home and away by latest canonical exact line;
- total over and under by latest canonical exact total;
- only when each side exists as canonical stored provider evidence;
- only before cutoff;
- only for the active Current V2 epoch.

## Operational Contract

Every expected selection must reconcile to one state:

| State | Meaning |
| --- | --- |
| `PREDICTION_CREATED` | A matching active-epoch prediction exists. |
| `MISSED_OPPORTUNITY` | A prediction was required before cutoff but is absent. |
| `CUTOFF_MISSED` | The stored market evidence exists, but the prediction is no longer allowed because cutoff passed. |
| `DUPLICATE_COLLAPSED` | Multiple active-epoch predictions match the same expected selection identity. |

The coverage API reports reason counts, market counts, side counts, duplicate rows, missing rows and silent remainder.

## Mutation Boundary

The coverage endpoint is read-only. Any production prediction generation must continue to use the existing protected operating-day writer path.

Certification reads make:

- provider calls: 0;
- remote mutations: 0;
- prediction writes: 0;
- settlement writes: 0;
- learning writes: 0.

## Current Next Step

Deploy the bounded runtime change, then production-certify `/api/operations/prediction-coverage` and one protected writer execution if eligible Current V2 selections remain before cutoff.
