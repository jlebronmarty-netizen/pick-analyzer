import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

const CONTEXT_VERSION='NHL_CAUSAL_CONTEXT_V2',MATCHUP_VERSION='NHL_CAUSAL_MATCHUPS_V3';
const providerGameId=(eventId:unknown)=>{const m=/^nhl:(\d+)$/.exec(String(eventId??''));return m?Number(m[1]):null;};
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const text=(v:any)=>typeof v==='string'?v:String(v?.default??'');
const toiSeconds=(v:unknown)=>{const s=String(v??'');const m=/^(\d+):(\d{2})$/.exec(s);return m?Number(m[1])*60+Number(m[2]):0;};

async function fetchOfficial(gameId:number,path:'play-by-play'|'boxscore'){
 const u='https://api-web.nhle.com/v1/gamecenter/'+gameId+'/'+path;
 const r=await fetch(u,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NHL_CAUSAL_PROVIDER_FAILED');
 return r.json();
}
function selectedTeam(pred:any):{team:string;teamId:number;p:number;side:'away'|'home'}{
 const away=Number(pred?.awayProbability)>Number(pred?.homeProbability);
 return {team:away?String(pred?.away):String(pred?.home),teamId:Number(away?pred?.awayId:pred?.homeId),p:Number(away?pred?.awayProbability:pred?.homeProbability),side:away?'away':'home'};
}
function pbpSummary(payload:any,selectionTeamId:number,side:'away'|'home'){
 const plays=Array.isArray(payload?.plays)?payload.plays:[];
 const goals=plays.filter((p:any)=>String(p?.typeDescKey)==='goal');
 const periodFinal=new Map<number,{away:number;home:number}>();
 let leadChanges=0,lastSign=0,maxLead=0,maxDeficit=0,ties=0;
 for(const p of plays){
  const d=p?.details??{},away=finite(d?.awayScore),home=finite(d?.homeScore);
  if(away===null||home===null)continue;
  const margin=side==='away'?away-home:home-away,sign=Math.sign(margin);
  if(sign===0)ties++;if(sign!==0&&lastSign!==0&&sign!==lastSign)leadChanges++;if(sign!==0)lastSign=sign;
  maxLead=Math.max(maxLead,margin);maxDeficit=Math.min(maxDeficit,margin);
  const period=Number(p?.periodDescriptor?.number??p?.period);if(Number.isFinite(period))periodFinal.set(period,{away,home});
 }
 const periods=[...periodFinal.entries()].sort((a,b)=>a[0]-b[0]).map(([period,s])=>({period,margin:side==='away'?s.away-s.home:s.home-s.away,awayScore:s.away,homeScore:s.home}));
 const selectedGoals=goals.filter((p:any)=>Number(p?.details?.eventOwnerTeamId)===selectionTeamId);
 const ppGoals=selectedGoals.filter((p:any)=>/PP|power/i.test(String(p?.details?.strength??p?.details?.strengthCode??''))).length;
 return {playCount:plays.length,goalEvents:goals.length,periods,leadChanges,ties,maxLead,maxDeficit,selectedGoals:selectedGoals.length,powerPlayGoals:ppGoals};
}
function boxSummary(payload:any,selectionTeamId:number){
 const pbg=payload?.playerByGameStats??{};
 const teamKeys=['awayTeam','homeTeam'];
 let team:any=null;
 for(const key of teamKeys){const candidate=pbg?.[key];const rows=[...(candidate?.forwards??[]),...(candidate?.defense??[]),...(candidate?.goalies??[])];if(rows.some((r:any)=>Number(r?.playerId)===Number(payload?.awayTeam?.id??payload?.homeTeam?.id)))void 0;}
 const awayId=Number(payload?.awayTeam?.id),homeId=Number(payload?.homeTeam?.id);
 team=selectionTeamId===awayId?pbg?.awayTeam:selectionTeamId===homeId?pbg?.homeTeam:null;
 const skaters=[...(team?.forwards??[]),...(team?.defense??[])];
 const goalies=[...(team?.goalies??[])];
 const skaterRows=skaters.map((r:any)=>({id:Number(r?.playerId)||null,name:text(r?.name),toi:r?.toi??null,toiSeconds:toiSeconds(r?.toi),goals:finite(r?.goals),assists:finite(r?.assists),points:finite(r?.points),sog:finite(r?.sog),hits:finite(r?.hits),blockedShots:finite(r?.blockedShots),giveaways:finite(r?.giveaways),takeaways:finite(r?.takeaways),pim:finite(r?.pim),plusMinus:finite(r?.plusMinus)}));
 const goalieRows=goalies.map((r:any)=>({id:Number(r?.playerId)||null,name:text(r?.name),toi:r?.toi??null,toiSeconds:toiSeconds(r?.toi),shotsAgainst:finite(r?.shotsAgainst),saves:finite(r?.saves),goalsAgainst:finite(r?.goalsAgainst),savePctg:finite(r?.savePctg??r?.savePercentage),decision:r?.decision??null}));
 const primary=[...goalieRows].sort((a,b)=>b.toiSeconds-a.toiSeconds)[0]??null;
 const topSkaters=[...skaterRows].sort((a,b)=>(b.toiSeconds-a.toiSeconds)).slice(0,6);
 const totals=skaterRows.reduce((a:any,r:any)=>({goals:a.goals+(r.goals??0),assists:a.assists+(r.assists??0),sog:a.sog+(r.sog??0),hits:a.hits+(r.hits??0),blockedShots:a.blockedShots+(r.blockedShots??0),giveaways:a.giveaways+(r.giveaways??0),takeaways:a.takeaways+(r.takeaways??0)}),{goals:0,assists:0,sog:0,hits:0,blockedShots:0,giveaways:0,takeaways:0});
 return {primaryGoalie:primary,goalies:goalieRows,topSkaters,totals,skaters:skaterRows.length,complete:Boolean(primary)&&skaterRows.length>=10};
}
function nameMap(box:any){
 const m=new Map<number,string>(),pbg=box?.playerByGameStats??{};
 for(const team of [pbg?.awayTeam,pbg?.homeTeam])for(const r of [...(team?.forwards??[]),...(team?.defense??[]),...(team?.goalies??[])]){const id=Number(r?.playerId);if(Number.isSafeInteger(id))m.set(id,text(r?.name)||String(id));}
 return m;
}
async function persistShooterGoalie(eventId:string,gameId:number,pbp:any,box:any,capturedAt:string){
 const names=nameMap(box),map=new Map<string,any>(),gameDate=/^\d{4}-\d{2}-\d{2}$/.test(String(pbp?.gameDate??''))?pbp.gameDate:null;
 for(const play of Array.isArray(pbp?.plays)?pbp.plays:[]){
  const type=String(play?.typeDescKey??'');if(type!=='shot-on-goal'&&type!=='goal')continue;
  const d=play?.details??{},shooter=Number(d?.shootingPlayerId??d?.scoringPlayerId),goalie=Number(d?.goalieInNetId);
  if(!Number.isSafeInteger(shooter)||!Number.isSafeInteger(goalie))continue;
  const key=shooter+'|'+goalie,v=map.get(key)??{event_id:eventId,provider_game_id:gameId,game_date:gameDate,shooting_player_id:shooter,goalie_id:goalie,shooting_player_name:names.get(shooter)??null,goalie_name:names.get(goalie)??null,shots:0,goals:0,strength_states:[],captured_at:capturedAt,source_version:MATCHUP_VERSION};
  v.shots++;if(type==='goal')v.goals++;
  const strength=String(d?.strength??d?.strengthCode??'').trim();if(strength&&!v.strength_states.includes(strength))v.strength_states.push(strength);
  map.set(key,v);
 }
 const rows=[...map.values()];if(!rows.length)return 0;
 const w=await db.from('nhl_matchup_observations_v3').upsert(rows,{onConflict:'event_id,shooting_player_id,goalie_id'}).select('event_id');if(w.error)throw Error('NHL_MATCHUP_WRITE_FAILED');return w.data?.length??0;
}
export async function syncNhlCausalContext({cap=1}:{cap?:number}={}){
 const [settledR,ctxR]=await Promise.all([
  db.from('nhl_free_predictions_v1').select('event_id,scheduled_at').order('scheduled_at',{ascending:true}).limit(1000),
  db.from('nhl_game_context_v2').select('event_id,play_by_play,boxscore').limit(1000),
 ]);
 if(settledR.error||ctxR.error)throw Error('NHL_CAUSAL_PLAN_READ_FAILED');
 const outcomes=await db.from('nhl_free_outcomes_v1').select('event_id').limit(1000);if(outcomes.error)throw Error('NHL_CAUSAL_OUTCOME_READ_FAILED');
 const finished=new Set((outcomes.data??[]).map(x=>x.event_id)),existing=new Map((ctxR.data??[]).map(x=>[x.event_id,x]));
 const targets=(settledR.data??[]).filter(x=>finished.has(x.event_id)&&providerGameId(x.event_id)!==null&&(!existing.get(x.event_id)?.play_by_play||!existing.get(x.event_id)?.boxscore)).slice(0,Math.max(0,Math.min(cap,1)));
 let calls=0,written=0,matchups=0;const failures:string[]=[];
 for(const t of targets){
  const gid=providerGameId(t.event_id);if(gid===null)continue;
  try{
   const [pbp,box]=await Promise.all([(calls++,fetchOfficial(gid,'play-by-play')),(calls++,fetchOfficial(gid,'boxscore'))]);
   const at=new Date().toISOString();
   const row={event_id:t.event_id,provider_game_id:gid,play_by_play:pbp,boxscore:box,pbp_captured_at:at,boxscore_captured_at:at,provider:'nhl_web_api',source_version:CONTEXT_VERSION,updated_at:at};
   const w=await db.from('nhl_game_context_v2').upsert(row,{onConflict:'event_id'}).select('event_id');if(w.error)throw Error('NHL_CONTEXT_WRITE_FAILED');written+=w.data?.length??0;
   matchups+=await persistShooterGoalie(t.event_id,gid,pbp,box,at);
  }catch(e){failures.push(t.event_id+':'+(e instanceof Error?e.message:'NHL_CAUSAL_FAILED'));}
 }
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:targets.length,provider_calls:calls,written,matchups,failures};
}
export async function runNhlCausalDiagnostics(){
 const [pR,oR,cR]=await Promise.all([
  db.from('nhl_free_predictions_v1').select('id,event_id,body').limit(1000),
  db.from('nhl_free_outcomes_v1').select('event_id,body').limit(1000),
  db.from('nhl_game_context_v2').select('event_id,play_by_play,boxscore').limit(1000),
 ]);
 if(pR.error||oR.error||cR.error)throw Error('NHL_CAUSAL_DIAGNOSTIC_READ_FAILED');
 const om=new Map((oR.data??[]).map(x=>[x.event_id,x.body])),cm=new Map((cR.data??[]).map(x=>[x.event_id,x]));
 const rows:any[]=[];
 for(const p of pR.data??[]){
  const outcome:any=om.get(p.event_id);if(!outcome)continue;
  const pred:any=p.body??{},sel=selectedTeam(pred),ctx:any=cm.get(p.event_id),away=Number(outcome.awayScore),home=Number(outcome.homeScore);
  const actualMargin=sel.side==='away'?away-home:home-away,win=actualMargin>0;
  const pbp=ctx?.play_by_play?pbpSummary(ctx.play_by_play,sel.teamId,sel.side):null,box=ctx?.boxscore?boxSummary(ctx.boxscore,sel.teamId):null;
  const labels:string[]=[];
  if(!win&&sel.p>=0.65)labels.push('HIGH_CONFIDENCE_MISS');
  if(!win&&actualMargin<=-3)labels.push('MULTI_GOAL_MISS');
  if((pbp?.maxLead??0)>=2&&!win)labels.push('MULTI_GOAL_LEAD_LOST');
  if((pbp?.maxDeficit??0)<=-2&&win)labels.push('MULTI_GOAL_COMEBACK_WIN');
  if((pbp?.leadChanges??0)>=3)labels.push('HIGH_LEAD_CHANGE_GAME');
  if((box?.totals?.giveaways??0)>=12)labels.push('HIGH_GIVEAWAY_GAME');
  if(box?.primaryGoalie?.savePctg!==null&&box?.primaryGoalie?.savePctg<0.88)labels.push('LOW_GOALIE_SAVE_PCT');
  if((pbp?.powerPlayGoals??0)>=2)labels.push('MULTI_POWER_PLAY_GOALS');
  const brier=(sel.p-(win?1:0))**2;
  rows.push({prediction_id:p.id,event_id:p.event_id,model:'DRATINGS_PUBLIC_ARGMAX_V1',selection:sel.team,predicted_probability:sel.p,outcome:win?'win':'loss',actual_margin:actualMargin,brier,period_margins:pbp?.periods??[],observed_labels:[...new Set(labels)],observed_evidence:{disclaimer:'Observed labels are postgame hypotheses, not causal proof.',pbp,boxscore:box,missingPbp:!pbp,missingBoxscore:!box},evidence_quality:pbp&&box?.complete?'HIGH':pbp||box?'MEDIUM':'LOW',causal_status:'HYPOTHESIS_ONLY',analyzed_at:new Date().toISOString()});
 }
 if(rows.length){const w=await db.from('nhl_causal_diagnostics_v1').upsert(rows,{onConflict:'prediction_id'}).select('prediction_id');if(w.error)throw Error('NHL_DIAGNOSTIC_WRITE_FAILED');}
 return {status:'COMPLETED',eligible:rows.length,written:rows.length,model_changes:0,auto_promotion:false};
}
export async function getNhlCausalLearningReport(){
 const [dR,mR,cR]=await Promise.all([
  db.from('nhl_causal_diagnostics_v1').select('*').order('analyzed_at',{ascending:false}).limit(500),
  db.from('nhl_matchup_observations_v3').select('*').order('game_date',{ascending:false}).limit(5000),
  db.from('nhl_game_context_v2').select('event_id,play_by_play,boxscore').limit(1000),
 ]);
 if(dR.error||mR.error||cR.error)throw Error('NHL_CAUSAL_REPORT_READ_FAILED');
 const rows=dR.data??[],wins=rows.filter(x=>x.outcome==='win').length,losses=rows.filter(x=>x.outcome==='loss').length,briers=rows.map(x=>finite(x.brier)).filter((x):x is number=>x!==null);
 const labels=new Map<string,{count:number,wins:number,losses:number}>();
 for(const r of rows)for(const l of Array.isArray(r.observed_labels)?r.observed_labels:[]){const v=labels.get(l)??{count:0,wins:0,losses:0};v.count++;r.outcome==='win'?v.wins++:v.losses++;labels.set(l,v);}
 const pair=new Map<string,any>();
 for(const x of mR.data??[]){const k=x.shooting_player_id+'|'+x.goalie_id,v=pair.get(k)??{shooterId:x.shooting_player_id,goalieId:x.goalie_id,shooter:x.shooting_player_name,goalie:x.goalie_name,games:new Set<string>(),shots:0,goals:0};v.games.add(x.event_id);v.shots+=Number(x.shots??0);v.goals+=Number(x.goals??0);pair.set(k,v);}
 const matchupProfiles=[...pair.values()].map(v=>({shooterId:v.shooterId,goalieId:v.goalieId,shooter:v.shooter,goalie:v.goalie,games:v.games.size,shots:v.shots,goals:v.goals,shootingPct:v.shots?v.goals/v.shots:null})).filter(v=>v.games>=2).sort((a,b)=>b.games-a.games||b.shots-a.shots).slice(0,50);
 const patterns=[...labels.entries()].map(([label,v])=>({label,...v,lossRate:v.wins+v.losses?v.losses/(v.wins+v.losses):null})).sort((a,b)=>b.count-a.count);
 return {status:'AVAILABLE',generatedAt:new Date().toISOString(),sample:{settled:rows.length,wins,losses,accuracy:wins+losses?wins/(wins+losses):null,brier:briers.length?briers.reduce((a,b)=>a+b,0)/briers.length:null},evidence:{contextGames:cR.data?.length??0,pbpGames:(cR.data??[]).filter(x=>x.play_by_play).length,boxscoreGames:(cR.data??[]).filter(x=>x.boxscore).length,shooterGoalieObservations:mR.data?.length??0},patterns,matchupProfiles,recent:rows.slice(0,50),policy:{labelsAreHypotheses:true,autoModelChanges:false,validatedCandidateRequiresHoldout:true,contextGamesPerRunCap:1,providerCallsPerRunCap:2}};
}
export async function runNhlCausalLearning(){const context=await syncNhlCausalContext({cap:1});const diagnostics=await runNhlCausalDiagnostics();return {context,diagnostics};}
