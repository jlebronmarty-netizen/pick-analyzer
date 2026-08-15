# NBA-03A-R1 Current Era Shadow Origin Migration

Status: NBA_03A_CURRENT_ERA_SHADOW_ORIGIN_MIGRATION_READY

NBA-03A stopped at the correct schema boundary: `prediction_history.prediction_origin` could represent historical replay, live pregame and legacy pre-certification rows, but not real forward NBA predictions that are shadow-only and non-product.

## Origin Decision

Chosen origin: `CURRENT_ERA_SHADOW`

This is intentionally generic. `sport_key` already provides NBA identity, and the origin describes a reusable regime: real pregame predictions from current evidence that remain excluded from user-facing recommendations, Official Picks, production calibration and production learning until a later explicit promotion.

## Migration

- File: `supabase/migrations/202608150001_current_era_shadow_origin_v1.sql`
- Applied: no
- Manual Supabase SQL Editor application required: yes
- Existing rows modified: 0
- RLS changed: no
- Default changed: no
- Backfill: none
- Index: `prediction_history_current_era_shadow_lookup_idx`

The historical replay null-odds exception remains scoped to `HISTORICAL_REPLAY_SHADOW`; Current Era Shadow rows require real current pregame odds for core market predictions.

## Contract

A Current Era Shadow row must carry:

- `prediction_origin = CURRENT_ERA_SHADOW`
- `production_eligible = false`
- `recommended_pick = false`
- `model_role = shadow`
- `certification_status = SHADOW_PENDING`
- `certification_metadata.currentEra = true`
- `certification_metadata.officialPickEligible = false`
- `certification_metadata.productionCalibrationEligible = false`
- `certification_metadata.productionLearningEligible = false`
- `certification_metadata.productSurfaceVisible = false`

It must also preserve sport, event, market, selection, line, model version, feature version, prediction timestamp, feature snapshot, price evidence and cutoff/start identity.

## Existing Row Inventory

Read-only audit at `2026-08-15T01:16:54.134Z`:

| Item | Count |
| --- | ---: |
| prediction_history total | 18,414 |
| CURRENT_ERA_SHADOW | 0 |
| HISTORICAL_REPLAY_SHADOW | 14,840 |
| LIVE_PREGAME | 0 |
| HISTORICAL_WALK_FORWARD_REPLAY | 0 |
| LEGACY_PRE_CERTIFICATION | 0 |
| NULL origin | 3,574 |
| Null odds total | 11,504 |
| Null odds historical replay | 11,504 |
| Official Pick rows | 172 |
| Production-eligible rows | 0 |

## Manual Pre-Check SQL

```sql
select count(*) as prediction_history_rows from public.prediction_history;
select coalesce(prediction_origin, 'NULL') as prediction_origin, count(*)
from public.prediction_history
group by 1
order by 1;
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.prediction_history'::regclass
  and conname = 'prediction_history_prediction_origin_check';
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'prediction_history'
  and indexname like '%origin%';
```

## Manual Post-Check SQL

```sql
select count(*) as prediction_history_rows from public.prediction_history;
select coalesce(prediction_origin, 'NULL') as prediction_origin, count(*)
from public.prediction_history
group by 1
order by 1;
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.prediction_history'::regclass
  and conname = 'prediction_history_prediction_origin_check';
select count(*) as current_era_shadow_existing_rows
from public.prediction_history
where prediction_origin = 'CURRENT_ERA_SHADOW';
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'prediction_history'
  and indexname in (
    'prediction_history_current_era_shadow_lookup_idx',
    'prediction_history_replay_origin_lookup_idx',
    'prediction_history_certification_lookup_idx'
  );
```

Expected post-check: existing `CURRENT_ERA_SHADOW` rows remain `0`.

## Resume Plan

After the migration is applied and post-checked, resume NBA-03A from Block 5. The next certification should cover current schedule sync, current odds acquisition, current feature construction, pregame shadow prediction generation, natural settlement, shadow performance and provider/runtime cost.

Do not activate NBA production, NBA scheduler, Official Picks, bankroll staking, notifications or automatic model promotion during R1.
