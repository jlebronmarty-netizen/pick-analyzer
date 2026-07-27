# NBA Result And Stat Completion Plan V1

Status: plan-only; no NBA result, stat, boxscore, lineup, injury, odds or prediction import is executed.

This phase converts the partial NBA baseline into a bounded completion plan. It keeps NBA production activation blocked until a later explicit approval authorizes source access, provider budget, import mutation limits and post-import validation.

## Current Baseline

| Dataset | Current rows | Completion state |
| --- | ---: | --- |
| events | 14 | partial/trial |
| completed events | 13 | partial/trial |
| canonical results | 0 | blocked |
| team/game stats | 18 | partial/trial |
| player stats | 918 | partial/trial |
| boxscores | 18 | partial/trial |
| period scores | 14 | partial |
| starters/lineups | 758 | partial/trial |
| injuries | 6 | partial/trial |
| odds snapshots | 540 | partial/trial |
| player props | 0 | blocked |

## Required Completion Manifests

| Manifest | Purpose | Source class | Mutation approval required | Provider approval required |
| --- | --- | --- | --- | --- |
| nba_schedule_results_v1 | fill regular season/playoff schedule and canonical final results | SportsDataIO or approved official source | yes | yes unless local fixture/manual source is approved |
| nba_boxscores_team_stats_v1 | fill team stats and boxscore summaries | SportsDataIO or approved official source | yes | yes unless local fixture/manual source is approved |
| nba_player_stats_v1 | fill player game logs and stat rows | SportsDataIO or approved official source | yes | yes unless local fixture/manual source is approved |
| nba_lineups_injuries_v1 | fill starters/lineups/injuries with as-of timestamps | SportsDataIO or approved official source | yes | yes unless local fixture/manual source is approved |
| nba_market_snapshots_v1 | fill current/full-game market snapshots only where entitlement is proven | SportsDataIO or The Odds API | yes | yes |

Player props remain out of scope until a separate NBA prop ingestion, identity, market normalization, settlement and UI certification exists.

## Idempotency Rules

- Schedule rows must use deterministic sport, season, provider event ID and scheduled-start identity.
- Canonical results must be one row per event/source/result type and must not overwrite locked settlement evidence.
- Team stats must key by event, team and source.
- Player stats must key by event, player/provider ID, team and source.
- Boxscore summaries must key by event and source.
- Lineups and injuries must include provider timestamp or as-of timestamp.
- Odds snapshots must retain provider, bookmaker, market, outcome, line, price and snapshot timestamp.

## Temporal Safety

- Pregame prediction features may only use data available before prediction cutoff.
- Final results and boxscore stats are allowed only for settlement, replay labels and historical training windows after event completion.
- Injury and lineup rows must preserve as-of timestamps and cannot be treated as pregame evidence without source time.
- No retrospective predictions may be generated for already completed events.

## Post-Import Gates

A future approved import must prove:

- canonical results are populated for imported completed events
- team and player stat natural keys have no duplicates
- boxscore counts reconcile to completed imported events
- player identity conflicts are quarantined
- provider call count stays inside approved budget
- remote mutation count matches the approved manifest
- no prediction rows are overwritten
- no production NBA activation occurs automatically

## Blockers

- provider/source approval is not granted in this phase
- production mutation approval is not granted in this phase
- canonical NBA results remain 0 before import
- full schedule/stat/boxscore coverage is not certified
- player props remain unavailable
- production prediction readiness remains blocked

## Certification Markers

- `NBA_RESULT_STAT_COMPLETION_PLAN_V1_PASS`
- `NBA_IMPORT_MANIFESTS_PLAN_ONLY_PASS`
- `NBA_TEMPORAL_SAFETY_V1_PASS`
- `NBA_NO_RETROSPECTIVE_PREDICTIONS_C2_PASS`
- `NO_PROVIDER_CALL_C2_PASS`
- `NO_REMOTE_MUTATION_C2_PASS`

Provider calls: 0

Remote mutations: 0

Production mutations: 0

Imports executed: 0

Retrospective predictions generated: 0
