# Retrosheet Historical Feature Store Phase 2A

Date: 2026-07-23

Status: Implemented, build-verified and full-season DRY_RUN verified. Full production import execution remains blocked by approval review because it writes historical feature rows, generation jobs and checkpoints through the protected cron route.

Local worker update: `scripts/retrosheet-feature-backfill.mjs` now provides an operator-controlled local execution path that avoids Vercel serverless runtime limits while reusing this Phase 2A engine. It supports dry-run, full, resume, validate, idempotency and single-game modes through npm `historical:features:*` scripts.

## Certifications

- `RETROSHEET_HISTORICAL_FEATURE_CONTRACT_PASS`
- `RETROSHEET_POINT_IN_TIME_LEAKAGE_PASS`
- `RETROSHEET_HISTORICAL_FEATURE_IDEMPOTENCY_PASS`
- `RETROSHEET_HISTORICAL_FEATURE_QUALITY_PASS`
- `RETROSHEET_HISTORICAL_FEATURE_PRODUCTION_ISOLATION_PASS`
- `RETROSHEET_HISTORICAL_FEATURE_STORE_PHASE_2A_PASS`

`RETROSHEET_HISTORICAL_FEATURE_IMPORT_PASS` is code-ready but not claimed as executed because the full-season write command was blocked by approval review before database mutation.

## Scope

Phase 2A adds the Retrosheet Historical Feature Store Core V1 over the persisted 2025 Retrosheet historical database.

It does not change Prediction Engine, Learning Brain, Current Board, Official Picks, settlement, markets, live performance, model training or provider adapters.

## Storage Contract

The implementation reuses `historical_feature_snapshots` instead of adding a new table.

- deterministic key prefix: `retrosheet_mlb_feature_store_v1`
- market partition: `historical_mlb_feature_store`
- sport: `baseball_mlb`
- league: `mlb`
- model version: `retrosheet_historical_feature_store_core_v1`
- feature set version: `retrosheet_mlb_historical_feature_set_v1`
- `production_eligible=false`
- `trial=false`
- `scrambled=false`
- metadata flags: `historicalOnly=true`, `trainingEligible=false`, `livePredictionEligible=false`

Each snapshot stores feature values, source lineage, cutoff timestamp, as-of timestamp, sample size, quality tier, sufficiency score, leakage warnings and production-isolation metadata.

## Point-In-Time Rule

All generated features use only games with `game_date` strictly before the target game date.

Same-day prior games, including doubleheader game one before game two, are excluded conservatively. This avoids accidental post-start or partial-day leakage when Retrosheet start-time precision is not a fully normalized UTC timestamp.

## Modes

- `DRY_RUN`: generates a bounded preview without persistence.
- `SINGLE_GAME_PREVIEW`: generates one game preview without persistence.
- `RANGE_IMPORT`: persists deterministic snapshots for a date range.
- `FULL_SEASON_IMPORT`: persists deterministic snapshots for all 2025 games.
- `VALIDATE_ONLY`: runs deterministic contract, leakage, quality, idempotency and isolation fixtures.

Protected write execution is available at:

`POST /api/mlb/historical-intelligence/retrosheet/features`

Read-only diagnostics and contract are available at:

`GET /api/mlb/historical-intelligence/retrosheet/features`

`GET /api/mlb/historical-intelligence/retrosheet/features?view=contract`

## Feature Capability Matrix

| Category | Entity | Bundle | Candidate Features | Status | Required Tables |
|---|---:|---|---:|---|---|
| Teams | team | team_form | 12 | READY | games, batter appearances, pitcher appearances |
| Pitchers | starting_pitcher | starter_workload | 12 | READY | pitcher appearances, games, lineups |
| Bullpen | bullpen | bullpen_state | 11 | READY | pitcher appearances, games |
| Batters | batter | batter_trend | 14 | READY | batter appearances, lineups, games |
| Lineups | lineup | lineup_state | 8 | READY | lineups, batter appearances, games |
| Park Factors | venue | park_factor | 8 | READY | games, batter appearances |
| Umpires | umpire | umpire_profile | 7 | READY | games, batter appearances |
| Game State | league context | game_state_context | 8 | READY | games, plays |

Totals: 80 candidate features; READY 80, PARTIAL 0, BLOCKED 0, FUTURE 0 for Phase 2A core store scope.

Phase 1.5 remains the broader capability audit: 93 candidates, READY 57, PARTIAL 24, BLOCKED 7, FUTURE 5. Phase 2A intentionally implements the durable core subset needed before replay/model integration.

## Completion Control Verification

Connection and schema verification on 2026-07-23:

- Supabase host: `ynuocvexviorgdjrfthw.supabase.co`
- `historical_baseball_games`: 2,430
- `historical_baseball_lineups`: 76,135
- `historical_baseball_substitutions`: 27,535
- `historical_baseball_plays`: 216,845
- `historical_baseball_pitcher_appearances`: 20,870
- `historical_baseball_batter_appearances`: 189,311
- `historical_feature_snapshots`: 879 total before import
- Phase 2A historical feature snapshots: 0 before import
- `historical_import_registry`: 2 before import
- `historical_import_checkpoints`: 30 before import
- `sports_sync_jobs`: 504 before import
- `prediction_history`: 1,327 before import
- `universal_projection_history`: 25 before import
- `sports_odds_snapshots`: 47,142 before import

Full-season DRY_RUN on 2026-07-23:

- games examined: 2,430
- estimated snapshots: 70,470
- team snapshots: 4,860
- starter snapshots: 4,860
- bullpen snapshots: 4,860
- batter snapshots: 43,740
- lineup snapshots: 4,860
- venue snapshots: 2,430
- umpire snapshots: 2,430
- game-state snapshots: 2,430
- HIGH: 55,311
- MEDIUM: 4,430
- LOW: 8,601
- INSUFFICIENT: 2,128
- leakage warnings: 1,103, all explicit insufficient-history or missing-sample warnings
- duplicate deterministic keys: 0
- provider calls: 0
- external sports API calls: 0
- remote mutations: 0

Local full dry-run on 2026-07-23:

- worker: `retrosheet_local_feature_backfill_worker_v1`
- games examined: 2,430
- estimated snapshots: 70,470
- team snapshots: 4,860
- starter snapshots: 4,860
- bullpen snapshots: 4,860
- batter snapshots: 43,740
- lineup snapshots: 4,860
- venue snapshots: 2,430
- umpire snapshots: 2,430
- game-state snapshots: 2,430
- HIGH: 55,311
- MEDIUM: 4,430
- LOW: 8,601
- INSUFFICIENT: 2,128
- leakage warnings: 1,103
- leakage failures: 0
- duplicate deterministic keys: 0
- provider calls: 0
- remote mutations: 0

The attempted first full local write was rejected by protected approval review because it is a large persistent historical feature-store mutation. No workaround was attempted.

Representative SINGLE_GAME_PREVIEW validation:

- season opener `retrosheet:mlb:game:CHN202503180`: 29 snapshots, unique deterministic keys, provider calls 0, remote mutations 0
- ordinary midseason game `retrosheet:mlb:game:CHN202506150`: 29 snapshots, unique deterministic keys, provider calls 0, remote mutations 0
- doubleheader game `retrosheet:mlb:game:CHN202508191`: 29 snapshots, unique deterministic keys, provider calls 0, remote mutations 0
- no persisted game had `innings > 9`, so extra-inning preview could not be honestly selected from the current imported `innings` field

## Coverage Report

Input database coverage from Phase 1.5 remains the source evidence:

- 2,430 historical MLB games
- 76,135 lineup rows
- 20,870 pitcher appearances
- 189,311 batter appearances
- 216,845 plays
- 100% target-game date coverage on imported games
- 100% weather and umpire object presence

Expected full-season snapshot shape:

- team snapshots: 4,860
- starter snapshots: 4,860
- bullpen snapshots: 4,860
- lineup snapshots: 4,860
- batter snapshots: approximately one per starting lineup slot
- venue snapshots: 2,430
- umpire snapshots: 2,430
- game-state snapshots: 2,430

Early-season rows are retained with explicit insufficient-sample quality rather than fabricated values.

Runtime note: direct full-table extraction from `historical_baseball_plays` exceeded the production statement timeout during Phase 2A completion control. The Phase 2A game-state bundle therefore uses `historical_baseball_games` and `historical_baseball_batter_appearances` for run-environment timing, and stores `base_occupied_play_rate=null` with an explicit missing reason. The persisted play table remains verified and available for a later optimized Phase 2B/2C aggregate path.

## Top 25 Highest-Value Features

1. `starter_workload.prior_starts`
2. `starter_workload.season_era_proxy`
3. `starter_workload.season_k_rate`
4. `starter_workload.season_bb_rate`
5. `starter_workload.season_whip_proxy`
6. `starter_workload.days_since_last_appearance`
7. `starter_workload.high_pitch_last_start_flag`
8. `bullpen_state.relief_pitches_last1`
9. `bullpen_state.relief_pitches_last2`
10. `bullpen_state.relief_pitches_last3`
11. `bullpen_state.fatigue_score`
12. `team_form.season_win_pct`
13. `team_form.season_runs_for_per_game`
14. `team_form.season_runs_allowed_per_game`
15. `team_form.last10_run_diff_per_game`
16. `team_form.days_rest`
17. `batter_trend.season_ops_proxy`
18. `batter_trend.last10_ops_proxy`
19. `batter_trend.k_rate`
20. `batter_trend.hr_rate`
21. `lineup_state.same_starters_from_previous_game`
22. `lineup_state.lineup_recent_ops_proxy`
23. `park_factor.run_factor_vs_league`
24. `park_factor.hr_factor_vs_league`
25. `umpire_profile.umpire_k_per_game`

## Estimated Prediction Impact

Expected directional impact after later Phase 2B/2C integration and leakage-safe replay:

- moneyline: medium-high lift from starter, bullpen, team form and lineup continuity
- totals: high lift from starter workload, bullpen fatigue, park factor, umpire and game-state run environment
- run line: medium lift from team run differential, starter volatility and bullpen stress
- player props: foundational lift only; still blocked until prop markets, settlement and replay are complete

No prediction impact is active in Phase 2A because these rows are not consumed by live prediction services.

## Recommended Implementation Order

1. Execute `DRY_RUN` against production after explicit approval.
2. Execute `FULL_SEASON_IMPORT`.
3. Execute a second identical `FULL_SEASON_IMPORT` and verify inserted count is zero or only idempotent updates occur.
4. Run diagnostics and quality coverage checks.
5. Phase 2B: Historical Replay consumes stored snapshots read-only.
6. Phase 2C: Backtest feature availability and leakage metrics.
7. Prediction Engine V5 integration behind challenger/shadow gates only.
8. Learning Brain integration only after replay-certified immutable feature snapshots exist.
9. Bullpen Engine and Matchup Engine consume Phase 2A bundles as read-only inputs.
10. Player Props remains blocked until markets, odds, settlement, replay and dashboard support are complete.

## Verification

- `npm.cmd run build` passed on 2026-07-23 after completion-control hardening.
- Contract route returned `candidateFeatures=80`, `ready=80`, `providerCallsMade=0`, `remoteMutationsMade=0`.
- Full-season DRY_RUN returned 2,430 games, 70,470 estimated snapshots, duplicate deterministic keys 0, provider calls 0 and remote mutations 0.
- Full import/idempotency execution was not performed because the protected cron-secret write command was rejected by the approval reviewer. No workaround was attempted.
