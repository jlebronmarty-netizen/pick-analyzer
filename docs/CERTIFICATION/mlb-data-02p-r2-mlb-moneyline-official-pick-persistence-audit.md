# MLB Moneyline Official Pick Persistence Audit

OFFICIAL PICK = PASSED POLICY V1. NOT A GUARANTEE. NOT HISTORICALLY PROFITABILITY-CERTIFIED.

## Verdict

MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_CERTIFIED

## Publication

- Published commit: `b60cea1f5633042dcade4df4df88d24dbd675144`
- Origin commit: `b60cea1f5633042dcade4df4df88d24dbd675144`
- Production commit: `b60cea1f5633042dcade4df4df88d24dbd675144`
- Production alignment: PASS

## Persisted Official Picks

| game_pk | teams | side | book | odds | model_prob | consensus_prob | consensus_edge | unit_ev | risk_flags | reason_codes |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 823904 | baseball_mlb:mlb:sportsdataio:team:35 @ baseball_mlb:mlb:sportsdataio:team:1 | AWAY | betrivers | 185 | 0.435413 | 0.353478 | 0.081936 | 0.240928 | PROBABLE_STARTER, MODERATE_MARKET_DISPERSION, EXTREME_PRICE | MODEL_EDGE_OVER_CONSENSUS, POSITIVE_BEST_PRICE_EV, STRONG_BOOK_SUPPORT, ACCEPTABLE_MARKET_DISPERSION, FRESH_MARKET, PROBABLE_STARTER_WITH_RISK_FLAG |
| 824468 | baseball_mlb:mlb:sportsdataio:team:32 @ baseball_mlb:mlb:sportsdataio:team:2 | HOME | lowvig | 134 | 0.480063 | 0.417455 | 0.062608 | 0.123348 | PROBABLE_STARTER, MODEL_PROBABILITY_NEAR_50 | MODEL_EDGE_OVER_CONSENSUS, POSITIVE_BEST_PRICE_EV, STRONG_BOOK_SUPPORT, LOW_MARKET_DISPERSION, FRESH_MARKET, PROBABLE_STARTER_WITH_RISK_FLAG |
| 824795 | baseball_mlb:mlb:sportsdataio:team:25 @ baseball_mlb:mlb:sportsdataio:team:19 | HOME | betrivers | 118 | 0.524487 | 0.465165 | 0.059321 | 0.143381 | PROBABLE_STARTER, MODERATE_MARKET_DISPERSION, MODEL_PROBABILITY_NEAR_50 | MODEL_EDGE_OVER_CONSENSUS, POSITIVE_BEST_PRICE_EV, STRONG_BOOK_SUPPORT, ACCEPTABLE_MARKET_DISPERSION, FRESH_MARKET, PROBABLE_STARTER_WITH_RISK_FLAG |
| 824310 | baseball_mlb:mlb:sportsdataio:team:31 @ baseball_mlb:mlb:sportsdataio:team:23 | HOME | williamhill_us | 110 | 0.517545 | 0.467290 | 0.050256 | 0.086845 | PROBABLE_STARTER, MODEL_PROBABILITY_NEAR_50 | MODEL_EDGE_OVER_CONSENSUS, POSITIVE_BEST_PRICE_EV, STRONG_BOOK_SUPPORT, LOW_MARKET_DISPERSION, FRESH_MARKET, PROBABLE_STARTER_WITH_RISK_FLAG |
| 823335 | baseball_mlb:mlb:sportsdataio:team:21 @ baseball_mlb:mlb:sportsdataio:team:4 | AWAY | betonlineag | 163 | 0.418117 | 0.374435 | 0.043682 | 0.099649 | PROBABLE_STARTER | MODEL_EDGE_OVER_CONSENSUS, POSITIVE_BEST_PRICE_EV, STRONG_BOOK_SUPPORT, LOW_MARKET_DISPERSION, FRESH_MARKET, PROBABLE_STARTER_WITH_RISK_FLAG |

## DML Accounting

- Attempted inserts: 5
- Inserted: 5
- Reused: 0
- Conflicts: 0
- Failures: 0
- Updates: 0
- Deletes: 0

## Boundaries

- Provider calls: 0
- Market writes: 0
- Value writes: 0
- Prediction writes: 0
- Production DDL: 0
- Value Board publication: NO
