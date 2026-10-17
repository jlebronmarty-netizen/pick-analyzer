import {z} from 'zod';
import type {ModelCohort} from './sport-model-overview';
const number=z.number().finite(),count=number.int().nonnegative(),p=number.gt(0).lt(1),stamp=z.string().datetime({offset:true});
const bucket=z.enum(['PASS','SHADOW','QUALIFIED','STRONG']);
const event=z.object({eventId:z.string().min(1),homeTeam:z.string().min(1),awayTeam:z.string().min(1),kickoffUtc:stamp,frozenAt:stamp,
 qualificationStatus:z.enum(['INSUFFICIENT_HISTORY','PASS','SHADOW','QUALIFIED','STRONG']),bucket:bucket.nullable(),
 expectedGoalsHome:number.positive(),expectedGoalsAway:number.positive(),modelOver25:p,modelUnder25:p,
 affiliateId:z.union([z.literal(3),z.literal(19),z.literal(23)]),over25Decimal:number.gt(1),under25Decimal:number.gt(1),quoteCapturedAt:stamp,quoteLastUpdated:stamp.nullable(),
 marketNoVigOver25:p,marketNoVigUnder25:p,rawSelectedSide:z.enum(['OVER_2_5','UNDER_2_5']),rawSelectedEdgePp:number,
 warmupComplete:z.boolean(),warmupEvidence:z.object({homeHomeGames:count,awayAwayGames:count,leagueGames:count,asOf:stamp,latestHistoryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).nullable(),
 settlement:z.object({result:z.enum(['WIN','LOSS','VOID']),homeGoals:count,awayGoals:count,profitUnits:number,settledAt:stamp,observedAt:stamp,final:z.literal(true),source:z.string().min(1)}).nullable(),
 closingNoVig:z.object({over25:p,under25:p,capturedAt:stamp}).nullable(),
});
const metrics=z.object({wins:count,losses:count,voids:count,pending:count,accuracy:number.min(0).max(1).nullable(),profitUnits:number.nullable(),roiPct:number.nullable(),clvMeanPp:number.nullable(),clvN:count});
const schema=z.object({schema:z.literal('SOCCER_SHADOW_READ_V1'),sport:z.literal('SOCCER'),classification:z.literal('SHADOW'),model:z.literal('SOCCER_POISSON_V0'),competition:z.literal('LaLiga'),market:z.literal('TOTAL_2_5'),line:z.literal(2.5),status:z.literal('AVAILABLE'),
 sourceCommit:z.string().regex(/^[0-9a-f]{40}$/),sourcePath:z.string().startsWith('research/soccer-v0/'),sourceSha256:z.string().regex(/^[0-9a-f]{64}$/),capturedAt:stamp,readAt:stamp,connection:z.literal('PUBLISHED_CHECKPOINT'),continuousCollection:z.literal(false),source:z.literal('TheRundown FREE'),oddsDelaySeconds:z.literal(300),scheduledFixtures:count,
 missingQuotes:z.array(z.object({homeTeam:z.string(),awayTeam:z.string(),reason:z.string()})).max(256),events:z.array(event).max(2000),metrics,warning:z.string(),providerCalls:z.literal(0),databaseWrites:z.literal(0)});
export type SoccerEvent=z.infer<typeof event>;
export type SoccerAvailableReport=z.infer<typeof schema>;
export type SoccerReport=SoccerAvailableReport|{status:'UNAVAILABLE';readAt:string;warning:string};
const close=(a:number,b:number)=>Math.abs(a-b)<1e-7;
export function validSoccerShadow(r:SoccerEvent){return r.warmupComplete&&['QUALIFIED','STRONG'].includes(r.qualificationStatus);}
export function currentSoccerEdge(r:SoccerEvent,now:string){
 const t=Date.parse(now),captured=Date.parse(r.quoteCapturedAt),updated=r.quoteLastUpdated?Date.parse(r.quoteLastUpdated):NaN;
 return validSoccerShadow(r)&&!r.settlement&&Date.parse(r.kickoffUtc)>t&&captured<=t&&t-captured<=45*60000&&updated<=captured&&t-updated<=45*60000;
}
export function parseSoccerReport(input:unknown,now=new Date()):SoccerAvailableReport{
 const r=schema.parse(input),ids=new Set<string>();
 if(Math.abs(now.getTime()-Date.parse(r.readAt))>300000||Date.parse(r.capturedAt)>Date.parse(r.readAt)+1000||r.scheduledFixtures!==r.events.length+r.missingQuotes.length)throw Error('SOURCE_SCOPE_OR_TIMESTAMP');
 for(const e of r.events){
  if(ids.has(e.eventId)||e.homeTeam===e.awayTeam)throw Error('DUPLICATE_OR_INVALID_EVENT');ids.add(e.eventId);
  const capture=Date.parse(e.quoteCapturedAt),tip=Date.parse(e.kickoffUtc);
  if(capture>=tip||Date.parse(e.frozenAt)>=tip||Date.parse(e.frozenAt)>Date.parse(r.capturedAt)+1000||capture>Date.parse(e.frozenAt)+1000||(e.quoteLastUpdated&&Date.parse(e.quoteLastUpdated)>capture))throw Error('INVALID_ENTRY_TIME');
  if(!close(e.modelOver25+e.modelUnder25,1))throw Error('PROBABILITY_COMPLEMENT');
  const over=(1/e.over25Decimal)/(1/e.over25Decimal+1/e.under25Decimal),under=1-over;
  const overEdge=(e.modelOver25-over)*100,underEdge=(e.modelUnder25-under)*100,side=overEdge>=underEdge?'OVER_2_5':'UNDER_2_5',edge=Math.max(overEdge,underEdge);
  if(!close(over,e.marketNoVigOver25)||!close(under,e.marketNoVigUnder25)||!close(edge,e.rawSelectedEdgePp)||side!==e.rawSelectedSide)throw Error('PRICE_EDGE_ARITHMETIC');
  const expected=edge>=8?'STRONG':edge>=5?'QUALIFIED':edge>=3?'SHADOW':'PASS';
  if(!e.warmupComplete){if(e.qualificationStatus!=='INSUFFICIENT_HISTORY'||e.bucket!==null)throw Error('WARMUP_GATE_BYPASS');}
  else{
   const w=e.warmupEvidence;
   if(!w||w.homeHomeGames<5||w.awayAwayGames<5||w.leagueGames<20||Date.parse(w.asOf)>capture||w.latestHistoryDate>=e.kickoffUtc.slice(0,10)||e.qualificationStatus!==expected||e.bucket!==expected)throw Error('WARMUP_EVIDENCE_OR_BUCKET');
  }
  if(e.closingNoVig){const c=e.closingNoVig;if(!close(c.over25+c.under25,1)||Date.parse(c.capturedAt)<capture||Date.parse(c.capturedAt)>=tip)throw Error('INVALID_CLOSE');}
  if(e.settlement){
   const s=e.settlement;
   if(Date.parse(s.settledAt)<tip||Date.parse(s.observedAt)<tip||Date.parse(s.observedAt)>Date.parse(s.settledAt)||Date.parse(s.settledAt)>Date.parse(r.readAt))throw Error('INVALID_SETTLEMENT_TIME');
   const win=(s.homeGoals+s.awayGoals>=3)===(e.rawSelectedSide==='OVER_2_5');
   const price=e.rawSelectedSide==='OVER_2_5'?e.over25Decimal:e.under25Decimal;
   if(s.result!=='VOID'&&(s.result!==(win?'WIN':'LOSS')||!close(s.profitUnits,win?price-1:-1))||s.result==='VOID'&&s.profitUnits!==0)throw Error('INVALID_SETTLEMENT_ARITHMETIC');
  }
 }
 const qualified=r.events.filter(validSoccerShadow),settled=qualified.filter(e=>e.settlement),decided=settled.filter(e=>e.settlement!.result!=='VOID');
 const wins=decided.filter(e=>e.settlement!.result==='WIN').length,losses=decided.length-wins,voids=settled.length-decided.length,pending=qualified.length-settled.length;
 const profit=decided.length?decided.reduce((n,e)=>n+e.settlement!.profitUnits,0):null;
 const closes=qualified.filter(e=>e.closingNoVig),clv=closes.length?closes.reduce((n,e)=>n+100*(e.rawSelectedSide==='OVER_2_5'?e.closingNoVig!.over25-e.marketNoVigOver25:e.closingNoVig!.under25-e.marketNoVigUnder25),0)/closes.length:null;
 const expected={wins,losses,voids,pending,accuracy:decided.length?wins/decided.length:null,profitUnits:profit,roiPct:profit===null?null:100*profit/decided.length,clvMeanPp:clv,clvN:closes.length};
 for(const k of Object.keys(expected) as (keyof typeof expected)[]){const a=expected[k],b=r.metrics[k];if(a===null?b!==null:b===null||!close(a,b))throw Error('METRICS_MISMATCH');}
 return r;
}
export function unavailableSoccer():SoccerReport{return {status:'UNAVAILABLE',readAt:new Date().toISOString(),warning:'Soccer: no se pudo verificar la captura publicada. No se sustituyen picks ni métricas.'};}
export function soccerModelCohort(r:SoccerReport):ModelCohort{
 if(r.status==='UNAVAILABLE')return {key:'SHADOW',label:'Soccer · LaLiga O/U 2.5',available:false,wins:null,losses:null,pending:null,pushes:null,voids:null,models:null,accuracy:null,note:r.warning};
 const m=r.metrics;return {key:'SHADOW',label:'Soccer · SOCCER_POISSON_V0 · SHADOW',available:true,wins:m.wins,losses:m.losses,pending:m.pending,pushes:0,voids:m.voids,models:1,accuracy:m.accuracy,note:'Solo QUALIFIED/STRONG con warmup verificado. Proyecciones bloqueadas excluidas; captura publicada, sin colector continuo.'};
}
