import type {PublicNhlForecast} from './nhl-free-source';
import type {NhlLegacyAvailableReport} from './nhl-external-report';
export const NHL_FREE_MODEL='DRATINGS_PUBLIC_ARGMAX_V1' as const;
export type NhlGame={eventId:string;eventName:string;scheduledAt:string;status:string;away:string;home:string;awayId:number;homeId:number;awayScore:number|null;homeScore:number|null};
export type NhlFreeForecast={id:string;eventId:string;eventName:string;scheduledAt:string;capturedAt:string;away:string;home:string;awayId:number;homeId:number;awayProbability:number;homeProbability:number;awayOdds:number|null;homeOdds:number|null;awayEdgePp:number|null;homeEdgePp:number|null;model:'DRATINGS_PUBLIC_V1';sportsbook:'CIRCA'|null;sourceUrl:string};
export type NhlFreeFinal={eventId:string;scheduledAt:string;awayId:number;homeId:number;awayScore:number;homeScore:number;capturedAt:string};
type LegacyPick=NhlLegacyAvailableReport['history'][number];
export type NhlFreePick=Omit<LegacyPick,'odds'|'settlement'> & {odds:number|null;settlement:(Omit<NonNullable<LegacyPick['settlement']>,'profitUnits'> & {profitUnits:number|null})|null};
export type NhlFreeAvailableReport=Omit<NhlLegacyAvailableReport,'schema'|'source'|'history'|'forecasts'> & {schema:'NHL_FREE_DIRECT_V1';source:'PICK_ANALYZER';history:NhlFreePick[];forecasts:NhlFreeForecast[]};
export const nhlSportsDate=(s:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'?v as Record<string,unknown>:{};
const localized=(v:unknown)=>String(object(v).default??'');
export function normalizeNhlScore(input:unknown):NhlGame[]{
 const raw=object(input);if(!Array.isArray(raw.games))throw Error('NHL_SCHEDULE_SCHEMA');
 const seen=new Set<string>();return raw.games.map(item=>{
  const g=object(item),a=object(g.awayTeam),h=object(g.homeTeam),tip=String(g.startTimeUTC??'');
  const teamName=(t:Record<string,unknown>)=>localized(t.name)||[localized(t.placeName),localized(t.commonName)].filter(Boolean).join(' ');
  const away=teamName(a),home=teamName(h),eventId='nhl:'+g.id;
  if(!Number.isSafeInteger(g.id)||!Number.isSafeInteger(a.id)||!Number.isSafeInteger(h.id)||a.id===h.id||!away||!home||!Number.isFinite(Date.parse(tip))||seen.has(eventId))throw Error('NHL_SCHEDULE_IDENTITY');seen.add(eventId);
  const states:Record<string,string>={FUT:'SCHEDULED',PRE:'SCHEDULED',LIVE:'LIVE',CRIT:'LIVE',OFF:'FINAL',FINAL:'FINAL',PPD:'POSTPONED',CANC:'CANCELLED'};
  const score=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0?v:null;
  return {eventId,eventName:away+' @ '+home,scheduledAt:new Date(tip).toISOString(),status:states[String(g.gameState)]??'UNKNOWN',away,home,awayId:Number(a.id),homeId:Number(h.id),awayScore:score(a.score),homeScore:score(h.score)};
 });
}
const name=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
export function matchFreeNhl(f:PublicNhlForecast,games:NhlGame[],at:string){
 const matches=games.filter(g=>g.status==='SCHEDULED'&&Date.parse(g.scheduledAt)>Date.parse(at)&&Date.parse(f.scheduledAt)>Date.parse(at)&&Math.abs(Date.parse(g.scheduledAt)-Date.parse(f.scheduledAt))<=15*60000&&name(g.away)===name(f.awayName)&&name(g.home)===name(f.homeName));
 return matches.length===1?matches[0]:null;
}
export const nhlImplied=(o:number)=>o>0?100/(o+100):-o/(-o+100);
export function freezeNhlForecast(g:NhlGame,f:PublicNhlForecast,at:string,prices:{awayOdds:number;homeOdds:number}|null):NhlFreeForecast|null{
 if(!matchFreeNhl(f,[g],at)||!Number.isFinite(Date.parse(at))||f.awayProbability===f.homeProbability)return null;
 if([f.awayProbability,f.homeProbability].some(p=>!Number.isFinite(p)||p<=0||p>=1)||Math.abs(f.awayProbability+f.homeProbability-1)>0.002)return null;
 if(prices&&[prices.awayOdds,prices.homeOdds].some(o=>!Number.isInteger(o)||Math.abs(o)<100))return null;
 const ai=prices?nhlImplied(prices.awayOdds):null,hi=prices?nhlImplied(prices.homeOdds):null;
 return {id:NHL_FREE_MODEL+':'+g.eventId,eventId:g.eventId,eventName:g.eventName,scheduledAt:g.scheduledAt,capturedAt:at,away:g.away,home:g.home,awayId:g.awayId,homeId:g.homeId,awayProbability:f.awayProbability,homeProbability:f.homeProbability,awayOdds:prices?.awayOdds??null,homeOdds:prices?.homeOdds??null,awayEdgePp:ai===null||hi===null?null:100*(f.awayProbability-ai/(ai+hi)),homeEdgePp:ai===null||hi===null?null:100*(f.homeProbability-hi/(ai+hi)),model:'DRATINGS_PUBLIC_V1',sportsbook:prices?'CIRCA':null,sourceUrl:f.detailUrl};
}
export function finalNhl(g:NhlGame,at:string):NhlFreeFinal|null{
 if(g.status!=='FINAL'||g.awayScore===null||g.homeScore===null||g.awayScore===g.homeScore||Date.parse(g.scheduledAt)>=Date.parse(at))return null;
 return {eventId:g.eventId,scheduledAt:g.scheduledAt,awayId:g.awayId,homeId:g.homeId,awayScore:g.awayScore,homeScore:g.homeScore,capturedAt:at};
}
export function reconcileFreeNhl(f:NhlFreeForecast,finals:NhlFreeFinal[]):NhlFreePick{
 const away=f.awayProbability>f.homeProbability,p=away?f.awayProbability:f.homeProbability,o=away?f.awayOdds:f.homeOdds;
 const valid=finals.filter(x=>x.eventId===f.eventId&&x.scheduledAt===f.scheduledAt&&x.awayId===f.awayId&&x.homeId===f.homeId&&Number.isInteger(x.awayScore)&&Number.isInteger(x.homeScore)&&x.awayScore>=0&&x.homeScore>=0&&x.awayScore!==x.homeScore&&Date.parse(x.capturedAt)>Date.parse(f.scheduledAt));
 const signatures=new Set(valid.map(x=>x.awayScore+':'+x.homeScore));
 const outcome=signatures.size===1?valid[0]:null;
 const win=outcome?away===(outcome.awayScore>outcome.homeScore):false;
 return {id:f.id,eventId:f.eventId,eventName:f.eventName,scheduledAt:f.scheduledAt,createdAt:f.capturedAt,direction:(away?f.away:f.home)+' ML',odds:o,modelProbability:p,edgePp:away?f.awayEdgePp:f.homeEdgePp,tier:'SHADOW',quality:signatures.size>1?'REVIEW_CONFLICTING_FINALS':'FORWARD_CAPTURE',classification:'MODEL_ONLY',status:outcome?'SETTLED':'ACTIVE',locked:true,sportsbook:f.sportsbook,model:NHL_FREE_MODEL,settlement:outcome?{outcome:win?'WIN':'LOSS',profitUnits:o===null?null:win?(o>0?o/100:100/-o):-1,result:`${f.away} ${outcome.awayScore} — ${f.home} ${outcome.homeScore} · final incluye OT/SO`,settledAt:outcome.capturedAt}:null};
}
export function freeNhlMetrics(history:NhlFreePick[]):NhlFreeAvailableReport['summary']{
 const wins=history.filter(p=>p.settlement?.outcome==='WIN').length,losses=history.filter(p=>p.settlement?.outcome==='LOSS').length;
 const priced=history.filter(p=>p.settlement?.profitUnits!==null&&p.settlement!==null),profit=priced.length?priced.reduce((s,p)=>s+p.settlement!.profitUnits!,0):null;
 return {settled:wins+losses,wins,losses,pushes:0,voids:0,pending:history.length-wins-losses,accuracyPct:wins+losses?100*wins/(wins+losses):null,profitUnits:profit,roiPct:profit===null?null:100*profit/priced.length,staked:priced.length};
}
// Fail closed when a stored forward observation is malformed; never repair historical values on read.
export function verifyFreeNhlForecast(f:NhlFreeForecast){
 if(f.id!==NHL_FREE_MODEL+':'+f.eventId||!/^nhl:\d+$/.test(f.eventId)||f.model!=='DRATINGS_PUBLIC_V1'||!f.away||!f.home||f.away===f.home||!Number.isSafeInteger(f.awayId)||!Number.isSafeInteger(f.homeId)||f.awayId===f.homeId||!Number.isFinite(Date.parse(f.capturedAt))||!Number.isFinite(Date.parse(f.scheduledAt))||Date.parse(f.capturedAt)>=Date.parse(f.scheduledAt)||[f.awayProbability,f.homeProbability].some(p=>!Number.isFinite(p)||p<=0||p>=1)||Math.abs(f.awayProbability+f.homeProbability-1)>0.002)throw Error('NHL_STORED_FORECAST_INVALID');
 if((f.awayOdds===null)!==(f.homeOdds===null)||[f.awayOdds,f.homeOdds].some(o=>o!==null&&(!Number.isInteger(o)||Math.abs(o)<100))||f.sportsbook!==(f.awayOdds===null?null:'CIRCA'))throw Error('NHL_STORED_PRICE_INVALID');
 const ai=f.awayOdds===null?null:nhlImplied(f.awayOdds),hi=f.homeOdds===null?null:nhlImplied(f.homeOdds);
 for(const [actual,expected] of [[f.awayEdgePp,ai===null||hi===null?null:100*(f.awayProbability-ai/(ai+hi))],[f.homeEdgePp,ai===null||hi===null?null:100*(f.homeProbability-hi/(ai+hi))]])if(expected===null?actual!==null:actual===null||!Number.isFinite(actual)||Math.abs(actual-expected)>1e-9)throw Error('NHL_STORED_EDGE_INVALID');
 return f;
}
