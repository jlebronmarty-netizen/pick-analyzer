import {timingSafeEqual} from 'node:crypto';
export function checkNbaDecisionCronRequest({
 authorization,secret,environment,enabled,search,now,mode
}={}){
 if(typeof secret!=='string'||secret.length<12||typeof authorization!=='string')
  return {status:'AUTH_REQUIRED',http:401};
 const expected=Buffer.from('Bearer '+secret),got=Buffer.from(authorization);
 if(got.length!==expected.length||!timingSafeEqual(got,expected))
  return {status:'UNAUTHORIZED',http:401};
 if(search)return {status:'NO_PARAMETERS_ALLOWED',http:400};
 if(environment!=='production')return {status:'PRODUCTION_ONLY',http:404};
 if(enabled!=='true')return {status:'SHADOW_DISABLED',http:200};
 const date=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(date.getTime()))return {status:'CLOCK_INVALID',http:503};
 const hour=date.getUTCHours(),minute=date.getUTCMinutes();
 const isFreeze=(hour===15||hour===23)&&minute>=35&&minute<=55;
 const isSettlement=hour===12&&minute>=15&&minute<=35;
 if(mode==='freeze'&&!isFreeze||mode==='settle'&&!isSettlement)
  return {status:'OUTSIDE_SCHEDULE_WINDOW',http:200};
 return {status:'RUN_ALLOWED',http:200};
}
