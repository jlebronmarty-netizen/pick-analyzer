# NBA-02B2 Bulk Model Replay

Status: `NBA_02B2_BULK_MODEL_REPLAY_PASS_READY_FOR_PRICE_AWARE_EVALUATION`

NBA-02B2 persisted the complete certified NBA historical model-replay universe
as isolated `HISTORICAL_REPLAY_SHADOW` rows. NBA Current Era remained
inactive, no provider calls were made, and settlement stayed preview-only.

## Replay Volume

| Metric | Count |
| --- | ---: |
| Replay-ready events | 3710 |
| Expected logical predictions | 14840 |
| Existing replay predictions before bulk | 96 |
| Existing canary predictions | 96 |
| Inserted during bulk | 14744 |
| Reused during bulk | 96 |
| Missing after readback | 0 |
| Duplicate logical rows | 0 |

## Isolation

- NBA Current Era writes: 0
- Official Pick writes: 0
- Production learning writes: 0
- Production calibration writes: 0
- Replay product visibility: 0
- Provider calls: 0

## Next

NBA-02B3 price-aware historical evaluation is ready after explicit
authorization. NBA production and scheduler remain inactive.
