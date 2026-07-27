# NHL Baseline And Completion Plan V1

Status: empty/blocked baseline certified and future completion plan prepared; no NHL provider calls, imports, SQL, feature rebuilds, predictions, odds sync or production activation are executed.

## Current Baseline

| Dataset | Current rows | State |
| --- | ---: | --- |
| teams | 0 | empty/blocked |
| players | 0 | empty/blocked |
| events | 0 | empty/blocked |
| completed events | 0 | empty/blocked |
| future events | 0 | empty/blocked |
| canonical results | 0 | empty/blocked |
| standings | 0 | empty/blocked |
| team/game stats | 0 | empty/blocked |
| player stats | 0 | empty/blocked |
| boxscores | 0 | empty/blocked |
| period scores | 0 | empty/blocked |
| goalie/starter context | 0 | empty/blocked |
| injuries | 0 | empty/blocked |
| odds snapshots | 0 | empty/blocked |
| player props | 0 | empty/blocked |
| provider identities | 0 | empty/blocked |
| feature snapshots | 0 | empty/blocked |
| predictions | 0 | empty/blocked |
| settlement evidence | 0 | empty/blocked |

## Required Future Manifests

| Manifest | Purpose | Mutation approval required | Provider/source approval required |
| --- | --- | --- | --- |
| nhl_team_player_identity_v1 | load teams, players and provider identity mappings | yes | yes |
| nhl_schedule_results_v1 | load schedule, event identity and final results | yes | yes |
| nhl_stats_boxscores_v1 | load team stats, player stats, goalie stats and boxscores | yes | yes |
| nhl_goalies_injuries_v1 | load probable/confirmed goalies, starters and injuries with as-of timestamps | yes | yes |
| nhl_market_snapshots_v1 | load standard full-game markets only after entitlement proof | yes | yes |

## NHL-Specific Rules

- Use cross-year season governance for NHL seasons.
- Preserve preseason, regular season and postseason classification where source data supports it.
- Treat goalie/starter context as time-sensitive evidence requiring source timestamps.
- Do not use post-start goalie evidence as pregame input.
- Do not fabricate shot, goalie, injury, market or player-prop data.
- Do not generate retrospective predictions for completed games.

## Activation Boundary

NHL remains blocked from production predictions, recommendations, market workflows, feature rebuilds, settlement expansion and Learning Brain updates until approved imports and post-import certification prove enough canonical coverage.

## Certification Markers

- `NHL_BASELINE_AND_COMPLETION_PLAN_V1_PASS`
- `NHL_EMPTY_FOUNDATION_NO_PRODUCTION_OVERCLAIM_PASS`
- `NHL_GOALIE_TEMPORAL_SAFETY_PASS`
- `NHL_IMPORT_MANIFESTS_PLAN_ONLY_PASS`
- `NO_PROVIDER_CALL_E1_PASS`
- `NO_REMOTE_MUTATION_E1_PASS`
- `NO_RETROSPECTIVE_PREDICTIONS_E1_PASS`

Provider calls: 0

Remote mutations: 0

Production mutations: 0

Imports executed: 0

Retrospective predictions generated: 0
