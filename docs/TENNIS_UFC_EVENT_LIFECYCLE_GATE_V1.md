# Tennis UFC Event Lifecycle Gate V1

Generated: 2026-07-28T03:58:17.796Z

Commit: `46264320bcf562c37e304f441db50f2c0a2a0b94`

Provider calls made: 0

Remote mutations made: 0

Production mutations made: 0

## Tennis

- Status: TENNIS_EVENT_PREVIEW_BLOCKED
- Stored odds rows: 0
- Provider event mappings: 0
- Canonical events: 0
- Completed result rows: 0
- Engine fixture predictions: 2
- Engine persistence enabled: false

| Gate | Result | Blocker |
| --- | --- | --- |
| Tennis event-driven scope | PASS |  |
| Tennis exact event identity | BLOCKED | TENNIS_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED |
| Tennis canonical events | BLOCKED | TENNIS_CANONICAL_EVENTS_EMPTY |
| Tennis scheduled future starts | BLOCKED | TENNIS_FUTURE_CANONICAL_EVENTS_EMPTY |
| Tennis completed results | BLOCKED | TENNIS_COMPLETED_RESULTS_EMPTY |
| Tennis pregame odds | BLOCKED | TENNIS_PREGAME_ODDS_EMPTY |
| Tennis feature readiness | BLOCKED | TENNIS_FEATURES_PARTIAL_OR_EMPTY |
| Tennis cutoff safety | PASS |  |
| Tennis persistence enabled for real preview rows | BLOCKED | TENNIS_PERSISTENCE_DISABLED_BY_DESIGN |
| Tennis settlement inputs | BLOCKED | TENNIS_SETTLEMENT_INPUTS_EMPTY |
| Tennis learning labels | BLOCKED | TENNIS_SETTLED_LEARNING_SAMPLE_EMPTY |
| Tennis preview/production separation | PASS |  |

## UFC

- Status: UFC_EVENT_PREVIEW_BLOCKED
- Stored odds rows: 360
- Provider event mappings: 32
- Canonical events: 0
- Completed result rows: 12
- Engine fixture predictions: 2
- Engine persistence enabled: false

| Gate | Result | Blocker |
| --- | --- | --- |
| UFC event-driven scope | PASS |  |
| UFC exact event identity | BLOCKED | UFC_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED |
| UFC canonical events | BLOCKED | UFC_CANONICAL_EVENTS_EMPTY |
| UFC scheduled future starts | BLOCKED | UFC_FUTURE_CANONICAL_EVENTS_EMPTY |
| UFC completed results | PASS |  |
| UFC pregame odds | PASS |  |
| UFC feature readiness | BLOCKED | UFC_FEATURES_PARTIAL_OR_EMPTY |
| UFC cutoff safety | PASS |  |
| UFC persistence enabled for real preview rows | BLOCKED | UFC_PERSISTENCE_DISABLED_BY_DESIGN |
| UFC settlement inputs | BLOCKED | UFC_SETTLEMENT_INPUTS_EMPTY |
| UFC learning labels | BLOCKED | UFC_SETTLED_LEARNING_SAMPLE_EMPTY |
| UFC preview/production separation | PASS |  |


## Verdict

Tennis remains empty/event-driven and blocked. UFC has genuine stored odds and 12 completed provider score-result rows, but it remains blocked from Preview prediction activation until canonical event identity, settlement inputs, feature readiness, persistence gates and learning labels are certified.
