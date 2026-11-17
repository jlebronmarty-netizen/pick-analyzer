# NBA GOAT formula search V3 — robust profiles and honest uncertainty

**Study cutoff**: 2026-11-16. **Scope**: reconstructed research only, not official NBA picks or calibrated probabilities. PR #340 remains draft and unmerged. No production writes.

## Experimental candidates

`src/lib/nba/goat-formula-lab-v3.mjs` generates **22 preregistered candidate formulas** for each of 4 markets (points/rebounds/assists/threes), 88 candidate × market evaluations in V3:

- L10, L5, median L10/L5, quartile targets Q35/Q40/Q45/Q60.
- EWMA decays .75, .55, .35, .15.
- Robust blend: 25%, 50%, 75% median in L10; 50% median L5; 50% selected quantiles.
- Historical minutes trend: L10 or robust median × sqrt(avg minutes L5 / avg minutes L10), **never** observed target-game minutes.

No player statistic, minute or opponent feature from the target game appears as input. Two explicitly distinct modes:

- `RETROSPECTIVE_RECONSTRUCTED` studies records collected after historical game dates (exploratory).
- `PROSPECTIVE_ASOF_VERIFIED` additionally requires source capture timestamp BEFORE target's frozen pregame cutoff.

Select formula using TRAIN **8–12 Nov**, check on 13–15 Nov (already explored in V1/V2 so **not** independent untouched holdout). Same 183 train cases per market, 26 NBA games; same 256 evaluation cases per market, 22 NBA games. **L10 baseline** has equal sample.

## Exploratory outcomes

| Market | Formula chosen by TRAIN | TRAIN MAE | Reused evaluation MAE | L10 MAE | Improvement |
|---|---|---:|---:|---:|---:|
| Points | L10 | 4.5115 | 5.4250 | 5.4250 | 0 |
| Assists | L10 | 1.4350 | 1.5707 | 1.5707 | 0 |
| Rebounds | 0.5 × L10 + 0.5 × Q35 (prior 10 games) | 1.8997 | **2.0624** | 2.0805 | **+0.0181** |
| Threes | 0.75 × L10 + 0.25 × median L10 | 0.9467 | **1.0680** | 1.0738 | **+0.0059** |

Improvement means lower MAE, not increased win rate; no real bookmaker ROI or prices were evaluated. Scanning many formulas exposes multiple-testing risk. **Do not promote** these candidates on the basis of a previously inspected test window.

### Game-cluster uncertainty (exploratory 22 games)

Paired error reductions per game were aggregated over all player forecasts in that game, and entire NBA games were resampled 4,000 times using a deterministic bootstrap, not individual player rows.

- Rebounds: gain **+0.0181 reb/player-game**; cluster 95% bootstrap interval approximately **[-0.0352,+0.0712]**. Positive in 11 games, negative in 11.
- Three-pointers: gain **+0.0059 threes/player-game**; cluster 95% interval approximately **[-0.0068,+0.0183]**. Positive in 13 games, negative in 7 (2 zero).
- **Both intervals include zero. Neither represents a robust validated improvement.**
- By day 13/14/15 Nov rebound improvements: +0.0170 / -0.0126 / +0.0459; three-pointer improvements -0.0140 / +0.0175 / +0.0046. Sign is not stable.

These intervals are conditional on the already selected formulas and observed test dates; they **do not** correct for selection bias from 88 formula searches or multiple peeks. They should not be called inferential proof.

## Engine status

- V3 pure formula engine: `src/lib/nba/goat-formula-lab-v3.mjs`.
- Tests: `tests/nba-goat-formula-lab-v3.test.mjs`: quantile interpolation, target leakage protection, strict pregame capture gate, duplicate rejection, game-level bootstrap, holdout separation.
- Bounded read-only CLI: `scripts/nba-goat-prop-formula-lab-v3.mjs`. No network by default; `--execute` reads only compact facts and outputs a JSON report. No database writes and no GOAT provider calls.
- No official model, feature flag, recommended pick, production weights, crons or migration in this stage.

## Decision and next validation

1. Save rebounds robust-blend and threes robust-blend as **UNVALIDATED_RESEARCH_HYPOTHESES**, alongside L10; do not overwrite V1/V2 baselines.
2. **Freeze coefficients now**; measure on **future untouched games starting 16 Nov** once compact game facts and as-of-valid pregame features exist. No further tuning based on future holdout labels.
3. Minimum independent coverage and interval excluding zero for a difference are necessary but not sufficient; calibrate by player/market, compare game-cluster confidence intervals, and confirm spread/odds/contract for betting return.
4. Additional searches allowed *only in separate exploratory cohorts*; any newly discovered formula requires its own subsequently frozen independent validation, not the existing 13–15 Nov reuse.
5. Current compact table snapshot (last verified): 192 games through Nov 15, 5,323 player rows. There are **zero** facts from games dated Nov 16 or later, hence no new untouched prospective validation is yet possible.
6. L20 is not yet a real current-season window; do not fabricate additional games or call L14 “L20”.

### Why this matters

Unlike earlier searches that returned only L10, V3 reveals a plausible **small** robust adjustment in rebounding/three-point prediction MAE. It is not yet validated, its effect is tiny relative to the natural game-to-game variability, and we must not confuse maximizing historical accuracy with finding a real actionable sportsbook edge.
