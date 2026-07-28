# NFL Preview Prediction Lifecycle V1

Generated: 2026-07-28T03:43:15.008Z

Commit: `a792d9d868a2cc7f641c6a3da80c306559d855d6`

Status: NFL_PREVIEW_BLOCKED

## Evidence

- Provider calls made: 0
- Remote mutations made: 0
- Production mutations made: 0
- Stored The Odds API odds rows: 1978
- Provider-native event mappings: 75
- Canonical NFL events: 0
- NFL completed result rows: 0
- Engine fixture predictions: 4
- Engine persistence enabled: false

## Gates

| Gate | Result | Blocker |
| --- | --- | --- |
| Exact event identity | BLOCKED | NFL_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED |
| Participant identity | BLOCKED | NFL_CANONICAL_EVENTS_EMPTY |
| Scheduled future starts | BLOCKED | NFL_FUTURE_CANONICAL_EVENTS_EMPTY |
| Historical results | BLOCKED | NFL_COMPLETED_RESULTS_EMPTY |
| Pregame odds | PASS |  |
| Cutoff safety | PASS |  |
| Persistence enabled for real preview rows | BLOCKED | NFL_PERSISTENCE_DISABLED_BY_DESIGN |
| Settlement inputs | BLOCKED | NFL_SETTLEMENT_INPUTS_EMPTY |
| Learning labels | BLOCKED | NFL_SETTLED_LEARNING_SAMPLE_EMPTY |
| Preview/production separation | PASS |  |

## Verdict

NFL remains blocked from Preview prediction activation. Existing NFL prediction architecture and fixture validation are intact, but stored evidence does not prove canonical events, completed results, feature readiness, settlement inputs or production-safe prediction persistence.
