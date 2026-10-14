import type { NhlAvailableReport } from "./nhl-external-report";
export const nhlDate=(s:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Puerto_Rico",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(s));
export function nhlOpportunities(r:NhlAvailableReport){
  const now=Date.parse(r.readAt),run=r.health.latestRunAt?Date.parse(r.health.latestRunAt):NaN;
  if(r.health.status!=="PASS"||!Number.isFinite(run)||now-run>45*60000||run>now+5000)return [];
  return r.forecasts.filter(f=>Date.parse(f.scheduledAt)>now&&now-Date.parse(f.capturedAt)<=45*60000).flatMap(f=>[
    {key:f.id+":AWAY",eventName:f.eventName,selection:f.away+" ML",probability:f.awayProbability,odds:f.awayOdds,edgePp:f.awayEdgePp,capturedAt:f.capturedAt},
    {key:f.id+":HOME",eventName:f.eventName,selection:f.home+" ML",probability:f.homeProbability,odds:f.homeOdds,edgePp:f.homeEdgePp,capturedAt:f.capturedAt},
  ]).filter(f=>f.edgePp>0).sort((a,b)=>b.edgePp-a.edgePp||a.key.localeCompare(b.key));
}
export function filterNhlHistory(r:NhlAvailableReport,date:string,outcome:string){return r.history.filter(p=>(!date||nhlDate(p.scheduledAt)===date)&&(outcome==="ALL"||(p.settlement?.outcome??(p.status==="ACTIVE"?"OPEN":p.status))===outcome));}
