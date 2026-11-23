import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {verifiedArchivedPlayerFinal,reconciledPeriods} from './decision-archived-final-core.mjs';

export const PLAYER_MATERIALIZER_VERSION='NBA_ARCHIVED_PLAYER_MATERIALIZER_V1';
export const PLAYER_MATERIALIZER_CAP=3;
const STATS=['pts','reb','ast','fg3m','stl','blk','turnover'];
const stamp=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const hash=x=>createHash('sha256').update(x).digest('hex');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 throw Error('ARCHIVED_PLAYER_JSON_INVALID');
}
export function archivedPlayerPayload(context){
 return JSON.stringify(canonical({...context.player_stats,archive_provenance:{
  version:PLAYER_MATERIALIZER_VERSION,source_kind:'STORED_OPERATIONAL_JSON',
  source_table:'public.nba_game_context_v2',source_game_id:context.game_id,
  provider_game_id:context.provider_game_id,source_version:context.source_version,
  source_captured_at:context.player_stats_captured_at,
  note:'Canonical copy of previously stored operational JSON; not original provider response bytes.'
 }}));
}
// Produces only a proposed compact and archive, with no persistence or provider access.
export function prepareArchivedPlayerMaterialization({context,schedule,asOf}){
 const now=stamp(asOf),captured=stamp(context?.player_stats_captured_at),received=stamp(schedule?.source_received_at),recorded=stamp(schedule?.recorded_at);
 const id=context?.provider_game_id,data=context?.player_stats?.data;
 if(now===null||captured===null||captured>now||received===null||received>now||recorded===null||recorded>now||
  context?.provider!=='balldontlie'||!positive(id)||context.game_id!=='bdl_nba_'+id||typeof context.source_version!=='string'||!context.source_version.trim()||
  !/^[a-f0-9]{64}$/.test(schedule?.snapshot_id??'')||!Array.isArray(data)||data.length<10||data.length>100||
  context.player_stats.meta?.next_cursor!=null||context.player_stats.meta?.complete===false)
  throw Error('ARCHIVED_PLAYER_SOURCE_UNVERIFIED');
 const matches=(schedule.payload?.data?.games??[]).filter(g=>g.id===id);
 if(matches.length!==1)throw Error('ARCHIVED_PLAYER_FINAL_NOT_UNIQUE');
 const game=matches[0],tip=stamp(game.datetime);
 if(tip===null||tip>=captured||tip>=received||tip>=now||now-tip>61*86400000||
  !Number.isSafeInteger(game.season)||game.season<1946||game.season>2100||
  !/^\d{4}-\d{2}-\d{2}$/.test(game.date)||!reconciledPeriods(game)||
  !verifiedArchivedPlayerFinal({context,final:game,providerGameId:id}))
  throw Error('ARCHIVED_PLAYER_FINAL_TRUTH_UNVERIFIED');
 const home=game.home_team?.id,away=game.visitor_team?.id,period=game.period;
 if(!positive(home)||!positive(away)||home===away||!Number.isSafeInteger(period)||period<4||period>7)
  throw Error('ARCHIVED_PLAYER_GAME_SCOPE_UNVERIFIED');
 const duration=48+5*(period-4),minutesByTeam=new Map([[home,0],[away,0]]),compact=[];
 for(const p of data){
  if(!positive(p.player?.id)||!positive(p.team?.id)||p.player.team_id!==p.team.id||!minutesByTeam.has(p.team.id))throw Error('ARCHIVED_PLAYER_IDENTITY_INVALID');
  const parts=String(p.min).split(':'),seconds=Number(parts[0])*60+Number(parts[1]??0);
  if(!Number.isSafeInteger(seconds)||seconds<0||seconds>duration*60)throw Error('ARCHIVED_PLAYER_MINUTES_INVALID');
  minutesByTeam.set(p.team.id,minutesByTeam.get(p.team.id)+seconds);
  for(const key of STATS){
   const n=p[key];
   if(n===null&&seconds===0)continue;
   if(!Number.isSafeInteger(n)||n<0||n>(key==='pts'?200:100)||seconds===0&&n!==0)
    throw Error('ARCHIVED_PLAYER_STAT_INVALID');
  }
  compact.push({season:game.season,provider_game_id:id,player_id:p.player.id,team_id:p.team.id,
   opponent_team_id:p.team.id===home?away:home,game_datetime:game.datetime,
   source_captured_at:context.player_stats_captured_at,minutes_played:seconds/60,
   ...Object.fromEntries(STATS.map(k=>[k,p[k]])),projection_eligible:false});
 }
 if([...minutesByTeam.values()].some(seconds=>Math.abs(seconds-duration*5*60)>60))throw Error('ARCHIVED_PLAYER_TEAM_MINUTES_UNRECONCILED');
 const payloadText=archivedPlayerPayload(context),bytes=Buffer.from(payloadText,'utf8'),responseHash=hash(bytes),compressed=gzipSync(bytes,{level:9});
 if(bytes.length>512000||compressed.length>32768)throw Error('ARCHIVED_PLAYER_ARCHIVE_SIZE_BOUND');
 const manifest={season:game.season,provider_game_id:id,dataset_key:'player_stats',provider:'balldontlie',
  source_captured_at:context.player_stats_captured_at,game_date:game.date,response_sha256:responseHash,
  data_count:data.length,storage_bucket:'nba-goat-2026-private',
  storage_object_path:[game.season,id,'player_stats',responseHash+'.json.gz'].join('/'),
  json_bytes:bytes.length,compressed_bytes:compressed.length};
 return {manifest,rows:compact.map(r=>({...r,source_sha256:responseHash})),payloadText,compressed,
  scheduleSnapshotId:schedule.snapshot_id,sourceKind:'STORED_OPERATIONAL_JSON'};
}
