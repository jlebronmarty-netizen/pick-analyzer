-- Preview only. One row per explicitly reviewed supplemental observation.
-- Positive minutes and seven counting components compared with the official final.
with original as (
  select (p#>>'{player,id}')::bigint id,(p#>>'{team,id}')::int team,
    p->>'min' minutes,(p->>'pts')::int pts,(p->>'ast')::int ast,(p->>'reb')::int reb,
    (p->>'fg3m')::int fg3m,(p->>'stl')::int stl,(p->>'blk')::int blk,(p->>'turnover')::int tov
  from public.nba_game_context_v2 c cross join lateral jsonb_array_elements(c.player_stats->'data') p
  where c.provider_game_id=21718140
), supplement(id,team,athlete,minutes,pts,ast,reb,fg3m,stl,blk,tov) as (values
  (57875092::bigint,10,'Gui Santos','17:08',6,6,6,0,1,0,1),
  (1057395872,10,'Will Richard','27:19',20,3,0,1,4,0,2),
  (1091351802,10,'Yaxel Lendeborg','30:27',13,4,5,0,2,0,0),
  (666747,7,'Caleb Martin','19:50',8,3,5,2,2,0,1),
  (1057262088,7,'Cooper Flagg','33:59',33,9,5,3,4,0,5),
  (228,7,'Kyrie Irving','29:08',17,5,6,1,2,0,1),
  (1028028244,7,'Zaccharie Risacher','17:46',3,0,3,1,0,2,2)
), proposed as (
  select o.team,o.pts from original o where not exists(select 1 from supplement s where o.id=s.id)
  union all select team,pts from supplement
)
select s.athlete,s.id,s.team,case when o.id is null then 'ABSENT' else 'COMPARE' end as original_status,
  to_jsonb(o)-'id'-'team' as archived,to_jsonb(s)-'athlete'-'id'-'team' as official_preview,
  (select sum(pts) from original where team=s.team) original_team_points,
  (select sum(pts) from proposed where team=s.team) preview_team_points
from supplement s left join original o using(id) order by s.team,s.id;
