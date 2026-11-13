import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

const BASE='https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary';
const CTX_VERSION='NCAAF_CAUSAL_CONTEXT_V2',MATCHUP_VERSION='NCAAF_CAUSAL_MATCHUPS_V3';
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const providerId=(eventId:unknown)=>{const m=/^espn:(\d+)$/.exec(String(eventId??''));return m?m[1]:null;};
async function fetchSummary(id:string){
 const u=new URL(BASE);u.searchParams.set('event',id);
 const r=await fetch(u,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NCAAF_CAUSAL_PROVIDER_FAILED');
 return r.json();
}
function teams(payload:any){
 const rows=payload?.header?.competitions?.[0]?.competitors??[];
 const home=rows.find((x:any)=>x?.homeAway==='home'),away=rows.find((x:any)=>x?.homeAway==='away');
 return {homeId:String(home?.id??home?.team?.id??''),awayId:String(away?.id??away?.team?.id??''),homeName:String(home?.team?.displayName??''),awayName:String(away?.team?.displayName??'')};
}
function drives(payload:any){
 const raw=[...(payload?.drives?.previous??[]),...(payload?.drives?.current?[payload.drives.current]:[])].filter(Boolean);
 const rows=raw.map((d:any)=>({id:String(d?.id??''),teamId:String(d?.team?.id??d?.teamId??''),result:String(d?.result??d?.displayResult??''),yards:finite(d?.yards),plays:Number(d?.plays?.length??d?.plays??0),timeElapsed:String(d?.timeElapsed?.displayValue??d?.timeElapsed??''),startPeriod:Number(d?.start?.period??d?.startPeriod??0),endPeriod:Number(d?.end?.period??d?.endPeriod??0),isScore:Boolean(d?.isScore),description:String(d?.description??'')}));
 return rows;
}
function driveSummary(payload:any,selectionTeamId:string|null){
 const rows=drives(payload),selected=selectionTeamId?rows.filter(x=>x.teamId===selectionTeamId):rows;
 const turnover=(s:string)=>/interception|fumble|downs/i.test(s),score=(x:any)=>x.isScore||/touchdown|field goal/i.test(x.result);
 return {drives:rows.length,selectedDrives:selected.length,scoringDrives:selected.filter(score).length,turnoverDrives:selected.filter(x=>turnover(x.result)).length,threeAndOutLike:selected.filter(x=>x.plays>0&&x.plays<=3&&!score(x)&&!turnover(x.result)).length,totalYards:selected.reduce((s,x)=>s+(x.yards??0),0)};
}
function teamStats(payload:any,teamId:string){
 const block=(payload?.boxscore?.teams??[]).find((x:any)=>String(x?.team?.id??'')===teamId);
 const map=new Map((block?.statistics??[]).map((x:any)=>[String(x?.name??x?.label??'').toLowerCase(),finite(x?.value??x?.displayValue)]));
 const get=(...keys:string[])=>{for(const k of keys){const v=map.get(k.toLowerCase());if(v!==undefined&&v!==null)return v;}return null;};
 return {totalYards:get('totalYards'),turnovers:get('turnovers'),firstDowns:get('firstDowns'),thirdDownPct:get('thirdDownEff','thirdDownConversions'),rushingYards:get('rushingYards'),passingYards:get('netPassingYards','passingYards'),sacks:get('sacks'),penalties:get('totalPenaltiesYards','penalties'),possession:get('possessionTime')};
}
function parseCompAtt(v:unknown){const m=/^(\d+)\s*[-/]\s*(\d+)$/.exec(String(v??''));return m?{completions:Number(m[1]),attempts:Number(m[2])}:{completions:null,attempts:null};}
function playerRows(payload:any){
 const out:any[]=[];
 for(const teamBlock of payload?.boxscore?.players??[]){
  const teamId=String(teamBlock?.team?.id??''),teamName=String(teamBlock?.team?.displayName??'');
  for(const group of teamBlock?.statistics??[]){
   const category=String(group?.name??group?.type??group?.displayName??'').toLowerCase(),labels=(group?.labels??[]).map((x:any)=>String(x).toUpperCase());
   const get=(stats:any[],...names:string[])=>{for(const name of names){const i=labels.indexOf(name);if(i>=0)return stats[i];}return null;};
   for(const row of group?.athletes??[]){
    const stats=row?.stats??[],ca=parseCompAtt(get(stats,'C/ATT','COMP/ATT'));
    out.push({athleteId:String(row?.athlete?.id??''),athleteName:String(row?.athlete?.displayName??row?.athlete?.shortName??''),teamId,teamName,category,completions:ca.completions,attempts:ca.attempts??finite(get(stats,'ATT')),yards:finite(get(stats,'YDS')),touchdowns:finite(get(stats,'TD')),interceptions:finite(get(stats,'INT')),carries:/rush/i.test(category)?finite(get(stats,'CAR','ATT')):null,receptions:/receiv/i.test(category)?finite(get(stats,'REC')):null,targets:/receiv/i.test(category)?finite(get(stats,'TGTS','TGT')):null});
   }
  }
 }
 return out.filter(x=>x.athleteId&&x.teamId);
}
async function persistPlayerOpponent(eventId:string,id:string,payload:any,at:string){
 const t=teams(payload),date=/^\d{4}-\d{2}-\d{2}/.exec(String(payload?.header?.competitions?.[0]?.date??''))?.[0]??null;
 const rows=playerRows(payload).map(r=>{const opp=r.teamId===t.homeId?{id:t.awayId,name:t.awayName}:r.teamId===t.awayId?{id:t.homeId,name:t.homeName}:null;if(!opp)return null;return {event_id:eventId,provider_event_id:id,game_date:date,athlete_id:r.athleteId,athlete_name:r.athleteName,team_id:r.teamId,opponent_team_id:opp.id,opponent_team_name:opp.name,category:r.category,attempts:r.attempts,completions:r.completions,yards:r.yards,touchdowns:r.touchdowns,interceptions:r.interceptions,carries:r.carries,receptions:r.receptions,targets:r.targets,captured_at:at,source_version:MATCHUP_VERSION};}).filter(Boolean);
 if(!rows.length)return 0;
 const w=await db.from('ncaaf_player_opponent_v3').upsert(rows,{onConflict:'event_id,athlete_id,opponent_team_id,category'}).select('event_id');if(w.error)throw Error('NCAAF_MATCHUP_WRITE_FAILED');return w.data?.length??0;
}
export async function syncNcaafCausalContext({cap=1}:{cap?:number}={}){
 const [fR,oR,cR]=await Promise.all([
  db.from('edge_lab_multi_forecasts_v1').select('id,event_id,scheduled_at').eq('sport','NCAAF').order('scheduled_at',{ascending:true}).limit(5000),
  db.from('edge_lab_multi_outcomes_v1').select('forecast_id').limit(10000),
  db.from('ncaaf_game_context_v2').select('event_id').limit(5000),
 ]);
 if(fR.error||oR.error||cR.error)throw Error('NCAAF_CAUSAL_PLAN_READ_FAILED');
 const outcomeIds=new Set((oR.data??[]).map(x=>x.forecast_id)),existing=new Set((cR.data??[]).map(x=>x.event_id));
 const settledEvents=new Set<string>();
 for(const f of fR.data??[]){if(existing.has(f.event_id)||!providerId(f.event_id))continue;if(outcomeIds.has(f.id))settledEvents.add(f.event_id);}
 const targets=[...settledEvents].slice(0,Math.max(0,Math.min(cap,1)));
 let calls=0,written=0,matchups=0;const failures:string[]=[];
 for(const eventId of targets){try{const id=providerId(eventId)!;calls++;const payload=await fetchSummary(id),at=new Date().toISOString();const w=await db.from('ncaaf_game_context_v2').upsert({event_id:eventId,provider_event_id:id,summary_payload:payload,captured_at:at,provider:'espn',source_version:CTX_VERSION,updated_at:at},{onConflict:'event_id'}).select('event_id');if(w.error)throw Error('NCAAF_CONTEXT_WRITE_FAILED');written+=w.data?.length??0;matchups+=await persistPlayerOpponent(eventId,id,payload,at);}catch(e){failures.push(eventId+':'+(e instanceof Error?e.message:'NCAAF_CAUSAL_FAILED'));}}
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:targets.length,provider_calls:calls,written,matchups,failures};
}
export async function runNcaafCausalDiagnostics(){
 const [fR,oR,cR]=await Promise.all([
  db.from('edge_lab_multi_forecasts_v1').select('id,event_id,model_version,market,selection,projection,probability,payload').eq('sport','NCAAF').limit(5000),
  db.from('edge_lab_multi_outcomes_v1').select('forecast_id,status,actual,absolute_error').limit(10000),
  db.from('ncaaf_game_context_v2').select('event_id,summary_payload').limit(5000),
 ]);
 if(fR.error||oR.error||cR.error)throw Error('NCAAF_CAUSAL_DIAGNOSTIC_READ_FAILED');
 const om=new Map((oR.data??[]).map(x=>[x.forecast_id,x])),cm=new Map((cR.data??[]).map(x=>[x.event_id,x.summary_payload])),rows:any[]=[];
 for(const f of fR.data??[]){const o:any=om.get(f.id);if(!o)continue;const ctx=cm.get(f.event_id),input:any=f.payload?.input??{},proj:any=f.payload?.projection??{},selectionTeamId=f.market==='MONEYLINE'?(f.selection==='HOME'?String(input.home_id):String(input.away_id)):null,ds=ctx?driveSummary(ctx,selectionTeamId):null,ts=ctx&&selectionTeamId?teamStats(ctx,selectionTeamId):null;
  const labels:string[]=[];const status=String(o.status??'').toUpperCase();
  if(f.market==='MONEYLINE'&&status==='L'&&Number(f.probability)>=0.7)labels.push('HIGH_CONFIDENCE_MISS');
  if(f.market==='POINT_MARGIN'&&Number(o.absolute_error)>=14)labels.push('LARGE_MARGIN_MISS');
  if(f.market==='TOTAL_POINTS'&&Number(o.absolute_error)>=17)labels.push('LARGE_TOTAL_MISS');
  if((ds?.turnoverDrives??0)>=3)labels.push('MULTI_TURNOVER_DRIVES');
  if((ds?.threeAndOutLike??0)>=4)labels.push('OFFENSIVE_STALLS');
  if((ts?.turnovers??0)>=3)labels.push('HIGH_TURNOVER_GAME');
  if((ts?.sacks??0)>=4)labels.push('HIGH_SACK_PRESSURE');
  const missing=Array.isArray(proj?.missing_features)?proj.missing_features:[];
  if(missing.includes('verified_starting_QB'))labels.push('PREGAME_QB_UNKNOWN');
  if(missing.includes('pregame_weather'))labels.push('PREGAME_WEATHER_UNKNOWN');
  rows.push({forecast_id:f.id,event_id:f.event_id,market:f.market,model_version:f.model_version,selection:f.selection,probability:f.probability,projection:f.projection,outcome_status:o.status,actual:o.actual,absolute_error:o.absolute_error,observed_labels:[...new Set(labels)],observed_evidence:{disclaimer:'Player-vs-opponent and unit evidence is not individual defender assignment.',drives:ds,teamStats:ts,missingPregameFeatures:missing,summaryAvailable:Boolean(ctx)},evidence_quality:ctx?'HIGH':'LOW',causal_status:'HYPOTHESIS_ONLY',analyzed_at:new Date().toISOString()});
 }
 if(rows.length){const w=await db.from('ncaaf_causal_diagnostics_v1').upsert(rows,{onConflict:'forecast_id'}).select('forecast_id');if(w.error)throw Error('NCAAF_DIAGNOSTIC_WRITE_FAILED');}
 return {status:'COMPLETED',eligible:rows.length,written:rows.length,model_changes:0,auto_promotion:false};
}
export async function runNcaafCausalLearning(){const context=await syncNcaafCausalContext({cap:1});const diagnostics=await runNcaafCausalDiagnostics();return {context,diagnostics};}
