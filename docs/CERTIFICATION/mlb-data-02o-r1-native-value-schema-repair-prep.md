# MLB-DATA-02O-R1 Native Value Schema Repair Prep

Verdict: `MLB_DATA_02O_R1_NATIVE_VALUE_SCHEMA_REPAIR_PREP_CERTIFIED`

## Strategy

Selected strategy: `OPTION_A`

Native table: `public.pick2_mlb_market_value_evaluations`

The legacy `pick2_market_value_evaluations` table remains preserved for odds-snapshot-rooted flows. The new native table is additive and rooted in persisted Pick 2 MLB predictions, native `game_pk`, and immutable `pick2_mlb_market_price_observations`.

## Dry Fit

| planned rows | valid rows | invalid rows | duplicate identities | missing source linkages |
| ---: | ---: | ---: | ---: | ---: |
| 386 | 386 | 0 | 0 | 0 |

## Safety

Production DML: 0

Production DDL: 0

Provider calls: 0

Migration prepared only: `supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql`
