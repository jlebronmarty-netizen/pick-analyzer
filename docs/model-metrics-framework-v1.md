# Model Metrics Framework V1

Model Metrics Framework V1 generalizes model performance metrics over stored prediction history.

## Scope

- Brier score
- ROI
- units
- win/loss/push counts
- win rate
- sample-size warnings
- sport splits
- market splits
- confidence splits
- data-sufficiency splits
- model-version splits

## Files

- `src/services/model-metrics-framework.service.ts`
- `src/app/api/model/metrics/route.ts`
- `src/components/dashboard/ModelMetricsFrameworkPanel.tsx`

## API

`GET /api/model/metrics`

Reads `prediction_history` and returns typed metrics. It makes zero provider calls.

## Empty Data Behavior

If no settled predictions exist, the API returns:

- `success: true`
- `status: empty`
- zero sample counts
- `brierScore: null`
- typed empty split arrays where applicable

## Future Work

- Adopt shared metrics in NBA backtesting/calibration where behavior matches exactly.
- Add model rollout comparison when Prediction Engine V5 is ready.
- Persist metric snapshots only if operational reporting needs historical metric runs.
