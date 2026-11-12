import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_POLICY} from '@/lib/nba/goat-provider-policy.mjs';

const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW';
const prob=(v:unknown)=>{const n=Number(v);if(!Number.isFinite(n))return null;return n>1?n/100:n;};
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
function selectedQuarterMargins(game:any,selection:string){
 const home=game?.home_team?.full_name,away=game?.visitor_team?.full_name;
 if(selection!==home&&selection!==away)return null;
 const hs=[game.home_q1,game.home_q2,game.home_q3,game.home_q4].map(finite);
 const as=[game.visitor_q1,game.visitor_q2,game.visitor_q3,game.visitor_q4].map(finite);
 if([...hs,...as].some(v=>v===null))return null;
 return hs.map((h,i)=>selection===home?Number(h)-Number(as[i]):Number(as[i])-Number(h));
}
function labels({outcome,p,actualMargin,q,featureSnapshot}:{outcome:string,p:number|null,actualMargin:number|null,q:number[]|null,featureSnapshot:any}){
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
 if(Number(featureSnapshot?.featureQualityScore??0)<=0||Number(featureSnapshot?.dataSufficiencyScore??0)<=0)out.push('PREGAME_CONTEXT_GAP');
 return [...new Set(out)];
}
export async function runNbaCausalDiagnostics(){
 const [predR,schedR]=await Promise.all([
  db.from('prediction_history').select('id,game_id,market,team,selection,model_version,model_probability,result,settled_at,feature_snapshot,settlement_details').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',NBA_GOAT_POLICY).not('settled_at','is',null).order('settled_at',{ascending:false}).limit(500),
  db.from('nba_market_schedules_v1').select('snapshot_id,date_local,source_received_at,payload').order('source_received_at',{ascending:false}).limit(300),
 ]);
 if(predR.error||schedR.error)throw Error('NBA_CAUSAL_READ_FAILED');
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
 const rows:any[]=[];
 for(const p of predR.data??[]){
  const m=/^bdl_nba_(\d+)$/.exec(String(p.game_id??''));if(!m)continue;
  const snap=latest.get(Number(m[1]));if(!snap)continue;
  const selection=String(p.team??p.selection??'').trim();if(!selection)continue;
  const q=selectedQuarterMargins(snap.game,selection);
  const actualMargin=finite(p.settlement_details?.actual);
  const probability=prob(p.model_probability);
  const outcome=String(p.result??'').toLowerCase();
  const y=outcome==='win'?1:outcome==='loss'?0:null;
  const brier=probability!==null&&y!==null?(probability-y)**2:null;
  const halftime=q?q[0]+q[1]:null,secondHalf=q?q[2]+q[3]:null;
  const observedLabels=labels({outcome,p:probability,actualMargin,q,featureSnapshot:p.feature_snapshot});
  const evidenceQuality=q&&actualMargin!==null?'MEDIUM':'LOW';
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
    quarterMargins:q,
    featureQualityScore:p.feature_snapshot?.featureQualityScore??null,
    dataSufficiencyScore:p.feature_snapshot?.dataSufficiencyScore??null,
    missingCurrentPbp:true,missingCurrentLineupTruth:true,missingCurrentPlayerGameStats:true,
   },
   causal_status:'HYPOTHESIS_ONLY',source_snapshot_ids:[snap.snapshotId],analyzed_at:new Date().toISOString(),
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
  evidence:{quarterArchive:rows.filter(x=>x.evidence_quality==='MEDIUM'||x.evidence_quality==='HIGH').length,pbpCurrent:false,lineupTruthCurrent:false,playerGameStatsCurrent:false},
  patterns,
  recent:rows.slice(0,50),
  policy:{labelsAreHypotheses:true,autoModelChanges:false,validatedCandidateRequiresHoldout:true},
 };
}
