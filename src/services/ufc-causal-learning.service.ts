import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

const CTX_VERSION='UFC_CAUSAL_CONTEXT_V2',H2H_VERSION='UFC_CAUSAL_H2H_V3';
async function fetchSummary(eventId:string){
 const u=new URL('https://site.api.espn.com/apis/site/v2/sports/mma/ufc/summary');u.searchParams.set('event',eventId);
 const r=await fetch(u,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('UFC_CAUSAL_PROVIDER_FAILED');
 return r.json();
}
function findBoutNode(value:any,boutId:string,depth=0):any{
 if(depth>8||value===null||value===undefined)return null;
 if(Array.isArray(value)){for(const x of value){const hit=findBoutNode(x,boutId,depth+1);if(hit)return hit;}return null;}
 if(typeof value!=='object')return null;
 if(String(value.id??value.competitionId??value.uid??'')===boutId)return value;
 for(const [k,v] of Object.entries(value)){if(['links','images','logos'].includes(k))continue;const hit=findBoutNode(v,boutId,depth+1);if(hit)return hit;}return null;
}
function boutDetail(context:any,boutId:string){
 const node=findBoutNode(context,boutId);if(!node)return null;
 const status=node?.status?.type??node?.status??{},details=node?.details??node?.result??node;
 const method=String(details?.method?.text??details?.method?.displayName??details?.method??status?.detail??'').trim()||null;
 const round=Number(details?.round??details?.period??node?.period);const time=String(details?.time??details?.clock?.displayValue??status?.shortDetail??'').trim()||null;
 return {method,round:Number.isFinite(round)?round:null,time};
}
export async function syncUfcCausalContext({cap=1}:{cap?:number}={}){
 const [pR,rR,cR]=await Promise.all([
  db.from('ufc_free_predictions_v1').select('bout_id,body').limit(5000),
  db.from('ufc_free_results_v1').select('bout_id,body').limit(5000),
  db.from('ufc_event_context_v2').select('event_id').limit(1000),
 ]);
 if(pR.error||rR.error||cR.error)throw Error('UFC_CAUSAL_PLAN_READ_FAILED');
 const predByBout=new Map((pR.data??[]).map(x=>[x.bout_id,x.body])),existing=new Set((cR.data??[]).map(x=>x.event_id)),events:string[]=[];
 for(const r of rR.data??[]){const p:any=predByBout.get(r.bout_id);const eventId=String(p?.bout?.eventId??r.body?.eventId??'');if(!eventId||existing.has(eventId)||events.includes(eventId))continue;events.push(eventId);if(events.length>=Math.max(0,Math.min(cap,1)))break;}
 let calls=0,written=0;const failures:string[]=[];
 for(const eventId of events){try{calls++;const payload=await fetchSummary(eventId),at=new Date().toISOString();const w=await db.from('ufc_event_context_v2').upsert({event_id:eventId,summary_payload:payload,captured_at:at,provider:'espn',source_version:CTX_VERSION,updated_at:at},{onConflict:'event_id'}).select('event_id');if(w.error)throw Error('UFC_CONTEXT_WRITE_FAILED');written+=w.data?.length??0;}catch(e){failures.push(eventId+':'+(e instanceof Error?e.message:'UFC_CAUSAL_FAILED'));}}
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:events.length,provider_calls:calls,written,failures};
}
export async function runUfcCausalDiagnostics(){
 const [pR,rR,cR]=await Promise.all([
  db.from('ufc_free_predictions_v1').select('id,bout_id,body').limit(5000),
  db.from('ufc_free_results_v1').select('bout_id,body,captured_at').limit(5000),
  db.from('ufc_event_context_v2').select('event_id,summary_payload').limit(1000),
 ]);
 if(pR.error||rR.error||cR.error)throw Error('UFC_CAUSAL_DIAGNOSTIC_READ_FAILED');
 const results=new Map((rR.data??[]).map(x=>[x.bout_id,x])),contexts=new Map((cR.data??[]).map(x=>[x.event_id,x.summary_payload])),rows:any[]=[],h2h=new Map<string,any>();
 for(const p of pR.data??[]){const rr:any=results.get(p.bout_id);if(!rr)continue;const pred:any=p.body??{},result:any=rr.body??{},bout:any=pred.bout??{},winnerId=String(result.winnerId??''),selectedId=String(pred.selectedId??''),outcome=winnerId&&selectedId?winnerId===selectedId?'win':'loss':'unknown';if(outcome==='unknown')continue;const prob=selectedId===String(bout.aId)?Number(pred.probabilityA):Number(pred.probabilityB),ctx=contexts.get(String(bout.eventId)),detail=ctx?boutDetail(ctx,String(p.bout_id)):null;const labels:string[]=[];
  if(outcome==='loss'&&prob>=0.65)labels.push('HIGH_CONFIDENCE_MISS');
  if(outcome==='loss'&&prob>=0.6)labels.push('FAVORITE_UPSET');
  if(detail?.method&&/decision/i.test(detail.method))labels.push('DECISION_RESULT');
  if(detail?.method&&!/decision/i.test(detail.method))labels.push('FINISH_RESULT');
  if(detail?.round!==null&&detail?.round!==undefined&&detail.round<=1&&!/decision/i.test(String(detail.method??'')))labels.push('ROUND_ONE_FINISH');
  rows.push({prediction_id:p.id,bout_id:p.bout_id,event_id:String(bout.eventId),model:pred.model,selected_fighter_id:selectedId,selected_fighter_name:String(pred.selection??'').replace(/ ML$/,''),probability:prob,outcome,observed_labels:[...new Set(labels)],observed_evidence:{disclaimer:'Fight method/round are used only when provider context confirms them. No striking/grappling stats are invented.',result,detail,contextAvailable:Boolean(ctx),priorA:pred.priorA??null,priorB:pred.priorB??null},evidence_quality:ctx&&detail?'HIGH':'MEDIUM',causal_status:'HYPOTHESIS_ONLY',analyzed_at:new Date().toISOString()});
  if(!h2h.has(p.bout_id)){const [aId,bId]=[String(bout.aId),String(bout.bId)].sort(),aName=String(bout.aId)===aId?String(bout.a):String(bout.b),bName=String(bout.bId)===bId?String(bout.b):String(bout.a);h2h.set(p.bout_id,{bout_id:p.bout_id,event_id:String(bout.eventId),fight_date:String(bout.scheduledAt??'').slice(0,10),fighter_a_id:aId,fighter_b_id:bId,fighter_a_name:aName,fighter_b_name:bName,winner_id:winnerId,method:detail?.method??null,round:detail?.round??null,time_text:detail?.time??null,captured_at:String(rr.captured_at??new Date().toISOString()),source_version:H2H_VERSION});}
 }
 if(rows.length){const w=await db.from('ufc_causal_diagnostics_v1').upsert(rows,{onConflict:'prediction_id'}).select('prediction_id');if(w.error)throw Error('UFC_DIAGNOSTIC_WRITE_FAILED');}
 const hrows=[...h2h.values()];if(hrows.length){const w=await db.from('ufc_h2h_observations_v3').upsert(hrows,{onConflict:'bout_id'}).select('bout_id');if(w.error)throw Error('UFC_H2H_WRITE_FAILED');}
 return {status:'COMPLETED',diagnostics:rows.length,h2h:hrows.length,model_changes:0,auto_promotion:false};
}
export async function getUfcCausalLearningReport(){
 const [dR,hR,cR]=await Promise.all([db.from('ufc_causal_diagnostics_v1').select('*').order('analyzed_at',{ascending:false}).limit(3000),db.from('ufc_h2h_observations_v3').select('*').order('fight_date',{ascending:false}).limit(5000),db.from('ufc_event_context_v2').select('event_id').limit(1000)]);
 if(dR.error||hR.error||cR.error)throw Error('UFC_CAUSAL_REPORT_READ_FAILED');const rows=dR.data??[],wins=rows.filter(x=>x.outcome==='win').length,losses=rows.filter(x=>x.outcome==='loss').length;const labels=new Map<string,number>();for(const r of rows)for(const l of Array.isArray(r.observed_labels)?r.observed_labels:[])labels.set(l,(labels.get(l)??0)+1);
 const pair=new Map<string,any>();for(const x of hR.data??[]){const k=x.fighter_a_id+'|'+x.fighter_b_id,v=pair.get(k)??{fighterAId:x.fighter_a_id,fighterBId:x.fighter_b_id,fighterA:x.fighter_a_name,fighterB:x.fighter_b_name,fights:0,winsA:0,winsB:0};v.fights++;if(x.winner_id===x.fighter_a_id)v.winsA++;if(x.winner_id===x.fighter_b_id)v.winsB++;pair.set(k,v);}const h2hProfiles=[...pair.values()].filter(x=>x.fights>=2);
 return {status:'AVAILABLE',generatedAt:new Date().toISOString(),sample:{settled:wins+losses,wins,losses,accuracy:wins+losses?wins/(wins+losses):null},evidence:{eventContexts:cR.data?.length??0,h2hFights:hR.data?.length??0},patterns:[...labels.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count),h2hProfiles,recent:rows.slice(0,50),policy:{labelsAreHypotheses:true,autoModelChanges:false,validatedCandidateRequiresHoldout:true,contextCardsPerRunCap:1,providerCallsPerRunCap:1,v3Meaning:'DIRECT_FIGHTER_VS_FIGHTER_H2H'}};
}
export async function runUfcCausalLearning(){const context=await syncUfcCausalContext({cap:1});const diagnostics=await runUfcCausalDiagnostics();return {context,diagnostics};}
