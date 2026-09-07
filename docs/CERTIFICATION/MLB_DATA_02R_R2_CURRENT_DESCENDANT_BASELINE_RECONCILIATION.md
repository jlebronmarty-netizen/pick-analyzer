# MLB Data 02R R2 Current Descendant Baseline Reconciliation

Certification: `MLB_DATA_02R_R2_CURRENT_DESCENDANT_BASELINE_RECONCILIATION_CERTIFIED`

As of: `2026-09-07T13:15:10.872Z`

## Current Snapshot

- Last accepted shared baseline: `861ce9d240daa54749ba88ddd923ea08fdfaeb3b`
- Current local HEAD before sync: `861ce9d240daa54749ba88ddd923ea08fdfaeb3b`
- Current origin/main accepted baseline: `c4be786102c4e88d2b34722e51dc5890d71b564f`
- Current production commit: `c4be786102c4e88d2b34722e51dc5890d71b564f`
- Relationship: compatible descendant candidate
- Merge base: `861ce9d240daa54749ba88ddd923ea08fdfaeb3b`
- Ahead by: 18
- Behind by: 0

## Descendant Scope Audit

The accepted descendant adds 15 files and 2,555 lines, grouped as:

- `PITCHER_K`: strikeout backtest service, strikeout research API, shadow projection service, shadow API, calibration migration, model registry migration.
- `OTHER_PLAYER_PROPS`: pitcher-outs research service/API and batter-hits research service/API.
- `STATCAST_ANALYTICS`: derived Statcast label materialized view and shared raw-backed research views.
- `MIGRATIONS`: six additive pitcher-prop materialized-view/model-registry migrations.
- `MONEYLINE_MODEL`: no changed files.
- `MONEYLINE_FEATURES`: no changed files.
- `PREDICTION_SCHEMA`: no changed files.
- `MARKET_SCHEMA`: no changed files.
- `VALUE_SCHEMA`: no changed files.
- `OFFICIAL_PICK_SCHEMA`: no changed files.
- `VALUE_BOARD`: no changed files.
- `AUTOMATION_CRON`: no changed files in this descendant delta.
- `UI`: research API routes only; no Value Board or Pick2 navigation changes.

## Critical Moneyline Manifest

Future 02R runs must treat these as critical surfaces:

- Champion version/artifact: `MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1`
- Feature set: `MLB_ML_FEATURE_SET_V1`
- Ordered 76-feature builder, input order, preprocessing and leakage contracts.
- Moneyline inference and immutable prediction persistence.
- Native market observation persistence and value-evaluation persistence.
- Official Pick Policy: `MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1`
- Official Pick persistence and immutability.
- Value Board service, route gating and navigation.
- 02R daily-refresh orchestration, provider responsibility contracts and critical migrations touching prediction, market, value, official-pick, raw or native identity tables.

The 18-commit descendant has no breaking critical moneyline touch. Player-prop research additions remain separate and versioned.

## Shared Foundation

Canonical shared layers remain:

- Raw pitch store: `pick2_raw_mlb_statcast_pitches`
- Native games: `pick2_mlb_games`
- Native players: `pick2_mlb_players`
- Read-only Statcast analytics and rollups where certified

No parallel raw pitch-by-pitch store was added. The new materialized views are derived research/read-model surfaces.

## Production Readback

Read-only production HTTP evidence:

- `/api/system/version`: `gitCommit = c4be786102c4e88d2b34722e51dc5890d71b564f`, `providerCallsMade = 0`
- `/api/operations/health`: `HEALTHY`, Vercel primary and GitHub fallback operating-day crons configured at `7-57/10 * * * *`
- `/api/operating-day/automation/status`: scheduler enabled, Vercel cron configured and operational, external scheduler configured, `automaticMultiRefreshActive = false`, next action `status_refresh`, provider calls by readback `0`
- `/api/dashboard/today`: operating date `2026-09-07`, 11 current games, 11 upcoming games, 0 final games, 44 prediction rows, 3 priced grounded rows, provider calls by readback `0`
- `/mlb-value-board`: HTTP 200 with MLB Value Board, Official Pick, Value Candidate, Watchlist and prior top-pick game `823904` markers present
- `/api/current-board?mode=current&limit=200`: 44 predictions evaluated, 30 candidates returned, 14 superseded rows filtered, 0 duplicate rows removed

Research-only route evidence:

- Pitcher strikeout backtest: HTTP 200, `SHADOW_CANDIDATE_ONLY`, `providerCallsMade = 0`, writes `0`, sportsbook odds not used.
- Batter hits backtest: HTTP 200, `SHADOW_CANDIDATE_ONLY`, provider calls at runtime false, betting activation false, leakage detected false.
- Pitcher outs backtest: HTTP 500 from stored-read timeout on quarantined SportsDataIO pitcher-start evidence. This is classified as a research-only route health caveat, not a Pick2 moneyline blocker.

## Pitch-by-Pitch Ingest Inventory

Observed mechanisms:

- `scripts/mlb-data-01b-2025-raw-statcast-import.mjs`: manual historical raw Statcast import into `pick2_raw_mlb_statcast_pitches`; not scheduled.
- `scripts/mlb-data-02h-2026-current-foundation.mjs`: manual 2026 foundation ingest/feature script; broader than 02R current-slate execution and not selected for R2.
- `/api/mlb/statcast` and `/api/mlb/statcast/matchup`: read-only Statcast analytics surfaces.
- Statcast materialized views and indexes under `supabase/migrations/2026090703*` and `2026090704*`: read-only/performance infrastructure.
- No committed active cron was found that continuously ingests pitch-by-pitch Statcast into `pick2_raw_mlb_statcast_pitches`.

Current pitch-by-pitch automation state: `PARTIALLY_AUTOMATED`. Stored raw/current-season foundation exists and shared analytics exist, but continuous pitch-by-pitch ingest appears manual or workstream-specific, not a single certified always-on ingest.

## Cron And Automation Inventory

- Vercel cron: `/api/cron/operating-day`, schedule `7-57/10 * * * *`, production active. Purpose: operating-day continuity, status, odds, results, settlement/performance/daily snapshot under app guards.
- GitHub fallback: `.github/workflows/production-operating-day.yml`, schedule `7-57/10 * * * *`, posts to `/api/cron/operating-day?dryRun=false&scheduler=github-fallback`, uses primary scheduler lease.
- Vercel cron: `/api/cron/nba-current-era-shadow`, schedule `*/30 * * * *`; non-MLB.
- GitHub heartbeat/refresh workflows: observer or manual operating-day health paths.
- Decision Board workflows: validation/audit/live certification/crosswalk persistence workflows. Some manual/live workflows can call The Odds API or player-prop sync only under their own request files and guards.

Automation domain matrix:

- `PICK2_MONEYLINE_AUTOMATION`: ACTIVE through operating-day scheduler infrastructure, but distinct from the manual 02R run.
- `STATCAST_INGEST_AUTOMATION`: UNKNOWN/PARTIAL; no always-on pitch-by-pitch ingest cron certified.
- `PITCHER_K_AUTOMATION`: NOT_PRESENT for betting activation; research API is read-only.
- `PLAYER_PROP_AUTOMATION`: CONFIGURED_MANUAL_GUARDED via Decision Board workflows; not a Pick2 Official Pick authority.
- `DECISION_BOARD_AUTOMATION`: CONFIGURED_MANUAL_GUARDED.
- `ODDS_AUTOMATION`: ACTIVE in operating-day/adaptive-refresh infrastructure.
- `SETTLEMENT_AUTOMATION`: ACTIVE in operating-day scheduler infrastructure.
- `OTHER`: NBA shadow cron active and unrelated to MLB 02R.

## Descendant-Aware Execution Contract

Baseline acceptance states:

- `EXACT_ACCEPTED_BASELINE`
- `COMPATIBLE_DESCENDANT_AUTO_ACCEPT`
- `DESCENDANT_REQUIRES_REVIEW`
- `DIVERGED_BLOCK`

A descendant may be auto-accepted only when:

1. It descends from the last accepted baseline.
2. It is not behind the accepted baseline.
3. It has no `CRITICAL_TOUCH_BREAKING`.
4. It has no unresolved `CRITICAL_TOUCH_REQUIRES_REVIEW`.
5. Champion V1 is preserved.
6. The 76-feature moneyline contract is preserved.
7. Prediction, market, value and Official Pick semantics are preserved.
8. Migrations are additive or compatible.
9. Provider responsibility remains compatible.
10. No destructive raw/native schema mutation is present.

For this audit, `c4be786102c4e88d2b34722e51dc5890d71b564f` is accepted as `COMPATIBLE_DESCENDANT`.

## Run Baseline Freeze Contract

At preflight pass, every manual or automated 02R run must freeze:

- `run_id`
- `run_date`
- `run_as_of`
- `execution_baseline_sha`
- `critical_manifest_digest`
- `pipeline_version`

Later `origin/main` advances must be ignored for that run. If production redeploys mid-run, continue only with proof that the running backend/package still executes the frozen SHA; otherwise stop at checkpoint with `STOP_BASELINE_CHANGED`.

## Execution Checkout Strategy

Preferred future execution strategy:

1. Fetch and audit current origin.
2. Accept exact baseline or compatible descendant.
3. Create an ephemeral worktree or detached checkout at the frozen accepted SHA for local execution tooling.
4. Execute only against the matching production package or from the frozen local checkout.
5. Ignore unrelated later main commits until the run completes.

This allows other chats to continue committing while a current 02R run remains deterministic.

## Shared Pitch-by-Pitch Architecture

Use one shared pitch-by-pitch ingest that writes only `pick2_raw_mlb_statcast_pitches`. Downstream consumers read canonical raw/native/Statcast rollups:

- Moneyline
- Pitcher strikeouts
- Pitcher outs
- Hits allowed
- Earned runs when supported
- Batter hits
- Total bases
- Home runs
- NRFI/first inning
- Decision Board diagnostics
- Future explicitly versioned models

No model-specific engine may independently redownload/store duplicate raw pitch-by-pitch data unless separately justified and authorized.

Recommended non-mutating cadence:

- Pregame schedule sync: discover eligible slate and native identities.
- During-game incremental pitch updates: provisional raw evidence only.
- Postgame final reconciliation: complete pitch identities and labels.
- Overnight completeness reconciliation: detect late Statcast corrections and certify finality.

Raw finality states:

- `LIVE_PROVISIONAL`
- `POSTGAME_PROVISIONAL`
- `FINAL_RECONCILED`

Newly ingested raw data must not mutate historical immutable pregame snapshots; it only affects future target-game feature snapshots.

## Boundaries

- No rollback.
- No delete.
- No provider calls.
- No production DML.
- No production DDL.
- No environment changes.
- No cron changes.
- No migration apply/reapply.
- No model promotion.
- No Official Pick changes.

