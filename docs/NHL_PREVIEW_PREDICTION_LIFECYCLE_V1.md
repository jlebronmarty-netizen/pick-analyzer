# NHL Preview Prediction Lifecycle V1

Generated: 2026-07-28T03:46:53.681Z

Commit: `3ae259e24afd676871f648db45c6f73248cadbce`

Status: NHL_PREVIEW_BLOCKED

## Evidence

- Provider calls made: 0
- Remote mutations made: 0
- Production mutations made: 0
- Stored The Odds API odds rows: 426
- Provider-native event mappings: 32
- Canonical NHL events: 0
- NHL completed result rows: 0
- Engine fixture predictions: 3
- Engine persistence enabled: false

## Gates

| Gate | Result | Blocker |
| --- | --- | --- |
| Exact event identity | BLOCKED | NHL_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED |
| Participant identity | BLOCKED | NHL_CANONICAL_EVENTS_EMPTY |
| Scheduled future starts | BLOCKED | NHL_FUTURE_CANONICAL_EVENTS_EMPTY |
| Historical results | BLOCKED | NHL_COMPLETED_RESULTS_EMPTY |
| Pregame odds | PASS |  |
| Cutoff safety | PASS |  |
| Persistence enabled for real preview rows | BLOCKED | NHL_PERSISTENCE_DISABLED_BY_DESIGN |
| Settlement inputs | BLOCKED | NHL_SETTLEMENT_INPUTS_EMPTY |
| Learning labels | BLOCKED | NHL_SETTLED_LEARNING_SAMPLE_EMPTY |
| Preview/production separation | PASS |  |

## Verdict

NHL remains blocked from Preview prediction activation. Existing NHL prediction architecture and fixture validation are intact, but stored evidence does not prove canonical events, completed results, feature readiness, settlement inputs, goalie context or production-safe prediction persistence.
