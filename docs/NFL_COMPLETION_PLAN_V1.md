# NFL Completion Plan V1

Status: plan-only; no NFL provider calls, imports, SQL, feature rebuilds, predictions, odds sync or production activation are executed.

This phase converts the empty/blocked NFL baseline into bounded future completion manifests. It preserves season-year governance and blocks production usage until a later approval explicitly authorizes source access, provider budget, mutation limits and post-import certification.

## Current Baseline

| Dataset | Current rows | State |
| --- | ---: | --- |
| teams | 0 | empty/blocked |
| players | 0 | empty/blocked |
| events | 0 | empty/blocked |
| canonical results | 0 | empty/blocked |
| standings | 0 | empty/blocked |
| team/game stats | 0 | empty/blocked |
| player stats | 0 | empty/blocked |
| boxscores | 0 | empty/blocked |
| starters/lineups/depth charts | 0 | empty/blocked |
| injuries | 0 | empty/blocked |
| odds snapshots | 0 | empty/blocked |
| provider identities | 0 | empty/blocked |
| feature snapshots | 0 | empty/blocked |
| legacy predictions | 190 | preserve only |

## Required Future Manifests

| Manifest | Purpose | Mutation approval required | Provider/source approval required |
| --- | --- | --- | --- |
| nfl_team_player_identity_v1 | load canonical teams, players and provider identity mappings | yes | yes |
| nfl_schedule_results_v1 | load season schedule, event identities and final results | yes | yes |
| nfl_stats_boxscores_v1 | load team stats, player stats and boxscores | yes | yes |
| nfl_injuries_depth_charts_v1 | load injuries, starters, depth charts and as-of roster context | yes | yes |
| nfl_market_snapshots_v1 | load standard full-game markets only after entitlement proof | yes | yes |

Player props, alternate lines, live markets, EV, Kelly, staking, Official Picks and Portfolio workflows remain out of scope.

## NFL-Specific Rules

- Use NFL season year, not calendar year, as the primary season identifier.
- Preserve cross-calendar postseason association with the originating season.
- Separate preseason, regular season and postseason when source data supports it.
- Require neutral-site and international-game metadata where available.
- Do not treat depth chart or injury data as pregame evidence without source timestamps.
- Do not generate retrospective predictions for imported completed games.

## Post-Import Gates

A later approved import must prove:

- all imported teams and events have deterministic provider identity
- final results reconcile to completed events
- team/player stat natural keys have no duplicates
- injury and depth-chart rows preserve as-of timestamps
- market rows preserve sportsbook, market, line, price and snapshot timestamp
- legacy prediction rows remain unchanged
- no production NFL activation occurs automatically

## Certification Markers

- `NFL_COMPLETION_PLAN_V1_PASS`
- `NFL_IMPORT_MANIFESTS_PLAN_ONLY_PASS`
- `NFL_SEASON_YEAR_GOVERNANCE_PASS`
- `NFL_NO_RETROSPECTIVE_PREDICTIONS_D2_PASS`
- `NO_PROVIDER_CALL_D2_PASS`
- `NO_REMOTE_MUTATION_D2_PASS`

Provider calls: 0

Remote mutations: 0

Production mutations: 0

Imports executed: 0

Retrospective predictions generated: 0
