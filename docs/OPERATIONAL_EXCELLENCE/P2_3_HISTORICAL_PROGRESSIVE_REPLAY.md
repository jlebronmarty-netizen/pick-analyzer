# P2.3 Historical Progressive Replay

Status: production certification pending deployment.

P2.3 implements a bounded, isolated replay engine over stored historical validation evidence. It does not run a broad season replay and does not call providers.

## Readiness Inventory

| Dependency | Status | Evidence |
| --- | --- | --- |
| Historical events | READY | `sport_events` linked by stored historical validation predictions. |
| Historical market snapshots | READY | `sports_odds_snapshots` ids linked from historical feature snapshot metadata. |
| Historical feature snapshots | READY | `historical_feature_snapshots` ids linked from non-production validation rows. |
| Historical results | READY | Settled source rows and terminal event evidence. |
| Frozen engine/version | READY | `historical_progressive_replay_v1`. |
| Replay persistence | READY | `universal_projection_history`, replay-only family. |
| Checkpointing | READY | `historical_import_checkpoints`, bounded checkpoint key. |
| Resume/idempotency | READY | deterministic idempotency keys and existing-row reuse. |
| Provider dependencies | READY | stored-data only; provider calls 0. |

## Certified Execution

- One-event certification: 1 event, 3 predictions, 3 settled, 3 inserted.
- Idempotency rerun: 1 event, 3 predictions, 0 inserted, 3 reused.
- Bounded sample: 10 events, 30 predictions, 30 settled, 27 inserted, 3 reused.
- Bounded metrics: 14 wins, 16 losses, 0 pushes, 46.67% accuracy, 0.2508 Brier, 4.96 calibration error, -6.11 ROI units per 100 predictions.
- Leakage failures: 0.
- Provider calls: 0.
- Provider credits: 0.

## Guardrails

Replay rows are non-production analysis artifacts. They are not Current Era predictions, not recommendation eligible, not Official Pick eligible and not Learning Brain updates.

## Next Action

Deploy and production-certify the runtime endpoints. After P2.3 certification, P2.4 becomes the next eligible phase. MC-03 and MC-08E remain paused/not started.
