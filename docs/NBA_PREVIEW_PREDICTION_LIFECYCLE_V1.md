# NBA Preview Prediction Lifecycle V1

Generated: 2026-07-28T03:39:15.748Z

Commit: `a230ceffa7319b9ad007c43c9a8dad1ad1252ae9`

Status: NBA_PREVIEW_BLOCKED

## Evidence

- Provider calls made: 0
- Remote mutations made: 0
- Production mutations made: 0
- Dry-run predictions generated: 0
- Dry-run predictions saved: 0
- Events scanned by engine: 0
- NBA future events: 0
- NBA The Odds API odds rows: 0
- NBA completed result rows: 0

## Gates

| Gate | Result | Blocker |
| --- | --- | --- |
| Exact event mapping | BLOCKED | NBA_EXACT_EVENT_MAPPING_NOT_CERTIFIED |
| Valid future start times | BLOCKED | NBA_FUTURE_EVENTS_EMPTY |
| Pregame The Odds API odds evidence | BLOCKED | NBA_THE_ODDS_API_ODDS_EMPTY |
| Minimum historical result evidence | BLOCKED | NBA_CANONICAL_GAME_RESULTS_EMPTY |
| Feature contract passes | BLOCKED | NBA_FEATURE_SAMPLE_NOT_AVAILABLE_FOR_CURRENT_EVENTS |
| No post-start leakage | PASS |  |
| Prediction persistence dry-run compatible | PASS |  |
| Cutoff classification works | PASS |  |
| Supported markets settle deterministically | PASS |  |
| Learning-label derivation can remain scoped | PASS |  |
| Preview rows separate from Production performance | PASS |  |
| Idempotent rerun safe | PASS |  |

## Verdict

NBA Preview predictions remain blocked. The existing NBA engine was reused in persist-off mode, but no Preview rows were persisted because the lifecycle gates do not pass. This checkpoint made no provider calls, generated no retrospective predictions and changed no model, threshold, settlement, Learning Brain or Official Pick policy.
