# MLB Pitcher Data Audit V1

Status: PARTIAL

Audit timestamp: 2026-07-26

## Baseline Verification

- Local HEAD: `2d0e3bdd3dc38a76f6dcd23a41aff147ec85c517`
- `origin/main`: `2d0e3bdd3dc38a76f6dcd23a41aff147ec85c517`
- Certified tag: `v1.0-platform-certified` exists locally
- Worktree before implementation: clean
- Production `/api/system/version`: commit `2d0e3bdd3dc38a76f6dcd23a41aff147ec85c517`, provider calls `0`

## Current Data Inventory

Read-only Supabase counts:

- `sport_events` MLB rows: 4,922
- `sport_players` MLB rows: 7,389
- `provider_entity_mappings` MLB player rows: 7,389
- `sport_lineups` MLB starting pitcher rows: 27
- `sport_player_stats` MLB rows: 47,232
- `historical_baseball_games` rows: 2,430
- `historical_baseball_pitcher_appearances` rows: 20,870
- Historical starter pitcher rows: 4,860
- Historical starter rows with recorded outs: 4,860
- Historical starter rows with pitch count: 4,859

## Canonical Sources

Player identity:

- Source: `sport_players`, `provider_entity_mappings`
- Provider: SportsDataIO for current identity, Retrosheet for historical IDs
- Coverage: strong for SportsDataIO player rows; historical bridge is limited because current SportsDataIO IDs do not currently expose a canonical Retrosheet ID in sampled metadata
- Reliability: current player identity is grounded; historical matching is exact-name based in V1 and treated as a quality limitation

Starter information:

- Source: `sport_lineups`
- Service: `mlb-starter-intelligence.service.ts`
- Provider lineage: SportsDataIO GamesByDate starter evidence persisted by existing pregame starter evidence flow
- Coverage: 27 stored starting pitcher rows in audit sample
- Freshness: source timestamps stored per row; post-start and stale rows are blocked by feature leakage counters

Game logs:

- Source: `historical_baseball_pitcher_appearances`
- Supporting source: `historical_baseball_games`
- Fields available: game date, home/away, started, innings via outs, recorded outs, pitch count, batters faced, strikeouts, walks, hits, earned runs proxy from runs, decision
- Fields unavailable or partial: home runs allowed, true earned/unearned split, current-season-only scoping, current provider game-log row bridge
- Historical depth: 4,860 starter rows
- Recorded-outs null rate: 0% among starter rows
- Pitch-count null rate: approximately 0.02% among starter rows

Season data:

- Source: computed from historical starter game logs
- Available: starts, average/median/stdev outs, average innings, average/median pitch count, pitches per inning, batters faced per inning, strikeout rate, walk rate, WHIP proxy, ERA proxy
- Missing: FIP, times through order, manager hook tendency

Matchup data:

- Source: `sport_events` team/opponent mapping; lineup context is not used by V1 pitcher outs projections
- Available: opponent ID/name, home/away, scheduled start
- Missing: confirmed opposing lineup quality, handedness split, park factor, weather, umpire, bullpen availability
- V1 behavior: numeric projections may proceed with opponent mapping, but opponent analytical features are marked limited and penalize quality/confidence

## Readiness Levels

- FULL: confirmed starter, mapped pitcher, mapped event/opponent, at least 15 historical starts with recorded outs, recent five-start workload, no leakage counters.
- STANDARD: probable or confirmed starter, mapped pitcher, mapped event/opponent, at least 8 historical starts with recorded outs, recent three-start workload, no leakage counters.
- LIMITED: expected/probable/confirmed starter, mapped pitcher, mapped event/opponent, at least 3 historical starts with recorded outs, no leakage counters.
- INSUFFICIENT: missing pitcher ID, missing event, unverified starter, fewer than 3 historical starts, no recorded-outs history, no recent workload, missing opponent mapping, or invalid feature timestamps.

League-average fallbacks are not used in V1 numeric pitcher projections.
