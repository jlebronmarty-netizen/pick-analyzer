# MLB Moneyline Official Pick Execution Prep Audit

EXECUTION PREP ONLY. NO OFFICIAL PICKS WRITTEN. NO PROFITABILITY GUARANTEE.

## Verdict

MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_CERTIFIED

## Publication

- Published commit: `75ca90f2a6c567bd2199bf295c25497106939297`
- Production commit: `75ca90f2a6c567bd2199bf295c25497106939297`
- Production alignment: PASS

## Policy

- Version: `MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1`
- Consensus edge threshold: 0.04
- Unit EV threshold: 0.08
- Minimum books: 8
- Freshness: FRESH
- Dispersion max: 0.03

## Exact Dry Eligible Set

| game_pk | teams | side | book | odds | consensus_edge | unit_ev | books | dispersion | starter | risk_flags |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 823904 | baseball_mlb:mlb:sportsdataio:team:35 @ baseball_mlb:mlb:sportsdataio:team:1 | AWAY | betrivers | 185 | 0.081936 | 0.240928 | 11 | 0.020284 | PROBABLE | PROBABLE_STARTER, MODERATE_MARKET_DISPERSION, EXTREME_PRICE |
| 824468 | baseball_mlb:mlb:sportsdataio:team:32 @ baseball_mlb:mlb:sportsdataio:team:2 | HOME | lowvig | 134 | 0.062608 | 0.123348 | 11 | 0.014743 | PROBABLE | PROBABLE_STARTER, MODEL_PROBABILITY_NEAR_50 |
| 824795 | baseball_mlb:mlb:sportsdataio:team:25 @ baseball_mlb:mlb:sportsdataio:team:19 | HOME | betrivers | 118 | 0.059321 | 0.143381 | 11 | 0.028056 | PROBABLE | PROBABLE_STARTER, MODERATE_MARKET_DISPERSION, MODEL_PROBABILITY_NEAR_50 |
| 824310 | baseball_mlb:mlb:sportsdataio:team:31 @ baseball_mlb:mlb:sportsdataio:team:23 | HOME | williamhill_us | 110 | 0.050256 | 0.086845 | 11 | 0.013266 | PROBABLE | PROBABLE_STARTER, MODEL_PROBABILITY_NEAR_50 |
| 823335 | baseball_mlb:mlb:sportsdataio:team:21 @ baseball_mlb:mlb:sportsdataio:team:4 | AWAY | betonlineag | 163 | 0.043682 | 0.099649 | 11 | 0.009300 | PROBABLE | PROBABLE_STARTER |

## Dry Summary

- Official Pick eligible: 5
- Value Candidate: 14
- Watchlist: 23
- Blocked: 0

## Schema Fit

Target table: `pick2_mlb_official_picks`

## Boundaries

- Official Pick writes: 0
- Other production DML: 0
- Production DDL: 0
- Provider calls: 0
