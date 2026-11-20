-- caseStats
with measurements as (select player_id,provider_game_id,game_datetime,materialized_at,case when player_id=132 then fg3m when player_id=17895858 then pts+reb+ast else ast end v from nba_goat_player_game_research_v1 where season=2026 and minutes_played>=10 and player_id in (132,17895858,1028038426) and game_datetime<'2026-11-20T23:15Z'), results as (select *,row_number() over(partition by player_id,cutoff order by game_datetime desc) n from measurements cross join(values ('2026-11-20 23:00Z'::timestamptz),('2026-11-20 23:15Z'::timestamptz)) cuts(cutoff) where materialized_at<=cutoff) select player_id,cutoff,round(avg(v)filter(where n<=5),2) l5,round(avg(v)filter(where n<=10),2) l10 from results group by 1,2 order by 1,2;

-- rawDisagree
with v as (select c.provider_game_id,p->'player'->>'id' player_id,p,c.player_stats_captured_at from nba_game_context_v2 c cross join lateral jsonb_array_elements(c.player_stats->'data') p where player_stats_captured_at>='2026-10-20') select count(*) raw_rows,count(*) filter(where r.player_id is null) raw_missing_compact,count(*) filter(where r.minutes_played>=10) eligible_join,count(*) filter(where r.minutes_played>=10 and ((p->>'ast')::int is distinct from r.ast or (p->>'reb')::int is distinct from r.reb or (p->>'fg3m')::int is distinct from r.fg3m or (p->>'pts')::int is distinct from r.pts)) disagreement from v left join nba_goat_player_game_research_v1 r on r.provider_game_id=v.provider_game_id and r.player_id=v.player_id::bigint and r.season=2026;

-- rawDetails
with v as (select c.provider_game_id,c.player_stats_captured_at,c.game_id,p from nba_game_context_v2 c cross join lateral jsonb_array_elements(c.player_stats->'data') p) select v.provider_game_id,v.game_id,p->'game'->>'date' event_date,p->'game'->>'status_state' game_status,p->'player'->>'first_name' given,p->'player'->>'last_name' family, v.player_stats_captured_at original_at,r.source_captured_at compact_source_at, jsonb_build_array(p->>'pts',p->>'reb',p->>'ast',p->>'fg3m') original,jsonb_build_array(r.pts,r.reb,r.ast,r.fg3m) compact from v join nba_goat_player_game_research_v1 r on r.provider_game_id=v.provider_game_id and r.player_id=(p->'player'->>'id')::bigint where r.minutes_played>=10 and ((p->>'ast')::int is distinct from r.ast or (p->>'reb')::int is distinct from r.reb or (p->>'fg3m')::int is distinct from r.fg3m or (p->>'pts')::int is distinct from r.pts);

-- rawMissing
with v as (select c.provider_game_id,c.player_stats_captured_at,c.game_id,p from nba_game_context_v2 c cross join lateral jsonb_array_elements(c.player_stats->'data') p) select v.provider_game_id,p->'game'->>'date' event_date,p->'game'->>'status_state' game_status,p->'game'->'home_team'->>'full_name' as home,p->'game'->'visitor_team'->>'full_name' as away,count(*) original_rows from v left join nba_goat_player_game_research_v1 r on r.provider_game_id=v.provider_game_id and r.player_id=(p->'player'->>'id')::bigint where r.player_id is null group by 1,2,3,4,5;

-- rawCalDetails
select s.date_local,g->>'id' provider_id,g->>'date' provider_date,g->>'datetime' utc_tip,g->'home_team'->>'full_name' home,g->'visitor_team'->>'full_name' away from (select distinct on (date_local) date_local,payload from nba_market_schedules_v1 where date_local between '2026-11-02' and '2026-11-19' order by date_local,source_received_at desc) s cross join lateral jsonb_array_elements(s.payload#>'{data,games}') g where g->>'status_state'='final' and not exists(select 1 from nba_goat_season_archive_v1 a where a.dataset_key='player_stats' and a.season=2026 and a.provider_game_id=(g->>'id')::bigint);

-- allCalendar
select count(*) as finals,count(distinct g->>'id') as distinct_finals from (select distinct on (date_local) date_local,payload from nba_market_schedules_v1 where date_local between '2026-11-02' and '2026-11-19' order by date_local,source_received_at desc) s cross join lateral jsonb_array_elements(s.payload#>'{data,games}') g where g->>'status_state'='final';

-- archCon
select count(*) as archives,count(*) filter(where o.id is null) missing_object,count(*) filter(where a.data_count<>coalesce(r.n,0)) row_count_mismatch,sum(a.compressed_bytes) bytes from nba_goat_season_archive_v1 a left join storage.objects o on o.bucket_id=a.storage_bucket and o.name=a.storage_object_path left join (select season,provider_game_id,count(*) n from nba_goat_player_game_research_v1 group by 1,2) r using(season,provider_game_id) where a.dataset_key='player_stats';

-- qualityNBA
select count(*) rows,count(*) filter(where a.provider_game_id is null) no_manifest,count(*) filter(where r.source_sha256 is distinct from a.response_sha256) hash_disagrees,count(*) filter(where r.source_captured_at<r.game_datetime) pretip_source,count(*) filter(where r.minutes_played>=10 and (r.pts is null or r.reb is null or r.ast is null or r.fg3m is null)) partial_stats from nba_goat_player_game_research_v1 r left join nba_goat_season_archive_v1 a on (r.season,r.provider_game_id)=(a.season,a.provider_game_id) and a.dataset_key='player_stats';

-- material
select count(*) rows,count(distinct (season,provider_game_id,player_id)) known_keys,count(distinct provider_game_id) games,min(game_datetime) oldest,max(game_datetime) newest,max(materialized_at) materialized,max(source_captured_at) source from nba_goat_player_game_research_v1;

-- advanced
select count(*) as research_rows,count(*) filter(where source_captured_at>game_datetime+interval '24 hours') source_lag_24h,count(*) filter(where materialized_at>source_captured_at+interval '24 hours') materialize_lag_24h from nba_goat_player_game_research_v1;

-- marketMeta
select distinct on(market) market,period,contract,phase,payload->>'sportsbook' book,payload->>'overtime_rule' overtime,provider_updated_at from nba_market_quotes_v1 where source_received_at>'2026-11-19' order by market,source_received_at desc;

-- availability
select count(*) captures,max(captured_at) latest,count(*) filter(where coverage->>'injuriesComplete'='true') with_injury_coverage,count(*) filter(where coverage->>'projectedLineupsComplete'='true') with_lineup_coverage from nba_pregame_context_v1;

-- nbaquoteTime
select count(*) total,count(*) filter(where provider_updated_at is null) missing_update,count(*) filter(where provider_updated_at>source_received_at) future_update,count(*) filter(where source_received_at-provider_updated_at> interval '3 hours') provider_lag_3h from nba_market_quotes_v1 where source_received_at>='2026-11-20 04:00Z' and source_received_at<'2026-11-20 23:15Z';

-- quoteParity
with s as (select distinct on(provider_game_id) provider_game_id,snapshot_id,source_received_at,payload,quote_count from nba_market_snapshots_v1 where date_local='2026-11-20' and source_received_at<'2026-11-20 23:15Z' and (payload#>'{data,quotes,0}') ->> 'market'='props' order by provider_game_id,source_received_at desc) select provider_game_id,quote_count, jsonb_array_length(payload#>'{data,quotes}') raw_total, (select count(*) from jsonb_array_elements(payload#>'{data,quotes}') x where x->>'side' in ('over','under')) raw_sides, (select count(*) from nba_market_quotes_v1 q where q.snapshot_id=s.snapshot_id and q.side in ('over','under')) derived_sides from s order by 1;

-- freeze
select market,model_version,count(*) forecasts,count(distinct f.game_id) games,count(o.forecast_id) receipts,count(*) filter(where decision_at>=game_start_at or quote_captured_at>decision_at) invalid_time from nba_decision_shadow_forecasts_v1 f left join nba_decision_shadow_outcomes_v1 o using(forecast_id) group by 1,2;

-- freezeProof
select forecast_id,model_version,decision_at,game_id,game_start_at,game_date_local,market,period,side,statistic,player_id,line,american_odds,quote_id,quote_source,quote_captured_at,projection,l5,l10,historical_n,md5(to_jsonb(f)::text) as row_fingerprint from nba_decision_shadow_forecasts_v1 f where player_id=1028038426 and statistic='assists' and game_id=21718150 and l5=8.8 and l10=7.1 and projection=8.21 and decision_at<'2026-11-20 23:15Z' order by decision_at;

-- freezeTriggers
select tgname,tgenabled,c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid where not tgisinternal and c.relname in ('nba_decision_shadow_forecasts_v1','nba_decision_shadow_outcomes_v1') order by c.relname,tgname;

-- settleCohort
select model_version,market,count(*) contracts,count(distinct game_id) unique_games,round(avg(absolute_error),3) contract_mae from nba_decision_shadow_forecasts_v1 f join nba_decision_shadow_outcomes_v1 o using(forecast_id) where f.decision_at<'2026-11-20 23:15Z' group by 1,2 order by 1,2;

-- ledgers
select 'NHL' sport,count(*) forecasts,count(distinct p.event_id) games,min(scheduled_at) oldest,max(p.created_at) latest,count(*) filter(where exists(select 1 from nhl_free_outcomes_v1 o where o.event_id=p.event_id)) forecasts_with_event_receipt from nhl_free_predictions_v1 p union all select 'NCAAB',count(*),count(distinct p.event_id),min(scheduled_at),max(p.created_at),count(*) filter(where exists(select 1 from ncaab_daily_outcomes_v1 o where o.event_id=p.event_id)) from ncaab_daily_predictions_v1 p union all select 'UFC',count(*),count(distinct p.bout_id),min(scheduled_at),max(p.captured_at),count(*) filter(where exists(select 1 from ufc_free_results_v1 o where o.bout_id=p.bout_id)) from ufc_free_predictions_v1 p;

-- edge
select sport,cohort,model_version,count(*) rows,count(distinct event_id) games,min(scheduled_at) oldest,max(emitted_at) latest,count(o.forecast_id) joined_outcomes,count(distinct f.event_id) filter(where o.forecast_id is not null) matched_events from edge_lab_multi_forecasts_v1 f left join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id group by 1,2,3 order by 1,2,3;

-- soccer
select f.cohort,f.model_version,count(*) forecasts,count(distinct f.event_id) games,min(f.scheduled_at) oldest,max(f.emitted_at) latest,count(o.forecast_id) receipts from edge_lab_forecasts_v1 f left join edge_lab_outcomes_v1 o on o.forecast_id=f.id group by 1,2;

-- leagues
select f.league,count(*) forecasts,count(distinct f.event_id) events,min(f.start_at) first,max(f.issued_at) latest,count(r.event_id) with_receipt from free_sports_forecasts_v1 f left join free_sports_results_v1 r on r.league=f.league and r.event_id=f.event_id group by 1;

-- agedPlayable
select f.sport,f.status,f.market,count(*) forecast_rows,count(distinct f.event_id) unique_events from edge_lab_multi_forecasts_v1 f left join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id where f.scheduled_at<'2026-11-20 23:15Z'::timestamptz-interval '48 hours' and f.status<>'ABSTAIN' and o.forecast_id is null group by 1,2,3 order by 1,2,3;

-- ttsett
select f.sport, o.status,count(*) forecast_rows,count(distinct f.event_id) games from edge_lab_multi_forecasts_v1 f left join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id group by 1,2 order by 1,2;

-- nhlShadow
select model_version,status,count(*) rows,count(distinct event_id) events,count(*)filter(where frozen_at>=scheduled_at or source_completed_at>frozen_at) temporal_errors,min(frozen_at) first,max(frozen_at) last from nhl_challenger_shadow_v1 group by 1,2 union all select model_version,status,count(*),count(distinct event_id),count(*)filter(where frozen_at>=scheduled_at or source_completed_at>frozen_at),min(frozen_at),max(frozen_at) from nhl_late_shadow_v6 group by 1,2;

-- ncaaModel
select model_version,status,count(*) rows,count(distinct event_id) events,count(*)filter(where frozen_at>=scheduled_at or original_created_at>frozen_at) temporal_errors,min(frozen_at) first,max(frozen_at) last from ncaab_calibration_shadow_v1 group by 1,2;

-- mlbLedger
select count(*) rows,count(distinct game_pk) unique_games,min(target_date) first,max(target_date) latest,count(*) filter(where settled_at is not null) received from mlb_2026_forward_master_ledger_v1;

-- elapsed
select 'NHL' sport,count(*) filter(where p.created_at>=p.scheduled_at) late,count(*) filter(where p.scheduled_at<now()-interval '48 hours' and not exists(select 1 from nhl_free_outcomes_v1 o where o.event_id=p.event_id)) aged from nhl_free_predictions_v1 p union all select 'NCAAB',count(*) filter(where p.created_at>=p.scheduled_at),count(*) filter(where p.scheduled_at<now()-interval '48 hours' and not exists(select 1 from ncaab_daily_outcomes_v1 o where o.event_id=p.event_id)) from ncaab_daily_predictions_v1 p union all select 'UFC',count(*) filter(where p.captured_at>=p.scheduled_at),count(*) filter(where p.scheduled_at<now()-interval '48 hours' and not exists(select 1 from ufc_free_results_v1 o where o.bout_id=p.bout_id)) from ufc_free_predictions_v1 p;

-- soccerTime
select count(*) as rows,count(*)filter(where emitted_at>=scheduled_at) post_start_issue,count(*)filter(where probability is not null and (probability<0 or probability>1)) invalid_probability from edge_lab_forecasts_v1;

-- freeTime
select f.league,count(*) forecasts,count(*) filter(where issued_at>=start_at) post_start_issue from free_sports_forecasts_v1 f group by f.league;

-- providerMap
select 'NCAAB' sport,split_part(source_url,'/',3) host,count(*) items,max(captured_at) latest from ncaab_daily_source_v1 group by 2 union all select 'NHL',split_part(source_url,'/',3),count(*),max(captured_at) from nhl_free_source_v1 group by 2 union all select 'UFC',split_part(source_url,'/',3),count(*),max(captured_at) from ufc_free_sources_v1 group by 2 union all select 'Soccer',split_part(source_url,'/',3),count(*),max(captured_at) from edge_lab_sources_v1 group by 2;

-- runErrors
select distinct on(split_part(slot,':',2)) split_part(slot,':',2) lane,status,started_at,completed_at from nba_market_sync_runs_v1 where slot like 'research:%' order by 1,started_at desc;

-- feeds
select 'NHL' sport,status,max(completed_at) latest,count(*) runs from nhl_free_runs_v1 group by 2 union all select 'NCAAB',status,max(completed_at),count(*) from ncaab_daily_runs_v1 group by 2 union all select 'UFC',status,max(completed_at),count(*) from ufc_free_runs_v1 group by 2 union all select 'SOCCER',status,max(finished_at),count(*) from edge_lab_runs_v1 group by 2 union all select sport,status,max(finished_at),count(*) from edge_lab_multi_runs_v1 group by 1,2 union all select league,state,max(observed_at),count(*) from free_sports_runs_v1 group by 1,2;

-- ncaabId
select count(*) receipts,count(*)filter(where p.body->>'home_id' is distinct from o.body->>'home_id' or p.body->>'away_id' is distinct from o.body->>'away_id') side_identity_disagreements,count(*)filter(where o.observed_at<=p.scheduled_at) impossible_receipt from ncaab_daily_predictions_v1 p join ncaab_daily_outcomes_v1 o using(event_id);

-- ncaabExceptions
select p.event_id,p.scheduled_at,p.created_at,p.body->>'state' prediction_state,p.body->>'home_name' home,p.body->>'away_name' away,p.body->>'home_id' predicted_home,p.body->>'away_id' predicted_away,o.body->>'home_id' result_home,o.body->>'away_id' result_away,o.body->>'status' result_status,o.observed_at from ncaab_daily_predictions_v1 p join ncaab_daily_outcomes_v1 o using(event_id) where p.body->>'home_id' is distinct from o.body->>'home_id' or p.body->>'away_id' is distinct from o.body->>'away_id' or o.observed_at<=p.scheduled_at order by p.scheduled_at;

-- nhlId
select count(*) receipts,count(*)filter(where p.body->>'homeId' is distinct from o.body->>'homeId' or p.body->>'awayId' is distinct from o.body->>'awayId') side_identity_disagreements,count(*)filter(where o.observed_at<=p.scheduled_at) impossible_receipt from nhl_free_predictions_v1 p join nhl_free_outcomes_v1 o using(event_id);

-- ufcId
select count(*) joined_rows,count(distinct p.bout_id) bouts,count(*) filter(where o.body->>'winnerId' not in (p.body#>>'{bout,aId}',p.body#>>'{bout,bId}')) alien_winner,count(*) filter(where o.captured_at<=p.scheduled_at) impossible_receipt from ufc_free_predictions_v1 p join ufc_free_results_v1 o using(bout_id);

-- candidate
select sport,model_version,state,count(*) candidates from model_learning_candidates_v1 group by 1,2,3 order by 1,2;

-- allPred
select sport_key,model_role,model_version,prediction_origin,count(*) forecasts,count(distinct game_id) games from prediction_history group by 1,2,3,4 order by 1,2,3;

-- sheadOrigQ
select payload->'quote_id' quote_id,payload->'game_id' game_id,payload->'player_id' player_id,payload->'statistic' statistic,payload->'market' market,payload->'period' period,payload->'side' side,payload->'line' line,payload->'american_odds' american_odds,payload->'contract' contract,payload->'provider_updated_at' provider_updated_at,payload->'source_received_at' source_received_at,payload->'sportsbook' sportsbook,payload->'overtime_rule' overtime_rule,payload->'freshness' freshness from nba_market_quotes_v1 where quote_id='809e3cc3358a7972c79a38d867d8af997a32fe6dea42b20c2cab1f3a1a7ac4fa' limit 1;

-- freezeAtCutoff
select count(*) as frozen,count(distinct game_id) independent_games,count(*) filter(where market='props') prop_rows,count(distinct game_id) filter(where market='props') prop_games,count(*) filter(where quote_captured_at>decision_at or decision_at>=game_start_at) temporal_violations from nba_decision_shadow_forecasts_v1 where decision_at<='2026-11-20 23:15Z';

-- freezeTimeline
select decision_at,model_version,period,line,american_odds,projection,l5,l10,historical_n from nba_decision_shadow_forecasts_v1 where player_id=1028038426 and game_id=21718150 and market='props' and statistic='assists' and side='over' and line=4.5 and decision_at<'2026-11-20 23:42Z' order by decision_at;
