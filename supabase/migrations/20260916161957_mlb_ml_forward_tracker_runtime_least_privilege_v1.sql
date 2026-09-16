alter table public.mlb_ml_prior2025_team_v1 enable row level security;
alter table public.mlb_ml_xyear_feature_stats_v1 enable row level security;
alter table public.mlb_ml_xyear_component_stats_v1 enable row level security;
alter table public.mlb_ml_xyear_team_game_v1 enable row level security;
alter table public.mlb_ml_xyear_pitcher_game_v1 enable row level security;
alter table public.mlb_ml_xyear_game_v1 enable row level security;
alter table public.mlb_ml_forward_tracker_v1 enable row level security;

revoke all privileges on table public.mlb_ml_prior2025_team_v1 from anon, authenticated, service_role;
revoke all privileges on table public.mlb_ml_xyear_feature_stats_v1 from anon, authenticated, service_role;
revoke all privileges on table public.mlb_ml_xyear_component_stats_v1 from anon, authenticated, service_role;
revoke all privileges on table public.mlb_ml_xyear_team_game_v1 from anon, authenticated, service_role;
revoke all privileges on table public.mlb_ml_xyear_pitcher_game_v1 from anon, authenticated, service_role;
revoke all privileges on table public.mlb_ml_xyear_game_v1 from anon, authenticated, service_role;

grant select on table public.mlb_ml_prior2025_team_v1 to service_role;
grant select on table public.mlb_ml_xyear_feature_stats_v1 to service_role;
grant select on table public.mlb_ml_xyear_component_stats_v1 to service_role;
grant select on table public.mlb_ml_xyear_team_game_v1 to service_role;
grant select on table public.mlb_ml_xyear_pitcher_game_v1 to service_role;
grant select on table public.mlb_ml_xyear_game_v1 to service_role;

revoke all privileges on table public.mlb_ml_forward_tracker_v1 from anon, authenticated, service_role;
grant select on table public.mlb_ml_forward_tracker_v1 to service_role;
grant insert (
  tracking_date,event_id,game_pk,start_time,home_team,away_team,model_version,
  snapshot_ts,feature_cutoff_ts,data_status,starter_score,team_prior_2025_score,
  history_score,lineup_matchup_score,recent_form_score,standard_score,pick_status,
  recommended_team,recommended_side,route_id,route_details,market_moneyline,
  market_no_vig_prob,notes,frozen_at
) on table public.mlb_ml_forward_tracker_v1 to service_role;
grant update (actual_winner,result_status,graded_at,updated_at)
  on table public.mlb_ml_forward_tracker_v1 to service_role;

revoke all privileges on sequence public.mlb_ml_forward_tracker_v1_id_seq from anon, authenticated, service_role;
grant usage on sequence public.mlb_ml_forward_tracker_v1_id_seq to service_role;
