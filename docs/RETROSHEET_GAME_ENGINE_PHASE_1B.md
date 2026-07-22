# Retrosheet Game Engine Phase 1B

Phase 1B reconstructs canonical baseball game objects from Retrosheet event records. It does not create historical features, Learning Brain inputs, predictions, backtests, player props or Statcast integrations.

## Scope

- Canonical game identity, date, teams, venue, metadata, weather, umpires, decisions, score, innings and source lineage.
- Starting lineups with batting order, field position, team side, player source id, canonical player foundation id and source line.
- Substitution chronology with pitching changes, pinch hitters, pinch runners, defensive replacements and position switches.
- Deterministic game-state tracking for inning, half, outs, bases and score.
- Canonical play objects preserving raw Retrosheet event text, parsed result, advances, pitch sequence, score, base state and source lineage.
- Historical starters only: `historicalOnly=true`, `postgameKnown=true`, `pregameEligible=false`.
- Pitcher and batter appearance foundations derived from reconstructed play chronology.
- Validation classifications: `VALID`, `VALID_WITH_WARNINGS`, `QUARANTINED`.
- Read-only diagnostics API and admin page.

## API

`GET /api/mlb/historical-intelligence/retrosheet/game-engine`

Query parameters:

- `limit`: number of game summaries to return, capped at 250.
- `gameId`: optional Retrosheet game id for detailed game, state, lineup, starter, pitcher and batter sections.

The response exposes health, coverage, games, game details, game state, lineups, starters, pitchers, batters, validation and diagnostics. Provider calls and remote mutations are always reported as zero.

## Admin UI

`/admin/historical-diagnostics`

This internal read-only page shows historical game reconstruction health, coverage, validation, parser version and summary rows for reconstructed games.

## Local 2025 Reconstruction Certification

Local diagnostics against `data/imports/retrosheet/2025/raw` reported:

- Event files: 30
- Canonical games: 2,430
- Valid games: 2,332
- Valid with warnings: 98
- Quarantined games: 0
- Lineup entries: 76,135
- Historical starters: 4,860
- Substitutions: 27,535
- Pitcher appearances: 20,870
- Batter appearances: 189,311
- Play objects: 216,845
- Warnings: 99
- Errors: 0
- Provider calls: 0
- Remote mutations: 0

Representative selected game `ANA202504040` reconstructed as `CLE @ ANA`, final score `8-6`, with full source lineage and zero provider calls.

Known warning class: conservative play-state validation can flag impossible-out transitions when Retrosheet play text contains complex runner-out semantics not fully normalized by Phase 1B. The raw event is preserved, the game remains reconstructable and later normalization can refine these transitions without losing lineage.

## Migration

`supabase/migrations/202607220003_retrosheet_game_engine_v1.sql`

The migration is additive and creates:

- `historical_baseball_games`
- `historical_baseball_lineups`
- `historical_baseball_substitutions`
- `historical_baseball_plays`
- `historical_baseball_pitcher_appearances`
- `historical_baseball_batter_appearances`

Rollback approach before production use: drop these six new tables if no downstream objects reference them. After production writes begin, rollback must be data-preserving: disable write routes, export affected tables and use forward repair migrations.
