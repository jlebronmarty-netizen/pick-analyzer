
-- Canonical source-controlled adoption of the leakage-safe MLB Moneyline daily materializer.
-- This migration does not retune any model, threshold or route.

create table if not exists public.mlb_ml_pregame_starter_evidence_v1 (
  game_date date not null,
  game_pk bigint not null,
  side text not null check (side in ('HOME','AWAY')),
  pitcher_mlbam_id bigint not null,
  pitcher_name text,
  evidence_source text not null,
  evidence_timestamp timestamptz not null,
  first_pitch timestamptz not null,
  source_job_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key(game_pk,side),
  constraint mlb_ml_pregame_starter_evidence_v1_pregame_ck
    check (evidence_timestamp < first_pitch)
);

create index if not exists mlb_ml_pregame_starter_evidence_date_idx
  on public.mlb_ml_pregame_starter_evidence_v1(game_date,game_pk);

alter table public.mlb_ml_pregame_starter_evidence_v1 enable row level security;
revoke all on table public.mlb_ml_pregame_starter_evidence_v1 from anon,authenticated;
grant select on table public.mlb_ml_pregame_starter_evidence_v1 to service_role;

create or replace function public.mlb_ml_capture_pregame_starter_evidence_v1(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_rows integer := 0;
  v_rows_second integer := 0;
begin
  insert into public.mlb_ml_pregame_starter_evidence_v1(
    game_date,game_pk,side,pitcher_mlbam_id,pitcher_name,
    evidence_source,evidence_timestamp,first_pitch,metadata
  )
  select
    f.feature_date,
    f.target_game_pk,
    s.side,
    s.pitcher_id,
    case when s.side='HOME'
         then g.metadata->'homeProbablePitcher'->>'fullName'
         else g.metadata->'awayProbablePitcher'->>'fullName' end,
    'PICK2_MLB_FIRST_INNING_DAILY_FEATURES',
    f.as_of_timestamp,
    g.scheduled_at,
    jsonb_build_object(
      'feature_snapshot_id',f.feature_snapshot_id,
      'feature_version',f.feature_version,
      'as_of_date',f.as_of_date,
      'source_rule','source_game_date < target_game_date'
    )
  from public.pick2_mlb_first_inning_daily_features f
  join public.pick2_mlb_games g on g.game_pk=f.target_game_pk
  cross join lateral (
    values
      ('HOME'::text,f.home_starter_mlbam_pitcher_id),
      ('AWAY'::text,f.away_starter_mlbam_pitcher_id)
  ) s(side,pitcher_id)
  where f.feature_date=p_target_date
    and s.pitcher_id is not null
    and f.as_of_date < p_target_date
    and f.as_of_timestamp < g.scheduled_at
  on conflict (game_pk,side) do update
  set pitcher_mlbam_id=excluded.pitcher_mlbam_id,
      pitcher_name=coalesce(excluded.pitcher_name,public.mlb_ml_pregame_starter_evidence_v1.pitcher_name),
      evidence_source=excluded.evidence_source,
      evidence_timestamp=excluded.evidence_timestamp,
      first_pitch=excluded.first_pitch,
      metadata=excluded.metadata
  where excluded.evidence_timestamp > public.mlb_ml_pregame_starter_evidence_v1.evidence_timestamp
    and excluded.evidence_timestamp < excluded.first_pitch;

  get diagnostics v_rows = row_count;

  insert into public.mlb_ml_pregame_starter_evidence_v1(
    game_date,game_pk,side,pitcher_mlbam_id,pitcher_name,
    evidence_source,evidence_timestamp,first_pitch,metadata
  )
  select
    g.game_date,
    g.game_pk,
    s.side,
    s.pitcher_id,
    s.pitcher_name,
    'PICK2_MLB_GAMES_PROBABLE_PITCHER',
    g.updated_at,
    g.scheduled_at,
    jsonb_build_object(
      'source',g.source,
      'source_payload_digest',g.source_payload_digest,
      'phase',g.metadata->>'phase',
      'official_date',g.metadata->>'officialDate'
    )
  from public.pick2_mlb_games g
  cross join lateral (
    values
      ('HOME'::text,
       nullif(g.metadata->'homeProbablePitcher'->>'id','')::bigint,
       g.metadata->'homeProbablePitcher'->>'fullName'),
      ('AWAY'::text,
       nullif(g.metadata->'awayProbablePitcher'->>'id','')::bigint,
       g.metadata->'awayProbablePitcher'->>'fullName')
  ) s(side,pitcher_id,pitcher_name)
  where g.game_date=p_target_date
    and s.pitcher_id is not null
    and g.updated_at < g.scheduled_at
  on conflict (game_pk,side) do update
  set pitcher_mlbam_id=excluded.pitcher_mlbam_id,
      pitcher_name=coalesce(excluded.pitcher_name,public.mlb_ml_pregame_starter_evidence_v1.pitcher_name),
      evidence_source=excluded.evidence_source,
      evidence_timestamp=excluded.evidence_timestamp,
      first_pitch=excluded.first_pitch,
      metadata=excluded.metadata
  where excluded.evidence_timestamp > public.mlb_ml_pregame_starter_evidence_v1.evidence_timestamp
    and excluded.evidence_timestamp < excluded.first_pitch;

  get diagnostics v_rows_second = row_count;
  v_rows := v_rows + v_rows_second;

  return jsonb_build_object(
    'targetDate',p_target_date,
    'writeOperations',v_rows,
    'evidenceSides',(
      select count(*) from public.mlb_ml_pregame_starter_evidence_v1 where game_date=p_target_date
    ),
    'gamesWithBothStarters',(
      select count(*) from (
        select game_pk from public.mlb_ml_pregame_starter_evidence_v1
        where game_date=p_target_date
        group by game_pk having count(distinct side)=2
      ) q
    )
  );
end
$$;

revoke all on function public.mlb_ml_capture_pregame_starter_evidence_v1(date)
  from public,anon,authenticated;
grant execute on function public.mlb_ml_capture_pregame_starter_evidence_v1(date)
  to service_role;

create table if not exists public.mlb_ml_daily_materialization_audit_v1 (
  game_date date primary key,
  source_games integer not null,
  feature_games integer not null,
  mapped_features_per_game integer not null,
  feature_value_rows integer not null,
  component_rows integer not null,
  team_strength_games integer not null,
  recent_form_games integer not null,
  history_games integer not null,
  starter_games integer not null,
  lineup_matchup_games integer not null,
  route_bcd_evaluable_games integer not null,
  zero_populated_nonnull_score_rows integer not null,
  cutoff_violation_rows integer not null,
  starter_evidence_time_violations integer not null,
  integrity_status text not null,
  notes text,
  materialized_at timestamptz not null default now()
);

alter table public.mlb_ml_daily_materialization_audit_v1 enable row level security;
revoke all on table public.mlb_ml_daily_materialization_audit_v1 from anon,authenticated;
grant select on table public.mlb_ml_daily_materialization_audit_v1 to service_role;

create or replace function public.mlb_ml_xyear_materialize_pregame_v4(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_core jsonb;
  v_source_games integer;
  v_feature_games integer;
  v_map_n integer;
  v_feature_value_rows integer;
  v_component_rows integer;
  v_team_strength integer;
  v_recent integer;
  v_history integer;
  v_starter integer;
  v_lineup integer;
  v_route_bcd integer;
  v_zero_bad integer;
  v_cutoff_bad integer;
  v_starter_time_bad integer;
  v_integrity text;
  v_base_notes text;
begin
  -- V3 owns the frozen formula reconstruction. V4 only audits/finalizes sync semantics.
  v_core := public.mlb_ml_xyear_materialize_pregame_v3(p_target_date);

  select count(*)::int into v_source_games
  from public.mlb_ml_xyear_game_v1
  where season=2026 and game_date=p_target_date;

  select count(*)::int into v_feature_games
  from public.mlb_ml_xyear_features_v1
  where season=2026 and game_date=p_target_date
    and feature_version='xyear_daily_sync_v3_leakage_safe';

  select count(*)::int into v_map_n
  from public.mlb_ml_component_map_v2
  where branch='PREGAME' and source_kind='pregame';

  select count(*)::int into v_feature_value_rows
  from public.mlb_ml_xyear_feature_values_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date;

  select count(*)::int into v_component_rows
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date;

  select count(*)::int into v_team_strength
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='team_strength' and score is not null;

  select count(*)::int into v_recent
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='recent_form' and score is not null;

  select count(*)::int into v_history
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='history' and score is not null;

  select count(*)::int into v_starter
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='starter' and score is not null;

  select count(*)::int into v_lineup
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='lineup_matchup' and score is not null;

  select count(*)::int into v_route_bcd
  from public.mlb_ml_xyear_game_components_z_v1 z
  join public.mlb_ml_prior_scores_2026_v1 p using(game_pk)
  where z.branch='PREGAME' and z.season=2026 and z.game_date=p_target_date
    and p.team_prior_adv is not null
    and z.starter is not null
    and (z.recent_form is not null or z.history is not null);

  select count(*)::int into v_zero_bad
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and populated_feature_count=0 and score is not null;

  select count(*)::int into v_cutoff_bad
  from public.mlb_ml_xyear_features_v1
  where season=2026 and game_date=p_target_date
    and (feature_cutoff_date is null or feature_cutoff_date>=game_date);

  select count(*)::int into v_starter_time_bad
  from public.mlb_ml_pregame_starter_evidence_v1
  where game_date=p_target_date and evidence_timestamp>=first_pitch;

  v_integrity := case
    when v_source_games>0
     and v_feature_games=v_source_games
     and v_feature_value_rows=v_source_games*v_map_n
     and v_component_rows=v_source_games*10
     and v_team_strength=v_source_games
     and v_recent=v_source_games
     and v_history=v_source_games
     and v_zero_bad=0
     and v_cutoff_bad=0
     and v_starter_time_bad=0
    then 'READY_CORE_FAIL_CLOSED'
    else 'PARTIAL'
  end;

  insert into public.mlb_ml_daily_materialization_audit_v1(
    game_date,source_games,feature_games,mapped_features_per_game,feature_value_rows,
    component_rows,team_strength_games,recent_form_games,history_games,starter_games,
    lineup_matchup_games,route_bcd_evaluable_games,zero_populated_nonnull_score_rows,
    cutoff_violation_rows,starter_evidence_time_violations,integrity_status,notes,materialized_at
  )
  values(
    p_target_date,v_source_games,v_feature_games,v_map_n,v_feature_value_rows,
    v_component_rows,v_team_strength,v_recent,v_history,v_starter,
    v_lineup,v_route_bcd,v_zero_bad,v_cutoff_bad,v_starter_time_bad,v_integrity,
    'Sync completeness is separate from route availability. Missing timestamped pregame starter or lineup evidence stays NULL and disables only dependent frozen routes; it is not a warehouse ingestion failure.',
    now()
  )
  on conflict (game_date) do update
  set source_games=excluded.source_games,
      feature_games=excluded.feature_games,
      mapped_features_per_game=excluded.mapped_features_per_game,
      feature_value_rows=excluded.feature_value_rows,
      component_rows=excluded.component_rows,
      team_strength_games=excluded.team_strength_games,
      recent_form_games=excluded.recent_form_games,
      history_games=excluded.history_games,
      starter_games=excluded.starter_games,
      lineup_matchup_games=excluded.lineup_matchup_games,
      route_bcd_evaluable_games=excluded.route_bcd_evaluable_games,
      zero_populated_nonnull_score_rows=excluded.zero_populated_nonnull_score_rows,
      cutoff_violation_rows=excluded.cutoff_violation_rows,
      starter_evidence_time_violations=excluded.starter_evidence_time_violations,
      integrity_status=excluded.integrity_status,
      notes=excluded.notes,
      materialized_at=excluded.materialized_at;

  select regexp_replace(coalesce(notes,''),'\s*\[xyear_daily_sync_v[34]\].*$','')
    into v_base_notes
  from public.mlb_ml_daily_ingestion_ledger_v1
  where game_date=p_target_date;

  update public.mlb_ml_daily_ingestion_ledger_v1
  set features_games_refreshed=v_feature_games,
      status=case when v_integrity='READY_CORE_FAIL_CLOSED' then 'COMPLETE' else 'PARTIAL' end,
      source_cutoff_ts=now(),
      notes=concat_ws(' ',
        nullif(trim(v_base_notes),''),
        format('[xyear_daily_sync_v4] integrity=%s; feature_games=%s/%s; feature_values=%s expected=%s; components=%s expected=%s; team_strength=%s; recent=%s; history=%s; starter=%s; lineup=%s; route_BCD_evaluable=%s; zero-input_nonnull_score=%s; cutoff_violations=%s; starter_time_violations=%s. Missing pregame starter/lineup evidence is route-gated NULL and does not make a complete warehouse sync PARTIAL.',
          v_integrity,v_feature_games,v_source_games,v_feature_value_rows,v_source_games*v_map_n,
          v_component_rows,v_source_games*10,v_team_strength,v_recent,v_history,v_starter,
          v_lineup,v_route_bcd,v_zero_bad,v_cutoff_bad,v_starter_time_bad)
      ),
      updated_at=now()
  where game_date=p_target_date;

  return coalesce(v_core,'{}'::jsonb) || jsonb_build_object(
    'finalizerVersion','MLB_ML_XYEAR_DAILY_MATERIALIZER_V4',
    'integrityStatus',v_integrity,
    'sourceGames',v_source_games,
    'featureGames',v_feature_games,
    'mappedFeaturesPerGame',v_map_n,
    'featureValueRows',v_feature_value_rows,
    'componentRows',v_component_rows,
    'teamStrengthGames',v_team_strength,
    'recentFormGames',v_recent,
    'historyGames',v_history,
    'starterGames',v_starter,
    'lineupMatchupGames',v_lineup,
    'routeBCDEvaluableGames',v_route_bcd,
    'zeroPopulatedNonnullScoreRows',v_zero_bad,
    'cutoffViolationRows',v_cutoff_bad,
    'starterEvidenceTimeViolations',v_starter_time_bad,
    'syncStatus',case when v_integrity='READY_CORE_FAIL_CLOSED' then 'COMPLETE' else 'PARTIAL' end,
    'missingEvidencePolicy','NULL_FAIL_CLOSED',
    'officialPicksModified',false,
    'apostarActivated',false,
    'modelRetuned',false
  );
end
$$;

revoke all on function public.mlb_ml_xyear_materialize_pregame_v4(date)
  from public,anon,authenticated;
grant execute on function public.mlb_ml_xyear_materialize_pregame_v4(date)
  to service_role;

comment on function public.mlb_ml_xyear_materialize_pregame_v4(date) is
'Canonical leakage-safe Moneyline daily finalizer. Calls parity-certified v3, audits full mapped/component coverage, preserves missing starter/lineup as NULL route gates, and marks ledger COMPLETE only when the warehouse sync itself is complete.';
