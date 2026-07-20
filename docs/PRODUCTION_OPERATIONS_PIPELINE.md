# Production Operations Pipeline

Status: Implemented
Version: V1

## Canonical MLB Pipeline

| Step | Source | Existing executor | Mutation behavior | Provider calls |
| --- | --- | --- | --- | --- |
| MLB_SCHEDULE_SYNC | MLB Stats API / SportsDataIO | `executeOperatingDay(morning_sync)` | events, operating day rows | capped |
| MLB_GAME_STATUS_SYNC | MLB Stats API | `executeOperatingDay(status_refresh)` | event status, scores when provider supplies them | 1 per due check |
| MLB_RESULTS_SYNC | MLB Stats API | `executeOperatingDay(sync_results)` | final results/events | 1 per due check |
| MLB_TEAM_STATS_SYNC | SportsDataIO | historical import executor | `sport_game_stats`/`team_stats` | protected |
| MLB_PLAYER_STATS_SYNC | SportsDataIO | historical import executor | `sport_player_stats` | protected |
| MLB_STARTER_SYNC | MLB Stats API / feature context | operating-day preview | feature snapshots | capped |
| MLB_ODDS_SYNC | SportsDataIO | operating-day preview | odds snapshots | capped |
| MLB_FEATURE_REFRESH | Feature Store / preview pipeline | operating-day preview | feature snapshots | no extra calls |
| MLB_PROJECTION_GENERATION | Universal Projection Engine | `/api/projections`, `/api/mlb/projections` | dry-run by default | none |
| MLB_PROJECTION_PERSISTENCE | Universal Projection Engine | protected POST | `universal_projection_history` when migration exists | none |
| MLB_PROJECTION_SETTLEMENT | Projection settlement | projection health/settlement paths | projection metrics | none |
| MLB_PREDICTION_GENERATION | MLB Prediction Engine | operating-day preview | prediction history | no extra calls |
| MLB_CURRENT_BOARD_REFRESH | Current Board | read/rebuild from stored rows | read-only | none |
| MLB_AI_BRIEFING_REFRESH | AI Coach / Today | read/rebuild from stored rows | read-only | none |
| MLB_AI_BRAIN_REFRESH | AI Performance Center | performance daily update | snapshots | none |
| MLB_PERFORMANCE_SNAPSHOT | AI Brain | performance daily update | `ai_performance_snapshots` | none |

## Execution Rule

Adaptive Refresh now delegates due, supported work to the existing operating-day executor rather than creating a second scheduler.

## MLB Status Refresh V1

`executeOperatingDay(status_refresh)` calls MLB Stats API schedule/status for the selected operating date, updates matched `sport_events`, records source/fetched evidence under event metadata, and writes provider-check evidence to `operating_day_lifecycle_events`. `SUCCESS_NO_CHANGE` is valid only when the MLB Stats API provider check completed.

## MLB Odds Refresh Repair V1

`POST /api/operations/adaptive-refresh?dryRun=false` maps due odds work to `executeOperatingDay(midday_refresh)` and now preserves provider-backed intent. The existing SportsDataIO MLB preview service performs the provider check against `GameOddsByDate`, normalizes through `normalizeSportsDataIoMlbGameOdds`, writes `sports_odds_snapshots`, regenerates affected preview predictions through the existing prediction path when accepted odds change, and exposes read-through Current Board and AI briefing freshness.

## Remaining Runtime Blocker

`executeOperatingDay(sync_results)` now uses MLB Stats API schedule/game results for MLB, maps provider games to canonical events, writes `game_results`, updates final event scores and exposes provider-check evidence. The Odds API remains supplemental only for already-approved non-primary uses.
