import type {SportDefinition} from '@/config/sports.config';
import type {AdapterResult,MultiSportQuery,NormalizedEvent,NormalizedOddsSnapshot,NormalizedParticipant} from '@/types/multi-sport';
import {createSportAdapter as legacyAdapter} from './multi-sport-adapters.legacy';
import type {SportAdapter,MultiSportAdapterQuery} from './multi-sport-adapters.legacy';
import {archiveEnabled,archiveStatus,storedNbaEvents,storedNbaOdds} from './nba-shared-storage.service';
export type {SportAdapter,MultiSportAdapterQuery} from './multi-sport-adapters.legacy';
const denied=<T>(data:T,error:string):AdapterResult<T>=>({success:false,source:'balldontlie',data,latencyMs:0,warnings:[error],error});
function query(q:MultiSportAdapterQuery):MultiSportQuery{return {...q,sportKey:'basketball_nba',status:q.status as MultiSportQuery['status']};}
function permitted(q:MultiSportAdapterQuery){return (!q.providerId||q.providerId==='balldontlie')&&archiveEnabled();}
export function createSportAdapter(sport:SportDefinition):SportAdapter{
 if(sport.key!=='basketball_nba')return legacyAdapter(sport);
 const schedule=async(q:MultiSportAdapterQuery):Promise<AdapterResult<NormalizedEvent[]>>=>permitted(q)?storedNbaEvents(query(q)):denied([],'NBA_GOAT_ARCHIVE_REQUIRED_NO_ODDS_API_FALLBACK');
 return {id:'nba-balldontlie-shared-archive',sportKey:'basketball_nba',features:['schedule','event','odds'],
  fetchSchedule:schedule,
  fetchOdds:async(q):Promise<AdapterResult<NormalizedOddsSnapshot[]>>=>permitted(q)?storedNbaOdds(query(q)):denied([],'NBA_GOAT_ARCHIVE_REQUIRED_NO_ODDS_API_FALLBACK'),
  fetchEvent:async(id)=>{const r=await schedule({page:1,limit:100});return {...r,data:r.success?r.data.find(e=>e.id===id)??null:null};},
  fetchLeagues:async()=>{const {getLeaguesForSport}=await import('./multi-sport-registry.service');return {success:true,source:'balldontlie',latencyMs:0,warnings:[],data:getLeaguesForSport('basketball_nba')};},
  fetchTeamsOrParticipants:async(q)=>{const r=await schedule(q),unique=new Map<string,NormalizedParticipant>();for(const e of r.data)for(const p of e.participants)unique.set(p.id,p);return {...r,data:[...unique.values()]};},
  fetchStandings:async()=>denied([],'NBA_GOAT_STATS_PIPELINE_NOT_CONNECTED'),fetchStats:async()=>denied([],'NBA_GOAT_STATS_PIPELINE_NOT_CONNECTED'),fetchInjuries:async()=>denied([],'NBA_GOAT_INJURY_PIPELINE_NOT_CONNECTED'),fetchLineups:async()=>denied([],'NBA_GOAT_LINEUP_PIPELINE_NOT_CONNECTED'),
  normalizeProviderData:()=>denied(null,'NBA_USE_VERIFIED_ARCHIVE_NORMALIZER'),
  healthCheck:async()=>{try{const s=await archiveStatus();return {adapterId:'nba-balldontlie-shared-archive',sportKey:'basketball_nba',status:'degraded',latencyMs:0,coverage:['schedule','event','odds'],lastSuccess:s.last_snapshot?.source_received_at,errorMessage:'GOAT archive connected; model readiness is separate.'};}catch{return {adapterId:'nba-balldontlie-shared-archive',sportKey:'basketball_nba',status:'unavailable',latencyMs:0,coverage:[],errorMessage:'NBA archive unavailable; no provider fallback.'};}},
 };
}
