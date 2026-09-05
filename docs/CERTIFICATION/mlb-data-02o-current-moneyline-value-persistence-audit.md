# Current Moneyline Value Persistence Audit

ANALYTICAL ONLY. NOT OFFICIAL PICKS. NOT HISTORICALLY PROFITABILITY-CERTIFIED.

Verdict: `MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_BLOCKED`
Blocker: `MLB_DATA_02O_VALUE_SCHEMA_FIT_BLOCKED`

## Schema Fit

Existing value table fit: `BLOCKED`

| blocker | evidence |
| --- | --- |
| LEGACY_ODDS_SNAPSHOT_ID_REQUIRED | pick2_market_value_evaluations.odds_snapshot_id is NOT NULL and references sports_odds_snapshots(id), but certified 02N rows are linked to pick2_mlb_market_price_observations and no sports_odds_snapshot row is part of the certified source state. |
| NATIVE_MARKET_OBSERVATION_LINKAGE_MISSING | live column probe rejected native value columns:  |
| NATIVE_VALUE_PAYLOAD_COLUMNS_MISSING | existing table lacks first-class game_pk, side, bookmaker_key, american_odds, raw_implied_probability, unit_ev, consensus_probability, consensus_edge, market pair identity and evaluation method/version columns. |

## Certified 02N Analytical Top Candidate

| game_pk | side | book | edge | unit EV |
| ---: | --- | --- | ---: | ---: |
| 823904 | AWAY | betrivers | 0.095882 | 0.240928 |

No value rows were inserted because the production schema cannot safely store the certified native market-observation-linked 02N payload without a separate schema migration.
