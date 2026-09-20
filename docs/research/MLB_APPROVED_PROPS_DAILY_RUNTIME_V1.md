# MLB Approved Props Daily Runtime V1

Status: RESEARCH-ONLY / SHADOW-ONLY

## Purpose

This runtime separates a model signal from a real, timestamped sportsbook opportunity.

A row may only be labeled QUALIFIES_MARKET_VERIFIED when:
1. the frozen model is evaluated with its certified pregame feature contract;
2. the frozen model gate is met;
3. the exact frozen line exists in a captured pregame sportsbook snapshot;
4. player identity is an exact unique MLBAM match.

Main and alternate player-prop markets are captured so a frozen line can be verified even when it is not the sportsbook main line.

## Fixed daily clocks

The existing MLB Statcast cron remains the only scheduler.

Approved prop market capture runs at the existing 10:15 and 10:45 Puerto Rico invocations.
The immutable daily formula freeze is allowed only from 10:45 through 10:59 Puerto Rico and must occur before the first scheduled pitch.
A completed daily freeze is never retroactively rewritten.

## Status contract

Every frozen daily observation ends in exactly one of:

- QUALIFIES_MARKET_VERIFIED
- MODEL_QUALIFIES_MARKET_NOT_VERIFIED
- NO_PLAY
- NO_EVALUABLE
- RUNTIME_PARITY_NOT_CERTIFIED

Blocker detail is preserved separately in the `blocker` field.

No status is an Official Pick and no row may activate APOSTAR.

## Markets captured

Pitcher: outs, hits allowed, walks, record a win, earned runs, plus documented alternate line markets.

Batter: hits, total bases, home runs, strikeouts, walks, singles, doubles, triples, plus documented alternate line markets.

All raw sportsbook snapshots remain in sports_odds_snapshots with sportsbook, line, price, provider timestamp and provider market key.

## Exact runtime enabled in V1

- pitcher_bb_under_2p5_p85_v1
- pitcher_outs_under_18p5_p90_v1
- batter_hits_under_1p5_edge_0p75_v1
- batter_total_bases_under_2p5_edge_1p5_v1
- batter_hr_under_0p5_proj_0p10_v1
- batter_k_under_1p5_proj_0p5_v1
- batter_walks_under_0p5_proj_0p20_v1
- pitcher_win_forward_numeric_p015_v1
- pitcher_er_over_1p5_p70_v1
- pitcher_hits_allowed_under_6p5_proj_5p0_v1
- batter_singles_under_1p5_proj_0p50_v1
- batter_doubles_under_0p5_proj_0p16_v1
- batter_triples_under_0p5_proj_0p015_v1

Batter Hits, Total Bases, Home Runs, Strikeouts and Walks use alpha=0. The raw-feature order was reconstructed from the canonical backtest implementation and independently checked against the frozen 2026 one-shot counts.

## Five-market exact parity certification

### Pitcher Earned Runs

- exact model: `MLB_PITCHER_EARNED_RUNS_RESEARCH_V1_R2`;
- strict prior-date ER history: MLB Official game logs, starts only;
- K-rate: canonical `pick2_mlb_pitcher_daily_features.k_rate` for the target game with `as_of_date < target_date`;
- no Runs Allowed substitution;
- empirical probability source: frozen 2025 TRAIN residual distribution;
- parity checksum: 3,568 modeled rows; TRAIN/VALIDATION/TEST = 2,194/729/645;
- coefficients reproduced exactly: 1.90273530551357, 0.227085168912444, 0.653408289475203, -3.0156054216154;
- TEST MAE/RMSE reproduced exactly: 1.53264877098586 / 1.89392266393888;
- market selections reproduced exactly: VALIDATION 47/59, TEST 26/32, combined 73/91.

### Pitcher Hits Allowed

- minimum 5 prior starts;
- strict `prior.game_date < target_game_date`;
- raw feature = average batters faced over last 5 starts × cumulative hits allowed / cumulative batters faced;
- 2025 refit reproduced exactly: n=3,099, intercept=2.97876810879942, slope=0.415326852941172;
- 2026 checksum reproduced exactly: 2,568 eligible → 1,226 selected → 968 correct.

### Batter Singles / Doubles / Triples

All three use the same strict-prior-date raw feature family:

`average PA over last 10 prior games × cumulative metric / cumulative PA`

The target date is excluded entirely, so Game 1 of a doubleheader cannot enter Game 2.

- Singles: n=42,601; intercept=0.260944252887134; slope=0.515544560255828; 2026 checksum 40,648 → 13,634 → 12,690.
- Doubles: n=42,601; intercept=0.126877618354346; slope=0.210234641434428; 2026 checksum 40,648 → 20,282 → 17,632.
- Triples: n=42,601; intercept=0.00876081897272024; slope=0.294769143425622; 2026 checksum 40,648 → 30,045 → 29,689.

Triples remains explicitly `LOW_INCREMENTAL_SIGNAL_BASELINE_DOMINATED`.

## Exact identity and market verification

Current Odds API capture requests both main and supported alternate versions of these markets. Each persisted snapshot carries canonical gamePk, exact MLBAM player ID when uniquely resolved, provider player name, sportsbook, exact line, price, provider timestamp, acquired timestamp and source/provenance.

No fuzzy matching is used. A row cannot become `QUALIFIES_MARKET_VERIFIED` unless the exact MLBAM ID, frozen line, direction, sportsbook, price and strictly pregame timestamp all match.

## Safety boundaries

- research_only = true
- production_eligible = false
- official_picks_eligible = false
- apostar_enabled = false
- no retrospective market reconstruction
- no historical Odds API credit spend
- prospective outcomes may not retune frozen models
