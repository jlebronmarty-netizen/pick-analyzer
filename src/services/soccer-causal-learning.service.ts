import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

const CTX_VERSION='SOCCER_CAUSAL_CONTEXT_V2',MATCHUP_VERSION='SOCCER_CAUSAL_MATCHUPS_V3';
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
function slugFromForecast(f:any){
 const urls=f?.payload?.evidence?.schedule_sources??[];
 for(const x of urls){const m=/\/sports\/soccer\/([^/]+)\/scoreboard/.exec(String(x?.url??''));if(m)return m[1];}
 return null;
}
async function fetchSummary(slug:string,id:string){
 const u=new URL('https://site.api.espn.com/apis/site/v2/sports/soccer/'+slug+'/summary');u.searchParams.set('event',id);
 const r=await fetch(u,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('SOCCER_CAUSAL_PROVIDER_FAILED');
 return r.json();
}
function teams(payload:any){
 const rows=payload?.header?.competitions?.[0]?.competitors??[];
 const home=rows.find((x:any)=>x?.homeAway==='home'),away=rows.find((x:any)=>x?.homeAway==='away');
 return {homeId:String(home?.id??home?.team?.id??''),awayId:String(away?.id??away?.team?.id??''),homeName:String(home?.team?.displayName??''),awayName:String(away?.team?.displayName??'')};
}
function eventRows(payload:any){
 const raw=[...(Array.isArray(payload?.keyEvents)?payload.keyEvents:[]),...(Array.isArray(payload?.plays)?payload.plays:[])];
 const seen=new Set<string>(),out:any[]=[];
 for(const e of raw){const id=String(e?.id??e?.sequenceNumber??JSON.stringify([e?.clock?.displayValue,e?.text,e?.type?.text]));if(seen.has(id))continue;seen.add(id);const type=String(e?.type?.text??e?.type?.type??e?.type??''),txt=String(e?.text??e?.shortText??''),minute=finite(e?.clock?.value??e?.clock?.displayValue?.replace(/[^0-9.]/g,'')),teamId=String(e?.team?.id??e?.teamId??e?.participants?.[0]?.team?.id??'');const athlete=e?.participants?.[0]?.athlete??e?.athlete??null;out.push({id,type,text:txt,minute,teamId,athleteId:String(athlete?.id??''),athleteName:String(athlete?.displayName??athlete?.shortName??'')});}
 return out;
}
function flow(payload:any,selectionTeamId:string|null){
 const ev=eventRows(payload),goals=ev.filter(x=>/goal/i.test(x.type+' '+x.text)&&!/own goal disallowed|no goal/i.test(x.text)),cards=ev.filter(x=>/card|yellow|red/i.test(x.type+' '+x.text)),subs=ev.filter(x=>/substitution|substitute/i.test(x.type+' '+x.text));
 const selectedGoals=selectionTeamId?goals.filter(x=>x.teamId===selectionTeamId):[];
 return {events:ev.length,goals:goals.length,cards:cards.length,redCards:cards.filter(x=>/red/i.test(x.type+' '+x.text)).length,yellowCards:cards.filter(x=>/yellow/i.test(x.type+' '+x.text)).length,substitutions:subs.length,selectedGoals:selectedGoals.length,earlyGoals:goals.filter(x=>(x.minute??999)<=20).length,lateGoals:goals.filter(x=>(x.minute??0)>=75).length};
}
function rosterRows(payload:any){
 const out:any[]=[];
 const blocks=Array.isArray(payload?.rosters)?payload.rosters:Array.isArray(payload?.lineups)?payload.lineups:[];
 for(const block of blocks){const teamId=String(block?.team?.id??block?.teamId??''),teamName=String(block?.team?.displayName??block?.teamName??'');const entries=block?.roster??block?.athletes??block?.players??[];
  for(const r of entries){const athlete=r?.athlete??r?.player??r;const id=String(athlete?.id??r?.athleteId??'');if(!id||!teamId)continue;out.push({playerId:id,playerName:String(athlete?.displayName??athlete?.fullName??athlete?.shortName??''),teamId,teamName,position:String(r?.position?.abbreviation??r?.position?.name??athlete?.position?.abbreviation??''),starter:Boolean(r?.starter??r?.isStarter)});}
 }
 return out;
}
async function persistPlayerOpponent(eventId:string,id:string,payload:any,at:string){
 const t=teams(payload),players=rosterRows(payload),events=eventRows(payload),date=/^\d{4}-\d{2}-\d{2}/.exec(String(payload?.header?.competitions?.[0]?.date??''))?.[0]??null;
 const rows=players.map(p=>{const opp=p.teamId===t.homeId?{id:t.awayId,name:t.awayName}:p.teamId===t.awayId?{id:t.homeId,name:t.homeName}:null;if(!opp)return null;const pe=events.filter(e=>e.athleteId===p.playerId);return {event_id:eventId,provider_event_id:id,game_date:date,player_id:p.playerId,player_name:p.playerName,team_id:p.teamId,opponent_team_id:opp.id,opponent_team_name:opp.name,position:p.position,starter:p.starter,goals:pe.filter(e=>/goal/i.test(e.type+' '+e.text)).length,assists:pe.filter(e=>/assist/i.test(e.type+' '+e.text)).length,yellow_cards:pe.filter(e=>/yellow/i.test(e.type+' '+e.text)).length,red_cards:pe.filter(e=>/red/i.test(e.type+' '+e.text)).length,captured_at:at,source_version:MATCHUP_VERSION};}).filter(Boolean);
 if(!rows.length)return 0;const w=await db.from('soccer_player_opponent_v3').upsert(rows,{onConflict:'event_id,player_id,opponent_team_id'}).select('event_id');if(w.error)throw Error('SOCCER_MATCHUP_WRITE_FAILED');return w.data?.length??0;
}
export async function syncSoccerCausalContext({cap=1}:{cap?:number}={}){
 const [fR,oR,cR]=await Promise.all([
  db.from('edge_lab_forecasts_v1').select('id,event_id,payload').eq('sport','SOCCER').order('scheduled_at',{ascending:true}).limit(5000),
  db.from('edge_lab_outcomes_v1').select('forecast_id').limit(10000),
  db.from('soccer_game_context_v2').select('event_id').limit(5000),
 ]);
 if(fR.error||oR.error||cR.error)throw Error('SOCCER_CAUSAL_PLAN_READ_FAILED');const done=new Set((oR.data??[]).map(x=>x.forecast_id)),existing=new Set((cR.data??[]).map(x=>x.event_id)),targets:any[]=[];const seen=new Set<string>();
 for(const f of fR.data??[]){if(seen.has(f.event_id)||existing.has(f.event_id)||!done.has(f.id))continue;const slug=slugFromForecast(f);if(!slug||!/^[0-9]+$/.test(String(f.event_id)))continue;seen.add(f.event_id);targets.push({...f,slug});if(targets.length>=Math.max(0,Math.min(cap,1)))break;}
 let calls=0,written=0,matchups=0;const failures:string[]=[];
 for(const f of targets){try{calls++;const payload=await fetchSummary(f.slug,String(f.event_id)),at=new Date().toISOString();const w=await db.from('soccer_game_context_v2').upsert({event_id:f.event_id,provider_event_id:String(f.event_id),league_slug:f.slug,summary_payload:payload,captured_at:at,provider:'espn',source_version:CTX_VERSION,updated_at:at},{onConflict:'event_id'}).select('event_id');if(w.error)throw Error('SOCCER_CONTEXT_WRITE_FAILED');written+=w.data?.length??0;matchups+=await persistPlayerOpponent(f.event_id,String(f.event_id),payload,at);}catch(e){failures.push(f.event_id+':'+(e instanceof Error?e.message:'SOCCER_CAUSAL_FAILED'));}}
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:targets.length,provider_calls:calls,written,matchups,failures};
}
export async function runSoccerCausalDiagnostics(){
 const [fR,oR,cR]=await Promise.all([db.from('edge_lab_forecasts_v1').select('id,event_id,market,selection,probability,model_version,payload').eq('sport','SOCCER').limit(5000),db.from('edge_lab_outcomes_v1').select('forecast_id,status,payload').limit(10000),db.from('soccer_game_context_v2').select('event_id,summary_payload').limit(5000)]);
 if(fR.error||oR.error||cR.error)throw Error('SOCCER_CAUSAL_DIAGNOSTIC_READ_FAILED');const om=new Map((oR.data??[]).map(x=>[x.forecast_id,x])),cm=new Map((cR.data??[]).map(x=>[x.event_id,x.summary_payload])),rows:any[]=[];
 for(const f of fR.data??[]){const o:any=om.get(f.id);if(!o)continue;const final=o?.payload?.final??{},selectionTeamId=f.market==='1X2'?(f.selection==='HOME'?String(final.home_id):f.selection==='AWAY'?String(final.away_id):null):null,ctx=cm.get(f.event_id),fl=ctx?flow(ctx,selectionTeamId):null,roster=ctx?rosterRows(ctx):[];const labels:string[]=[];const loss=String(o.status).toUpperCase()==='L';
  if(loss&&Number(f.probability)>=0.65)labels.push('HIGH_CONFIDENCE_MISS');if((fl?.redCards??0)>=1)labels.push('RED_CARD_GAME');if((fl?.earlyGoals??0)>=1)labels.push('EARLY_GOAL');if((fl?.lateGoals??0)>=1)labels.push('LATE_GOAL');if((fl?.cards??0)>=6)labels.push('HIGH_CARD_GAME');if((fl?.substitutions??0)>=8)labels.push('HIGH_SUBSTITUTION_GAME');
  const expHome=finite(f.payload?.projection?.expectedGoalsHome),expAway=finite(f.payload?.projection?.expectedGoalsAway),actualHome=finite(final?.home_score),actualAway=finite(final?.away_score);
  if(expHome!==null&&actualHome!==null&&Math.abs(actualHome-expHome)>=1.5)labels.push('HOME_FINISHING_VARIANCE');if(expAway!==null&&actualAway!==null&&Math.abs(actualAway-expAway)>=1.5)labels.push('AWAY_FINISHING_VARIANCE');
  rows.push({forecast_id:f.id,event_id:f.event_id,market:f.market,model_version:f.model_version,selection:f.selection,probability:f.probability,outcome_status:o.status,observed_labels:[...new Set(labels)],observed_evidence:{disclaimer:'V3 is player-vs-opponent-team context, not direct defender assignment. xG is not inferred when source does not provide it.',flow:fl,rosterAvailable:roster.length>0,rosterPlayers:roster.length,expectedGoals:{home:expHome,away:expAway},final:{home:actualHome,away:actualAway}},evidence_quality:ctx&&roster.length?'HIGH':ctx?'MEDIUM':'LOW',causal_status:'HYPOTHESIS_ONLY',analyzed_at:new Date().toISOString()});
 }
 if(rows.length){const w=await db.from('soccer_causal_diagnostics_v1').upsert(rows,{onConflict:'forecast_id'}).select('forecast_id');if(w.error)throw Error('SOCCER_DIAGNOSTIC_WRITE_FAILED');}
 return {status:'COMPLETED',eligible:rows.length,written:rows.length,model_changes:0,auto_promotion:false};
}
export async function runSoccerCausalLearning(){const context=await syncSoccerCausalContext({cap:1});const diagnostics=await runSoccerCausalDiagnostics();return {context,diagnostics};}
