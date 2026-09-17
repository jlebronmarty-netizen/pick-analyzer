# MLB Totals V11-B Closeout — 2026-09-17

Repository: `jlebronmarty-netizen/pick-analyzer`

Branch: `research/totals-2025-historical-backfill`

Supabase: `ynuocvexviorgdjrfthw`

Status: `RESEARCH_ONLY / REJECTED_VALIDATION_GATE`

## Purpose

Replace the zero-filled historical bullpen workload fields discovered in V11-A with a strict-prior reconstruction from actual pitcher appearances already stored in `mlb_ml_xyear_pitcher_game_v1`.

## Leakage boundary

For each target game, only non-starter appearances satisfying:

`source_game_date < target_game_date`

were used.

Same-day appearances were deliberately excluded because the xyear pitcher-game table does not provide a sufficiently strong chronological contract to prove that an earlier game in a same-day doubleheader occurred before the target game.

## Reconstructed workload features

Per HOME and AWAY bullpen:

- total reliever pitches previous calendar day
- total reliever pitches previous 2 calendar days
- total reliever pitches previous 3 calendar days
- relievers used previous day / previous 2 days
- maximum pitches by one reliever previous day
- maximum 2-day pitch total by one reliever
- relievers with >=20 pitches previous day
- relievers with >=35 / >=45 pitches over 2 days

Game-level aggregates:

- combined bullpen pitches 1/2/3 days
- combined relievers used
- combined high-workload counts
- maximum team workload
- workload imbalance between bullpens

## Coverage / sanity check

2025-04-01 through 2025-08-31:

- games: 1,985
- games where at least one bullpen had prior-day usage: 1,745
- average combined bullpen pitches previous day: 104.34
- average combined bullpen pitches previous 2 days: 208.48
- average combined relievers >=35 pitches over 2 days: 1.04

This proves the earlier zero-filled workload columns were an artifact of that historical feature build, not evidence that bullpen workload data was unavailable in the underlying database.

## Signal tests

Training window: Apr-Jun 2025.

Validation window: Jul-Aug 2025.

Workload correlations with `actual_bullpen_vulnerability_score` were weak. The strongest absolute Jul-Aug correlation among the tested workload variables was approximately 0.0818.

The strongest absolute Jul-Aug correlation with the OVER/UNDER label was approximately 0.0929.

A train-stable quantile-rule search was then run using only Apr-Jun cutoffs and directions. Only one rule survived the train stability filter:

- feature: `away_bp_pitches_1d`
- train cutoff: 15th percentile, LOW
- predicted side: OVER

Jul-Aug validation:

- n = 111
- correct = 54
- accuracy = 48.65%
- worst month = 46.15%
- gate passed = NO

## Interpretation

Raw prior bullpen usage is real and can be reconstructed safely, but it does **not** by itself explain the same-game bullpen vulnerability process strongly enough for Totals prediction.

The negative/weak associations observed should not be interpreted causally as “more bullpen use reduces scoring.” They are likely confounded by team quality, game state, reliever selection, roster composition and which specific relievers were used.

The next useful bullpen feature is therefore not generic team-level pitch volume. It would need to be **individual-reliever availability and quality**, e.g. which high-leverage relievers are likely unavailable, their quality, consecutive-day usage and expected share of bullpen innings.

## Final decision

Registry candidate:

`totals_v11b_reconstructed_bullpen_workload_v1`

State:

`REJECTED_VALIDATION_GATE`

- September 2025 not opened for rescue/tuning.
- 2026 not opened for V11-B selection or validation.
- Official Picks writes: 0.
- APOSTAR activation: false.
- production promotion: false.
- Odds API historical credits consumed: 0.

## Current real blocker

With the currently certified 2025 pregame surface, V1–V11B have exhausted direct formulas, linear models, rules, matchup-cross models, side-run projections, rolling handedness and reconstructed aggregate bullpen workload without a stable 75% candidate.

A genuinely new path now requires information that is not cleanly available in the 2025 pregame evidence set:

1. timestamp-proven 2025 lineups / lineup changes;
2. reliable historical weather / roof conditions;
3. player-level lineup-vs-hand composition;
4. individual high-leverage reliever availability/quality rather than aggregate bullpen workload;
5. injury/roster availability with pregame timestamps.

BALLDONTLIE GOAT can support several of these prospectively/currently, but its MLB lineup history does not solve the missing 2025 timestamp-proven lineup evidence. The Odds API is not the missing source for these baseball-context features.