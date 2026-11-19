-- Applied as additive migration nba_hoopsapi_durable_preview_v1 on 2026-11-18.
-- PostgreSQL 15+. No existing NBA/model/scheduler table is changed.
begin;
create table public.nba_hoopsapi_accounts_v1 (
  account_scope text primary key check (account_scope ~ '^[a-z0-9_-]{3,80}$'),
  enabled boolean not null default false,
  request_cap integer not null default 10 check (request_cap between 1 and 10),
  -- No automatic account provisioning. Seed observed prior attempts before enabling.
  -- The application ledger cannot prove usage from other callers of this account.
  blocked_until timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);
create table public.nba_hoopsapi_attempts_v1 (
  attempt_id uuid primary key default gen_random_uuid(),
  account_scope text not null references public.nba_hoopsapi_accounts_v1(account_scope),
  request_id uuid not null,
  reserved_at timestamptz not null default clock_timestamp(),
  dispatch_deadline timestamptz not null,
  dispatched_at timestamptz,
  completed_at timestamptz,
  status text not null check (status in ('reserved','dispatched','succeeded','failed','external_observed')),
  observed_evidence jsonb,
  provider_http_status integer check (provider_http_status between 100 and 599),
  failure_code text check (failure_code in ('PROVIDER_HTTP','PROVIDER_429','TRANSPORT_UNKNOWN','INVALID_RESPONSE','RESPONSE_BOUND','CREDENTIAL_ECHO')),
  unique (account_scope, request_id)
);
create index nba_hoopsapi_attempts_window_v1 on public.nba_hoopsapi_attempts_v1
  (account_scope, (coalesce(dispatched_at, reserved_at)) desc);
create table public.nba_hoopsapi_captures_v1 (
  capture_id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.nba_hoopsapi_attempts_v1(attempt_id),
  account_scope text not null references public.nba_hoopsapi_accounts_v1(account_scope),
  source_received_at timestamptz not null,
  archived_at timestamptz not null default clock_timestamp(),
  response_sha256 text not null check (response_sha256 ~ '^[0-9a-f]{64}$'),
  raw_response text not null check (octet_length(raw_response) <= 2000000),
  normalized jsonb not null check (jsonb_typeof(normalized) = 'object')
);
create index nba_hoopsapi_captures_latest_v1 on public.nba_hoopsapi_captures_v1 (account_scope, archived_at desc);
alter table public.nba_hoopsapi_accounts_v1 enable row level security;
alter table public.nba_hoopsapi_attempts_v1 enable row level security;
alter table public.nba_hoopsapi_captures_v1 enable row level security;
revoke all on public.nba_hoopsapi_accounts_v1, public.nba_hoopsapi_attempts_v1, public.nba_hoopsapi_captures_v1 from public, anon, authenticated, service_role;
grant select, update on public.nba_hoopsapi_accounts_v1 to service_role;
grant select, insert, update on public.nba_hoopsapi_attempts_v1 to service_role;
grant select, insert on public.nba_hoopsapi_captures_v1 to service_role;

create function public.reject_nba_hoopsapi_capture_mutation_v1() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin raise exception 'IMMUTABLE_HOOPSAPI_CAPTURE'; end;
$$;
create trigger nba_hoopsapi_captures_immutable_v1 before update or delete on public.nba_hoopsapi_captures_v1
for each row execute function public.reject_nba_hoopsapi_capture_mutation_v1();

create function public.read_nba_hoopsapi_quota_v1(p_account text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.nba_hoopsapi_accounts_v1; n integer; t timestamptz := clock_timestamp();
begin
  select * into a from public.nba_hoopsapi_accounts_v1 where account_scope = p_account;
  if not found then return jsonb_build_object('status','ACCOUNT_NOT_CONFIGURED','enabled',false); end if;
  select count(*) into n from public.nba_hoopsapi_attempts_v1 where account_scope = p_account
    and coalesce(dispatched_at,reserved_at) > t - interval '24 hours';
  return jsonb_build_object('status','QUOTA_OBSERVED','enabled',a.enabled,'cap',a.request_cap,
    'charged_attempts_24h',n,'remaining_app_reservations',greatest(0,a.request_cap-n),
    'blocked_until',case when a.blocked_until > t then a.blocked_until else null end,
    'uncertain_or_in_flight',exists(select 1 from public.nba_hoopsapi_attempts_v1 where account_scope = p_account and
       ((status='dispatched' and dispatched_at > t-interval '24 hours') or (status='reserved' and dispatch_deadline > t))));
end;
$$;

create function public.claim_nba_hoopsapi_capture_v1(p_account text, p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.nba_hoopsapi_accounts_v1; prior public.nba_hoopsapi_attempts_v1; n integer; t timestamptz; v_id uuid;
begin
  -- This account row serializes every reservation and dispatch across all Preview instances.
  select * into a from public.nba_hoopsapi_accounts_v1 where account_scope = p_account for update;
  if not found then return jsonb_build_object('status','ACCOUNT_NOT_CONFIGURED'); end if;
  t := clock_timestamp();
  select * into prior from public.nba_hoopsapi_attempts_v1 where account_scope=p_account and request_id=p_request_id;
  if found then return jsonb_build_object('status','ALREADY_CLAIMED','attempt_id',prior.attempt_id,
    'attempt_status',prior.status,'capture_id',(select capture_id from public.nba_hoopsapi_captures_v1 where attempt_id=prior.attempt_id)); end if;
  if not a.enabled then return jsonb_build_object('status','CAPTURE_DISABLED'); end if;
  if a.blocked_until > t then return jsonb_build_object('status','ACCOUNT_COOLDOWN','retry_at',a.blocked_until); end if;
  if exists(select 1 from public.nba_hoopsapi_attempts_v1 where account_scope=p_account and
    ((status='reserved' and dispatch_deadline > t) or (status='dispatched' and dispatched_at > t-interval '24 hours')))
    then return jsonb_build_object('status','REQUEST_IN_PROGRESS_OR_UNCERTAIN'); end if;
  select count(*) into n from public.nba_hoopsapi_attempts_v1 where account_scope=p_account
    and coalesce(dispatched_at,reserved_at) > t-interval '24 hours';
  if n >= a.request_cap then return jsonb_build_object('status','APP_QUOTA_EXHAUSTED','charged_attempts_24h',n,'cap',a.request_cap); end if;
  insert into public.nba_hoopsapi_attempts_v1(account_scope,request_id,reserved_at,dispatch_deadline,status)
    values(p_account,p_request_id,t,t+interval '15 seconds','reserved') returning attempt_id into v_id;
  return jsonb_build_object('status','RESERVED','attempt_id',v_id,'charged_attempts_24h',n+1,'cap',a.request_cap);
end;
$$;

create function public.dispatch_nba_hoopsapi_capture_v1(p_account text, p_attempt_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.nba_hoopsapi_accounts_v1; r public.nba_hoopsapi_attempts_v1; t timestamptz;
begin
  select * into a from public.nba_hoopsapi_accounts_v1 where account_scope=p_account for update;
  if not found then return jsonb_build_object('status','ACCOUNT_NOT_CONFIGURED'); end if;
  t := clock_timestamp();
  select * into r from public.nba_hoopsapi_attempts_v1 where attempt_id=p_attempt_id and account_scope=p_account for update;
  if not found or r.status <> 'reserved' or r.dispatch_deadline <= t or not a.enabled or a.blocked_until > t
    then return jsonb_build_object('status','DISPATCH_DENIED'); end if;
  update public.nba_hoopsapi_attempts_v1 set status='dispatched',dispatched_at=t where attempt_id=p_attempt_id;
  return jsonb_build_object('status','DISPATCH_GRANTED');
end;
$$;

create function public.complete_nba_hoopsapi_capture_v1(p_account text, p_attempt_id uuid, p_received_at timestamptz,
  p_raw text, p_sha256 text, p_normalized jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r public.nba_hoopsapi_attempts_v1; v_id uuid; v_hash text;
begin
  select * into r from public.nba_hoopsapi_attempts_v1 where attempt_id=p_attempt_id and account_scope=p_account for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  select capture_id,response_sha256 into v_id,v_hash from public.nba_hoopsapi_captures_v1 where attempt_id=p_attempt_id;
  if found then
    if v_hash <> p_sha256 then raise exception 'CAPTURE_CONFLICT'; end if;
    return jsonb_build_object('status','ARCHIVED','capture_id',v_id);
  end if;
  if r.status <> 'dispatched' or p_received_at < r.dispatched_at or p_received_at > clock_timestamp()+interval '5 seconds'
    or p_received_at is null or p_raw is null or p_sha256 is null or p_normalized is null
    or p_sha256 <> encode(sha256(convert_to(p_raw,'UTF8')),'hex')
    or p_normalized->>'provider' is distinct from 'hoopsapi' or p_normalized->>'capture_version' is distinct from 'NBA_HOOPSAPI_DURABLE_PREVIEW_V2'
    or jsonb_typeof(p_normalized->'quotes') is distinct from 'array' or jsonb_typeof(p_normalized->'games') is distinct from 'array'
    then raise exception 'CAPTURE_CONTRACT_INVALID'; end if;
  insert into public.nba_hoopsapi_captures_v1(attempt_id,account_scope,source_received_at,response_sha256,raw_response,normalized)
    values(p_attempt_id,p_account,p_received_at,p_sha256,p_raw,p_normalized) returning capture_id into v_id;
  update public.nba_hoopsapi_attempts_v1 set status='succeeded',completed_at=clock_timestamp(),provider_http_status=200 where attempt_id=p_attempt_id;
  return jsonb_build_object('status','ARCHIVED','capture_id',v_id);
end;
$$;

create function public.fail_nba_hoopsapi_capture_v1(p_account text,p_attempt_id uuid,p_code text,p_http integer,p_retry_seconds integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r public.nba_hoopsapi_attempts_v1; t timestamptz;
begin
  perform 1 from public.nba_hoopsapi_accounts_v1 where account_scope=p_account for update;
  t := clock_timestamp();
  select * into r from public.nba_hoopsapi_attempts_v1 where attempt_id=p_attempt_id and account_scope=p_account for update;
  if not found or r.status <> 'dispatched' then return jsonb_build_object('status','FAILURE_NOT_APPLIED'); end if;
  update public.nba_hoopsapi_attempts_v1 set status='failed',completed_at=t,failure_code=p_code,provider_http_status=p_http where attempt_id=p_attempt_id;
  if p_code='PROVIDER_429' then
    update public.nba_hoopsapi_accounts_v1 set blocked_until=greatest(blocked_until,t+make_interval(secs=>least(86400,greatest(1,coalesce(p_retry_seconds,86400))))) where account_scope=p_account;
  end if;
  return jsonb_build_object('status','FAILURE_RECORDED');
end;
$$;

revoke execute on function public.reject_nba_hoopsapi_capture_mutation_v1(),public.read_nba_hoopsapi_quota_v1(text),
 public.claim_nba_hoopsapi_capture_v1(text,uuid),public.dispatch_nba_hoopsapi_capture_v1(text,uuid),
 public.complete_nba_hoopsapi_capture_v1(text,uuid,timestamptz,text,text,jsonb),
 public.fail_nba_hoopsapi_capture_v1(text,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.read_nba_hoopsapi_quota_v1(text),public.claim_nba_hoopsapi_capture_v1(text,uuid),
 public.dispatch_nba_hoopsapi_capture_v1(text,uuid),public.complete_nba_hoopsapi_capture_v1(text,uuid,timestamptz,text,text,jsonb),
 public.fail_nba_hoopsapi_capture_v1(text,uuid,text,integer,integer) to service_role;
commit;
