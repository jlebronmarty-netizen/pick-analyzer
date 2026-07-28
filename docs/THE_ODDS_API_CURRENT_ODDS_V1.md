# The Odds API Current Odds Acquisition V1

Generated: 2026-07-28T02:54:39.204Z

Commit: `837aec6d25bb9eb5f91c1f3a054f17717c94e6c9`

Status: LIVE_ACQUISITION_PERSISTED

## Credit Safety

- Provider calls made: 11
- Requests remaining before: 19938
- Requests remaining after: 19923
- Requests used observed: 15
- Required reserve: 2000
- Retry note: an earlier Checkpoint 2 attempt consumed 15 credits and failed before persistence on an oversized Supabase ID-preflight read; it wrote 0 rows and the batch size was reduced before this successful run.

## Persistence

- Rows accepted: 4128
- Rows rejected: 0
- Rows inserted: 4128
- Rows updated: 4128
- Mappings upserted: 159
- Duplicate deterministic IDs: 0
- Production mutations recorded: 8416

## Sport Coverage

| Sport | Provider key | Events | Future events | Odds events | Rows accepted | Bookmakers | Markets |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| MLB Baseball | baseball_mlb | 20 | 15 | 20 | 1104 | 11 | moneyline, spread, total |
| NFL Football | americanfootball_nfl | 75 | 75 | 75 | 1978 | 11 | moneyline, spread, total |
| NHL Hockey | icehockey_nhl | 32 | 32 | 32 | 426 | 7 | moneyline, spread, total |
| Soccer | soccer | 0 | 0 | 8 | 260 | 8 | moneyline, spread, total |
| UFC | mma_mixed_martial_arts | 32 | 32 | 32 | 360 | 8 | moneyline, total |

## Validation

- Fixture validation: PASS
- Checks passed: 7/7

## Safety Notes

- Event mappings are provider-native and marked pending canonical crosswalk; canonical sport events are not overwritten.
- Only h2h, spreads and totals are acquired in this checkpoint.
- No prediction generation, feature rebuild, SQL migration, scheduler change, settlement write or recommendation-policy change was executed.
