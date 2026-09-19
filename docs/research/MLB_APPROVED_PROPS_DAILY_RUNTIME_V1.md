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

- QUALIFIES_MARKET_VERIFIED
- MODEL_QUALIFIES_MARKET_NOT_VERIFIED
- NO_PLAY
- NO_EVALUABLE_EXACT_RUNTIME_PENDING
- NO_EVALUABLE_IDENTITY_UNRESOLVED
- NO_EVALUABLE_INSUFFICIENT_HISTORY
- NO_EVALUABLE_FEATURE_MISSING
- NO_EVALUABLE_LINEAGE_BLOCKED

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
- pitcher_win_forward_numeric_p015_v1

Batter Hits and Total Bases use the selected alpha=0 protocol reproduced from the canonical backtest implementation and frozen final-2025 fits.

## Fail-closed pending runtime contracts

The market lines are captured now, but the following frozen candidates remain NO_EVALUABLE_EXACT_RUNTIME_PENDING until their exact raw-feature / eligibility contract is serialized and reproduced without approximation:

- pitcher_er_over_1p5_p70_v1
- pitcher_hits_allowed_under_6p5_proj_5p0_v1
- batter_hr_under_0p5_proj_0p10_v1
- batter_k_under_1p5_proj_0p5_v1
- batter_walks_under_0p5_proj_0p20_v1
- batter_singles_under_1p5_proj_0p50_v1
- batter_doubles_under_0p5_proj_0p16_v1
- batter_triples_under_0p5_proj_0p015_v1

This is intentional. Missing frozen semantics must never be replaced by a plausible proxy.

## Safety boundaries

- research_only = true
- production_eligible = false
- official_picks_eligible = false
- apostar_enabled = false
- no retrospective market reconstruction
- no historical Odds API credit spend
- prospective outcomes may not retune frozen models
