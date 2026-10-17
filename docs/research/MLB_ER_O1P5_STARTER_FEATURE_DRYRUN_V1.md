# MLB ER O1.5 Starter Feature Dry-Run V1

Status: RESEARCH-ONLY / READ-ONLY

## Goal

Repair the operational blocker preventing the frozen Pitcher ER O1.5 model from evaluating many real sportsbook lines.

The ER model itself is unchanged:
- market: Pitcher Earned Runs
- exact line: OVER 1.5
- candidate: `pitcher_er_over_1p5_p70_v1`
- historical event accuracy: 80.22%

## Root cause found

The sportsbook market is available. The missing piece is inconsistent target-day coverage in:

`public.pick2_mlb_pitcher_daily_features`

Observed coverage:
- 2026-09-19: 12 games / 24 pitcher rows
- 2026-09-20: 1 game / 2 rows
- 2026-09-21: 2 games / 4 rows
- 2026-09-22: 14 games / 28 rows
- 2026-09-23: 0 target-day rows at audit time
- 2026-09-24: canonical `pick2_mlb_games` slate not yet materialized at audit time

When rows exist, `k_rate` is populated. Therefore this is a target-day materialization coverage problem, not a model-formula problem.

## Proven writer path

`pg_stat_statements` shows one successful INSERT of exactly 28 rows into `pick2_mlb_pitcher_daily_features`, matching 14 games × 2 pitchers on 2026-09-22.

The physical target and semantic contract are already certified:
- target game linkage: `target_game_pk`
- pitcher identity: `mlbam_pitcher_id`
- strict pregame as-of fields
- feature version: `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`
- source-window rule: `source_game_date < target_game_date`

## Current 2026-09-24 blocker

`sport_events` contains 12 scheduled MLB games, but `pick2_mlb_games` has no 2026-09-24 rows yet.

The quarantined SportsDataIO event metadata lists probable-pitcher field names but does not persist their values. Those rows are not used to fabricate pitcher identity.

Therefore the repair remains fail-closed until canonical gamePk + probable-pitcher MLBAM identity is materialized.

## Dry-run behavior

The companion SQL:
- performs no writes;
- produces exactly two target rows per canonical game when both probable pitchers exist;
- classifies each row as `REUSE_NO_OP`, `INSERT_ELIGIBLE_IF_CANONICAL_PLAN_MATCHES`, or a fail-closed blocker;
- verifies strict prior-date semantics.

## Next gate

After today's canonical slate exists, rerun this dry-run. If it yields the expected 2×game rows with no identity/as-of conflicts, a separately authorized bounded DML repair may insert only missing starter/pitcher feature rows.

No bullpen, batter, matchup, first-inning, Official Picks, APOSTAR, model, threshold, or odds writes are authorized by this dry-run.
