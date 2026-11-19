import 'server-only';
// NHL V6: one late goalie-aware evidence record per future NHL event.
// Does not perform any network request, re-score historical freezes or update models.
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {extractNhlFrozenFinalScores} from '@/lib/nhl-challenger-poisson-core.mjs';
import {buildNhlV6LateCandidate,NHL_LATE_V6} from '@/lib/nhl-late-v6-core.mjs';

const PAGE=500,MAX_RUNS=2000,MAX_QUOTES=3500,MAX_WRITES=16;
const readPages=async(table:string,select:string,field:string,from:string,until:string,limit:number)=>{
 const rows:any[]=[];
 for(let offset=0;offset<limit;offset+=PAGE){
  const r=await db.from(table).select(select).gte(field,from).lte(field,until)
   .order(field,{ascending:true}).range(offset,offset+PAGE-1);
  if(r.error)throw Error('NHL_V6_ARCHIVE_READ_FAILED');
  rows.push(...(r.data??[]));
  if((r.data??[]).length<PAGE)return rows;
 }
 throw Error('NHL_V6_SOURCE_SCAN_CAP');
};
export async function runNhlLateV6ShadowFreeze(){
 if(process.env.NHL_LATE_V6_SHADOW_ENABLED!=='true')
  return {status:'DISABLED',providerCalls:0,written:0,officialPicksChanged:false};
 const t=new Date(),now=t.toISOString(),hour=t.getUTCHours(),minute=t.getUTCMinutes();
 // The 22:07 UTC ESPN V5 one-free-call capture has already run at this point.
 if(hour!==22||minute>20)return {status:'OUTSIDE_VERIFIED_GOALIE_WINDOW',providerCalls:0,written:0};
 const prior=await db.from('nhl_late_shadow_v6').select('id,event_id')
  .gte('scheduled_at',now).limit(50);
 if(prior.error?.code==='42P01'||prior.error?.code==='PGRST205')
  return {status:'SCHEMA_PENDING',providerCalls:0,written:0};
 if(prior.error)return {status:'LEDGER_NOT_AVAILABLE',providerCalls:0,written:0};
 const known=new Set((prior.data??[]).map(x=>String(x.event_id)));
 const from=new Date(t.getTime()-16*86400000).toISOString();
 let runs:any[],quoteRows:any[];
 try{
  runs=await readPages('nhl_free_runs_v1','completed_at,games:detail->games','completed_at',from,now,MAX_RUNS);
  quoteRows=await readPages('nhl_free_quote_observations_v1',
   'id,event_id,scheduled_at,captured_at,body','captured_at',from,now,MAX_QUOTES);
 }catch{return {status:'SOURCE_SCAN_UNAVAILABLE_OR_CAPPED',providerCalls:0,written:0};}
 const latest=runs.at(-1),completed=Date.parse(latest?.completed_at??'');
 if(!Number.isFinite(completed)||t.getTime()-completed>45*60000)
  return {status:'NO_FRESH_NHL_SCHEDULE',providerCalls:0,written:0};
 const extracted=extractNhlFrozenFinalScores(runs,now);
 if(extracted.conflicts)return {status:'CONFLICTED_NHL_FINAL_ARCHIVE',providerCalls:0,written:0};
 const [g,p,d,pp]=await Promise.all([
  db.from('nhl_espn_goalie_probables_v1')
   .select('id,captured_at,source_version,raw_sha256,games')
   .lte('captured_at',now).order('captured_at',{ascending:false}).limit(2),
  db.from('nhl_free_predictions_v1')
   .select('event_id,created_at,body').limit(250),
  db.from('nhl_free_outcomes_v1')
   .select('event_id,observed_at,body').limit(250),
  db.from('nhl_special_teams_asof_v1')
   .select('id,captured_at,source_version,source_hash,season_id,teams')
   .lte('captured_at',now).order('captured_at',{ascending:false}).limit(2)
 ]);
 if(g.error||p.error||d.error||(p.data??[]).length===250||(d.data??[]).length===250)
  return {status:'EVIDENCE_NOT_VERIFIABLE',providerCalls:0,written:0};
 const goals=g.data??[],reasons:Record<string,number>={},records:any[]=[];
 for(const game of Array.isArray(latest?.games)?latest.games:[]){
  if(known.has(game.eventId))continue;
  const v=buildNhlV6LateCandidate({game,decisionAt:now,sourceCompletedAt:latest.completed_at,
   finalScores:extracted.games,probableSnapshots:goals,
   ppPkSnapshots:pp.error?[]:pp.data??[],
   dratingsRows:p.data??[],quoteRows,outcomeRows:d.data??[]});
  if(!('record' in v)){const why='reason' in v&&typeof v.reason==='string'?v.reason:'NO_EVIDENCE';
   reasons[why]=(reasons[why]??0)+1;continue;}
  records.push(v.record);
  if(records.length>=MAX_WRITES)break;
 }
 if(!records.length)return {status:'NO_VERIFIED_LATE_MATCHUPS',providerCalls:0,written:0,reasons};
 const w=await db.from('nhl_late_shadow_v6').upsert(records,{onConflict:'id',ignoreDuplicates:true}).select('id');
 if(w.error)return {status:'LATE_SHADOW_INSERT_NOT_VERIFIED',providerCalls:0,written:0};
 return {status:'FROZEN_V6_RESEARCH_ONLY',version:NHL_LATE_V6,
  providerCalls:0,written:w.data?.length??0,candidates:records.length,reasons,
  probableOnly:true,confirmedStarters:0,scoreModelsChanged:false,
  officialPicksChanged:false,calibrationProspectiveOnly:true,
  noBookmakerRulesCertified:true};
}
