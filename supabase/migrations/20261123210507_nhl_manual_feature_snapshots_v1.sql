-- Prospective research inputs shared with the manual NHL panel. No forecasts.
-- Availability in Pick is assigned by this database; source time stays in JSON.
create table public.nhl_manual_feature_snapshots_v1 (
  event_id text not null check (event_id ~ '^nhl:[0-9]{10}$'),
  available_as_of timestamptz not null,
  scheduled_at timestamptz not null,
  source_snapshot_sha256 text not null check (source_snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  source_run_id text not null check (source_run_id ~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{0,159}$'),
  feature_payload jsonb not null,
  schema_version text not null default 'NHL_MANUAL_FEATURES_V1',
  inserted_at timestamptz not null,
  primary key (event_id, available_as_of),
  constraint nhl_manual_features_run_event_key unique (source_run_id, event_id),
  check (pg_catalog.isfinite(scheduled_at) and pg_catalog.isfinite(available_as_of)),
  check (scheduled_at > available_as_of and inserted_at = available_as_of),
  check (pg_catalog.octet_length(feature_payload::text) <= 131072),
  check ((schema_version = 'NHL_MANUAL_FEATURES_V1'
    and feature_payload->>'schema_version' = schema_version
    and feature_payload->>'event_id' = event_id
    and (feature_payload->>'scheduled_at')::timestamptz = scheduled_at
    and feature_payload->>'available_as_of' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$'
    and pg_catalog.isfinite((feature_payload->>'available_as_of')::timestamptz)
    and (feature_payload->>'available_as_of')::timestamptz <= available_as_of
    and feature_payload->>'local_date' = (scheduled_at at time zone 'America/Puerto_Rico')::date::text
    and feature_payload->>'scope' = 'PROSPECTIVE_RESEARCH_INPUTS'
    and feature_payload->'forecast_probability' = 'null'::jsonb
    and feature_payload->'official_pick' = 'false'::jsonb
    and feature_payload->'model_promoted' = 'false'::jsonb
    and pg_catalog.jsonb_typeof(feature_payload->'teams') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload->'coverage') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload->'provenance') = 'object'
    and feature_payload#>>'{teams,away,abbrev}' ~ '^[A-Z]{2,3}$'
    and feature_payload#>>'{teams,home,abbrev}' ~ '^[A-Z]{2,3}$'
    and feature_payload#>>'{teams,away,abbrev}' <> feature_payload#>>'{teams,home,abbrev}'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,away,season}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,home,season}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,away,last10}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,home,last10}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,away,recent_event_ids}') = 'array'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,home,recent_event_ids}') = 'array'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,away,special_teams}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,home,special_teams}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,away,rest}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,home,rest}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,away,reported_goalie}') = 'object'
    and pg_catalog.jsonb_typeof(feature_payload#>'{teams,home,reported_goalie}') = 'object') is true)
);

create index nhl_manual_features_day_read_idx
  on public.nhl_manual_feature_snapshots_v1 (scheduled_at, event_id, available_as_of desc);

comment on table public.nhl_manual_feature_snapshots_v1 is
  'Private append-only prospective NHL manual-panel inputs. No prediction or promotion authority. Source generation time is feature_payload.available_as_of; Pick availability is server-assigned available_as_of.';

create function public.nhl_manual_features_immutable_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP <> 'INSERT' then
    raise exception using errcode = '55000', message = 'NHL_MANUAL_FEATURES_APPEND_ONLY';
  end if;
  NEW.available_as_of := pg_catalog.clock_timestamp();
  NEW.inserted_at := NEW.available_as_of;
  return NEW;
end;
$$;

create trigger nhl_manual_features_stamp_and_immutable
  before insert or update or delete on public.nhl_manual_feature_snapshots_v1
  for each row execute function public.nhl_manual_features_immutable_v1();
create trigger nhl_manual_features_no_truncate
  before truncate on public.nhl_manual_feature_snapshots_v1
  for each statement execute function public.nhl_manual_features_immutable_v1();

-- Invoker-only writer: the SQL owner may call it; application roles cannot.
-- One run/event is immutable. A retry can return the identical prior receipt.
create function public.append_nhl_manual_feature_snapshots_v1(
  p_source_run_id text, p_source_snapshot_sha256 text, p_features jsonb
) returns table (event_id text, status text, available_as_of timestamptz, inserted_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  receipt public.nhl_manual_feature_snapshots_v1%rowtype;
  item_id text;
  item_start timestamptz;
begin
  if p_source_run_id is null or p_source_run_id !~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{0,159}$'
    or p_source_snapshot_sha256 is null or p_source_snapshot_sha256 !~ '^[a-f0-9]{64}$'
    or p_features is null or pg_catalog.jsonb_typeof(p_features) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_NHL_MANUAL_FEATURE_BATCH';
  end if;
  if pg_catalog.jsonb_array_length(p_features) > 32 or pg_catalog.octet_length(p_features::text) > 4194304
    or (select count(*) <> count(distinct x->>'event_id') from pg_catalog.jsonb_array_elements(p_features) x) then
    raise exception using errcode = '22023', message = 'INVALID_NHL_MANUAL_FEATURE_BATCH';
  end if;
  -- Stable lock order makes concurrent retries independent of input array order.
  for item in select value from pg_catalog.jsonb_array_elements(p_features) order by value->>'event_id' loop
    item_id := item->>'event_id';
    item_start := (item->>'scheduled_at')::timestamptz;
    if item_id is null or item_id !~ '^nhl:[0-9]{10}$' or item_start is null
      or not pg_catalog.isfinite(item_start) then
      raise exception using errcode = '22023', message = 'INVALID_NHL_MANUAL_FEATURE_IDENTITY';
    end if;
    select s.* into receipt from public.nhl_manual_feature_snapshots_v1 s
      where s.source_run_id = p_source_run_id and s.event_id = item_id;
    if found then
      if receipt.source_snapshot_sha256 <> p_source_snapshot_sha256 or receipt.feature_payload <> item then
        raise exception using errcode = '23505', message = 'DIVERGENT_NHL_MANUAL_FEATURE_RETRY';
      end if;
      return query select receipt.event_id, 'ALREADY_STORED'::text, receipt.available_as_of, receipt.inserted_at;
      continue;
    end if;
    if item_start <= pg_catalog.clock_timestamp() then
      return query select item_id, 'SKIPPED_STARTED'::text, null::timestamptz, null::timestamptz;
      continue;
    end if;
    insert into public.nhl_manual_feature_snapshots_v1 as target
      (event_id, scheduled_at, source_snapshot_sha256, source_run_id, feature_payload, schema_version)
      values (item_id, item_start, p_source_snapshot_sha256, p_source_run_id, item, item->>'schema_version')
      on conflict on constraint nhl_manual_features_run_event_key do nothing
      returning target.* into receipt;
    if found then
      return query select receipt.event_id, 'INSERTED'::text, receipt.available_as_of, receipt.inserted_at;
    else
      -- A concurrent identical run can win the unique constraint after the first read.
      select s.* into strict receipt from public.nhl_manual_feature_snapshots_v1 s
        where s.source_run_id = p_source_run_id and s.event_id = item_id;
      if receipt.source_snapshot_sha256 <> p_source_snapshot_sha256 or receipt.feature_payload <> item then
        raise exception using errcode = '23505', message = 'DIVERGENT_NHL_MANUAL_FEATURE_RETRY';
      end if;
      return query select receipt.event_id, 'ALREADY_STORED'::text, receipt.available_as_of, receipt.inserted_at;
    end if;
  end loop;
end;
$$;

alter table public.nhl_manual_feature_snapshots_v1 enable row level security;
revoke all on public.nhl_manual_feature_snapshots_v1 from public, anon, authenticated, service_role;
grant select on public.nhl_manual_feature_snapshots_v1 to service_role;
revoke all on function public.nhl_manual_features_immutable_v1() from public, anon, authenticated, service_role;
revoke all on function public.append_nhl_manual_feature_snapshots_v1(text,text,jsonb) from public, anon, authenticated, service_role;
