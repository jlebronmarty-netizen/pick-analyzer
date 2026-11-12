import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_POLICY} from '@/lib/nba/goat-provider-policy.mjs';
import {getNbaCausalV2Evidence} from '@/services/nba-causal-v2-context.service';
import {getNbaCausalV3Evidence} from '@/services/nba-causal-v3-matchup.service';

const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW',PBP_VERSION='NBA_BDL_PBP_V1';
const prob=(v:unknown)=>{const n=Number(v);if(!Number.isFinite(n))return null;return n>1?n/100:n;};
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const providerGameId=(id:unknown)=>{const m=/^bdl_nba_(\d+)$/.exec(String(id??''));return m?Number(m[1]):null;};

function selectedQuarterMargins(game:any,selection:string){
 const home=game?.home_team?.full_name,away=game?.visitor_team?.full_name;
 if(selection!==home&&selection!==away)return null;
 const hs=[game.home_q1,game.home_q2,game.home_q3,game.home_q4].map(finite);
 const as=[game.visitor_q1,game.visitor_q2,game.visitor_q3,game.visitor_q4].map(finite);
 if([...hs,...as].some(v=>v===null))return null;
 return hs.map((h,i)=>selection===home?Number(h)-Number(as[i]):Number(as[i])-Number(h));
}
function clockSeconds(v:unknown){
 const s=String(v??'').trim();if(!s)return null;
 if(/^\d+:\d{1,2}(?:\.\d+)?$/.test(s)){const [m,sec]=s.split(':');return Number(m)*60+Number(sec);}
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function summarizePbp(payload:any,selection:string,home:string,away:string){
 const plays=Array.isArray(payload?.data)?payload.data:[];
 if(selection!==home&&selection!==away||!plays.length)return null;
 const margins:{period:number;clock:number|null;margin:number;order:number}[]=[];
 let leadChanges=0,ties=0,lastSign=0,scoringPlays=0;
 for(const play of plays){
  const hs=finite(play?.home_score),as=finite(play?.away_score);if(hs===null||as===null)continue;
  const margin=selection===home?hs-as:as-hs,sign=Math.sign(margin);
  if(sign===0)ties++;
  if(sign!==0&&lastSign!==0&&sign!==lastSign)leadChanges++;
  if(sign!==0)lastSign=sign;
  if(play?.scoring_play===true)scoringPlays++;
  margins.push({period:Number(play?.period??0),clock:clockSeconds(play?.clock),margin,order:Number(play?.order??margins.length)});
 }
 if(!margins.length)return null;
 const q4=margins.filter(x=>x.period===4);
 const atSix=q4.find(x=>x.clock!==null&&x.clock<=360)??null;
 return {
  playCount:plays.length,
  scoredStates:margins.length,
  scoringPlays,
  largestLead:Math.max(...margins.map(x=>x.margin)),
  largestDeficit:Math.min(...margins.map(x=>x.margin)),
  leadChanges,
  ties,
  q4MarginAtSix:atSix?.margin??null,
  finalMargin:margins.at(-1)?.margin??null,
 };
}
function labels({outcome,p,actualMargin,q,featureSnapshot,pbp}:{outcome:string,p:number|null,actualMargin:number|null,q:number[]|null,featureSnapshot:any,pbp:any}){
 const out:string[]=[];
 const loss=outcome==='loss',win=outcome==='win';
 if(loss&&p!==null&&p>=0.75)out.push('HIGH_CONFIDENCE_MISS');
 if(loss&&actualMargin!==null&&actualMargin<=-15)out.push('BLOWOUT_MISS');
 if(win&&actualMargin!==null&&actualMargin>=15)out.push('STRONG_MARGIN_WIN');
 if(q){
  const halftime=q[0]+q[1],final=q.reduce((a,b)=>a+b,0);
  if(halftime!==0&&final!==0&&Math.sign(halftime)!==Math.sign(final))out.push('SECOND_HALF_REVERSAL');
  if(q[0]<=-8)out.push('SLOW_START');
  if(loss&&q[3]<=-8)out.push('LATE_GAME_COLLAPSE');
  if(Math.max(...q.map(Math.abs))>=15)out.push('HIGH_QUARTER_VOLATILITY');
 }
 if(pbp){
  if(loss&&pbp.largestLead>=10)out.push('DOUBLE_DIGIT_LEAD_LOST');
  if(win&&pbp.largestDeficit<=-10)out.push('DOUBLE_DIGIT_COMEBACK_WIN');
  if(loss&&pbp.q4MarginAtSix!==null&&pbp.q4MarginAtSix>=5)out.push('LATE_Q4_LEAD_LOST');
  if(pbp.leadChanges>=8)out.push('HIGH_LEAD_CHANGE_GAME');
 }
 if(Number(featureSnapshot?.featureQualityScore??0)<=0||Number(featureSnapshot?.dataSufficiencyScore??0)<=0)out.push('PREGAME_CONTEXT_GAP');
 return [...new Set(out)];
}

export async function syncNbaCausalPbpForSettled({cap=3}:{cap?:number}={}){
 const key=process.env.BALLDONTLIE_API_KEY?.trim();if(!key)return {status:'KEY_UNAVAILABLE',provider_calls:0,written:0};
 const [pR,eR]=await Promise.all([
  db.from('prediction_history').select('game_id,settled_at,feature_snapshot').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',NBA_GOAT_POLICY).not('settled_at','is',null).order('settled_at',{ascending:true}).limit(500),
  db.from('nba_pbp_snapshots_v1').select('game_id').limit(1000),
 ]);
 if(pR.error||eR.error)throw Error('NBA_PBP_PLAN_READ_FAILED');
 const existing=new Set((eR.data??[]).map(x=>x.game_id));
 const games=[...new Set((pR.data??[]).map(x=>x.game_id).filter((x:any)=>providerGameId(x)!==null&&!existing.has(x)))].slice(0,Math.max(0,Math.min(cap,3)));
 let providerCalls=0,written=0;const failures:string[]=[];
 for(const gameId of games){
  const gid=providerGameId(gameId);if(gid===null)continue;
  try{
   providerCalls++;
   const u=new URL('https://api.balldontlie.io/v1/plays');u.searchParams.set('game_id',String(gid));
   const res=await fetch(u,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!res.ok||!(res.headers.get('content-type')??'').includes('application/json'))throw Error('NBA_PBP_PROVIDER_FAILED');
   const payload=await res.json();if(!Array.isArray(payload?.data))throw Error('NBA_PBP_PAYLOAD_INVALID');
   const row={game_id:gameId,provider_game_id:gid,provider:'balldontlie',captured_at:new Date().toISOString(),play_count:payload.data.length,payload,source_version:PBP_VERSION};
   const w=await db.from('nba_pbp_snapshots_v1').upsert(row,{onConflict:'game_id'}).select('game_id');if(w.error)throw Error('NBA_PBP_WRITE_FAILED');written+=w.data?.length??0;
  }catch(e){failures.push(e instanceof Error?e.message:'NBA_PBP_FAILED');}
 }
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:games.length,provider_calls:providerCalls,written,failures};
}

export async function runNbaCausalDiagnostics(){
 const [predR,schedR,pbpR,ctxR,v3R]=await Promise.all([
  db.from('prediction_history').select('id,game_id,market,team,selection,model_version,model_probability,result,settled_at,feature_snapshot,settlement_details').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',NBA_GOAT_POLICY).not('settled_at','is',null).order('settled_at',{ascending:false}).limit(500),
  db.from('nba_market_schedules_v1').select('snapshot_id,date_local,source_received_at,payload').order('source_received_at',{ascending:false}).limit(300),
  db.from('nba_pbp_snapshots_v1').select('game_id,captured_at,play_count,payload,source_version').limit(1000),
  db.from('nba_game_context_v2').select('game_id,projected_lineups,projected_captured_at,actual_lineups,actual_lineups_captured_at,player_stats,player_stats_captured_at,source_version').limit(1000),
  db.from('nba_matchup_context_v3').select('game_id,matchups,advanced_stats,coverage_status,attempt_count,source_version').limit(1000),
 ]);
 if(predR.error||schedR.error||pbpR.error||ctxR.error||v3R.error)throw Error('NBA_CAUSAL_READ_FAILED');
 const latest=new Map<number,{game:any,snapshotId:string,received:number}>();
 for(const row of schedR.data??[]){
  const received=Date.parse(row.source_received_at??'');if(!Number.isFinite(received))continue;
  const games=row?.payload?.data?.games;if(!Array.isArray(games))continue;
  for(const g of games){
   if(!Number.isSafeInteger(g?.id))continue;
   if(String(g.status_state??'').toLowerCase()!=='final'&&!/final/i.test(String(g.status??'')))continue;
   const old=latest.get(g.id);if(!old||received>old.received)latest.set(g.id,{game:g,snapshotId:row.snapshot_id,received});
  }
 }
 const pbpMap=new Map((pbpR.data??[]).map(x=>[x.game_id,x]));
 const ctxMap=new Map((ctxR.data??[]).map(x=>[x.game_id,x]));
 const v3Map=new Map((v3R.data??[]).map(x=>[x.game_id,x]));
 const rows:any[]=[];
 for(const p of predR.data??[]){
  const gid=providerGameId(p.game_id);if(gid===null)continue;
  const snap=latest.get(gid);if(!snap)continue;
  const selection=String(p.team??p.selection??'').trim();if(!selection)continue;
  const q=selectedQuarterMargins(snap.game,selection);
  const actualMargin=finite(p.settlement_details?.actual);
  const probability=prob(p.model_probability);
  const outcome=String(p.result??'').toLowerCase();
  const y=outcome==='win'?1:outcome==='loss'?0:null;
  const brier=probability!==null&&y!==null?(probability-y)**2:null;
  const halftime=q?q[0]+q[1]:null,secondHalf=q?q[2]+q[3]:null;
  const pbpRow=pbpMap.get(p.game_id),pbp=pbpRow?summarizePbp(pbpRow.payload,selection,snap.game.home_team.full_name,snap.game.visitor_team.full_name):null;
  const v2=getNbaCausalV2Evidence(ctxMap.get(p.game_id),selection);
  const v3=getNbaCausalV3Evidence(v3Map.get(p.game_id),selection,v2.playerStats);
  const observedLabels=[...new Set([...labels({outcome,p:probability,actualMargin,q,featureSnapshot:p.feature_snapshot,pbp}),...v2.labels,...v3.labels])];
  const evidenceQuality=v3.quality==='HIGH'&&v2.quality==='HIGH'&&pbp&&q&&actualMargin!==null?'HIGH':pbp&&q&&actualMargin!==null?'HIGH':q&&actualMargin!==null?'MEDIUM':'LOW';
  rows.push({
   prediction_id:p.id,game_id:p.game_id,model_version:p.model_version,market:p.market,selection,
   predicted_probability:probability,outcome,actual_margin:actualMargin,brier,
   q1_margin:q?.[0]??null,q2_margin:q?.[1]??null,q3_margin:q?.[2]??null,q4_margin:q?.[3]??null,
   halftime_margin:halftime,second_half_margin:secondHalf,
   max_quarter_deficit:q?Math.min(...q):null,max_quarter_advantage:q?Math.max(...q):null,
   evidence_quality:evidenceQuality,observed_labels:observedLabels,
   observed_evidence:{
    disclaimer:'Observed labels are postgame hypotheses, not causal proof.',
    provider:'balldontlie schedule archive',
    finalScore:{home:snap.game.home_team_score,away:snap.game.visitor_team_score},
    quarterMargins:q,pbp,
    lineupComparison:v2.lineups,
    playerGameStats:v2.playerStats,
    matchupTracking:v3,
    featureQualityScore:p.feature_snapshot?.featureQualityScore??null,
    dataSufficiencyScore:p.feature_snapshot?.dataSufficiencyScore??null,
    missingCurrentPbp:!pbp,missingCurrentLineupTruth:!v2.lineups?.complete,missingCurrentPlayerGameStats:!v2.playerStats?.complete,missingConfirmedMatchup:v3.quality!=='HIGH',
   },
   causal_status:'HYPOTHESIS_ONLY',source_snapshot_ids:[snap.snapshotId,...(pbpRow?['pbp:'+p.game_id]:[]),...(ctxMap.get(p.game_id)?['context-v2:'+p.game_id]:[]),...(v3Map.get(p.game_id)?['context-v3:'+p.game_id]:[])],analyzed_at:new Date().toISOString(),
  });
 }
 let written=0;
 for(let i=0;i<rows.length;i+=100){
  const w=await db.from('nba_causal_diagnostics_v1').upsert(rows.slice(i,i+100),{onConflict:'prediction_id'}).select('prediction_id');
  if(w.error)throw Error('NBA_CAUSAL_WRITE_FAILED');written+=w.data?.length??0;
 }
 return {status:'COMPLETED',eligible:rows.length,written,provider_calls:0,model_changes:0,auto_promotion:false};
}

export async function getNbaCausalLearningReport(){
 const r=await db.from('nba_causal_diagnostics_v1').select('*').order('analyzed_at',{ascending:false}).limit(500);
 if(r.error)throw Error('NBA_CAUSAL_REPORT_READ_FAILED');
 const rows=r.data??[];
 const settled=rows.filter(x=>['win','loss','push'].includes(String(x.outcome)));
 const wins=settled.filter(x=>x.outcome==='win').length,losses=settled.filter(x=>x.outcome==='loss').length;
 const briers=settled.map(x=>finite(x.brier)).filter((x):x is number=>x!==null);
 const labelMap=new Map<string,{count:number,wins:number,losses:number}>();
 for(const row of settled){
  for(const label of Array.isArray(row.observed_labels)?row.observed_labels:[]){
   const v=labelMap.get(label)??{count:0,wins:0,losses:0};v.count++;if(row.outcome==='win')v.wins++;if(row.outcome==='loss')v.losses++;labelMap.set(label,v);
  }
 }
 const patterns=[...labelMap.entries()].map(([label,v])=>({label,...v,lossRate:v.wins+v.losses?v.losses/(v.wins+v.losses):null})).sort((a,b)=>b.count-a.count);
 return {
  status:'AVAILABLE',generatedAt:new Date().toISOString(),
  sample:{settled:settled.length,wins,losses,accuracy:wins+losses?wins/(wins+losses):null,brier:briers.length?briers.reduce((a,b)=>a+b,0)/briers.length:null},
  evidence:{
   quarterArchive:rows.filter(x=>x.evidence_quality==='MEDIUM'||x.evidence_quality==='HIGH').length,
   pbpCurrent:rows.some(x=>x.observed_evidence?.missingCurrentPbp===false),
   pbpGames:rows.filter(x=>x.observed_evidence?.missingCurrentPbp===false).length,
   lineupTruthCurrent:rows.some(x=>x.observed_evidence?.missingCurrentLineupTruth===false),
   lineupGames:rows.filter(x=>x.observed_evidence?.missingCurrentLineupTruth===false).length,
   playerGameStatsCurrent:rows.some(x=>x.observed_evidence?.missingCurrentPlayerGameStats===false),
   playerStatGames:rows.filter(x=>x.observed_evidence?.missingCurrentPlayerGameStats===false).length,
   matchupTrackingCurrent:rows.some(x=>x.observed_evidence?.missingConfirmedMatchup===false),
   matchupGames:rows.filter(x=>x.observed_evidence?.missingConfirmedMatchup===false).length,
  },
  patterns,recent:rows.slice(0,50),
  policy:{labelsAreHypotheses:true,autoModelChanges:false,validatedCandidateRequiresHoldout:true,pbpCallsPerRunCap:3,v2ContextGamesPerRunCap:3,v2ContextProviderCallsPerRunCap:3,v3MatchupGamesPerRunCap:1,v3ProviderCallsPerRunCap:2,v3RetryHours:12},
 };
}
