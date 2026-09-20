-- Harden MLB Moneyline daily materialization audit after context-component parity recovery.
-- COMPLETE now requires all strict-prior non-Lineup context components to be populated for every source game.
-- Starter and Lineup remain evidence-gated and may be NULL without converting a complete warehouse sync to PARTIAL.

alter table public.mlb_ml_daily_materialization_audit_v1
  add column if not exists offense_games integer not null default 0,
  add column if not exists bullpen_games integer not null default 0,
  add column if not exists home_away_games integer not null default 0,
  add column if not exists fatigue_travel_games integer not null default 0,
  add column if not exists defense_context_games integer not null default 0;

CREATE OR REPLACE FUNCTION public.mlb_ml_xyear_materialize_pregame_v4(p_target_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_core jsonb;
  v_source_games integer;
  v_feature_games integer;
  v_map_n integer;
  v_feature_value_rows integer;
  v_component_rows integer;
  v_team_strength integer;
  v_recent integer;
  v_offense integer;
  v_bullpen integer;
  v_home_away integer;
  v_fatigue integer;
  v_defense integer;
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

  select count(*)::int into v_offense
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='offense' and score is not null;

  select count(*)::int into v_bullpen
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='bullpen' and score is not null;

  select count(*)::int into v_home_away
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='home_away' and score is not null;

  select count(*)::int into v_fatigue
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='fatigue_travel' and score is not null;

  select count(*)::int into v_defense
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
    and component='defense_context' and score is not null;

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
     and v_offense=v_source_games
     and v_bullpen=v_source_games
     and v_home_away=v_source_games
     and v_fatigue=v_source_games
     and v_defense=v_source_games
     and v_history=v_source_games
     and v_zero_bad=0
     and v_cutoff_bad=0
     and v_starter_time_bad=0
    then 'READY_CORE_FAIL_CLOSED'
    else 'PARTIAL'
  end;

  insert into public.mlb_ml_daily_materialization_audit_v1(
    game_date,source_games,feature_games,mapped_features_per_game,feature_value_rows,
    component_rows,team_strength_games,recent_form_games,offense_games,bullpen_games,
    home_away_games,fatigue_travel_games,defense_context_games,history_games,starter_games,
    lineup_matchup_games,route_bcd_evaluable_games,zero_populated_nonnull_score_rows,
    cutoff_violation_rows,starter_evidence_time_violations,integrity_status,notes,materialized_at
  )
  values(
    p_target_date,v_source_games,v_feature_games,v_map_n,v_feature_value_rows,
    v_component_rows,v_team_strength,v_recent,v_offense,v_bullpen,
    v_home_away,v_fatigue,v_defense,v_history,v_starter,
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
      offense_games=excluded.offense_games,
      bullpen_games=excluded.bullpen_games,
      home_away_games=excluded.home_away_games,
      fatigue_travel_games=excluded.fatigue_travel_games,
      defense_context_games=excluded.defense_context_games,
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
        format('[xyear_daily_sync_v4] integrity=%s; feature_games=%s/%s; feature_values=%s expected=%s; components=%s expected=%s; team_strength=%s; recent=%s; offense=%s; bullpen=%s; home_away=%s; fatigue_travel=%s; defense_context=%s; history=%s; starter=%s; lineup=%s; route_BCD_evaluable=%s; zero-input_nonnull_score=%s; cutoff_violations=%s; starter_time_violations=%s. Missing pregame starter/lineup evidence is route-gated NULL and does not make a complete warehouse sync PARTIAL.',
          v_integrity,v_feature_games,v_source_games,v_feature_value_rows,v_source_games*v_map_n,
          v_component_rows,v_source_games*10,v_team_strength,v_recent,v_offense,v_bullpen,
          v_home_away,v_fatigue,v_defense,v_history,v_starter,
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
    'offenseGames',v_offense,
    'bullpenGames',v_bullpen,
    'homeAwayGames',v_home_away,
    'fatigueTravelGames',v_fatigue,
    'defenseContextGames',v_defense,
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
$function$
;

revoke all on function public.mlb_ml_xyear_materialize_pregame_v4(date) from public,anon,authenticated;
grant execute on function public.mlb_ml_xyear_materialize_pregame_v4(date) to service_role;

comment on function public.mlb_ml_xyear_materialize_pregame_v4(date) is
'Canonical leakage-safe Moneyline daily finalizer. COMPLETE requires full strict-prior Team Strength, Recent Form, Offense, Bullpen, Home/Away, Fatigue/Travel, Defense Context and History coverage; Starter/Lineup remain evidence-gated NULL fail-closed.';
