begin;
with candidates as (
 select f.id freeze_id,f.completed_at freeze_completed_at,f.metadata->>'targetDate' target_date,
 f.metadata->>'candidateId' candidate_id, o.obs,
 g.home_score,g.away_score,g.home_team,g.away_team,g.game_pk
 from public.sports_sync_jobs f
 cross join lateral jsonb_array_elements(f.metadata->'observations') o(obs)
 join public.mlb_ml_xyear_game_v1 g on g.game_pk=(o.obs->>'gamePk')::bigint and g.game_date=(f.metadata->>'targetDate')::date and g.season=2026
 join public.pick2_mlb_games c on c.game_pk=g.game_pk and c.season=2026
 where f.id in ('58e857d5-20c5-424d-8443-db4264f3b3b0','d890f333-65a9-4bb3-91c1-40c6f1251cc7')
 and f.job_type='runline_v2_home_p15_alt_forward_freeze_v1' and f.status in ('completed','partial')
 and f.metadata->>'candidateId'='rl_v2_home_p15_alt_favorite_tsh_q92_v1'
 and o.obs->>'selected'='true'
 and g.home_score is not null and g.away_score is not null and g.actual_winner is not null
 and o.obs->>'homeTeam'=g.home_team and o.obs->>'awayTeam'=g.away_team
 and coalesce((f.metadata->>'frozenAt')::timestamptz,f.completed_at,f.started_at)<c.scheduled_at
), grouped as (
 select freeze_id,freeze_completed_at,target_date,candidate_id,count(*)::integer n,
 count(*) filter(where home_score+1.5>away_score)::integer correct,
 jsonb_agg(jsonb_build_object('gamePk',game_pk,'eventId',obs->'eventId','homeTeam',home_team,'awayTeam',away_team,
 'frozenScore',obs->'score','threshold',obs->'threshold','homeScore',home_score,'awayScore',away_score,
 'homeMargin',home_score-away_score,'homeP15Cover',home_score+1.5>away_score,
 'result',case when home_score+1.5>away_score then 'WIN' else 'LOSS' end,
 'alternateHomeP15Quotes',obs->'alternateHomeP15Quotes') order by game_pk) results
 from candidates group by 1,2,3,4
)
insert into public.sports_sync_jobs(id,job_type,sport_key,league_key,provider,season,started_at,completed_at,status,
 records_fetched,records_inserted,records_updated,records_skipped,error_count,metadata,updated_at)
select gen_random_uuid(),'runline_v2_home_p15_alt_forward_settlement_v1','baseball_mlb','mlb','internal-model','2026',now(),now(),'completed',
 n,n,0,0,0,jsonb_build_object('candidateId',candidate_id,'targetDate',target_date,'freezeJobId',freeze_id,
 'freezeCompletedAt',freeze_completed_at,'selectedGames',n,'correct',correct,'accuracy',correct::numeric/n,
 'outcomesRead',true,'outcomeSource','mlb_ml_xyear_game_v1_after_daily_history_sync','roiCertified',false,
 'pricingPolicyCertified',false,'researchOnly',true,'productionEligible',false,'officialPicksModified',false,
 'apostarActivated',false,'results',results,'recoveryReason','SOURCE_SETTLEMENT_JOB_MISSING_LEDGER_SYNC_REGRESSION'),now()
from grouped g where not exists (
 select 1 from public.sports_sync_jobs s where s.job_type='runline_v2_home_p15_alt_forward_settlement_v1'
 and s.status='completed' and s.metadata->>'targetDate'=g.target_date and s.metadata->>'candidateId'=g.candidate_id
);
with settlements as (
 select s.id,s.completed_at,s.metadata->>'targetDate' target_date,s.metadata->>'freezeJobId' freeze_id,r.item
 from public.sports_sync_jobs s cross join lateral jsonb_array_elements(s.metadata->'results') r(item)
 where s.job_type='runline_v2_home_p15_alt_forward_settlement_v1' and s.status='completed'
 and s.metadata->>'freezeJobId' in ('58e857d5-20c5-424d-8443-db4264f3b3b0','d890f333-65a9-4bb3-91c1-40c6f1251cc7')
)
update public.mlb_2026_forward_master_ledger_v1 l set result=s.item->>'result',
 actual_value=(s.item->>'homeMargin')::numeric,
 actual_label=case when s.item->>'homeP15Cover'='true' then 'HOME_PLUS_1P5_COVER' else 'HOME_PLUS_1P5_NO_COVER' end,
 settled_at=s.completed_at,metadata=l.metadata||jsonb_build_object('settlementJobId',s.id),updated_at=now()
from settlements s where l.source_relation='sports_sync_jobs' and l.metadata->>'sourceFreezeJobId'=s.freeze_id
 and l.target_date=s.target_date::date and l.game_pk=(s.item->>'gamePk')::bigint
 and l.model_id='rl_v2_home_p15_alt_favorite_tsh_q92_v1' and l.research_only
 and not l.production_eligible and not l.official_picks_eligible and not l.apostar_enabled;
commit;
