# MLB-DATA-01C-R4D Pick 2 MLBAM Native Identity Plan

Status: `MLB_DATA_01C_R4D_PICK2_MLBAM_NATIVE_IDENTITY_PLAN_CERTIFIED`

R4D accepts the architecture decision that SportsDataIO MLB is intentionally cancelled and no longer a required Pick 2 MLB identity dependency. No credential repair, provider probe, production mutation, identity write, feature build, model work, prediction write, 2026 import, automation activation or cron change occurred.

## Identity Decision

- Game identity root: `game_pk`
- Player identity root: `mlbam_person_id`
- Team identity root: existing certified canonical team ids
- SportsDataIO MLB required by Pick 2: `NO`
- SportsDataIO MLB auth repair required: `NO`

## Current Dependency Audit

The current Pick 2 foundation already stores raw Statcast with non-null `game_pk`, but several prepared Pick 2 tables still hard-reference legacy `sport_events.id` or `sport_players.id`. R4D therefore retires the old legacy crosswalk persistence path and certifies an additive native identity migration before 01D feature building.

| Area | Current state | Native plan |
| --- | --- | --- |
| raw Statcast | game_pk: REQUIRED_BY_SCHEMA; source_pitcher_id: OPTIONAL_COMPATIBILITY_CAN_BE_REPLACED_BY_MLB_NATIVE_ID; source_batter_id: OPTIONAL_COMPATIBILITY_CAN_BE_REPLACED_BY_MLB_NATIVE_ID; event_id: OPTIONAL_COMPATIBILITY; canonical_pitcher_id: OPTIONAL_COMPATIBILITY; canonical_batter_id: OPTIONAL_COMPATIBILITY | Keep game_pk and MLBAM source pitcher/batter ids as authoritative; leave legacy mapping columns nullable and non-blocking. |
| daily feature snapshots | subject_id: REQUIRED_BY_SCHEMA; event_id: OPTIONAL_COMPATIBILITY | Add native game/player identity columns and encode subject ids by MLBAM/game_pk, not legacy sport IDs. |
| starter features | player_id: REQUIRED_BY_SCHEMA; sport_players_id: REQUIRED_BY_SCHEMA | Add mlbam_pitcher_id and unique native key; make legacy player_id optional compatibility in the next migration. |
| bullpen/team features | canonical_team_id: REQUIRED_BY_SCHEMA | Keep certified canonical team ids; include game_pk/as_of for target-game-scoped bullpen context. |
| batter/offense features | player_id: REQUIRED_BY_SCHEMA; sport_players_id: REQUIRED_BY_SCHEMA | Add mlbam_batter_id and unique native key; do not use names or legacy player rows as identity roots. |
| matchup features | event_id: REQUIRED_BY_SCHEMA; sport_events_id: REQUIRED_BY_SCHEMA; canonical_team_id: OPTIONAL_COMPATIBILITY | Add game_pk, mlbam_pitcher_id and mlbam_batter_id; make legacy event_id optional after migration. |
| first-inning/F5/NRFI-YRFI features | event_id: REQUIRED_BY_SCHEMA; sport_events_id: REQUIRED_BY_SCHEMA | Add game_pk plus starter/lineup MLBAM ids and as_of fields; do not require legacy event_id. |
| prediction storage | event_id: REQUIRED_BY_SCHEMA; sport_events_id: REQUIRED_BY_SCHEMA | Add game_pk or pick2_mlb_games FK rooted in game_pk; legacy event_id becomes optional compatibility. |
| prediction results | prediction_id: REQUIRED_BY_SCHEMA; result_id: OPTIONAL_COMPATIBILITY; game_results_id: OPTIONAL_COMPATIBILITY | Evaluate through prediction.game_pk and an additive game_pk result adapter or native result column. |
| market-value evaluation / odds | prediction_id: REQUIRED_BY_SCHEMA; odds_snapshot_id: REQUIRED_BY_SCHEMA | Join odds through deterministic market-event crosswalk keyed from game_pk to odds provider event id. |
| Today UI / Performance / Data Health / Model Lab | legacy_identity: LEGACY_ONLY | Preserve empty product surface until native identity migration/backfill/features are separately certified. |

## Native Game Contract

`game_pk` is the authoritative Pick 2 MLB game identity. It is already available for all 2,430 certified 2025 Statcast games, so the seven unresolved legacy `sport_events` doubleheader edges no longer block Pick 2 by design. The recommended storage strategy is a thin `pick2_mlb_games` registry keyed by `game_pk`, with optional `legacy_sport_event_id`.

## Native Player Contract

`mlbam_person_id` is the authoritative Pick 2 MLB player identity. It covers all 1,469 certified 2025 source players through Statcast and MLB Official identity evidence. Names, teams and fuzzy matches are not identity keys. The recommended storage strategy is a dedicated `pick2_mlb_players` registry keyed by `mlbam_person_id`, with optional legacy `sport_players.id` linkage only when exact evidence exists.

## Raw And Feature Semantics

Raw `game_pk`, `source_pitcher_id` and `source_batter_id` become the native identity inputs. The future migration should add clear `mlbam_pitcher_id` and `mlbam_batter_id` compatibility columns rather than destructively renaming existing source fields. Feature tables should key starter, bullpen, batter/offense, matchup, F5 and NRFI/YRFI features by `game_pk`, MLBAM player ids, certified team ids and as-of timestamps.

## Prediction, Results And Markets

Pick 2 predictions should use `game_pk` directly or a native registry FK rooted in `game_pk`. Result evaluation should resolve through `game_pk`, with legacy `game_results.id` kept as an optional compatibility adapter if needed. The Odds API remains market-price-only and must not redefine the sports model's game identity.

## Migration Requirements

- New tables: pick2_mlb_games, pick2_mlb_players, pick2_mlb_game_results_or_game_pk_result_adapter, pick2_market_event_crosswalks
- New columns: pick2_raw_mlb_statcast_pitches.mlbam_pitcher_id, pick2_raw_mlb_statcast_pitches.mlbam_batter_id, pick2_feature_snapshots.game_pk, pick2_feature_snapshots.mlbam_person_id, pick2_mlb_pitcher_daily_features.game_pk, pick2_mlb_pitcher_daily_features.mlbam_pitcher_id, pick2_mlb_batter_daily_features.game_pk, pick2_mlb_batter_daily_features.mlbam_batter_id, pick2_mlb_matchup_daily_features.game_pk, pick2_mlb_matchup_daily_features.mlbam_pitcher_id, pick2_mlb_matchup_daily_features.mlbam_batter_id, pick2_mlb_first_inning_daily_features.game_pk, pick2_game_predictions.game_pk, pick2_prediction_results.game_pk
- New indexes: unique pick2_mlb_games(game_pk), unique pick2_mlb_players(mlbam_person_id), native feature uniqueness by game_pk/mlbam ids/as_of/feature_version, pick2_game_predictions(sport_key, game_pk, predicted_at desc), pick2_market_event_crosswalks(provider, provider_event_id)
- FK changes: add nullable legacy_sport_event_id and legacy_sport_player_id links; do not require legacy FKs for native feature/prediction writes
- Constraints: game_pk > 0; mlbam_person_id > 0; no name-based uniqueness; immutable prediction rows preserved
- RLS changes: enable RLS and service_role all policies on new native tables; authenticated select only where product read surface requires it

The migration contract is additive-only: no drops, destructive alters, deletes, truncates, legacy rewrites or name-based backfills.

## Readiness

- `LEGACY_IDENTITY_NO_LONGER_BLOCKS_01D_BY_DESIGN = YES`
- `MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO`
- `MLB_DATA_01D_PROJECTED_READY_AFTER_NATIVE_IDENTITY_MIGRATION = YES`
- `LEGACY_R5_PERSISTENCE_PLAN_RETIRED = YES`
- Next phase: `MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION`

## Safety

- Provider calls: 0
- SportsDataIO calls: 0
- MLB Official calls: 0
- The Odds API calls: 0
- BALLDONTLIE calls: 0
- Production DML mutations: 0
- Production schema mutations: 0
- Canonical inserts: 0
- Crosswalk writes: 0
- Raw mapping writes: 0
- Feature/model/prediction writes: 0
- 2026 import: 0
- Automation activated: NO
- Active cron added: NO
