# MLB-04D-D3W Forward Opportunity Writer Lineage

Classification: `MLB_04D_D3W_FORWARD_OPPORTUNITY_WRITER_LINEAGE_CERTIFIED`

Contract: `MLB_04D_D3W_FORWARD_OPPORTUNITY_WRITER_LINEAGE_V1`

## Purpose

The active forward MLB prospective writer now preserves the exact raw model probability and calibrated probability pair for every newly generated eligible prospective row. This is a lineage repair only. It does not change the raw model formula, calibration formula, recommendation policy, settlement, learning, Official Picks, product exposure, or scheduler automation.

## Active Writer

The active scheduled path is:

`runAdaptiveRefresh -> generateMlbProspectivePredictionsFromStoredOdds -> writeSnapshotsAndPredictions`

The legacy SportsDataIO prospective preview route still shares `writeSnapshotsAndPredictions`, but remains authority-gated and skipped in Stage 3 when SportsDataIO is not the product odds authority.

## Storage Contract

New forward rows store the pair in:

- `prediction_history.certification_metadata.rawModelProbability`
- `prediction_history.certification_metadata.calibratedProbability`
- `prediction_history.feature_snapshot.mlb03CalibratedShadow.rawModelProbability`
- `prediction_history.feature_snapshot.mlb03CalibratedShadow.calibratedProbability`

The same payload stores exact event, market, selection, line, sportsbook, odds snapshot, odds timestamp, generated timestamp, cutoff timestamp, prediction id, and feature snapshot id. This creates the same-opportunity binding required by the MLB-04D D3 forward ledger reader.

`prediction_history.model_probability` remains the existing raw SDK percent for prospective rows. D3 ledger consumers must use the explicit metadata pair, not infer a pair from that single field.

## Safety

No old rows are backfilled. Missing raw or missing calibrated values fail closed. The repair does not synthesize raw probability from calibrated probability, does not copy calibrated into raw, and does not reconstruct any value retrospectively.

Provider calls: `0`

Production DB mutations during certification: `0`

Automation activated: `NO`

Active cron added: `NO`

