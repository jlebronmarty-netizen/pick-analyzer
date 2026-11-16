// NHL free ESPN goalie probable evidence, strictly separate from confirmed starter status.
export const NHL_ESPN_GOALIE_VERSION='NHL_ESPN_FREE_PROBABLE_V5';
const time=v=>{const x=Date.parse(String(v??''));return Number.isFinite(x)?x:null;};
const normalize=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const positiveId=x=>/^\d{1,15}$/.test(String(x??''))?String(x):null;
const blocked=reason=>({status:'NOT_READY',reason,version:NHL_ESPN_GOALIE_VERSION,
 confirmedStarter:false,modelAdjustment:null});
function goalie(competitor){
 const probable=competitor?.probables;
 if(!Array.isArray(probable)||probable.length!==1)return null;
 const p=probable[0],a=p?.athlete,id=positiveId(a?.id);
 const name=String(a?.displayName??'').trim();
 if(!id||name.length<5||name.length>100||p?.name!=='probableStartingGoalie'||p?.abbreviation!=='SG'||
  (a?.position?.abbreviation&&a.position.abbreviation!=='G'))return null;
 return {sourceAthleteId:id,displayName:name,status:'PROBABLE_ONLY',
  sourceAthleteIdIsNhlPlayerId:false,sourceConfirmationVerified:false};
}
export function parseEspnNhlFreeProbables({payload,officialSchedule,capturedAt}){
 const at=time(capturedAt);
 if(at===null||!Array.isArray(payload?.events)||!Array.isArray(officialSchedule))
  return blocked('ESPN_OR_NHL_SCHEDULE_UNAVAILABLE');
 if(payload.events.length>30||officialSchedule.length>30)return blocked('SOURCE_SIZE_CAP_EXCEEDED');
 const schedule=officialSchedule.filter(g=>g?.status==='SCHEDULED'&&
  /^nhl:202602\d{4}$/.test(String(g?.eventId??''))&&
  Number.isSafeInteger(g.homeId)&&Number.isSafeInteger(g.awayId)&&g.homeId!==g.awayId);
 const found=[],seen=new Set();
 for(const espnEvent of payload.events){
  const comp=Array.isArray(espnEvent?.competitions)?espnEvent.competitions[0]:null;
  const sides=comp?.competitors,espnAt=time(espnEvent?.date);
  if(!Array.isArray(sides)||sides.length!==2||espnAt===null||
    espnEvent?.status?.type?.name!=='STATUS_SCHEDULED')continue;
  const home=sides.find(c=>c.homeAway==='home'),away=sides.find(c=>c.homeAway==='away');
  if(!home||!away||!home.team?.displayName||!away.team?.displayName)continue;
  const matches=schedule.filter(g=>time(g.scheduledAt)!==null&&
   Math.abs(time(g.scheduledAt)-espnAt)<=15*60000&&
   normalize(g.home)===normalize(home.team.displayName)&&
   normalize(g.away)===normalize(away.team.displayName)&&
   at<=time(g.scheduledAt)-60*60000);
  if(matches.length!==1||seen.has(matches[0].eventId))continue;
  const h=goalie(home),a=goalie(away);
  if(!h&&!a)continue;
  const event=matches[0];seen.add(event.eventId);
  found.push({eventId:event.eventId,scheduledAt:event.scheduledAt,
   homeTeamId:event.homeId,awayTeamId:event.awayId,
   homeName:event.home,awayName:event.away,
   espnEventId:positiveId(espnEvent.id),homeProbable:h,awayProbable:a,
   confirmedHome:false,confirmedAway:false,
   sourceObservedAt:new Date(at).toISOString(),
   sourceName:'ESPN_PUBLIC_SCOREBOARD',sourceCategory:'UNCONFIRMED_PROBABLE'});
 }
 return {status:found.length?'FREE_PREGAME_PROBABLES_OBSERVED':'NO_ELIGIBLE_PREGAME_PROBABLES',
  version:NHL_ESPN_GOALIE_VERSION,capturedAt:new Date(at).toISOString(),games:found,
  source:'ESPN_PUBLIC_SCOREBOARD',sourcePublicationTimeVerified:false,
  probableIsConfirmed:false,modelAdjusted:false,providerCalls:0};
}
export function selectEspnNhlProbablesAsOf({snapshots,game,decisionAt}){
 const decision=time(decisionAt),tip=time(game?.scheduledAt);
 if(decision===null||tip===null||tip-decision<60*60000)return blocked('PREGAME_CUTOFF_FAILED');
 if(!Array.isArray(snapshots))return blocked('NO_GOALIE_SNAPSHOT_SOURCE');
 const candidate=snapshots
  .filter(s=>s?.source_version===NHL_ESPN_GOALIE_VERSION&&
    typeof s.raw_sha256==='string'&&/^[0-9a-f]{64}$/.test(s.raw_sha256)&&
    time(s.captured_at)!==null&&time(s.captured_at)<=decision&&
    decision-time(s.captured_at)<=24*3600000&&
    Array.isArray(s.games))
  .sort((a,b)=>time(b.captured_at)-time(a.captured_at))
  .flatMap(s=>s.games.filter(g=>g.eventId===game.eventId&&
    g.scheduledAt===game.scheduledAt&&g.homeTeamId===game.homeId&&
    g.awayTeamId===game.awayId&&normalize(g.homeName)===normalize(game.home)&&
    normalize(g.awayName)===normalize(game.away))
    .map(g=>({g,s}))).at(0);
 if(!candidate)return blocked('NO_VERIFIED_ASOF_PROBABLES');
 const {g,s}=candidate;
 return {status:'PREGAME_PROBABLE_SOURCE_ONLY',version:NHL_ESPN_GOALIE_VERSION,
  observedAt:s.captured_at,sourceSnapshotId:s.id,
  home:g.homeProbable??null,away:g.awayProbable??null,
  confirmedHome:false,confirmedAway:false,sourcePublicationTimeVerified:false,
  goalieNhlIdentityCrosswalkVerified:false,source:'ESPN_PUBLIC_SCOREBOARD',
  modelAdjusted:false,officialPicksChanged:false,
  warning:'ESPN probables are projections, not official confirmed starters; athlete IDs are ESPN IDs.'};
}
