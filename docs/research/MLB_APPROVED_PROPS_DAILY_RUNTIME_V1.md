# MLB Approved Props Daily Runtime V1

Status: RESEARCH-ONLY / SHADOW-ONLY

## Operational contract

The existing authenticated MLB Statcast cron remains the only scheduler. Current-market capture runs during the existing 10:15 and 10:45 Puerto Rico invocations; the immutable daily evaluator may freeze only from 10:45 through 10:59 and must finish before first pitch.

A row is QUALIFIES_MARKET_VERIFIED only when the frozen model qualifies and there is an exact pregame line, sportsbook, price, provider timestamp, canonical gamePk and exact persisted MLBAM player ID. Unresolved identity or missing exact line can never be called an available play.

The only top-level daily statuses are:

- QUALIFIES_MARKET_VERIFIED
- MODEL_QUALIFIES_MARKET_NOT_VERIFIED
- NO_PLAY
- NO_EVALUABLE
- RUNTIME_PARITY_NOT_CERTIFIED

Detailed reasons remain in blocker / feature_snapshot.

## Identity and market evidence

The current Odds API capture stores canonical gamePk, provider player name, canonical name when resolved, MLBAM ID, exact identity method, match count, line, side, price, sportsbook, provider timestamp, acquired timestamp and provider provenance. fuzzyMatchingUsed is always false.

Pitchers are bound to MLB Official probable-pitcher identities. Batter identities require one unique exact normalized match in the canonical MLBAM player directory. Ambiguous rows are retained as evidence but fail closed.

## Exact runtime: Pitcher Earned Runs

Candidate: pitcher_er_over_1p5_p70_v1

Frozen math:

- base intercept 1.90273530551357
- base slope 0.227085168912444 on prior ER all-history
- K residual intercept 0.653408289475203
- K residual slope -3.0156054216154
- minimum prior starts 3
- OVER 1.5 when empirical TRAIN P(OVER) >= 70%

Frozen parity surface: public.mlb_pitcher_er_frozen_2025_runtime_v1

Exact fingerprint:

- modeled rows 3,568; TRAIN 2,194; VALIDATION 729; TEST 645
- TEST MAE 1.53264877098586
- TEST RMSE 1.89392266393888
- VALIDATION 47/59
- TEST 26/32
- combined 73/91 = 80.22%

Daily priorErAll comes from MLB Official earnedRuns over prior starts only with date < target date. K-rate comes from the canonical strict-pregame pick2_mlb_pitcher_daily_features row. Probability uses the frozen empirical TRAIN residual distribution. Runs Allowed is never substituted for Earned Runs.

## Exact runtime: Pitcher Hits Allowed

Candidate: pitcher_hits_allowed_under_6p5_proj_5p0_v1

Raw feature:

avg(BF in last 5 prior starts) * cumulative prior hits allowed / cumulative prior BF

Eligibility is at least 5 prior starts with source date < target date.

Parity:

- 2025 refit n 3,099
- intercept 2.97876810879942
- slope 0.415326852941172
- 2026 frozen one-shot: eligible 2,568; selected 1,226; correct 968 = 78.96%

Daily source is MLB Official gameLog pitching hits and battersFaced.

## Exact batter runtimes

All three use the same strict-prior shape:

avg(PA over last 10 prior games) * cumulative prior metric / cumulative prior PA

At least 10 prior games are required and same-date game 1 is never prior input for game 2.

Batter Singles:
- candidate batter_singles_under_1p5_proj_0p50_v1
- 2025 n 42,601; intercept 0.260944252887134; slope 0.515544560255828
- 2026 frozen one-shot 12,690/13,634 = 93.08%

Batter Doubles:
- candidate batter_doubles_under_0p5_proj_0p16_v1
- 2025 n 42,601; intercept 0.126877618354346; slope 0.210234641434428
- 2026 frozen one-shot 17,632/20,282 = 86.93%

Batter Triples:
- candidate batter_triples_under_0p5_proj_0p015_v1
- 2025 n 42,601; intercept 0.00876081897272024; slope 0.294769143425622
- 2026 frozen one-shot 29,689/30,045 = 98.82%
- signal label remains LOW_INCREMENTAL_SIGNAL_BASELINE_DOMINATED

## Prospective batter source

The daily rollup public.mlb_statcast_batter_sdt_game_mv is derived from current raw Statcast regular-season terminal plate appearances. It is refreshed through the existing Statcast analytics refresh function; no parallel ingestion pipeline was created.

Against the frozen 2025 xyear corpus, PA/singles/doubles/triples parity is exactly 48,862/48,862 rows.

The current 2026 Statcast corpus contains later corrections relative to the frozen one-shot xyear snapshot. Those corrected rows are used prospectively but do not rewrite the frozen historical one-shot results.

## Market capture

The existing current-odds capture requests main and alternate keys where supported for pitcher_earned_runs, pitcher_hits_allowed, batter_singles, batter_doubles and batter_triples.

No historical Odds API credits are used.

A model qualifier without the exact required line + sportsbook + price + pregame timestamp is MODEL_QUALIFIES_MARKET_NOT_VERIFIED.

## Safety

- research_only = true
- production_eligible = false
- Official Picks unchanged
- APOSTAR disabled
- no historical odds spend
- no fuzzy matching
- no same-day outcome leakage
- no prospective retuning
