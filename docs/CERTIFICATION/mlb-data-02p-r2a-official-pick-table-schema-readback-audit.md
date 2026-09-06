# MLB Data 02P R2A Official Pick Table Schema Readback

## Verdict

MLB_DATA_02P_R2A_OFFICIAL_PICK_SCHEMA_DIAGNOSIS_BLOCKED

## Root Cause

PRIOR_PGRST205_SCHEMA_CACHE_MISS_NOW_REST_VISIBLE_CATALOG_READBACK_NOT_AVAILABLE

## Findings

- Production commit: `728ed2a1771f522ffab1b29363f40ab31b4bfb29`
- Intended table: `public.pick2_mlb_official_picks`
- Repo table definition: NOT_FOUND
- Migration state: NO_NATIVE_OFFICIAL_PICK_TABLE_MIGRATION_FOUND
- REST visibility: REST_VISIBLE
- information_schema table count: NOT_AVAILABLE
- pg_class table count: NOT_AVAILABLE

## Boundaries

- Official Pick DML: 0
- Other production DML: 0
- Production DDL: 0
- Provider calls: 0
- Value Board publication: NO

## Future Path

- Do not insert Official Picks until public.pick2_mlb_official_picks is REST-visible with the required schema.
- If catalog proves absence, prepare an additive table migration only.
- If catalog proves presence, diagnose PostgREST exposure/cache without creating a duplicate table.
