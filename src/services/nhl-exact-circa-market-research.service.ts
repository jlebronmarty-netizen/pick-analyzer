import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {gradeNhlExactCircaCohort,NHL_CIRCA_EXACT_LINE_RESEARCH}
 from '@/lib/nhl-exact-circa-market-research.mjs';

const PAGE=250,MAX_RUNS=2000,MAX_MARKET_QUOTES=8000;
export async function getNhlExactCircaMarketResearch(){
 const now=new Date(),asOf=now.toISOString(),from=new Date(now.getTime()-21*86400000).toISOString();
 const [early,late,results]=await Promise.all([
  db.from('nhl_challenger_shadow_v1').select('id,event_id,model_version,scheduled_at,frozen_at,source_completed_at,home_team_id,away_team_id,home_team,away_team,projection,official_pick,production_eligible')
   .gte('scheduled_at',from).order('frozen_at',{ascending:false}).limit(250),
  db.from('nhl_late_shadow_v6').select('id,event_id,model_version,scheduled_at,frozen_at,source_completed_at,home_team_id,away_team_id,market_proxies,projection,official_pick,production_eligible')
   .gte('scheduled_at',from).order('frozen_at',{ascending:false}).limit(250),
  db.from('nhl_free_outcomes_v1').select('event_id,body,observed_at').limit(500)
 ]);
 if(early.error||results.error)return {status:'RESEARCH_SOURCE_UNAVAILABLE',readOnly:true,providerCalls:0,databaseWrites:0};
 if(late.error&& !['42P01','PGRST205'].includes(late.error.code))
  return {status:'LATE_SHADOW_SOURCE_UNAVAILABLE',readOnly:true,providerCalls:0,databaseWrites:0};
 if((early.data??[]).length>=250||(late.data??[]).length>=250||(results.data??[]).length>=500)
  return {status:'SOURCE_SCAN_CAP_REACHED',readOnly:true,providerCalls:0,databaseWrites:0};
 const runs:any[]=[];
 for(let offset=0;offset<MAX_RUNS;offset+=PAGE){
  const r=await db.from('nhl_free_runs_v1').select('started_at,marketQuotes:detail->marketQuoteObservations')
   .in('status',['PASS','PARTIAL']).gte('started_at',from).lte('started_at',asOf)
   .order('started_at',{ascending:true}).range(offset,offset+PAGE-1);
  if(r.error)return {status:'QUOTE_ARCHIVE_NOT_AVAILABLE',readOnly:true,providerCalls:0,databaseWrites:0};
  const values=r.data??[];
  runs.push(...values);
  if(values.length<PAGE)break;
  if(offset+PAGE>=MAX_RUNS)return {status:'RUN_ARCHIVE_CAPPED',readOnly:true,providerCalls:0,databaseWrites:0};
 }
 const observations=runs.flatMap(r=>Array.isArray(r.marketQuotes)?r.marketQuotes:[]);
 if(observations.length>=MAX_MARKET_QUOTES)
  return {status:'MARKET_QUOTE_SCAN_CAPPED',readOnly:true,providerCalls:0,databaseWrites:0};
 const earlyRows=(early.data??[]);
 // V6 stores home and away team names frozen as JSON market proxy evidence.
 // Never derive these names from a later game or from a current team roster.
 const lateRows=(late.data??[]).map(x=>({
  ...x,home_team:x.market_proxies?.frozenTeams?.home??null,
  away_team:x.market_proxies?.frozenTeams?.away??null
 }));
 const baseline=gradeNhlExactCircaCohort({frozenRows:earlyRows,observations,
  finalRows:results.data??[]});
 const prospective=gradeNhlExactCircaCohort({frozenRows:lateRows,observations,
  finalRows:results.data??[]});
 return {status:'READ_ONLY_EXACT_MARKET_RESEARCH',version:NHL_CIRCA_EXACT_LINE_RESEARCH,
  asOf,readOnly:true,providerCalls:0,databaseWrites:0,
  archive:{nhlRunsScanned:runs.length,spreadAndTotalReceipts:observations.length,
   earlyFrozen:earlyRows.length,lateFrozen:lateRows.length},
  earlyPoissonV1Retrospective:baseline,
  lateV6Prospective:prospective,
  gates:{fullGameOTSOContractCertified:false,CircaQuotePublishedAtVerified:false,
   FanDuelMarketsVerified:false,roiValidated:false,modelPromotionApproved:false},
  warning:'Historical exact-line research. No automated wagers or official selections. Do not compare subsets with different denominators or mistake retrospective research for independent validation.'};
}
