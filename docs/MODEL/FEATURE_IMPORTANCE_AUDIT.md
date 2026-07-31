# Feature Importance Audit V1

Status: RELEASE 04 LOCAL AUDIT

Source: `src/services/feature-store-core.service.ts`, `src/services/multi-sport-feature-registry.service.ts`, `src/services/current-board.service.ts`, `src/services/sport-prediction-engine-sdk.service.ts`, and existing model documentation.

No feature weights, prediction formulas, provider contracts or data tables were changed.

## Feature Inventory

| Feature | Source | Update Frequency | Sports | Consumers | Impact |
| --- | --- | --- | --- | --- | --- |
| event_context | `sport_events` | 24h max age | NBA, BSN, MLB, NFL, NHL, soccer, tennis, UFC | Feature Store, prediction SDK, performance scope, Current Board | High |
| team_form | `team_stats`, `sport_game_stats`, `sport_standings` | 7d max age | NBA, BSN, MLB, NFL, NHL, soccer | Feature Store, sport prediction SDK, MLB previews | High |
| market_odds | `sports_odds_snapshots` | 120m max age | NBA, BSN, MLB, NFL, NHL, soccer, tennis, UFC | Market alignment, Current Board, recommendation policy | High |
| injury_context | `sport_injuries` | 24h max age | NBA, BSN, MLB, NFL, NHL | Feature Store, recommendation blockers | Medium |
| lineup_context | `sport_players` | 6h max age | NBA, BSN, MLB, NFL, NHL, soccer | Feature Store, Current Board missing-information labels | Medium |
| player_stats_context | `sport_player_stats` | 24h max age | NBA, BSN, MLB, NFL, NHL, soccer | Feature Store, model-readiness checks | Medium |
| basketball_team_intelligence | events, stats, standings | 12h max age | NBA, BSN | Basketball feature sets | Medium |
| basketball_period_context | events, game stats | 12h max age | NBA, BSN | First-half and period market planning | Unknown |
| basketball_playoff_context | events, standings | 12h max age | NBA, BSN | Basketball model readiness | Unknown |
| starter_status_context | `sports_sync_jobs` | 6h max age | MLB | MLB Feature Store, Current Board, official gate warnings | High |
| pitcher_context | sync jobs, players, player stats | 24h max age | MLB | MLB prediction engine, model explanation, Current Board | High |
| weather_context | `sports_sync_jobs` | 6h max age | MLB | MLB totals, run environment explanation | Medium |
| park_context | `sports_sync_jobs` | 30d max age | MLB | MLB totals and run environment explanation | Medium |

## Feature Set Readiness

| Sport | Market Coverage | Status | Notes |
| --- | --- | --- | --- |
| MLB | moneyline, spread/run-line, total | Ready contract, production sample available | Best candidate for Release 05 model-quality work. |
| NBA | moneyline, spread, total | Ready contract, no current production settled sample | Needs production sample before trust claims. |
| BSN | moneyline, spread, total, first half | Partial | Odds, lineups, injuries and period scoring remain not production verified. |
| NFL | spread | Partial | Quarterback and injury impact are not complete. |
| NHL | moneyline | Partial | Goalie-specific features are missing. |
| Soccer | moneyline | Partial | Draw-aware and league-specific features are missing. |
| Tennis | moneyline | Partial | Player-form features are missing. |
| UFC | moneyline | Partial | Fighter-form and bout-specific features are missing. |

## Duplicated Features

No harmful duplicate feature definition was proven. There is intentional overlap between generic `team_form` and sport-specific feature integrations. That overlap should remain until segment-level performance proves a consolidation opportunity.

## Stale Or Weak Features

| Feature | Finding |
| --- | --- |
| injury_context | Often unavailable or optional, and it should remain a confidence reducer rather than a fabricated input. |
| lineup_context | Useful for user trust, but insufficiently complete for Official Pick promotion in several sports. |
| basketball_period_context | Registered for first-half work, but no production settled first-half sample exists. |
| park_context | MLB StadiumID exists; advanced park metadata remains a known completeness gap. |

## Never-Used Or Insufficiently Proven Features

No feature should be deleted from static analysis alone. The features with unknown impact are not dead code; they are future or partial capabilities without enough settled production evidence.

## Model Quality Implication

Market odds, event context and team form are the minimum viable production signal. MLB starter, pitcher, weather and park context are the most likely next quality levers, especially for totals and run-line markets. The system should collect segment evidence before changing any model coefficients.

