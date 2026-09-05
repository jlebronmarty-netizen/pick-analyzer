# MLB-DATA-02O-R2A Manual Native Value Schema Readback

Verdict: `MLB_DATA_02O_R2A_NATIVE_VALUE_SCHEMA_PRODUCTION_CERTIFIED`

## Alignment

- Local HEAD: `c417d6b5519ff371ac79a78c88c59605e26fcffe`
- origin/main: `46f5c70666e8f05c89203c6da417bd88aea7d05b`
- Production: `46f5c70666e8f05c89203c6da417bd88aea7d05b`

## Manual Migration

Manual migration state: `YES_USER_CONFIRMED`

Migration: `supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql`

## Schema

- Table readback: `PASS`
- Column contract: `PASS_USER_SQL_EVIDENCE`
- FK contract: `PASS_USER_SQL_EVIDENCE`
- Immutability: `PASS_USER_SQL_EVIDENCE`
- RLS: `PASS_USER_SQL_EVIDENCE`
- Index contract: `PASS_USER_SQL_EVIDENCE`

## Dry Run

| plan rows | valid | invalid | missing source links | duplicate identities | inserts | reuses | conflicts |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 386 | 386 | 0 | 0 | 0 | 386 | 0 | 0 |

## Safety

- Native value DML: 0
- Other production DML: 0
- Codex production DDL: 0
- Provider calls: 0
