import {verifyFreeNhlForecast,type NhlFreeForecast,type NhlGame} from './nhl-free';
export const NHL_QUOTE_FRESH_MS=45*60000;
export type NhlQuoteAttempt={eventId:string;capturedAt:string;status:'PAIRED'|'NO_PAIR'|'FAILED';sourceId:string|null};
export type NhlQuoteCoverage={book:'CIRCA';paired:number;eligible:number;missing:string[];latestCapturedAt:string|null};
const hasPair=(f:NhlFreeForecast)=>f.awayOdds!==null&&f.homeOdds!==null&&f.sportsbook==='CIRCA';
export function sameNhlQuoteIdentity(a:NhlFreeForecast,b:NhlFreeForecast){return a.eventId===b.eventId&&a.awayId===b.awayId&&a.homeId===b.homeId&&a.scheduledAt===b.scheduledAt;}
export function rankNhlQuoteTargets(targets:NhlFreeForecast[],latest:NhlFreeForecast[],attempts:NhlQuoteAttempt[],at:string){
 const now=Date.parse(at),prices=new Map(latest.filter(hasPair).map(f=>[f.eventId,f])),last=new Map<string,number>();
 for(const a of attempts){const t=Date.parse(a.capturedAt);if(Number.isFinite(t)&&t<=now+5000)last.set(a.eventId,Math.max(t,last.get(a.eventId)??0));}
 const fresh=(f:NhlFreeForecast)=>{const p=prices.get(f.eventId);return !!p&&sameNhlQuoteIdentity(f,p)&&Date.parse(p.capturedAt)<=now+5000&&now-Date.parse(p.capturedAt)<=NHL_QUOTE_FRESH_MS;};
 return targets.filter(f=>Date.parse(f.scheduledAt)>now).slice().sort((a,b)=>Number(fresh(a))-Number(fresh(b))||(last.get(a.eventId)??0)-(last.get(b.eventId)??0)||a.scheduledAt.localeCompare(b.scheduledAt)||a.eventId.localeCompare(b.eventId));
}
// Carry an entire contemporaneous forecast+price snapshot; never mix an old price with a new probability.
export function mergeNhlQuoteSnapshots(current:NhlFreeForecast[],latest:NhlFreeForecast[],games:NhlGame[],at:string){
 const now=Date.parse(at),quotes=new Map<string,NhlFreeForecast>();
 for(const q of latest){verifyFreeNhlForecast(q);const game=games.find(g=>g.eventId===q.eventId);
  if(!hasPair(q)||!game||game.status!=='SCHEDULED'||game.scheduledAt!==q.scheduledAt||game.awayId!==q.awayId||game.homeId!==q.homeId||Date.parse(q.scheduledAt)<=now||Date.parse(q.capturedAt)>now+5000||now-Date.parse(q.capturedAt)>NHL_QUOTE_FRESH_MS)continue;
  const prior=quotes.get(q.eventId);if(!prior||q.capturedAt>prior.capturedAt)quotes.set(q.eventId,q);
 }
 return current.map(f=>{const q=quotes.get(f.eventId);return q&&sameNhlQuoteIdentity(f,q)&&(!hasPair(f)||q.capturedAt>f.capturedAt)?q:f;});
}
export function nhlQuoteCoverage(forecasts:NhlFreeForecast[],games:NhlGame[],at:string):NhlQuoteCoverage{
 const now=Date.parse(at),eligible=games.filter(g=>g.status==='SCHEDULED'&&Date.parse(g.scheduledAt)>now);
 const quoted=eligible.filter(g=>forecasts.some(f=>f.eventId===g.eventId&&g.scheduledAt===f.scheduledAt&&g.awayId===f.awayId&&g.homeId===f.homeId&&hasPair(f)&&Date.parse(f.capturedAt)<=now+5000&&now-Date.parse(f.capturedAt)<=NHL_QUOTE_FRESH_MS));
 return {book:'CIRCA',paired:quoted.length,eligible:eligible.length,missing:eligible.filter(g=>!quoted.includes(g)).map(g=>g.eventName),latestCapturedAt:forecasts.filter(f=>quoted.some(g=>g.eventId===f.eventId)).map(f=>f.capturedAt).sort().at(-1)??null};
}
