import {fighterKey,predictElo,updateEloDate,UFC_MODEL,type Rating,type BoutFact} from './elo';
import type {ModelCohort} from '../sport-model-overview';
export type UfcBout={id:string;eventId:string;eventName:string;scheduledAt:string;boutTime:string;a:string;b:string;aId:string;bId:string;status:'SCHEDULED'|'LIVE'|'FINAL'|'CANCELLED'|'UNKNOWN';winnerId:string|null;cardComplete:boolean};
export type UfcQuote={boutId:string;eventId:string;aId:string;bId:string;aOdds:number;bOdds:number;book:'DraftKings';capturedAt:string};
export type UfcForecast={id:string;model:typeof UFC_MODEL;bout:UfcBout;capturedAt:string;probabilityA:number;probabilityB:number;selectedId:string;selection:string;priorA:number;priorB:number;eloA:number;eloB:number;lastDateA:string;lastDateB:string;quote:UfcQuote|null};
export type UfcResult={boutId:string;eventId:string;aId:string;bId:string;winnerId:string|null;status:UfcBout['status'];capturedAt:string};
export type UfcRow=UfcForecast&{outcome:'WIN'|'LOSS'|'OPEN'|'REVIEW'|'CANCELLED';profitUnits:number|null;latestQuote:UfcQuote|null};
export type UfcSummary={wins:number;losses:number;pending:number;review:number;cancelled:number;accuracyPct:number|null;brier:number|null;logLoss:number|null;pricedSettled:number;conditionalProfitUnits:number|null;conditionalRoiPct:number|null};
export type UfcReport={status:'AVAILABLE'|'UNAVAILABLE';classification:'SHADOW / RESEARCH';readAt:string;latestRunAt:string|null;health:string;issues:string[];bouts:UfcBout[];forecasts:UfcRow[];summary:UfcSummary;abstentions:{boutId:string;reason:string}[];providerCalls:0;databaseWrites:0};
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'?x as Record<string,unknown>:{};
const array=(x:unknown):unknown[]=>Array.isArray(x)?x:[];
const iso=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const id=(x:unknown)=>typeof x==='string'&&/^\d+$/.test(x)?x:null;
export function normalizeUfcBoard(input:unknown):UfcBout[]{
 const root=obj(input);if(!Array.isArray(root.events))throw Error('UFC_BOARD_SCHEMA');const seen=new Set<string>(),out:UfcBout[]=[];
 for(const ev of root.events){const e=obj(ev),name=String(e.name??''),eventId=id(e.id),date=iso(e.date);
  // ESPN's UFC league includes DWCS; those bouts are outside this UFC-only model.
  if(/contender|road to ufc|ultimate fighter/i.test(name))continue;
  if(!/\bUFC\b/i.test(name)||!eventId||!date)throw Error('UFC_EVENT_IDENTITY');
  const comps=array(e.competitions);const starts=[date,...comps.map(c=>iso(obj(c).date)).filter((s):s is string=>!!s)];const scheduledAt=starts.sort()[0];
  for(const item of comps){const b=obj(item),boutId=id(b.id),cs=array(b.competitors).map(obj).sort((a,b)=>String(a.id).localeCompare(String(b.id))),status=obj(obj(b.status).type),state=String(status.state??''),stateName=String(status.name??'');
   if(!boutId||seen.has(boutId)||cs.length!==2)throw Error('UFC_BOUT_IDENTITY');seen.add(boutId);
   const aId=id(cs[0].id),bId=id(cs[1].id),a=String(obj(cs[0].athlete).fullName??''),c=String(obj(cs[1].athlete).fullName??'');
   if(!aId||!bId||aId===bId||!a||!c||fighterKey(a)===fighterKey(c))throw Error('UFC_ATHLETE_IDENTITY');
   const winners=cs.filter(c=>c.winner===true);if(winners.length>1)throw Error('UFC_TWO_WINNERS');
   const cancelled=/CANCEL|POSTPON|NO_CONTEST/.test(stateName);const st:UfcBout['status']=cancelled?'CANCELLED':status.completed===true&&state==='post'?'FINAL':state==='pre'?'SCHEDULED':state==='in'?'LIVE':'UNKNOWN';
   out.push({id:boutId,eventId,eventName:name,scheduledAt,boutTime:iso(b.date)??scheduledAt,a,b:c,aId,bId,status:st,winnerId:st==='FINAL'&&winners.length===1?String(winners[0].id):null,cardComplete:obj(obj(e.status).type).completed===true});
  }
 }return out.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id));
}
const american=(o:unknown)=>typeof o==='number'&&Number.isInteger(o)&&Math.abs(o)>=100&&Math.abs(o)<=100000?o:null;
export const decimalOdds=(o:number)=>o>0?1+o/100:1+100/-o;
export function normalizeUfcQuote(input:unknown,b:UfcBout,at:string):UfcQuote|null{
 if(!iso(at)||Date.parse(at)>=Date.parse(b.scheduledAt)||b.status!=='SCHEDULED')return null;
 const items=array(obj(input).items);const found:UfcQuote[]=[];
 for(const value of items){const v=obj(value),provider=obj(v.provider);if(String(provider.id)!=='100'||provider.name!=='DraftKings')continue;
  const ref=String(v.$ref??'');if(!ref.includes(`/events/${b.eventId}/competitions/${b.id}/odds/100?`))continue;
  const sides=[obj(v.homeAthleteOdds),obj(v.awayAthleteOdds)],mapped=new Map<string,number>();
  for(const s of sides){const ref=String(obj(s.athlete).$ref??''),aid=ref.match(/\/athletes\/(\d+)(?:\?|$)/)?.[1],current=obj(obj(s.current).moneyLine),o=american(Number(current.american));if(!aid||o===null||american(s.moneyLine)!==o)continue;mapped.set(aid,o);}
  if(mapped.size!==2||!mapped.has(b.aId)||!mapped.has(b.bId))continue;
  const aOdds=mapped.get(b.aId)!,bOdds=mapped.get(b.bId)!;
  if(1/decimalOdds(aOdds)+1/decimalOdds(bOdds)<.98||1/decimalOdds(aOdds)+1/decimalOdds(bOdds)>1.4)continue;
  found.push({boutId:b.id,eventId:b.eventId,aId:b.aId,bId:b.bId,aOdds,bOdds,book:'DraftKings',capturedAt:at});
 }return found.length===1?found[0]:null;
}
export function ratingsWithRecent(seed:[string,Rating][],history:UfcBout[],at:string){
 const ratings=new Map(seed.map(([id,r])=>[id,{...r}])),uncertain=new Set<string>(),byDate=new Map<string,UfcBout[]>(),identity=new Map<string,Set<string>>();
 for(const b of history){for(const [name,id] of [[b.a,b.aId],[b.b,b.bId]]){const key=fighterKey(name);identity.set(key,new Set([...(identity.get(key)??[]),id]));}
  if(b.cardComplete&&b.scheduledAt<at&&b.scheduledAt.slice(0,10)>'2026-05-16')byDate.set(b.scheduledAt.slice(0,10),[...(byDate.get(b.scheduledAt.slice(0,10))??[]),b]);}
 for(const [key,ids] of identity)if(ids.size>1)uncertain.add(key);
 for(const date of [...byDate.keys()].sort()){
  const rows=byDate.get(date)!,facts:BoutFact[]=[],tainted=new Set<string>();
  for(const b of rows){const a=fighterKey(b.a),c=fighterKey(b.b);if(b.status==='FINAL'&&b.winnerId){facts.push({id:b.id,event:b.eventId,date,a:b.a,b:b.b,result:b.winnerId===b.aId?'A':'B'});if(uncertain.has(a)||uncertain.has(c)){tainted.add(a);tainted.add(c);}}
   else if(b.status!=='CANCELLED'){tainted.add(a);tainted.add(c);}}
  updateEloDate(ratings,facts);for(const key of tainted)uncertain.add(key);
 }return {ratings,uncertain};
}
export function freezeUfc(b:UfcBout,ratings:Map<string,Rating>,uncertain:Set<string>,at:string,quote:UfcQuote|null):UfcForecast|null{
 if(!iso(at)||b.status!=='SCHEDULED'||Date.parse(at)>=Date.parse(b.scheduledAt)||[b.a,b.b].some(s=>uncertain.has(fighterKey(s))))return null;
 const p=predictElo(ratings,b.a,b.b);if(!p||p.probabilityA===.5||[p.lastDateA,p.lastDateB].some(d=>d>=b.scheduledAt.slice(0,10)))return null;
 if(quote&&!sameQuote(b,quote))return null;
 const a=p.probabilityA>.5;return {id:UFC_MODEL+':'+b.id,model:UFC_MODEL,bout:b,capturedAt:at,...p,selectedId:a?b.aId:b.bId,selection:(a?b.a:b.b)+' ML',quote};
}
export const sameQuote=(b:UfcBout,q:UfcQuote)=>q.boutId===b.id&&q.eventId===b.eventId&&q.aId===b.aId&&q.bId===b.bId&&q.book==='DraftKings'&&american(q.aOdds)!==null&&american(q.bOdds)!==null&&Date.parse(q.capturedAt)<Date.parse(b.scheduledAt);
export function reconcileUfc(f:UfcForecast,results:UfcResult[],quotes:UfcQuote[]):UfcRow{
 const b=f.bout,valid=results.filter(r=>r.boutId===b.id&&r.eventId===b.eventId&&r.aId===b.aId&&r.bId===b.bId&&Date.parse(r.capturedAt)>Date.parse(b.scheduledAt)),finals=valid.filter(r=>r.status==='FINAL'&&[b.aId,b.bId].includes(r.winnerId??'')),signatures=new Set(finals.map(r=>r.winnerId));
 let outcome:UfcRow['outcome']='OPEN';if(signatures.size>1)outcome='REVIEW';else if(signatures.size===1)outcome=finals[0].winnerId===f.selectedId?'WIN':'LOSS';else if(valid.some(r=>r.status==='CANCELLED'))outcome='CANCELLED';else if(valid.some(r=>r.status==='FINAL'||r.status==='UNKNOWN'))outcome='REVIEW';
 const odds=f.quote?(f.selectedId===b.aId?f.quote.aOdds:f.quote.bOdds):null,profitUnits=odds===null||!['WIN','LOSS'].includes(outcome)?null:outcome==='WIN'?decimalOdds(odds)-1:-1;
 const latestQuote=quotes.filter(q=>sameQuote(b,q)).sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt))[0]??null;
 return {...f,outcome,profitUnits,latestQuote};
}
export function ufcSummary(rows:UfcRow[]):UfcSummary{
 const settled=rows.filter(r=>r.outcome==='WIN'||r.outcome==='LOSS'),wins=settled.filter(r=>r.outcome==='WIN').length,priced=settled.filter(r=>r.profitUnits!==null),profit=priced.length?priced.reduce((s,r)=>s+r.profitUnits!,0):null;
 const losses=settled.length-wins;return {wins,losses,pending:rows.filter(r=>r.outcome==='OPEN').length,review:rows.filter(r=>r.outcome==='REVIEW').length,cancelled:rows.filter(r=>r.outcome==='CANCELLED').length,accuracyPct:settled.length?100*wins/settled.length:null,brier:settled.length?settled.reduce((s,r)=>s+((r.selectedId===r.bout.aId?r.probabilityA:r.probabilityB)-(r.outcome==='WIN'?1:0))**2,0)/settled.length:null,logLoss:settled.length?-settled.reduce((s,r)=>{const p=r.selectedId===r.bout.aId?r.probabilityA:r.probabilityB;return s+Math.log(r.outcome==='WIN'?p:1-p);},0)/settled.length:null,pricedSettled:priced.length,conditionalProfitUnits:profit,conditionalRoiPct:profit===null?null:100*profit/priced.length};
}
export function ufcCohort(r:UfcReport):ModelCohort{return {key:UFC_MODEL,label:'UFC · Elo prospectivo FREE',available:r.status==='AVAILABLE',wins:r.status==='AVAILABLE'?r.summary.wins:null,losses:r.status==='AVAILABLE'?r.summary.losses:null,pending:r.status==='AVAILABLE'?r.summary.pending:null,pushes:0,voids:0,models:1,accuracy:r.summary.accuracyPct===null?null:r.summary.accuracyPct/100,note:'SHADOW; solo predicciones archivadas antes del inicio. Retrospectiva separada; resultados ambiguos excluidos.'};}
export function emptyUfc():UfcReport{return {status:'UNAVAILABLE',classification:'SHADOW / RESEARCH',readAt:new Date().toISOString(),latestRunAt:null,health:'UNAVAILABLE',issues:['Esperando captura gratuita verificada.'],bouts:[],forecasts:[],summary:ufcSummary([]),abstentions:[],providerCalls:0,databaseWrites:0};}

export function calendarCoverage(raw:unknown,bouts:UfcBout[],at:string){
 const r=raw as {leagues?:{calendar?:{label?:string;startDate?:string;event?:{$ref?:string}}[]}[]};const calendar=r.leagues?.[0]?.calendar;if(!Array.isArray(calendar)||!calendar.length)return false;
 const known=new Set(bouts.map(b=>b.eventId));return calendar.filter(c=>!/contender|road to ufc|ultimate fighter/i.test(c.label??'')&&Date.parse(c.startDate??'')>=Date.parse('2026-05-17T00:00:00Z')&&Date.parse(c.startDate??'')<Date.parse(at)).every(c=>{const event=c.event?.$ref?.match(/\/events\/(\d+)/)?.[1];return !!event&&known.has(event);});
}
