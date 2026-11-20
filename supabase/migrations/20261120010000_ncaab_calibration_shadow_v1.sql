-- Append-only prospective NCAAB calibration candidate; no Official Picks.
-- Never rewrite NCAAB_PRESEASON_V1 forecasts or settled outcomes.
create table if not exists public.ncaab_calibration_shadow_v1 (
 id text primary key,
 event_id text not null unique,
 model_version text not null default 'NCAAB_SIDE_PRESERVING_SHADOW_V1',
 original_prediction_id text not null,
 profile_sha256 text not null,
 scheduled_at timestamptz not null,
 original_created_at timestamptz not null,
 frozen_at timestamptz not null,
 home_id text not null,
 away_id text not null,
 source_hash text not null,
 baseline jsonb not null,
 candidate jsonb not null,
 history_evidence jsonb not null,
 status text not null default 'FROZEN_RESEARCH',
 official_pick boolean not null default false,
 production_eligible boolean not null default false,
 created_at timestamptz not null default now(),
 constraint ncaab_calibration_id check (id=model_version||':'||event_id),
 constraint ncaab_calibration_version check (model_version='NCAAB_SIDE_PRESERVING_SHADOW_V1'),
 constraint ncaab_calibration_event_id check (event_id~'^espn:[0-9]{6,15}$'),
 constraint ncaab_calibration_profile check (profile_sha256~'^[a-f0-9]{64}$'),
 constraint ncaab_calibration_hash check (source_hash~'^[a-f0-9]{64}$'),
 constraint ncaab_calibration_teams check (home_id~'^[0-9]{1,12}$' and away_id~'^[0-9]{1,12}$' and home_id<>away_id),
 constraint ncaab_calibration_freeze_time check (
  original_created_at<=frozen_at
  and frozen_at-original_created_at<=interval '10 minutes'
  and frozen_at<=scheduled_at-interval '60 minutes'
  and created_at>=frozen_at-interval '10 seconds'
  and created_at<=frozen_at+interval '5 minutes'),
 constraint ncaab_calibration_never_official check (
   official_pick=false and production_eligible=false and status='FROZEN_RESEARCH'),
 constraint ncaab_calibration_research_only check (
  (history_evidence->>'priorGames')::int>=100
  and history_evidence->>'totalAdjustmentApplied'='false'
  and candidate->>'model_promotion_allowed'='false'
  and candidate->>'bookmaker_value_estimated' is null
  and candidate->>'predicted_winner_unchanged'=baseline->>'predicted_winner'
  and (candidate->>'projected_total_unchanged')::numeric=(baseline->>'projected_total')::numeric
  and (case when (baseline->>'home_win_probability')::numeric>=0.5
   then (candidate->>'probability_home_preserve_original_side')::numeric>=0.5
   else (candidate->>'probability_home_preserve_original_side')::numeric<0.5 end)
 )
);
create index if not exists ncaab_calibration_shadow_frozen_idx on public.ncaab_calibration_shadow_v1(frozen_at desc);
alter table public.ncaab_calibration_shadow_v1 enable row level security;
revoke all on public.ncaab_calibration_shadow_v1 from public,anon,authenticated;
revoke update,delete,truncate on public.ncaab_calibration_shadow_v1 from service_role;
grant select,insert on public.ncaab_calibration_shadow_v1 to service_role;
comment on table public.ncaab_calibration_shadow_v1 is
 'NCAAB research-only immutable side-preserving model calibration, as-of known finals only; no official wagers/picks.';
