create or replace function public.sync_mlb_pitcher_win_forward_starter_history_v1(p_target_date date)
returns table(upserted_rows integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer := 0;
begin
  with ranked as (
    select
      p.game_year::smallint as season,
      p.game_pk,
      p.game_date::date as game_date,
      case when p.inning_topbot='Top' then 'home' else 'away' end as starter_side,
      coalesce(p.mlbam_pitcher_id,p.source_pitcher_id)::bigint as starter_mlbam_id,
      row_number() over(
        partition by p.game_year,p.game_pk,
          case when p.inning_topbot='Top' then 'home' else 'away' end
        order by p.inning,p.at_bat_number,p.pitch_number
      ) rn
    from public.pick2_raw_mlb_statcast_pitches p
    where p.game_year=2026
      and p.game_type='R'
      and p.game_date=p_target_date
      and coalesce(p.mlbam_pitcher_id,p.source_pitcher_id) is not null
  ),
  starters as (
    select season,game_pk,game_date,starter_side,starter_mlbam_id
    from ranked
    where rn=1
  ),
  upserted as (
    insert into public.mlb_pitcher_win_forward_starter_history_v1
      (season,game_pk,game_date,starter_side,starter_mlbam_id,y_win,starter_source,outcome_source,updated_at)
    select season,game_pk,game_date,starter_side,starter_mlbam_id,null,
           'RAW_STATCAST_ACTUAL_STARTER_V1',null,now()
    from starters
    on conflict (season,game_pk,starter_side) do update
      set starter_mlbam_id=excluded.starter_mlbam_id,
          starter_source=excluded.starter_source,
          updated_at=now()
    returning 1
  )
  select count(*) into v_count from upserted;

  return query select v_count;
end;
$$;

grant execute on function public.sync_mlb_pitcher_win_forward_starter_history_v1(date) to service_role;

comment on function public.sync_mlb_pitcher_win_forward_starter_history_v1(date) is
'Research-only daily sync of actual MLB starters from final raw Statcast. Outcome remains null until MLB Official winner decision is applied postgame.';
