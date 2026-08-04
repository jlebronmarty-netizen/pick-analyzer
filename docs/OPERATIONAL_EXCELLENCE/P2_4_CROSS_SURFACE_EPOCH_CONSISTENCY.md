# P2.4 Cross-Surface Epoch And Performance Consistency

Status: PRODUCTION CERTIFIED.

P2.4 closes the product consistency gap between current-day surfaces, Current Era Performance and Historical Replay. The repository now exposes one bounded read-only E2E integrity contract named surfaceConsistency.

## Certified Contract

- Active epoch: CURRENT_V2_PRODUCTION.
- Legacy scope: LEGACY_PRE_V2.
- Replay scope: REPLAY.
- Current Era expected counts: 69 canonical, 24 settled, 45 pending, 0 blocked.
- Replay expected counts: 30 predictions, 30 settled, 0 pending.
- Homepage, Dashboard and Current Board use current operating-day scope.
- Performance uses Current Era scope and reports Replay separately.
- Recommendation surfaces may intentionally show fewer rows because their filters are stricter than prediction existence.

## Operational Result

The E2E integrity endpoint now reports scope-explained differences instead of allowing silent contradictions. It also exposes count equations and stale subsystem warnings in the same payload.

## Safety

Provider calls: 0.
Remote mutations: 0.
Prediction writes: 0.
Result writes: 0.
Settlement writes: 0.
Learning writes: 0.
Scheduler changes: none.
Model policy changes: none.
