# P2.3 Historical Progressive Replay Certification

Verdict: PASS pending production deployment observation.

Starting commit: `88da4dcc813236b326469df03a913bbd4d8782bf`.

## Replay Contract

- Scope: `REPLAY`.
- Engine: `historical_progressive_replay_v1`.
- Feature contract: `historical_prediction_snapshot_lineage_pilot_v1`.
- Policy: `p2_3_frozen_engine_replay_policy_v1`.
- Storage: replay-only `universal_projection_history` rows.
- Performance: exposed separately as `replayPerformance`; excluded from Current Era.

## Certification Evidence

| Check | Result |
| --- | --- |
| One historical event processed | PASS |
| Three canonical markets or fewer | PASS |
| Replay settlement created | PASS |
| Rerun idempotency | PASS |
| Bounded 10-event sample | PASS |
| Chronological ordering | PASS |
| Market timestamp before cutoff | PASS |
| Feature timestamp before cutoff | PASS |
| Leakage failures | 0 |
| Provider calls | 0 |
| Current Era writes | 0 |
| Historical row mutations | 0 |
| Production settlement writes | 0 |
| Production learning writes | 0 |

## Results

One-event certification inserted 3 replay rows and settled all 3. The immediate rerun inserted 0 and reused 3. The bounded sample completed 10 events with 30 replay predictions, all settled.

Final bounded replay metrics: 14 wins, 16 losses, 0 pushes, 46.67% accuracy, 0.2508 Brier, 4.96 calibration error and -6.11 ROI.

## Classification

`P2_3_HISTORICAL_PROGRESSIVE_REPLAY_CERTIFIED`

P2.4 is next eligible after production certification. P2.4, MC-03 and MC-08E were not started.
