import {buildElo,predictElo,type BoutFact} from '../ufc/elo-v2';
import {decimalOdds} from '../ufc/free-v2';
import type {ModelCohort} from '../sport-model-overview';

export const LEAGUES=['NFL','ATP','WTA','BSN'] as const;
export type League=typeof LEAGUES[number];
export const SPORT_LEAGUES={nfl:['NFL'],tennis:['ATP','WTA'],bsn:['BSN']} as const;
export type Sport=keyof typeof SPORT_LEAGUES;
export const SPORT_NAMES={nfl:'NFL',tennis:'Tenis',bsn:'BSN'};
export const modelId=(league:League)=>league+'_FREE_ELO_K32_SHADOW_V1';
export const dateOffset=(date:Date,days:number)=>new Date(date.getTime()+days*86400000).toISOString().slice(0,10);
export const market='Ganador del partido';
export type Party={id:string;name:string};
export type Quote={book:'DraftKings';a:number;b:number;capturedAt:string};
export type Fixture={id:string;start:string;a:Party;b:Party;state:'PRE'|'LIVE'|'FINAL'|'TIE'|'EXCLUDED';winner:string|null;reason:string|null;quote:Quote|null};
export type Forecast={event:Fixture;league:League;issuedAt:string;probabilityA:number;priorA:number;priorB:number;selectedId:string};
export type Observation={event_id:string;start_at:string;a_id:string;b_id:string;outcome:string;observed_at:string};
export type Outcome='OPEN'|'AWAITING_RESULT'|'WIN'|'LOSS'|'EXCLUDED'|'REVIEW';
export type Settled={forecast:Forecast;outcome:Outcome;profit:number|null;price:number|null};

const ratingKey=(id:string)=>'id'+Array.from(id,c=>c.codePointAt(0)!.toString(16).padStart(6,'0')).join('');
export function issueForecasts(league:League,events:Fixture[],observedAt:string,issuedAt:string){
 const day=issuedAt.slice(0,10);
 const facts:BoutFact[]=events.filter(e=>e.state==='FINAL'&&e.start.slice(0,10)<day&&e.start<observedAt).map(e=>({
  id:e.id,event:league,date:e.start.slice(0,10),a:ratingKey(e.a.id),b:ratingKey(e.b.id),result:e.winner===e.a.id?'A':'B',
 }));
 const ratings=buildElo(facts);
 const through=dateOffset(new Date(issuedAt),league==='NFL'?10:7);
 return events.flatMap((event):Forecast[]=>{
  if(event.state!=='PRE'||observedAt>issuedAt||issuedAt>=event.start||event.start.slice(0,10)>through)return [];
  const p=predictElo(ratings,ratingKey(event.a.id),ratingKey(event.b.id));
  if(!p||p.probabilityA===.5)return [];
  return [{event,league,issuedAt,probabilityA:p.probabilityA,priorA:p.priorA,priorB:p.priorB,selectedId:p.probabilityA>.5?event.a.id:event.b.id}];
 });
}
export function resolve(forecast:Forecast,observations:Observation[],now:string):Settled{
 const e=forecast.event, q=e.quote;
 const price=q&&q.capturedAt<=forecast.issuedAt&&forecast.issuedAt<e.start?(forecast.selectedId===e.a.id?q.a:q.b):null;
 const eligible=observations.filter(o=>o.observed_at>=forecast.issuedAt);
 const invalid=eligible.some(o=>!sameIdentity(e,o)||!['EXCLUDED','TIE',e.a.id,e.b.id].includes(o.outcome));
 const outcomes=new Set(eligible.map(o=>o.outcome));
 const settled=outcomes.values().next().value;
 let outcome:Outcome;
 if(invalid||outcomes.size>1)outcome='REVIEW';
 else if(!settled)outcome=e.start>now?'OPEN':'AWAITING_RESULT';
 else if(settled==='TIE'||settled==='EXCLUDED')outcome='EXCLUDED';
 else outcome=settled===forecast.selectedId?'WIN':'LOSS';
 const profit=price===null?null:outcome==='WIN'?decimalOdds(price)-1:outcome==='LOSS'?-1:null;
 return {forecast,outcome,profit,price};
}
export function sameIdentity(e:Fixture,o:Pick<Observation,'start_at'|'a_id'|'b_id'>){
 return Date.parse(o.start_at)===Date.parse(e.start)&&
  ((e.a.id===o.a_id&&e.b.id===o.b_id)||(e.a.id===o.b_id&&e.b.id===o.a_id));
}
export function metrics(rows:Settled[]){
 const wins=rows.filter(r=>r.outcome==='WIN').length,losses=rows.filter(r=>r.outcome==='LOSS').length;
 const excluded=rows.filter(r=>r.outcome==='EXCLUDED').length,review=rows.filter(r=>r.outcome==='REVIEW').length;
 const pending=rows.length-wins-losses-excluded-review;
 const priced=rows.filter(r=>r.profit!==null),profit=priced.reduce((sum,r)=>sum+r.profit!,0);
 return {wins,losses,excluded,review,pending,accuracy:wins+losses?100*wins/(wins+losses):null,
  priced:priced.length,profit:priced.length?profit:null,roi:priced.length?100*profit/priced.length:null};
}
export type LeagueReport={league:League;status:'AVAILABLE'|'WAITING'|'UNAVAILABLE';sourceAt:string|null;history:number;upcoming:Fixture[];rows:Settled[];metrics:ReturnType<typeof metrics>};
export function cohort(report:LeagueReport):ModelCohort{
 const m=report.metrics,available=report.status!=='UNAVAILABLE';
 return {key:modelId(report.league),label:report.league+' · Elo SHADOW',available,wins:available?m.wins:null,losses:available?m.losses:null,pending:available?m.pending:null,pushes:null,voids:null,models:available?1:null,accuracy:m.accuracy,
  note:report.league==='BSN'?'Calendario futuro sujeto a una fuente atestada.':m.roi===null?'ROI simulado: sin pronósticos liquidados con cuota.':'ROI simulado: '+m.roi.toFixed(2)+'% · '+m.priced+' con cuota.'};
}
