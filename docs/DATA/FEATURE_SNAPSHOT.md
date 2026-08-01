# Feature Snapshot Analytical Context V1

Status: RELEASE 06 FOUNDATION

Release 06 reuses existing prediction persistence instead of adding a migration. `prediction_history` already carries `feature_snapshot_id`, `feature_set_version`, and `feature_snapshot` for rows that have embedded feature metadata.

## Existing Persistence

| Field | Purpose |
| --- | --- |
| `feature_snapshot_id` | Durable link between prediction and feature snapshot lineage. |
| `feature_set_version` | Version of the feature contract used by the model. |
| `feature_snapshot` | Compact embedded metadata for feature coverage and provenance. |
| `model_version` | Model contract that consumed the feature set. |
| `odds_snapshot_id` | Stored odds evidence used by market alignment. |
| `settlement_details` | Stored settlement evidence and labels. |

## Release 06 Feature Coverage

The segment engine extracts coverage flags from existing snapshot metadata:

- persisted snapshot
- weather snapshot
- park context
- starter context
- bullpen context
- team strength snapshot

No enormous vectors were added. No historical rows were rewritten. No feature generation logic changed.

## Future Persistence Need

Release 07 may add a compact analytical feature summary only if it is additive, versioned and populated prospectively. Historical rows must not be fabricated or rewritten to create false evidence.

