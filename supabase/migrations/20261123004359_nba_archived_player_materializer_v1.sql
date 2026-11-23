-- Materialize only independently reconciled, already stored NBA final boxes.
-- No provider access, prediction writes, UPDATE/DELETE of compact history, or new cron.
create or replace function public.materialize_nba_archived_player_game_v1(
 p_job_id uuid, p_game_id bigint, p_source_captured_at timestamptz,
 p_schedule_snapshot_id text, p_payload_text text, p_response_sha256 text,
 p_compressed_bytes bigint, p_as_of timestamptz
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
 v_now timestamptz := clock_timestamp();
 v_version constant text := 'NBA_ARCHIVED_PLAYER_MATERIALIZER_V1';
 v_context public.nba_game_context_v2%rowtype;
 v_schedule public.nba_market_schedules_v1%rowtype;
 v_job public.sports_sync_jobs%rowtype;
 v_manifest public.nba_goat_season_archive_v1%rowtype;
 v_payload jsonb; v_game jsonb; v_player jsonb; v_rows jsonb := '[]'::jsonb; v_row jsonb;
 v_home bigint; v_away bigint; v_team bigint; v_player_id bigint; v_season integer;
 v_tip timestamptz; v_count integer; v_existing integer; v_inserted integer; v_json_bytes bigint;
 v_period integer; v_duration integer; v_seconds integer; v_stat text; v_value integer;
 v_home_pts integer := 0; v_away_pts integer := 0; v_home_n integer := 0; v_away_n integer := 0;
 v_home_secs integer := 0; v_away_secs integer := 0; v_seen bigint[] := '{}';
 v_h integer := 0; v_a integer := 0; v_x integer; v_y integer; v_i integer;
 v_hash text; v_path text; v_job_hash text; v_expected_job uuid;
begin
 if current_user <> 'service_role' then raise exception 'NBA_MATERIALIZER_SERVICE_ROLE_REQUIRED'; end if;
 if p_game_id is null or p_game_id<=0 or p_as_of is null or p_as_of>v_now or v_now-p_as_of>interval '2 minutes'
  or p_source_captured_at is null or p_source_captured_at>p_as_of
  or p_payload_text is null or p_response_sha256 is null or p_response_sha256 !~ '^[a-f0-9]{64}$'
  or p_compressed_bytes is null or p_compressed_bytes<1 or p_compressed_bytes>32768
  then raise exception 'NBA_MATERIALIZER_REQUEST_INVALID'; end if;
 v_json_bytes:=octet_length(convert_to(p_payload_text,'UTF8'));
 if v_json_bytes<1 or v_json_bytes>512000 then raise exception 'NBA_MATERIALIZER_SIZE_BOUND'; end if;
 v_hash:=encode(sha256(convert_to(p_payload_text,'UTF8')),'hex');
 if v_hash is distinct from p_response_sha256 then raise exception 'NBA_MATERIALIZER_HASH_MISMATCH'; end if;
 v_payload:=p_payload_text::jsonb;
 v_job_hash:=encode(sha256(convert_to(v_version||':'||floor(extract(epoch from p_as_of)/1800)::bigint::text,'UTF8')),'hex');
 v_expected_job:=(substr(v_job_hash,1,8)||'-'||substr(v_job_hash,9,4)||'-4'||substr(v_job_hash,14,3)||'-a'||substr(v_job_hash,18,3)||'-'||substr(v_job_hash,21,12))::uuid;
 if p_job_id is distinct from v_expected_job then raise exception 'NBA_MATERIALIZER_JOB_ID_INVALID'; end if;
 select * into strict v_job from public.sports_sync_jobs where id=p_job_id for update;
 if v_job.job_type is distinct from 'nba_archived_player_materialization_v1' or v_job.status is distinct from 'running'
  or v_job.sport_key<>'basketball_nba' or v_job.provider<>'balldontlie'
  or (v_job.metadata->>'slot')::bigint is distinct from floor(extract(epoch from p_as_of)/1800)::bigint
  then raise exception 'NBA_MATERIALIZER_JOB_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_version||':'||p_game_id::text,0));
 select count(*) into v_count from public.nba_game_context_v2 where provider_game_id=p_game_id;
 if v_count<>1 then raise exception 'NBA_MATERIALIZER_CONTEXT_NOT_UNIQUE'; end if;
 select * into strict v_context from public.nba_game_context_v2 where game_id='bdl_nba_'||p_game_id::text for share;
 if v_context.provider is distinct from 'balldontlie' or v_context.provider_game_id is distinct from p_game_id
  or coalesce(length(btrim(v_context.source_version)),0)=0 or v_context.player_stats_captured_at is distinct from p_source_captured_at
  or v_context.player_stats is null or v_context.player_stats is distinct from (v_payload-'archive_provenance')
  or v_payload#>>'{archive_provenance,version}' is distinct from v_version
  or v_payload#>>'{archive_provenance,source_kind}' is distinct from 'STORED_OPERATIONAL_JSON'
  or v_payload#>>'{archive_provenance,source_table}' is distinct from 'public.nba_game_context_v2'
  or v_payload#>>'{archive_provenance,source_game_id}' is distinct from v_context.game_id
  or v_payload#>>'{archive_provenance,source_version}' is distinct from v_context.source_version
  or (v_payload#>>'{archive_provenance,provider_game_id}')::bigint is distinct from p_game_id
  or (v_payload#>>'{archive_provenance,source_captured_at}')::timestamptz is distinct from p_source_captured_at
  or v_payload#>>'{meta,next_cursor}' is not null or v_payload#>>'{meta,complete}'='false'
  then raise exception 'NBA_MATERIALIZER_SOURCE_CHANGED_OR_UNVERIFIED'; end if;
 if jsonb_typeof(v_payload->'data') is distinct from 'array' then raise exception 'NBA_MATERIALIZER_DATA_INVALID'; end if;
 v_count:=jsonb_array_length(v_payload->'data');
 if v_count<10 or v_count>100 then raise exception 'NBA_MATERIALIZER_ROW_BOUND'; end if;
 select * into strict v_schedule from public.nba_market_schedules_v1 where snapshot_id=p_schedule_snapshot_id;
 if v_schedule.source_received_at is null or v_schedule.recorded_at is null or v_schedule.source_received_at>p_as_of or v_schedule.recorded_at>p_as_of then raise exception 'NBA_MATERIALIZER_FUTURE_FINAL'; end if;
 select count(*) into v_existing from jsonb_array_elements(v_schedule.payload#>'{data,games}') g where (g->>'id')::bigint=p_game_id;
 if v_existing<>1 then raise exception 'NBA_MATERIALIZER_FINAL_NOT_UNIQUE'; end if;
 select g into v_game from jsonb_array_elements(v_schedule.payload#>'{data,games}') g where (g->>'id')::bigint=p_game_id;
 v_home:=(v_game#>>'{home_team,id}')::bigint; v_away:=(v_game#>>'{visitor_team,id}')::bigint;
 v_season:=(v_game->>'season')::integer; v_tip:=(v_game->>'datetime')::timestamptz; v_period:=(v_game->>'period')::integer;
 if v_game->>'status_state' is distinct from 'final' or coalesce((v_game->>'postponed')::boolean,false)
  or v_home is null or v_away is null or v_home<=0 or v_away<=0 or v_home=v_away
  or v_tip is null or v_tip>=p_source_captured_at or v_tip>=v_schedule.source_received_at or v_tip>=p_as_of
  or p_as_of-v_tip>interval '61 days' or v_season is null or v_season<1946 or v_season>2100
  or v_period is null or v_period<4 or v_period>7 or v_game->>'date' is null or v_game->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
  then raise exception 'NBA_MATERIALIZER_FINAL_INVALID'; end if;
 if (v_game->>'home_team_id' is not null and (v_game->>'home_team_id')::bigint<>v_home)
  or (v_game->>'visitor_team_id' is not null and (v_game->>'visitor_team_id')::bigint<>v_away)
  then raise exception 'NBA_MATERIALIZER_FINAL_IDENTITY_CONFLICT'; end if;
 for v_i in 1..4 loop
  v_x:=(v_game->>('home_q'||v_i))::integer; v_y:=(v_game->>('visitor_q'||v_i))::integer;
  if v_x is null or v_y is null or v_x<0 or v_y<0 then raise exception 'NBA_MATERIALIZER_PERIOD_MISSING'; end if;
  v_h:=v_h+v_x; v_a:=v_a+v_y;
 end loop;
 for v_i in 1..3 loop
  v_x:=(v_game->>('home_ot'||v_i))::integer; v_y:=(v_game->>('visitor_ot'||v_i))::integer;
  if v_i<=v_period-4 then
   if v_h<>v_a or v_x is null or v_y is null or v_x<0 or v_y<0 then raise exception 'NBA_MATERIALIZER_OVERTIME_INVALID'; end if;
   v_h:=v_h+v_x; v_a:=v_a+v_y;
  elsif coalesce(v_x,0)<>0 or coalesce(v_y,0)<>0 then raise exception 'NBA_MATERIALIZER_UNPLAYED_OVERTIME'; end if;
 end loop;
 if v_h=v_a or v_h is distinct from (v_game->>'home_team_score')::integer or v_a is distinct from (v_game->>'visitor_team_score')::integer
  then raise exception 'NBA_MATERIALIZER_SCORE_UNRECONCILED'; end if;
 v_duration:=48+5*(v_period-4);
 for v_player in select value from jsonb_array_elements(v_payload->'data') loop
  v_player_id:=(v_player#>>'{player,id}')::bigint; v_team:=(v_player#>>'{team,id}')::bigint;
  if v_player_id is null or v_player_id<=0 or v_player_id=any(v_seen) or v_team is null or v_team not in(v_home,v_away)
   or jsonb_typeof(v_player#>'{player,id}') is distinct from 'number' or jsonb_typeof(v_player#>'{team,id}') is distinct from 'number'
   or (v_player#>>'{player,team_id}')::bigint is distinct from v_team
   or (v_player#>>'{game,id}')::bigint is distinct from p_game_id
   or v_player#>>'{game,status_state}' is distinct from 'final'
   or v_player#>>'{game,date}' is distinct from v_game->>'date'
   or (v_player#>>'{game,datetime}')::timestamptz is distinct from v_tip
   or (v_player#>>'{game,season}')::integer is distinct from v_season
   or (v_player#>>'{game,period}')::integer is distinct from v_period
   or coalesce(v_player#>>'{game,home_team_id}',v_player#>>'{game,home_team,id}')::bigint is distinct from v_home
   or coalesce(v_player#>>'{game,visitor_team_id}',v_player#>>'{game,visitor_team,id}')::bigint is distinct from v_away
   or (v_player#>>'{game,home_team,id}' is not null and (v_player#>>'{game,home_team,id}')::bigint<>v_home)
   or (v_player#>>'{game,visitor_team,id}' is not null and (v_player#>>'{game,visitor_team,id}')::bigint<>v_away)
   or (v_player#>>'{game,home_team_score}')::integer is distinct from v_h
   or (v_player#>>'{game,visitor_team_score}')::integer is distinct from v_a
   then raise exception 'NBA_MATERIALIZER_PLAYER_IDENTITY_INVALID'; end if;
  v_seen:=array_append(v_seen,v_player_id);
  if v_player->>'min'='0' then v_seconds:=0;
  elsif v_player->>'min' ~ '^\d{1,3}:[0-5]\d$' then
   v_seconds:=split_part(v_player->>'min',':',1)::integer*60+split_part(v_player->>'min',':',2)::integer;
  else raise exception 'NBA_MATERIALIZER_MINUTES_INVALID'; end if;
  if v_seconds<0 or v_seconds>v_duration*60 then raise exception 'NBA_MATERIALIZER_MINUTES_INVALID'; end if;
  foreach v_stat in array array['pts','reb','ast','fg3m','stl','blk','turnover'] loop
   if not(v_player ? v_stat) then raise exception 'NBA_MATERIALIZER_STAT_MISSING'; end if;
   v_value:=(v_player->>v_stat)::integer;
   if (v_value is null and v_seconds<>0) or (v_value is not null and
     (jsonb_typeof(v_player->v_stat)<>'number' or v_value<0 or v_value>case when v_stat='pts' then 200 else 100 end
      or (v_player->>v_stat)::numeric<>v_value or v_seconds=0 and v_value<>0))
    then raise exception 'NBA_MATERIALIZER_STAT_INVALID'; end if;
  end loop;
  if v_team=v_home then v_home_n:=v_home_n+1;v_home_pts:=v_home_pts+coalesce((v_player->>'pts')::integer,0);v_home_secs:=v_home_secs+v_seconds;
  else v_away_n:=v_away_n+1;v_away_pts:=v_away_pts+coalesce((v_player->>'pts')::integer,0);v_away_secs:=v_away_secs+v_seconds;end if;
  v_rows:=v_rows||jsonb_build_array(jsonb_build_object('season',v_season,'provider_game_id',p_game_id,'player_id',v_player_id,
   'team_id',v_team,'opponent_team_id',case when v_team=v_home then v_away else v_home end,'game_datetime',v_tip,
   'source_captured_at',p_source_captured_at,'source_sha256',v_hash,'minutes_played',v_seconds::numeric/60,
   'pts',(v_player->>'pts')::smallint,'reb',(v_player->>'reb')::smallint,'ast',(v_player->>'ast')::smallint,
   'fg3m',(v_player->>'fg3m')::smallint,'stl',(v_player->>'stl')::smallint,'blk',(v_player->>'blk')::smallint,
   'turnover',(v_player->>'turnover')::smallint,'projection_eligible',false,'materialized_at',v_now));
 end loop;
 if v_home_n<5 or v_away_n<5 or v_home_pts<>v_h or v_away_pts<>v_a
  or abs(v_home_secs-v_duration*5*60)>60 or abs(v_away_secs-v_duration*5*60)>60
  then raise exception 'NBA_MATERIALIZER_TEAM_TOTALS_UNRECONCILED'; end if;
 v_path:=v_season::text||'/'||p_game_id::text||'/player_stats/'||v_hash||'.json.gz';
 if not exists(select 1 from storage.objects where bucket_id='nba-goat-2026-private' and name=v_path and (metadata->>'size')::bigint=p_compressed_bytes)
  then raise exception 'NBA_MATERIALIZER_IMMUTABLE_OBJECT_MISSING'; end if;
 select * into v_manifest from public.nba_goat_season_archive_v1 where season=v_season and provider_game_id=p_game_id and dataset_key='player_stats';
 select count(*) into v_existing from public.nba_goat_player_game_research_v1 where season=v_season and provider_game_id=p_game_id;
 if v_manifest.provider_game_id is not null then
  if v_manifest.response_sha256 is distinct from v_hash or v_manifest.source_captured_at is distinct from p_source_captured_at
   or v_manifest.data_count<>v_count or v_existing<>v_count or v_manifest.storage_object_path<>v_path
   or v_manifest.json_bytes<>v_json_bytes or v_manifest.compressed_bytes<>p_compressed_bytes
   then raise exception 'NBA_MATERIALIZER_EXISTING_ARCHIVE_CONFLICT'; end if;
  for v_row in select value from jsonb_array_elements(v_rows) loop
   if not exists(select 1 from public.nba_goat_player_game_research_v1 r where r.season=v_season and r.provider_game_id=p_game_id
     and r.player_id=(v_row->>'player_id')::bigint and to_jsonb(r)-'materialized_at'=v_row-'materialized_at')
    then raise exception 'NBA_MATERIALIZER_EXISTING_COMPACT_CONFLICT'; end if;
  end loop;
  return jsonb_build_object('status','ALREADY_MATERIALIZED','game_id',p_game_id,'inserted_rows',0,'provider_calls',0);
 end if;
 if v_existing<>0 then raise exception 'NBA_MATERIALIZER_EXISTING_PARTIAL_REQUIRES_REVIEW'; end if;
 if jsonb_array_length(coalesce(v_job.metadata->'materialized_games','[]'::jsonb))>=3 then raise exception 'NBA_MATERIALIZER_CYCLE_CAP'; end if;
 insert into public.nba_goat_season_archive_v1(season,provider_game_id,dataset_key,provider,source_captured_at,game_date,response_sha256,data_count,storage_bucket,storage_object_path,compressed_bytes,json_bytes)
 values(v_season,p_game_id,'player_stats','balldontlie',p_source_captured_at,(v_game->>'date')::date,v_hash,v_count,'nba-goat-2026-private',v_path,p_compressed_bytes,v_json_bytes);
 insert into public.nba_goat_player_game_research_v1 select * from jsonb_populate_recordset(null::public.nba_goat_player_game_research_v1,v_rows);
 get diagnostics v_inserted=row_count;
 if v_inserted<>v_count then raise exception 'NBA_MATERIALIZER_INSERT_COUNT_MISMATCH'; end if;
 update public.sports_sync_jobs set records_inserted=coalesce(records_inserted,0)+v_inserted,
  metadata=metadata||jsonb_build_object('materialized_games',coalesce(metadata->'materialized_games','[]'::jsonb)||jsonb_build_array(
   jsonb_build_object('provider_game_id',p_game_id,'rows',v_inserted,'source_sha256',v_hash,'materialized_at',v_now,'source_captured_at',p_source_captured_at))) where id=p_job_id;
 return jsonb_build_object('status','MATERIALIZED','game_id',p_game_id,'inserted_rows',v_inserted,'source_sha256',v_hash,'materialized_at',v_now,'provider_calls',0);
end;
$$;
revoke all on function public.materialize_nba_archived_player_game_v1(uuid,bigint,timestamptz,text,text,text,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.materialize_nba_archived_player_game_v1(uuid,bigint,timestamptz,text,text,text,bigint,timestamptz) to service_role;
grant select,insert on public.nba_goat_season_archive_v1,public.nba_goat_player_game_research_v1 to service_role;
comment on function public.materialize_nba_archived_player_game_v1(uuid,bigint,timestamptz,text,text,text,bigint,timestamptz) is
'Private append-only derivation from archived operational NBA boxes, independently reconciled with an archived final schedule. Server hash and current knowledge time; no predictions, providers, or retroactive forecasts.';
