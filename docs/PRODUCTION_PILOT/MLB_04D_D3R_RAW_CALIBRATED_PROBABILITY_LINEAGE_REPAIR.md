# MLB-04D-D3R Raw / Calibrated Probability Lineage Repair

Classification: `MLB_04D_D3R_RAW_CALIBRATED_PROBABILITY_LINEAGE_REPAIR_CERTIFIED`

MLB-04D-D3R repairs the forward research-ledger probability contract after D3 found a real payload blocker: current stored prospective-preview evidence had one `model_probability` value but no separate raw model probability for the same exact event, market, selection, line, sportsbook and pregame snapshot opportunity.

The repair does not backfill, infer or recreate raw probabilities for existing rows. Old rows without explicit raw and calibrated probability lineage fail closed with `RAW_MISSING`, `CALIBRATED_MISSING` or `PROBABILITY_AMBIGUOUS`.

## Forward Contract

Future ledger serialization requires an explicit pair:

- `raw_probability`: the raw model probability before calibration.
- `calibrated_probability`: the calibrated probability after the certified MLB calibrated-shadow artifact.
- Both probabilities must be bound to the same event, market, selection, exact line, sportsbook, odds timestamp, snapshot timestamp and cutoff.

`prediction_history.model_probability` is not enough by itself. It is calibrated only for explicit `MLB_CALIBRATED_SHADOW_V1` / `CURRENT_ERA_SHADOW` rows that also preserve raw lineage in `certification_metadata` or `feature_snapshot.mlb03CalibratedShadow`. Prospective-preview rows with only a single value remain ambiguous for MLB-04D-D3 ledger purposes.

## Storage Decision

The forward-safe storage root is the existing calibrated-shadow convention:

- `prediction_history.certification_metadata.rawModelProbability`
- `prediction_history.certification_metadata.calibratedProbability`
- `prediction_history.feature_snapshot.mlb03CalibratedShadow.rawModelProbability`
- `prediction_history.feature_snapshot.mlb03CalibratedShadow.calibratedProbability`

The future `mlb_forward_research_ledger` row copies those values only after the lineage extractor returns `PAIR_READY`.

## Safety

- No model formula changed.
- No calibration artifact changed.
- No ledger rows were created.
- No Observation #4 was created.
- No automation was activated.
- No provider calls were made.
- No production database mutations were made.
- No prediction, snapshot, settlement, learning, calibration, Official Pick or product rows were written.

## D3 Fixture Outcome

The D3 example `ATH @ HOU`, `MORNING`, FanDuel, Total Under 9.0 remains blocked for ledger persistence because its current stored row lacks an explicit raw/calibrated pair. The repair is forward-only: it prevents future D3 rows from reaching ledger serialization unless both probabilities are present and identity-bound.

## Next Phase

Publish D3R, then rerun D3 preview on a fresh forward slate. If current rows still lack explicit raw probability lineage, the correct classification is still a fail-closed observation state rather than a fabricated ledger row.
