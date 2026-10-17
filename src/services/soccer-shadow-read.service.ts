import 'server-only';
import {cache} from 'react';
import {parseSoccerReport,unavailableSoccer,type SoccerReport} from '@/lib/soccer-shadow-report';
export const SOCCER_READ_BRIDGE_URL='https://sports-edge-hub.vercel.app/api/soccer/read-bridge';
export const getSoccerShadowReport=cache(async():Promise<SoccerReport>=>{
 try{
  const response=await fetch(SOCCER_READ_BRIDGE_URL,{cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
  return parseSoccerReport(await response.json());
 }catch{return unavailableSoccer();}
});
