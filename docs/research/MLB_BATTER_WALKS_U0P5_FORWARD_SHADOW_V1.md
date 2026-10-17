# MLB Batter Walks U0.5 Forward Shadow V1

Status: RESEARCH-ONLY / FORWARD-ONLY

## Exact contract

- Market: Batter Walks
- Exact line: 0.5
- Side: UNDER
- Frozen candidate: `batter_walks_under_0p5_proj_0p20_v1`
- Threshold: projection <=0.20
- Historical accuracy: 83.39%
- Minimum prior games: 10

Projection is the exact runtime formula:
`max(0, 0.117815177785939 + 0.593708345578887 * ((recent_PA/10) * (prior_walks/prior_PA)))`.

## Runtime lineage

A real forward shadow candidate requires:
- exact MLBAM identity;
- strict-pregame U0.5 quote;
- target-day row in `pick2_mlb_batter_daily_features`;
- feature version `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`;
- source rule `source_game_date < target_game_date`;
- >=10 prior batter games;
- projection <=0.20.

## 2026-09-24 audit

The approved capture contained U0.5 quotes for 17 PIT-STL batters across DraftKings, Fanatics and William Hill.

One mathematical crossing was found:
- Ronny Simon U0.5 Walks
- projection: 0.184
- threshold: 0.20
- best captured quote: DraftKings -309
- prior games: 17
- latest prior date: 2026-09-23

However, no 2026-09-24 strict target-day batter feature row existed for any of the 17 quoted players at audit time.

Therefore Ronny Simon is **not** a runtime-verified candidate. State:
`MATHEMATICAL_CROSSING_BLOCKED_TARGET_FEATURE`.

This confirms batter-feature materialization is a practical operational blocker for an otherwise available real market.

## Price handling

Price is recorded. EV is not calculated from the 83.39% historical accuracy because that aggregate accuracy is not a calibrated per-play probability.

## Boundaries

- no line extrapolation
- no threshold retuning
- no fuzzy identity
- strict-pregame only
- no historical Odds API spend
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
