# PICK-2.0 RESET-03 UI Simplification

Status: `PICK_2_RESET_03_UI_SIMPLIFICATION_CERTIFIED`

RESET-03 replaces the normal product shell with four primary areas:

- Today
- Performance
- Model Lab
- Data Health

The implementation preserves legacy pages and backend APIs outside normal navigation. It does not delete production data, change schemas, import data, generate predictions, alter model/calibration/Official Pick policy, add cron, or activate automation.

## Product Surface

The root page and `/today` now show a Pick Analyzer 2.0 clean-start Today surface. It is explicit that the Pick 2 prediction engine is being rebuilt and no legacy prediction is relabeled as a Pick 2 recommendation.

`/performance` now shows Pick 2 clean-start metrics:

- Predictions: 0
- Evaluated: 0
- Accuracy: N/A
- Brier: N/A
- Log Loss: N/A
- ROI: N/A

`/model-lab` shows that no Pick 2 champion model has been promoted.

`/data-health` shows supported reset-state readiness and keeps Statcast as not yet imported/setup pending.

## Boundary

Legacy pages remain available for audit/bookmark compatibility but are hidden from normal navigation. Existing APIs are preserved. Production data isolation remains intact: provider calls 0, production database mutations 0.
