-- NHL V6: immutable late-pregame research ledger. Separate from
-- NHL Poisson V1 frozen snapshots and ALL Official Picks.
-- No public RLS read or write grants. No post-freeze mutation.
create table if not exists public.nhl_late_shadow_v6 (
 id text primary key,
 event_id text not null unique,
 model_version text not null default 'NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6',
 scheduled_at timestamptz not null,
 frozen_at timestamptz not null,
 source_completed_at timestamptz not null,
 home_team_id bigint not null,
 away_team_id bigint not null,
 source_hash text not null,
 goalie_snapshot_id text not null,
 goalie_evidence jsonb not null,
 calibration jsonb not null,
 projection jsonb not null,
 market_proxies jsonb not null,
 special_teams_evidence jsonb not null,
 status text not null default 'FROZEN_RESEARCH',
 official_pick boolean not null default false,
 production_eligible boolean not null default false,
 created_at timestamptz not null default now(),
 constraint nhl_late_v6_id_contract check (id = model_version || ':' || event_id),
 constraint nhl_late_v6_model_version check (model_version='NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6'),
 constraint nhl_late_v6_event check (event_id ~ '^nhl:202602[0-9]{4}$'),
 constraint nhl_late_v6_teams check (home_team_id<>away_team_id),
 constraint nhl_late_v6_time check (
   frozen_at <= scheduled_at - interval '60 minutes'
   and source_completed_at <= frozen_at
   and frozen_at-source_completed_at <= interval '45 minutes'
   and created_at >= frozen_at-interval '10 seconds'
   and created_at <= frozen_at+interval '5 minutes'
   and created_at <= scheduled_at-interval '55 minutes'
 ),
 constraint nhl_late_v6_source_hash check (source_hash ~ '^[a-f0-9]{64}$'),
 constraint nhl_late_v6_probable_snapshot check (goalie_snapshot_id<>''
  and jsonb_typeof(goalie_evidence)='object'
  and goalie_evidence->>'status'='PREGAME_PROBABLE_SOURCE_ONLY'
  and goalie_evidence->>'isConfirmedStarter'='false'
  and goalie_evidence->>'goalieAdjustmentApplied'='false'),
 constraint nhl_late_v6_research_payload check (
  jsonb_typeof(calibration)='object' and jsonb_typeof(projection)='object'
  and jsonb_typeof(market_proxies)='object'
  and jsonb_typeof(special_teams_evidence)='object'
  and calibration->>'holdoutPassed'='false'
  and calibration->>'officialPromotion'='false'
  and calibration->>'expectedValue' is null
 ),
 constraint nhl_late_v6_never_official check(
  status='FROZEN_RESEARCH' and official_pick=false and production_eligible=false)
);
create index if not exists nhl_late_shadow_v6_frozen_idx
 on public.nhl_late_shadow_v6(frozen_at desc);
alter table public.nhl_late_shadow_v6 enable row level security;
revoke all on public.nhl_late_shadow_v6 from public,anon,authenticated;
revoke update,delete,truncate on public.nhl_late_shadow_v6 from service_role;
grant select,insert on public.nhl_late_shadow_v6 to service_role;
comment on table public.nhl_late_shadow_v6 is
'Immutable as-of late NHL V6 goalie PROBABLE-only and experimental Circa calibration; no official model, no pregame confirmed starter inference or PnL claims.';
