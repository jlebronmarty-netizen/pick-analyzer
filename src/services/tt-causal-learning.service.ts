import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

function finalOf(o:any){return o?.payload?.final??null;}
function winner(final:any){if(!final)return null;return Number(final.setsA)>Number(final.setsB)?'A':Number(final.setsB)>Number(final.setsA)?'B':null;}
function normalizedPair(a:string,b:string){return a.localeCompare(b)<=0?[a,b]:[b,a];}
export async function runTtCausalLearning(){
 const [fR,oR]=await Promise.all([
  db.from('edge_lab_multi_forecasts_v1').select('id,event_id,market,selection,projection,probability,payload,scheduled_at').eq('sport','TT').limit(10000),
  db.from('edge_lab_multi_outcomes_v1').select('forecast_id,status,actual,absolute_error,payload').limit(20000),
 ]);
 if(fR.error||oR.error)throw Error('TT_CAUSAL_READ_FAILED');
 const om=new Map((oR.data??[]).map(x=>[x.forecast_id,x])),diagnostics:any[]=[],h2h=new Map<string,any>();
 for(const f of fR.data??[]){const o:any=om.get(f.id);if(!o)continue;const fin=finalOf(o),sets=Array.isArray(fin?.setPoints)?fin.setPoints:[],input:any=f.payload?.input??{},playerA=String(input.playerA??fin?.playerA??''),playerB=String(input.playerB??fin?.playerB??''),win=winner(fin);const labels:string[]=[];
  if(f.market==='MONEYLINE'&&String(o.status)==='L'&&Number(f.probability)>=0.65)labels.push('HIGH_CONFIDENCE_MISS');
  if(f.market==='TOTAL_POINTS'&&Number(o.absolute_error)>=15)labels.push('LARGE_TOTAL_MISS');
  if(Number(fin?.setsA)+Number(fin?.setsB)>=5)labels.push('FIVE_SET_MATCH');
  if(Math.min(Number(fin?.setsA??0),Number(fin?.setsB??0))===0)labels.push('STRAIGHT_SETS');
  if(sets.some((s:any)=>Number(s?.[0])>=12||Number(s?.[1])>=12))labels.push('DEUCE_EXTENDED_SET');
  if(sets.length&&win){const firstWinner=Number(sets[0]?.[0])>Number(sets[0]?.[1])?'A':'B';if(firstWinner!==win)labels.push('COMEBACK_AFTER_FIRST_SET');}
  const pointMargins=sets.map((s:any)=>Number(s?.[0])-Number(s?.[1])).filter(Number.isFinite);
  const volatility=pointMargins.length?Math.max(...pointMargins)-Math.min(...pointMargins):null;if(volatility!==null&&volatility>=12)labels.push('HIGH_SET_SWING');
  diagnostics.push({forecast_id:f.id,event_id:f.event_id,market:f.market,selection:f.selection,probability:f.probability,projection:f.projection,outcome_status:o.status,actual:o.actual,absolute_error:o.absolute_error,observed_labels:[...new Set(labels)],observed_evidence:{final:fin,setPointMargins:pointMargins,sourceStored:true,providerCalls:0},evidence_quality:fin&&sets.length?'HIGH':fin?'MEDIUM':'LOW',causal_status:'HYPOTHESIS_ONLY',analyzed_at:new Date().toISOString()});
  if(fin&&playerA&&playerB&&!h2h.has(f.event_id)){const [ca,cb]=normalizedPair(playerA,playerB),winnerName=win==='A'?playerA:win==='B'?playerB:null;h2h.set(f.event_id,{event_id:f.event_id,game_date:String(fin?.scheduledAt??f.scheduled_at).slice(0,10),player_a:ca,player_b:cb,winner:winnerName,sets_a:Number(fin?.setsA??0),sets_b:Number(fin?.setsB??0),total_points:Number(fin?.totalPoints??0),set_points:sets,source:String(fin?.source??'stored_outcome'),captured_at:String(fin?.capturedAt??new Date().toISOString()),source_version:'TT_CAUSAL_H2H_V3'});}
 }
 if(diagnostics.length){const w=await db.from('tt_causal_diagnostics_v1').upsert(diagnostics,{onConflict:'forecast_id'}).select('forecast_id');if(w.error)throw Error('TT_DIAGNOSTIC_WRITE_FAILED');}
 const hrows=[...h2h.values()];if(hrows.length){const w=await db.from('tt_h2h_observations_v3').upsert(hrows,{onConflict:'event_id'}).select('event_id');if(w.error)throw Error('TT_H2H_WRITE_FAILED');}
 return {status:'COMPLETED',diagnostics:diagnostics.length,h2h:hrows.length,provider_calls:0,model_changes:0,auto_promotion:false};
}
export async function getTtCausalLearningReport(){
 const [dR,hR]=await Promise.all([db.from('tt_causal_diagnostics_v1').select('*').order('analyzed_at',{ascending:false}).limit(3000),db.from('tt_h2h_observations_v3').select('*').order('game_date',{ascending:false}).limit(5000)]);
 if(dR.error||hR.error)throw Error('TT_CAUSAL_REPORT_READ_FAILED');const rows=dR.data??[],ml=rows.filter(x=>x.market==='MONEYLINE'),wins=ml.filter(x=>String(x.outcome_status)==='W').length,losses=ml.filter(x=>String(x.outcome_status)==='L').length;
 const labels=new Map<string,number>();for(const r of rows)for(const l of Array.isArray(r.observed_labels)?r.observed_labels:[])labels.set(l,(labels.get(l)??0)+1);
 const pair=new Map<string,any>();for(const x of hR.data??[]){const k=x.player_a+'|'+x.player_b,v=pair.get(k)??{playerA:x.player_a,playerB:x.player_b,games:0,winsA:0,winsB:0,totalPoints:0,totalSets:0};v.games++;v.totalPoints+=Number(x.total_points??0);v.totalSets+=Number(x.sets_a??0)+Number(x.sets_b??0);if(x.winner===x.player_a)v.winsA++;if(x.winner===x.player_b)v.winsB++;pair.set(k,v);}
 const h2hProfiles=[...pair.values()].filter(x=>x.games>=2).map(x=>({...x,winRateA:x.games?x.winsA/x.games:null,avgTotalPoints:x.games?x.totalPoints/x.games:null,avgSets:x.games?x.totalSets/x.games:null})).sort((a,b)=>b.games-a.games).slice(0,100);
 const totalErr=rows.filter(x=>x.market==='TOTAL_POINTS'&&Number.isFinite(Number(x.absolute_error))).map(x=>Number(x.absolute_error));
 return {status:'AVAILABLE',generatedAt:new Date().toISOString(),sample:{mlSettled:wins+losses,wins,losses,accuracy:wins+losses?wins/(wins+losses):null,totalMae:totalErr.length?totalErr.reduce((a,b)=>a+b,0)/totalErr.length:null},evidence:{diagnostics:rows.length,h2hGames:hR.data?.length??0,providerCalls:0},patterns:[...labels.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count),h2hProfiles,recent:rows.slice(0,50),policy:{labelsAreHypotheses:true,autoModelChanges:false,validatedCandidateRequiresHoldout:true,v3Meaning:'DIRECT_PLAYER_VS_PLAYER_H2H'}};
}
