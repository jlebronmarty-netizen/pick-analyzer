# NBA Decision Shadow Learning V1 — 2026-11-19

Goal: advance from descriptive NBA Decision Board charts to auditable, prospective frozen statistical predictions and automatic outcome measurement, without changing any existing production official models or using additional paid providers.

## Separate append-only evidence tables
- Migration supabase/migrations/20261119185000_nba_decision_shadow_freeze_v1.sql creates nba_decision_shadow_forecasts_v1 and nba_decision_shadow_outcomes_v1 with RLS, service_role SELECT/INSERT-only grants and mutation-rejection triggers.
- Forecasts store exact GOAT or HoopsAPI quote fingerprint, market, period, side, player identity where applicable, line, price, model version, projected numerical outcome, L5/L10, historical sample and decision timestamp; insert is blocked if decision is within ten minutes of tipoff or afterward.
- Outcomes reference an immutable forecast by hash, contain statistical actual score, MAE, win/loss/push under an explicitly statistical-only rule and independent postgame source evidence.
- A repeated cron attempts the same deterministic forecast ID (ignoreDuplicates), never overwrites existing decisions or outcomes.

## Scheduled work (zero new provider calls)
- New production-only cron /api/cron/nba-decision-freeze at 15:35 and 23:35 UTC (11:35 a.m. and 7:35 p.m. Puerto Rico), after the configured HoopsAPI capture slots. Reads only the current Pick archived feeds, builds numeric SHADOW hypotheses and freezes eligible, recent quotes. For main moneylines it freezes the model-favored winner, for other lines only a strictly positive descriptive projection difference. Neither is an official betting recommendation.
- New production-only cron /api/cron/nba-decision-settle at 12:15 UTC (8:15 a.m. Puerto Rico). Finds unresolved recent forecast IDs, reads GOAT final quarter scores and materialized player stats without making API calls, and writes separate statistical outcomes if trustworthy final evidence exists.
- Both endpoints require CRON_SECRET, VERCEL_ENV=production, the exact UTC window and NBA_DECISION_SHADOW_ENABLED=true. The flag is NOT automatically enabled by code. No URL parameters accepted.
- Results may remain pending if the GOAT final archive or player boxscore arrives late. No forced settlements, bookmaker win claims or synthetic actuals.

## Accuracy and learning safeguards
- The private Preview Decision Board reads status of frozen forecasts, settled outcomes, MAE, sample size, unique games and statistical win rate only if the sample meets the minimum threshold.
- Historic GOAT CURRENT_ERA_SHADOW accuracy (from prediction_history) is displayed separately and is not treated as this new model's prospective accuracy.
- Repeated snapshots of the same game are correlated; report unique games. A positive numeric projection gap is not a calibrated win probability, EV or safe pick.
- No autonomous weight promotion. The system continues to collect and evaluate real outcomes; later candidate parameter studies must use a chronological independent holdout and human review to activate in production.
- The 210-game archived GOAT cohort was downloaded retrospectively; it is NOT used as proof of pregame immutable predictions.
- FanDuel Puerto Rico offered markets and settlement rules remain unverified; settlement labels refer to statistical results only.

## Release and verification sequence
1. Node unit tests cover prospective immutable freeze decisions, provider timestamps, no-future leakage, overtime for H2 but not Q4, player ID matching and safe cron windows.
2. Deploy protected Preview with cron OFF; verify the six-tab read-only dashboard and no live provider calls.
3. Apply additive Supabase migration, run rollback-only DB fixture verification and inspect RLS/grants.
4. Merge reviewed PR only after CI and Vercel build pass; production cron remains OFF until exact endpoint and source readiness are checked.
5. Enable NBA_DECISION_SHADOW_ENABLED only after production gated verification; do not force out-of-schedule provider calls.
6. Observe at least one freeze and one settlement from real scheduled runs, verify immutable row counts, and compare against existing GOAT results before considering it fully operational.

## V2: queue and preregistered paired challengers (2026-11-19)

- Preserves the existing versioned baseline and all original immutable evidence.
- Freeze job writes no more than **240 forecasts per scheduled slot**, shared fairly across slate games and market/period groups. Two slots/day cap model output at 480/day; this prevents unbounded props growth and helps per-game independence.
- Preregisters a small fixed set of **numeric challenger projections** on each eligible forecast before tipoff. For player props: L5/L10 50/50 and 35/65. For period totals: baseline plus or minus 10% of (L5−L10), with the same source and exact contract. These are stored as immutable evidence, **not promoted forecasts**, and never contain a fabricated win probability.
- New read-only SQL functions `read_nba_decision_unsettled_v1` (350 oldest + 350 newest, excludes already-settled) and `read_nba_decision_learning_metrics_v1` (90-day aggregate) replace the fragile 1000-row settlement scan and incomplete scoreboard. They do not consume GOAT or HoopsAPI calls.
- Challenger comparisons are paired on the **same frozen forecast/actual result**, aggregated by independent game before estimating difference and approximate CI. A candidate requires at least 100 distinct games plus further independent holdout and policy review. No automatic learning-weight promotion. Small samples and correlated contracts remain research-only.
- Rollback-only Supabase test verifies read functions, service-role-only grants, exclusion of settled records, paired challenger columns, and leaves no synthetic rows.
- Trigger existing production cron only on its normal schedule; no off-schedule provider or model writes to prove operation.
