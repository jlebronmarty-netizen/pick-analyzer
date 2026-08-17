# NFL-02 Canonical Historical Import

Status: `NFL_02_CANONICAL_HISTORICAL_IMPORT_READY`

NFL-02 closes the BallDontLie NFL historical acquisition phase and prepares the
canonical import plan from preserved local raw data only.

No provider calls, production database mutations, model training, historical
prediction generation, Current Era Shadow writes, Official Pick activation,
NFL scheduler activation, MLB changes, or NBA changes were performed.

## Source Dataset

The certified BallDontLie NFL raw dataset under `data/imports/balldontlie/nfl`
contains the required P0 model foundation for 2021-2025:

| Feed | Valid records |
| --- | ---: |
| Teams | 32 canonical team records from identity payload |
| Players | 67,795 source rows |
| Games | 1,360 |
| Player game stats | 85,749 |
| Team game stats | 2,718 |
| Season stats | 9,072 |
| Standings | 160 |
| 2025 roster supplement | 3,408 |

The 16 historical failed advanced/original roster payloads are preserved as
`PROVIDER_ERROR_EVIDENCE` and are normalization-ineligible.

## Canonical Destination Plan

NFL-02 reuses existing shared Pick Analyzer tables:

| Destination | Status | Use |
| --- | --- | --- |
| `sports_teams` | READY | NFL team identities |
| `sport_players` | READY | Provider player identities |
| `sport_events` | READY | Historical NFL games |
| `game_results` | READY | Completed game results |
| `sport_game_stats` | READY | Team game stats |
| `sport_player_stats` | READY | Player game and season stats |
| `sport_standings` | READY_WITH_TEMPORAL_RESTRICTION | Validation/research only |
| `sport_lineups` | READY_FOR_FORWARD_ONLY_ROSTER_SUPPLEMENT | 2025 roster supplement |
| `provider_entity_mappings` | READY | Deterministic provider lineage |

## Game Results Production Compatibility

Production `game_results` currently supports the lean canonical result shape:

`id`, `game_id`, `sport_key`, `home_team`, `away_team`, `home_score`,
`away_score`, `winner`, `commence_time`.

NFL-02 keeps richer internal result lineage during normalization, but the
production persistence payload intentionally omits unsupported optional fields:

`league_key`, `result_source`, `metadata`, `updated_at`.

Result lineage remains preserved because each result ID is derived from the
canonical `sport_events.id`, `game_results.game_id` points to that event, the
event stores `provider_ids.balldontlie`, and `provider_entity_mappings` maps
BallDontLie event IDs back to the same canonical event. No schema migration is
required for NFL-02.

## Temporal Contract

Future NFL feature builders must use only prior completed games before a target
kickoff. Same-game stats cannot become same-game pregame features.

Season aggregates and final standings are restricted to validation/research
until as-of safety is certified. The 2025 roster supplement is
`FORWARD_ONLY_OR_UNKNOWN` and is not eligible as historical 2021-2025 replay
truth.

No historical odds, prices, spreads, totals, or lines are fabricated by NFL-02.

## Dry Run Result

`node scripts/nfl-02-canonical-historical-import.mjs --validate`

PASS:

- Teams: 32
- Games: 1,360
- Completed games: 1,359
- Canceled games: 1
- Game results: 1,359
- Production-compatible result payloads: 1,359
- Team game stats: 2,718
- Player game stats: 85,749
- Season stats: 9,072
- Standings: 160
- Roster supplement: 3,408
- Orphans: 0
- Duplicate canonical IDs: 0
- Unsupported production result columns: 0
- Provider calls: 0
- Production database mutations: 0

Known exception: 2022 Week 17 BUF @ CIN, BallDontLie game `6686`, is preserved
as a cancelled/non-final canonical event with no fabricated result.

## Import Boundary

NFL-02 certifies normalization architecture and dry-run row plans only.
Production Supabase import requires a separate explicit authorization.

Next phase: `NFL-02-IMPORT` or equivalent bounded production canonical import,
followed by `NFL-03 TEMPORAL FEATURE CONSTRUCTION + MODEL TRAINING /
HISTORICAL REPLAY`.
