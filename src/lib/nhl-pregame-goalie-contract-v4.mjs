// Next-match goalie evidence only: explicit sourced, timestamped status.
// Previous starting goalie or predicted probable is never silently promoted to confirmed.
export const NHL_GOALIE_SOURCE_VERSION='NHL_PREGAME_GOALIE_CONTRACT_V4';
const ms=x=>{const n=Date.parse(String(x??''));return Number.isFinite(n)?n:null;};
const reject=(reason)=>({status:'UNVERIFIED',reason,confirmedPregameStarter:false,modelScoringAdjusted:false});
export function classifyNhlPregameGoalie({event,observation,asOf}){
 const tip=ms(event?.scheduledAt),now=ms(asOf),published=ms(observation?.publishedAt),
   captured=ms(observation?.capturedAt);
 if(tip===null||now===null||published===null||captured===null||
   tip-now<60*60000||published>captured||captured>now||now-published>18*3600000)
  return reject('SOURCE_TIMING_UNVERIFIED');
 if(!/^nhl:202602\d{4}$/.test(String(event?.eventId??''))||
   observation?.eventId!==event.eventId||!Number.isSafeInteger(event.homeId)||
   !Number.isSafeInteger(event.awayId)||event.homeId===event.awayId)
  return reject('EVENT_IDENTITY_UNVERIFIED');
 if(observation?.teamId!==event.homeId&&observation?.teamId!==event.awayId)
  return reject('TEAM_IDENTITY_UNVERIFIED');
 if(!Number.isSafeInteger(observation?.goalieId)||observation.goalieId<=0)
  return reject('GOALIE_IDENTITY_UNVERIFIED');
 if(!['probable','confirmed'].includes(observation?.status))
  return reject('SOURCE_CLASSIFICATION_UNSUPPORTED');
 const source=String(observation?.sourceName??'').trim();
 const ref=String(observation?.sourceArticleUrl??'').trim();
 if(!source||!/^https:\/\/[a-z0-9.-]+\/\S+$/i.test(ref))return reject('ATTRIBUTION_UNVERIFIED');
 const confirmed=observation.status==='confirmed'&&observation?.sourceSaysStart===true&&
  observation?.identityCrosswalkVerified===true;
 return {status:confirmed?'SOURCE_CONFIRMED_STARTER':'PROBABLE_ONLY',
  version:NHL_GOALIE_SOURCE_VERSION,eventId:event.eventId,teamId:observation.teamId,
  goalieId:observation.goalieId,publishedAt:new Date(published).toISOString(),
  capturedAt:new Date(captured).toISOString(),sourceName:source,sourceArticleUrl:ref,
  confirmedPregameStarter:confirmed,modelScoringAdjusted:false,officialPick:false,
  warning:'Confirmed classification requires explicit source start statement and verified stable goalie ID. No implied starter from historic game.'};
}
export function assessNhlGoaltenderCoverage({observations,events,asOf}){
 const result=[];
 for(const event of Array.isArray(events)?events:[]){
  const rows=(Array.isArray(observations)?observations:[])
   .map(x=>classifyNhlPregameGoalie({event,observation:x,asOf}))
   .filter(x=>x.status==='SOURCE_CONFIRMED_STARTER'||x.status==='PROBABLE_ONLY');
  const home=rows.filter(x=>x.teamId===event.homeId),away=rows.filter(x=>x.teamId===event.awayId);
  result.push({eventId:event.eventId,confirmedBoth:home.some(x=>x.confirmedPregameStarter)&&away.some(x=>x.confirmedPregameStarter),
   homeConfirmed:home.some(x=>x.confirmedPregameStarter),awayConfirmed:away.some(x=>x.confirmedPregameStarter),
   probableRows:rows.filter(x=>x.status==='PROBABLE_ONLY').length});
 }
 return {status:'NO_AUTOMATIC_GOALIE_SOURCE_CERTIFIED',version:NHL_GOALIE_SOURCE_VERSION,
   eventCounts:result.length,confirmedBoth:result.filter(x=>x.confirmedBoth).length,
   audit:result,sourceCalls:0,dbWrites:0,modelAdjusted:false};
}
