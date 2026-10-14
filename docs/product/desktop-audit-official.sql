-- Read-only: run against the canonical Pick Analyzer project.
with picks as (
 select *,row_number() over(partition by game_pk,side order by decision_at,official_pick_identity) as rn
 from public.pick2_mlb_official_picks where decision_status='OFFICIAL_PICK'
), raw as (
 select x from public.pick2_prediction_results r
 cross join lateral jsonb_array_elements(r.actual_result->'settlements') x
 where evaluator_version='PICK2_MLB_OFFICIAL_SETTLEMENT_V1'
), settlements as (
 select x->>'official_pick_identity' as identity,min(x->>'outcome') as outcome,
 count(distinct x->>'outcome') as outcome_versions,count(distinct x->>'units') as unit_versions,
 min((x->>'units')::numeric) as units,count(*) as copies from raw
 group by x->>'official_pick_identity'
), grouped as (
 select p.game_pk,p.side,count(*) as snapshots,count(s.identity) as settled_snapshots,
 count(distinct s.outcome) as outcomes,min(s.outcome) as outcome,
 min(s.units) filter(where p.rn=1) as first_units,max(s.outcome_versions) as versions
 from picks p left join settlements s on s.identity=p.official_pick_identity
 group by p.game_pk,p.side
)
select now() as audited_at,(select count(*) from picks) as stored_pick_rows,count(*) as unique_selections,
 count(*) filter(where snapshots=settled_snapshots and outcomes=1 and outcome='win') as wins,
 count(*) filter(where snapshots=settled_snapshots and outcomes=1 and outcome='loss') as losses,
 count(*) filter(where snapshots<>settled_snapshots or outcomes<>1) as pending_or_conflicting,
 sum(first_units) filter(where snapshots=settled_snapshots and outcomes=1) as original_selection_units,
 (select count(*) from settlements where outcome_versions>1 or unit_versions>1) as conflicting_settlement_identities,
 (select count(*) from settlements where copies>1) as repeated_settlement_identities,
 (select count(*) from picks where rn>1) as repeat_pick_snapshots from grouped;
