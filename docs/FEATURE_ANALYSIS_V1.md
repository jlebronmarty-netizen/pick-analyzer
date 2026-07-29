# Feature Analysis V1

Date: 2026-07-29

Status: READ-ONLY FEATURE INVENTORY

No model training. No production mutation.

## Inventory

Read-only feature metadata analysis inspected:

- Linked prediction rows: 2,595
- Linked feature snapshot IDs: 1,691
- Feature snapshots read: 1,691
- Unique feature keys observed: 366

## Feature Categories

| Category | Observed Key Count |
| --- | ---: |
| Schedule context | 52,632 |
| Team strength | 26,107 |
| MLB pitching | 24,624 |
| Market pricing | 19,404 |
| MLB offense | 18,432 |
| Other | 7,577 |
| Model-output or label-risk fields | 6,106 |
| Environment | 1,008 |
| Roster availability | 54 |

## High-Value Future Features

- Market pricing and implied probability context.
- MLB starter and bullpen features.
- Team strength and recent form.
- Weather, park and stadium context.
- Schedule, home/away and rest context.

## Missing Feature Categories

- Multi-season form.
- Closing-line evaluation-only fields.
- Injury and lineup confidence.
- Travel and rest depth.
- Market movement history.

## Redundancy And Leakage Notes

Market price, implied probability, edge and model-output-like fields require leakage audit before training. Team strength and recent form features may be correlated and should be regularized or grouped. Pitching, weather and park features are likely high-value MLB differentiators, but importance cannot be claimed until a future approved training run and walk-forward validation exist.

Statistical feature importance and correlation were not computed in this phase because that would require model fitting or training-style analysis.
