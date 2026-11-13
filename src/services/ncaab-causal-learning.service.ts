import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary';
const CTX_VERSION='NCAAB_CAUSAL_CONTEXT_V2',MATCHUP_VERSION='NCAAB_CAUSAL_MATCHUPS_V3';
const providerEventId=(eventId:unknown)=>{const m=/^espn:(\d+)$/.exec(String(eventId??''));return m?m[1]:null;};
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const pct=(v:unknown)=>{const n=finite(v);return n===null?null:n>1?n/100:n;};
function splitMadeAttempt(v:unknown){const m=/^(\d+)\s*-\s*(\d+)$/.exec(String(v??''));return m?{made:Number(m[1]),att:Number(m[2])}:{made:null,att:null};}
function minutes(v:unknown){const s=String(v??'').trim();if(!s)return null;if(/^\d+:\d{2}$/.test(s)){const [m,sec]=s.split(':');return Number(m)+Number(sec)/60;}const n=Number(s);return Number.isFinite(n)?n:null;}

async function fetchSummary(id:string){
 const u=new URL(BASE);u.searchParams.set('event',id);
 const r=await fetch(u,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NCAAB_CAUSAL_PROVIDER_FAILED');
 return r.json();
}
function competitors(payload:any){
 const rows=payload?.header?.competitions?.[0]?.competitors??[];
 const home=rows.find((x:any)=>x?.homeAway==='home'),away=rows.find((x:any)=>x?.homeAway==='away');
 return {homeId:String(home?.id??home?.team?.id??''),awayId:String(away?.id??away?.team?.id??''),homeName:String(home?.team?.displayName??home?.team?.shortDisplayName??''),awayName:String(away?.team?.displayName??away?.team?.shortDisplayName??'')};
}
function flow(payload:any,selectionId:string){
 const ids=competitors(payload),side=selectionId===ids.homeId?'home':selectionId===ids.awayId?'away':null;
 const plays=Array.isArray(payload?.plays)?payload.plays:[];
 if(!side)return null;
 let maxLead=0,maxDeficit=0,leadChanges=0,lastSign=0,ties=0;
 const periodFinal=new Map<number,{home:number;away:number}>();
 for(const p of plays){
  const h=finite(p?.homeScore),a=finite(p?.awayScore);if(h===null||a===null)continue;
  const margin=side==='home'?h-a:a-h,sign=Math.sign(margin);maxLead=Math.max(maxLead,margin);maxDeficit=Math.min(maxDeficit,margin);
  if(sign===0)ties++;if(sign!==0&&lastSign!==0&&sign!==lastSign)leadChanges++;if(sign!==0)lastSign=sign;
  const period=Number(p?.period?.number??p?.period);if(Number.isFinite(period))periodFinal.set(period,{home:h,away:a});
 }
 const periods=[...periodFinal.entries()].sort((a,b)=>a[0]-b[0]).map(([period,s])=>({period,homeScore:s.home,awayScore:s.away,margin:side==='home'?s.home-s.away:s.away-s.home}));
 const half=periodFinal.get(1),halftimeMargin=half?(side==='home'?half.home-half.away:half.away-half.home):null;
 return {playCount:plays.length,periods,halftimeMargin,maxLead,maxDeficit,leadChanges,ties};
}
function playerRows(payload:any){
 const result:any[]=[];
 for(const teamBlock of payload?.boxscore?.players??[]){
  const teamId=String(teamBlock?.team?.id??''),teamName=String(teamBlock?.team?.displayName??teamBlock?.team?.shortDisplayName??'');
  for(const group of teamBlock?.statistics??[]){
   const labels=(group?.labels??[]).map((x:any)=>String(x).toUpperCase());
   for(const a of group?.athletes??[]){
    const values=a?.stats??[],get=(label:string)=>{const i=labels.indexOf(label);return i>=0?values[i]:null;};
    const fg=splitMadeAttempt(get('FG')),three=splitMadeAttempt(get('3PT'));
    result.push({playerId:String(a?.athlete?.id??''),playerName:String(a?.athlete?.displayName??a?.athlete?.shortName??''),teamId,teamName,minutes:minutes(get('MIN')),points:finite(get('PTS')),rebounds:finite(get('REB')),assists:finite(get('AST')),turnovers:finite(get('TO')),fouls:finite(get('PF')),fgm:fg.made,fga:fg.att,fgPct:fg.att?Number(fg.made)/fg.att:null,threeMade:three.made,threeAtt:three.att,threePct:three.att?Number(three.made)/three.att:null,starter:Boolean(a?.starter)});
   }
  }
 }
 return result.filter(x=>x.playerId&&x.teamId);
}
function teamStats(payload:any,teamId:string){
 const block=(payload?.boxscore?.teams??[]).find((x:any)=>String(x?.team?.id??'')===teamId);
 const map=new Map((block?.statistics??[]).map((s:any)=>[String(s?.name??s?.label??'').toLowerCase(),finite(s?.value??s?.displayValue)]));
 const get=(...keys:string[])=>{for(const k of keys){const v=map.get(k.toLowerCase());if(v!==undefined&&v!==null)return v;}return null;};
 return {turnovers:get('turnovers','totalTurnovers'),rebounds:get('totalRebounds','rebounds'),offensiveRebounds:get('offensiveRebounds'),assists:get('assists'),steals:get('steals'),blocks:get('blocks'),fouls:get('fouls','totalFouls'),fgPct:pct(get('fieldGoalPct','fieldGoalPercentage')),threePct:pct(get('threePointFieldGoalPct','threePointPct')),freeThrowPct:pct(get('freeThrowPct','freeThrowPercentage'))};
}
async function persistOpponentMatchups(eventId:string,providerId:string,payload:any,capturedAt:string){
 const ids=competitors(payload),rows=playerRows(payload),gameDate=/^\d{4}-\d{2}-\d{2}/.exec(String(payload?.header?.competitions?.[0]?.date??''))?.[0]??null;
 const out=rows.flatMap(r=>{const opp=r.teamId===ids.homeId?{id:ids.awayId,name:ids.awayName}:r.teamId===ids.awayId?{id:ids.homeId,name:ids.homeName}:null;if(!opp)return [];return [{event_id:eventId,provider_event_id:providerId,game_date:gameDate,player_id:r.playerId,player_name:r.playerName,team_id:r.teamId,opponent_team_id:opp.id,opponent_team_name:opp.name,minutes:r.minutes,points:r.points,rebounds:r.rebounds,assists:r.assists,turnovers:r.turnovers,fouls:r.fouls,fgm:r.fgm,fga:r.fga,fg_pct:r.fgPct,three_made:r.threeMade,three_att:r.threeAtt,three_pct:r.threePct,captured_at:capturedAt,source_version:MATCHUP_VERSION}];});
 if(!out.length)return 0;
 const w=await db.from('ncaab_opponent_matchups_v3').upsert(out,{onConflict:'event_id,player_id,opponent_team_id'}).select('event_id');if(w.error)throw Error('NCAAB_MATCHUP_WRITE_FAILED');return w.data?.length??0;
}
export async function syncNcaabCausalContext({cap=3}:{cap?:number}={}){
 const [pR,oR,cR]=await Promise.all([
  db.from('ncaab_daily_predictions_v1').select('event_id,scheduled_at').order('scheduled_at',{ascending:true}).limit(5000),
  db.from('ncaab_daily_outcomes_v1').select('event_id').limit(5000),
  db.from('ncaab_game_context_v2').select('event_id').limit(5000),
 ]);
 if(pR.error||oR.error||cR.error)throw Error('NCAAB_CAUSAL_PLAN_READ_FAILED');
 const settled=new Set((oR.data??[]).map(x=>x.event_id)),existing=new Set((cR.data??[]).map(x=>x.event_id));
 const targets=(pR.data??[]).filter(x=>settled.has(x.event_id)&&!existing.has(x.event_id)&&providerEventId(x.event_id)).slice(0,Math.max(0,Math.min(cap,3)));
 let calls=0,written=0,matchups=0;const failures:string[]=[];
 for(const t of targets){try{const id=providerEventId(t.event_id)!;calls++;const payload=await fetchSummary(id),at=new Date().toISOString();const w=await db.from('ncaab_game_context_v2').upsert({event_id:t.event_id,provider_event_id:id,summary_payload:payload,captured_at:at,provider:'espn',source_version:CTX_VERSION,updated_at:at},{onConflict:'event_id'}).select('event_id');if(w.error)throw Error('NCAAB_CONTEXT_WRITE_FAILED');written+=w.data?.length??0;matchups+=await persistOpponentMatchups(t.event_id,id,payload,at);}catch(e){failures.push(t.event_id+':'+(e instanceof Error?e.message:'NCAAB_CAUSAL_FAILED'));}}
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:targets.length,provider_calls:calls,written,matchups,failures};
}
export async function runNcaabCausalDiagnostics(){
 const [pR,oR,cR]=await Promise.all([
  db.from('ncaab_daily_predictions_v1').select('id,event_id,body').limit(5000),
  db.from('ncaab_daily_outcomes_v1').select('event_id,body').limit(5000),
  db.from('ncaab_game_context_v2').select('event_id,summary_payload').limit(5000),
 ]);
 if(pR.error||oR.error||cR.error)throw Error('NCAAB_CAUSAL_DIAGNOSTIC_READ_FAILED');
 const om=new Map((oR.data??[]).map(x=>[x.event_id,x.body])),cm=new Map((cR.data??[]).map(x=>[x.event_id,x.summary_payload])),rows:any[]=[];
 for(const p of pR.data??[]){const pred:any=p.body??{},out:any=om.get(p.event_id);if(!out||pred.state!=='FORECAST'||!pred.predicted_winner)continue;
  const win=String(pred.predicted_winner)===(Number(out.home_score)>Number(out.away_score)?String(out.home_id):String(out.away_id)),selectionId=String(pred.predicted_winner),isHome=selectionId===String(pred.home_id),selectionName=isHome?pred.home_name:pred.away_name;
  const actualMargin=isHome?Number(out.home_score)-Number(out.away_score):Number(out.away_score)-Number(out.home_score),actualTotal=Number(out.home_score)+Number(out.away_score),projectedMargin=isHome?Number(pred.projected_margin):-Number(pred.projected_margin),projectedTotal=Number(pred.projected_total);
  const probability=isHome?Number(pred.home_win_probability):Number(pred.away_win_probability),ctx=cm.get(p.event_id),f=ctx?flow(ctx,selectionId):null,t=ctx?teamStats(ctx,selectionId):null,players=ctx?playerRows(ctx).filter(x=>x.teamId===selectionId):[];
  const labels:string[]=[];if(!win&&probability>=0.7)labels.push('HIGH_CONFIDENCE_MISS');if(!win&&actualMargin<=-15)labels.push('BLOWOUT_MISS');if((f?.halftimeMargin??0)>0&&!win)labels.push('SECOND_HALF_REVERSAL');if((f?.maxDeficit??0)<=-12&&win)labels.push('DOUBLE_DIGIT_COMEBACK_WIN');if((f?.leadChanges??0)>=8)labels.push('HIGH_LEAD_CHANGE_GAME');if(Number(t?.turnovers??0)>=18)labels.push('HIGH_TURNOVER_GAME');if(typeof t?.threePct==='number'&&t.threePct>=0.45)labels.push('HOT_THREE_POINT_SHOOTING');if(Number(t?.fouls??0)>=22)labels.push('HIGH_FOUL_GAME');if(players.some(x=>(x.fouls??0)>=4&&(x.minutes??0)>=20))labels.push('KEY_PLAYER_FOUL_TROUBLE');
  rows.push({prediction_id:p.id,event_id:p.event_id,model:'NCAAB_PRESEASON_V1',selection_team_id:selectionId,selection_name:selectionName,predicted_probability:probability,outcome:win?'win':'loss',actual_margin:actualMargin,projected_margin:projectedMargin,projected_total:projectedTotal,actual_total:actualTotal,margin_error:Math.abs(projectedMargin-actualMargin),total_error:Math.abs(projectedTotal-actualTotal),brier:(probability-(win?1:0))**2,observed_labels:[...new Set(labels)],observed_evidence:{disclaimer:'Opponent/team matchup evidence is not direct defender assignment.',flow:f,teamStats:t,topPlayers:[...players].sort((a,b)=>(b.minutes??0)-(a.minutes??0)).slice(0,6),missingSummary:!ctx},evidence_quality:ctx&&players.length?'HIGH':ctx?'MEDIUM':'LOW',causal_status:'HYPOTHESIS_ONLY',analyzed_at:new Date().toISOString()});
 }
 if(rows.length){const w=await db.from('ncaab_causal_diagnostics_v1').upsert(rows,{onConflict:'prediction_id'}).select('prediction_id');if(w.error)throw Error('NCAAB_DIAGNOSTIC_WRITE_FAILED');}
 return {status:'COMPLETED',eligible:rows.length,written:rows.length,model_changes:0,auto_promotion:false};
}
export async function getNcaabCausalLearningReport(){
 const [dR,mR,cR]=await Promise.all([
  db.from('ncaab_causal_diagnostics_v1').select('*').order('analyzed_at',{ascending:false}).limit(2000),
  db.from('ncaab_opponent_matchups_v3').select('*').order('game_date',{ascending:false}).limit(10000),
  db.from('ncaab_game_context_v2').select('event_id').limit(5000),
 ]);
 if(dR.error||mR.error||cR.error)throw Error('NCAAB_CAUSAL_REPORT_READ_FAILED');
 const rows=dR.data??[],wins=rows.filter(x=>x.outcome==='win').length,losses=rows.filter(x=>x.outcome==='loss').length,briers=rows.map(x=>finite(x.brier)).filter((x):x is number=>x!==null);
 const labels=new Map<string,{count:number,wins:number,losses:number}>();for(const r of rows)for(const l of Array.isArray(r.observed_labels)?r.observed_labels:[]){const v=labels.get(l)??{count:0,wins:0,losses:0};v.count++;r.outcome==='win'?v.wins++:v.losses++;labels.set(l,v);}
 const pair=new Map<string,any>();for(const x of mR.data??[]){const k=x.player_id+'|'+x.opponent_team_id,v=pair.get(k)??{playerId:x.player_id,player:x.player_name,opponentTeamId:x.opponent_team_id,opponent:x.opponent_team_name,games:new Set<string>(),minutes:0,points:0,rebounds:0,assists:0,turnovers:0,fgm:0,fga:0};v.games.add(x.event_id);v.minutes+=Number(x.minutes??0);v.points+=Number(x.points??0);v.rebounds+=Number(x.rebounds??0);v.assists+=Number(x.assists??0);v.turnovers+=Number(x.turnovers??0);v.fgm+=Number(x.fgm??0);v.fga+=Number(x.fga??0);pair.set(k,v);}
 const matchupProfiles=[...pair.values()].map(v=>({...v,games:v.games.size,fgPct:v.fga?v.fgm/v.fga:null})).filter(v=>v.games>=2).sort((a,b)=>b.games-a.games||b.minutes-a.minutes).slice(0,100);
 const patterns=[...labels.entries()].map(([label,v])=>({label,...v,lossRate:v.wins+v.losses?v.losses/(v.wins+v.losses):null})).sort((a,b)=>b.count-a.count);
 const marginErrors=rows.map(x=>finite(x.margin_error)).filter((x):x is number=>x!==null),totalErrors=rows.map(x=>finite(x.total_error)).filter((x):x is number=>x!==null);
 return {status:'AVAILABLE',generatedAt:new Date().toISOString(),sample:{settled:rows.length,wins,losses,accuracy:wins+losses?wins/(wins+losses):null,brier:briers.length?briers.reduce((a,b)=>a+b,0)/briers.length:null,marginMae:marginErrors.length?marginErrors.reduce((a,b)=>a+b,0)/marginErrors.length:null,totalMae:totalErrors.length?totalErrors.reduce((a,b)=>a+b,0)/totalErrors.length:null},evidence:{contextGames:cR.data?.length??0,opponentMatchupObservations:mR.data?.length??0,directDefenderAssignments:false},patterns,matchupProfiles,recent:rows.slice(0,50),policy:{labelsAreHypotheses:true,autoModelChanges:false,validatedCandidateRequiresHoldout:true,contextGamesPerRunCap:3,providerCallsPerRunCap:3,v3Meaning:'PLAYER_VS_OPPONENT_TEAM_NOT_DIRECT_DEFENDER'}};
}
export async function runNcaabCausalLearning(){const context=await syncNcaabCausalContext({cap:3});const diagnostics=await runNcaabCausalDiagnostics();return {context,diagnostics};}
