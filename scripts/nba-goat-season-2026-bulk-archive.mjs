#!/usr/bin/env node
// One-time, resumable, explicitly opt-in NBA GOAT historical data archive.
// Does not update official picks, models, crons, or existing prediction tables.
// Run only from a trusted environment with existing server-side credentials.
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const arg=(name,fallback)=>process.argv.find(x=>x.startsWith('--'+name+'='))?.split('=').slice(1).join('=')??fallback;
const active=process.argv.includes('--execute');
const season=Number(arg('season','2026'));
const from=arg('from','2026-10-20'),through=arg('through','2026-11-14');
const mode=arg('mode','all'),maxRequests=Number(arg('max-requests','300'));
const maxGames=Number(arg('max-games','999'));
const pauseMs=Number(arg('pause-ms','300'));
if(season!==2026||!/^2026-\d\d-\d\d$/.test(from)||!/^2026-\d\d-\d\d$/.test(through)||from>through||!['core','all'].includes(mode)||!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>600||!Number.isSafeInteger(maxGames)||maxGames<1||maxGames>1000||pauseMs<200)throw Error('INVALID_BOUNDED_OPTIONS');

const BASE='https://api.balldontlie.io',apiKey=process.env.BALLDONTLIE_API_KEY?.trim();
const dbUrl=process.env.SUPABASE_URL?.trim()??process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const dbKey=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const registry=[
  {key:'player_stats',url:'/v1/stats',filter:'game_ids[]',paged:true},
  {key:'advanced_v2',url:'/nba/v2/stats/advanced',filter:'game_ids[]',paged:true,params:{period:'0'}},
  {key:'tracking_passing',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'passing'}},
  {key:'tracking_drives',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'drives'}},
  {key:'tracking_possessions',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'possessions'}},
  {key:'tracking_rebounding',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'rebounding'}},
  {key:'tracking_speeddistance',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'speeddistance'}},
  {key:'tracking_elbowtouch',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'elbowtouch'}},
  {key:'tracking_posttouch',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'posttouch'}},
  {key:'tracking_painttouch',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'painttouch'}},
  {key:'tracking_catchshoot',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'catchshoot'}},
  {key:'tracking_pullupshot',url:'/nba/v1/stats/tracking',filter:'game_ids[]',paged:true,params:{type:'pullupshot'}},
  {key:'defense_2p',url:'/nba/v1/stats/defense',filter:'game_ids[]',paged:true,params:{type:'2_pointers'}},
  {key:'defense_3p',url:'/nba/v1/stats/defense',filter:'game_ids[]',paged:true,params:{type:'3_pointers'}},
  {key:'shooting_distance',url:'/nba/v1/stats/shooting',filter:'game_ids[]',paged:true,params:{type:'defender_distance'}},
  {key:'shooting_dribbles',url:'/nba/v1/stats/shooting',filter:'game_ids[]',paged:true,params:{type:'dribbles'}},
  {key:'shooting_touch_time',url:'/nba/v1/stats/shooting',filter:'game_ids[]',paged:true,params:{type:'touch_time'}},
  {key:'defense_overall',url:'/nba/v1/stats/defense',filter:'game_ids[]',paged:true,params:{type:'overall'}},
  {key:'lineup_stats',url:'/nba/v1/lineup_stats',filter:'game_ids[]',paged:true},
  {key:'matchups',url:'/nba/v1/matchups',filter:'game_ids[]',paged:true},
  {key:'shot_charts',url:'/nba/v1/shot_charts',filter:'game_ids[]',paged:true},
  {key:'opening_odds',url:'/nba/v2/odds/opening',filter:'game_ids[]',paged:true},
  {key:'opening_player_props',url:'/nba/v2/odds/player_props/opening',filter:'game_id',paged:false},
  {key:'plays',url:'/v1/plays',filter:'game_id',paged:false},
  {key:'win_probabilities',url:'/nba/v1/win_probabilities',filter:'game_id',paged:false},
];
const selected=mode==='core'?registry.slice(0,2):registry;
let calls=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const emit=(event,obj)=>console.log(JSON.stringify({event,...obj}));
if(!active){
 emit('DRY_RUN',{season,from,through,mode,marketFamilies:selected.map(x=>x.key),maxRequests,maxGames,warning:'NO_PROVIDER_CALLS_NO_DB_WRITES; --execute required'});
 process.exit(0);
}
if(!apiKey||!dbUrl||!dbKey)throw Error('MISSING_SERVER_SIDE_KEYS; do not paste secrets in chat or logs');
const db=createClient(dbUrl,dbKey,{auth:{persistSession:false,autoRefreshToken:false}});
async function get(path,params={}){
 let attempt=0;
 while(true){
  if(calls>=maxRequests)throw Error('RUN_REQUEST_CAP_REACHED');
  calls++;
  const url=new URL(path,BASE);
  for(const [k,v] of Object.entries(params))url.searchParams.append(k,String(v));
  const r=await fetch(url,{headers:{Authorization:apiKey,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(r.status===429||r.status>=500){
   if(++attempt>3)throw Error('PROVIDER_UNAVAILABLE_'+r.status);
   await sleep(Math.min(2500*attempt,7500));continue;
  }
  if(!r.ok)throw Error('PROVIDER_HTTP_'+r.status);
  const data=await r.json();
  if(!data||!Array.isArray(data.data))throw Error('PROVIDER_SCHEMA_UNEXPECTED');
  await sleep(pauseMs);
  return data;
 }
}
async function collect(path,params,paged){
 const data=[];let cursor=null;const seen=new Set();
 for(let p=0;p<150;p++){
  const extra={...params,...(paged?{per_page:100}:{}),...(cursor!==null?{cursor}:{})};
  const answer=await get(path,extra);
  data.push(...answer.data);
  const next=answer.meta?.next_cursor??null;
  if(!paged||next===null)return data;
  if(seen.has(String(next)))throw Error('REPEATED_CURSOR');
  seen.add(String(next));cursor=next;
 }
 throw Error('PAGE_BOUND_EXCEEDED');
}
async function archive(game,key,payload){
 const record={season,provider_game_id:Number(game.id),dataset_key:key,provider:'balldontlie',
  source_captured_at:new Date().toISOString(),game_date:game.date,response_sha256:sha(payload),data_count:payload.length,payload};
 const {error}=await db.from('nba_goat_season_archive_v1').upsert(record,{onConflict:'season,provider_game_id,dataset_key'});
 if(error)throw Error('ARCHIVE_DB_WRITE_FAILED_'+error.code);
}
async function already(gameId,key){
 const {data,error}=await db.from('nba_goat_season_archive_v1').select('response_sha256').eq('season',season).eq('provider_game_id',gameId).eq('dataset_key',key).maybeSingle();
 if(error)throw Error('ARCHIVE_DB_READ_FAILED_'+error.code);
 return Boolean(data);
}
async function fillExistingPlayerContext(game,stats){
 if(!stats.length||stats.some(s=>Number(s.game?.id)!==Number(game.id)))throw Error('INVALID_GAME_PLAYER_STATS');
 const id='bdl_nba_'+game.id;
 const {data:existing,error:readError}=await db.from('nba_game_context_v2').select('game_id,player_stats').eq('game_id',id).maybeSingle();
 if(readError)throw Error('CONTEXT_READ_FAILED_'+readError.code);
 if(existing?.player_stats?.data?.length)return 'PRESERVED_EXISTING';
 const value={player_stats:{data:stats},player_stats_captured_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const result=existing
 ?await db.from('nba_game_context_v2').update(value).eq('game_id',id).is('player_stats',null)
 :await db.from('nba_game_context_v2').insert({game_id:id,provider_game_id:Number(game.id),provider:'balldontlie',source_version:'NBA_GOAT_SEASON_BULK_ARCHIVE_V1',...value});
 if(result.error)throw Error('CONTEXT_WRITE_FAILED_'+result.error.code);
 return 'FILLED_MISSING_ONLY';
}
const games=await collect('/v1/games',{'seasons[]':season,start_date:from,end_date:through},true);
const eligible=[...new Map(games.filter(g=>Number(g.season)===season&&g.date>=from&&g.date<=through&&g.status_state==='final'&&g.postseason===false&&g.postponed===false).map(g=>[Number(g.id),g])).values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.id)-Number(b.id));
emit('INVENTORY',{season,from,through,allListed:games.length,verifiedFinal:eligible.length,processedCap:maxGames,selectedDatasets:selected.length,requestsUsed:calls});
const errors=[];let completed=0,skipped=0,stored=0,filled=0;
outer:for(const game of eligible.slice(0,maxGames)){
 for(const spec of selected){
  try{
   if(await already(game.id,spec.key)){skipped++;continue;}
   const data=await collect(spec.url,{[spec.filter]:game.id,...(spec.params??{})},spec.paged);
   await archive(game,spec.key,data);stored++;
   if(spec.key==='player_stats'&&data.length){await fillExistingPlayerContext(game,data);filled++;}
  }catch(err){
   const reason=String(err?.message??err);
   errors.push({gameId:game.id,dataset:spec.key,reason});
   emit('DATASET_FAILED',{gameId:game.id,dataset:spec.key,reason,requestsUsed:calls});
   if(reason==='RUN_REQUEST_CAP_REACHED'||reason.startsWith('PROVIDER_HTTP_401')||reason.startsWith('PROVIDER_HTTP_403'))break outer;
  }
 }
 completed++;
 emit('GAME_PROGRESS',{gameId:game.id,gameDate:game.date,completed,requestsUsed:calls,stored,skipped,failed:errors.length});
}
emit('SUMMARY',{season,through,completed,stored,skipped,filledContexts:filled,failed:errors.length,errors:errors.slice(0,50),requestsUsed:calls,requestCap:maxRequests,mode,noOfficialModelOrPickWrites:true});
if(errors.length)process.exitCode=2;
