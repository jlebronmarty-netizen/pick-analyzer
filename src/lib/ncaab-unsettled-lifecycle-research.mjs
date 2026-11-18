// Pure, read-only NCAAB lifecycle review. Deliberately does not grade games,
// change forecast identity, or invent settlements for rescheduled fixtures.
const ms=v=>{const n=Date.parse(String(v??''));return Number.isFinite(n)?n:null};
const bad=(reason)=>({status:'REVIEW_SOURCE_CONFLICT',reason,settlement:null,officialPick:false});
const done=(status,reason,latest=null)=>({status,reason,latest:latest?{
 event_id:latest.event_id,scheduled_at:latest.scheduled_at,
 captured_at:latest.captured_at,provider_status:latest.status
}:null,settlement:null,officialPick:false});
export function classifyNcaabUnsettled(forecast,observations,{toleranceMinutes=120}={}){
 if(!Number.isInteger(toleranceMinutes)||toleranceMinutes<0||toleranceMinutes>120)
   throw Error('NCAAB_UNSAFE_TOLERANCE');
 const id=String(forecast?.event_id??''),tip=ms(forecast?.scheduled_at);
 const home=String(forecast?.home_id??''),away=String(forecast?.away_id??'');
 if(!/^espn:\d+$/.test(id)||tip==null||!home||!away||home===away)
   return bad('INVALID_FROZEN_CONTRACT');
 if(!Array.isArray(observations)||!observations.length)return done('PENDING_SOURCE','NO_PROVIDER_OBSERVATION');
 const verified=[];
 for(const o of observations){
  if(!o||o.event_id!==id)return bad('EVENT_ID_CONFLICT');
  const t=ms(o.scheduled_at),at=ms(o.captured_at);
  if(t==null||at==null)return bad('INVALID_PROVIDER_TIMESTAMPS');
  const h=String(o.home_id??''),a=String(o.away_id??'');
  if(!h||!a||h===a||!((h===home&&a===away)||(h===away&&a===home)))
   return bad('TEAM_IDENTITY_CONFLICT');
  if(!['STATUS_POSTPONED','STATUS_CANCELED','STATUS_CANCELLED','STATUS_SCHEDULED','STATUS_FINAL'].includes(o.status))
   return bad('UNKNOWN_PROVIDER_STATUS');
  verified.push(o);
 }
 verified.sort((a,b)=>ms(a.captured_at)-ms(b.captured_at));
 const latest=verified.at(-1),drift=Math.abs(ms(latest.scheduled_at)-tip);
 if(latest.status==='STATUS_CANCELED'||latest.status==='STATUS_CANCELLED')
   return done('REVIEW_CANCELLED','NO_FINAL_PERMITTED',latest);
 if(latest.status==='STATUS_POSTPONED')
   return done('REVIEW_POSTPONED','POSTPONED_IS_NOT_A_LOSS',latest);
 if(drift>toleranceMinutes*60000)
   return done('REVIEW_RESCHEDULED','FROZEN_TIME_CHANGED',latest);
 if(latest.status==='STATUS_FINAL')
   return done('REVIEW_FINAL_EXISTING_RECONCILER','ONLY_EXISTING_FINAL_VALIDATION_MAY_GRADE',latest);
 return done('PENDING_FINAL','NO_VERIFIED_FINAL',latest);
}
