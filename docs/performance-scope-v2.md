# Performance Scope V2

Performance must distinguish:

- generated predictions
- eligible predictions
- settled predictions
- pending predictions
- shadow/model-only predictions
- legacy/test/fixture rows
- superseded model versions

Accuracy denominators use settled win/loss rows only. Pending rows must not display as `0-0 / 0%` without settlement coverage context.

Known issue found on 2026-07-22: public Performance mixes informational preview rows into timelines and uses prediction generated time as the period key. The recovery surface now exposes model-only intelligence separately; deeper timeline rebuilding remains the next phase.

