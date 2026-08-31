-- READ-ONLY CATALOG VERIFICATION - NO DML / NO DDL
-- Manual target: Supabase Production SQL Editor
-- Phase: MLB_DATA_01D_R1H_SCHEMA_READBACK_AUTHORITY_PREP
-- Table: public.pick2_mlb_bullpen_daily_features

with target_table as (
  select
    n.oid as schema_oid,
    c.oid as table_oid,
    n.nspname as schema_name,
    c.relname as table_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'pick2_mlb_bullpen_daily_features'
    and c.relkind in ('r', 'p')
),
constraint_columns as (
  select
    con.oid as object_oid,
    array_agg(att.attname order by key_position.ordinality) as ordered_columns
  from pg_catalog.pg_constraint con
  join target_table tt on tt.table_oid = con.conrelid
  join unnest(con.conkey) with ordinality as key_position(attnum, ordinality) on true
  join pg_catalog.pg_attribute att on att.attrelid = con.conrelid and att.attnum = key_position.attnum
  group by con.oid
),
unique_constraints as (
  select
    'unique_constraint' as object_type,
    con.conname as object_name,
    tt.schema_name,
    tt.table_name,
    (con.contype = 'u') as is_unique,
    cc.ordered_columns,
    null::text as predicate
  from pg_catalog.pg_constraint con
  join target_table tt on tt.table_oid = con.conrelid
  left join constraint_columns cc on cc.object_oid = con.oid
  where con.contype = 'u'
),
index_columns as (
  select
    idx.indexrelid as object_oid,
    array_agg(att.attname order by key_position.ordinality) as ordered_columns
  from pg_catalog.pg_index idx
  join target_table tt on tt.table_oid = idx.indrelid
  join unnest(idx.indkey) with ordinality as key_position(attnum, ordinality) on key_position.attnum <> 0
  join pg_catalog.pg_attribute att on att.attrelid = idx.indrelid and att.attnum = key_position.attnum
  group by idx.indexrelid
),
unique_indexes as (
  select
    'unique_index' as object_type,
    idx_class.relname as object_name,
    tt.schema_name,
    tt.table_name,
    idx.indisunique as is_unique,
    ic.ordered_columns,
    pg_catalog.pg_get_expr(idx.indpred, idx.indrelid) as predicate
  from pg_catalog.pg_index idx
  join target_table tt on tt.table_oid = idx.indrelid
  join pg_catalog.pg_class idx_class on idx_class.oid = idx.indexrelid
  left join index_columns ic on ic.object_oid = idx.indexrelid
  where idx.indisunique = true
),
catalog_objects as (
  select * from unique_constraints
  union all
  select * from unique_indexes
),
checks as (
  select
    (select count(*) from target_table) as table_count,
    (select count(*) from catalog_objects where object_name = 'pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key') as legacy_exact_object_count,
    (select count(*) from catalog_objects where object_name = 'pick2_mlb_bullpen_daily_features_target_game_team_version_key') as native_exact_object_count,
    (select count(*) from catalog_objects where object_name = 'pick2_mlb_bullpen_daily_features_target_game_team_version_key' and is_unique = true and ordered_columns = array['target_game_pk', 'team_id', 'feature_version']) as native_exact_unique_key_count,
    (select count(*) from catalog_objects where is_unique = true and ordered_columns = array['team_id', 'feature_date', 'feature_version']) as contradictory_legacy_unique_key_count
)
select
  'expected_result' as section,
  'R1H_EXPECTED_LEGACY_CONSTRAINT_ROWS' as check_name,
  legacy_exact_object_count::text as observed,
  '0' as expected,
  (legacy_exact_object_count = 0) as pass,
  null::text as object_type,
  null::text as object_name,
  null::text as schema_name,
  null::text as table_name,
  null::boolean as is_unique,
  null::text[] as ordered_columns,
  null::text as predicate
from checks
union all
select
  'expected_result',
  'R1H_EXPECTED_NATIVE_UNIQUENESS_ROWS',
  native_exact_unique_key_count::text,
  '1',
  (native_exact_unique_key_count = 1),
  null,
  null,
  null,
  null,
  null,
  null,
  null
from checks
union all
select
  'expected_result',
  'R1H_EXPECTED_CONTRADICTORY_LEGACY_UNIQUE_ROWS',
  contradictory_legacy_unique_key_count::text,
  '0',
  (contradictory_legacy_unique_key_count = 0),
  null,
  null,
  null,
  null,
  null,
  null,
  null
from checks
union all
select
  'expected_result',
  'R1H_EXPECTED_BULLPEN_TABLE_ROWS',
  table_count::text,
  '1',
  (table_count = 1),
  null,
  null,
  null,
  null,
  null,
  null,
  null
from checks
union all
select
  'full_unique_inventory',
  'R1H_BULLPEN_UNIQUE_OBJECT',
  null,
  null,
  null,
  object_type,
  object_name,
  schema_name,
  table_name,
  is_unique,
  ordered_columns,
  predicate
from catalog_objects
order by section, check_name, object_name;
