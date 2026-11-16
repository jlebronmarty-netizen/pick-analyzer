// Pure, deterministic conversion of verified archived GOAT boxscores to compact research facts.
// Never assume that a postgame source was available before its capture timestamp.
export function playedMinutes(value) {
 if(value===null||value===undefined)return 0;
 const s=String(value).trim();
 if(!s||s.toUpperCase()==='DNP')return 0;
 if(/^\d+:\d{1,2}$/.test(s)){
  const [m,sec]=s.split(':').map(Number);return sec<60&&m>=0?m+sec/60:0;
 }
 const n=Number(s);return Number.isFinite(n)&&n>=0?n:0;
}
const safeInt=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0&&Number(v)<=100?Number(v):null;
export function compactGoatBoxscores({season,gameId,raw,sourceCapturedAt,sourceSha256}){
 if(!Array.isArray(raw)||raw.length<10)throw Error('GOAT_BOXSCORES_INSUFFICIENT');
 if(!/^([a-f0-9]{64})$/.test(String(sourceSha256??'')))throw Error('GOAT_SOURCE_HASH_INVALID');
 if(!Number.isSafeInteger(Number(gameId))||!Number.isSafeInteger(Number(season))||!Number.isFinite(Date.parse(sourceCapturedAt)))throw Error('GOAT_SOURCE_IDENTITY_INVALID');
 const rows=[],players=new Set();let gameStamp=null;
 for(const entry of raw) {
  const id=Number(entry?.game?.id),pid=Number(entry?.player?.id);
  if(id!==Number(gameId)||!Number.isSafeInteger(pid)||players.has(pid)||String(entry?.game?.status_state).toLowerCase()!=='final')throw Error('GOAT_GAME_PLAYER_IDENTITY_OR_DUPLICATE');
  const stamp=Date.parse(String(entry?.game?.datetime??''));
  if(!Number.isFinite(stamp)||stamp>Date.parse(sourceCapturedAt))throw Error('GOAT_GAME_TIMESTAMP_UNVERIFIED');
  if(gameStamp!==null&&stamp!==gameStamp)throw Error('GOAT_INCONSISTENT_GAME_TIMESTAMP');
  gameStamp=stamp;players.add(pid);
  const m=playedMinutes(entry?.min);
  if(m>80)throw Error('GOAT_MINUTES_OUT_OF_RANGE');
  const data={};
  for(const field of ['pts','reb','ast','fg3m','stl','blk','turnover'])data[field]=safeInt(entry?.[field]);
  const teamId=Number(entry?.team?.id),homeId=Number(entry?.game?.home_team_id),awayId=Number(entry?.game?.visitor_team_id);
  rows.push({
   season:Number(season),provider_game_id:id,player_id:pid,
   team_id:Number.isSafeInteger(teamId)?teamId:null,
   opponent_team_id:Number.isSafeInteger(teamId)&&Number.isSafeInteger(homeId)&&Number.isSafeInteger(awayId)?(teamId===homeId?awayId:teamId===awayId?homeId:null):null,
   game_datetime:new Date(stamp).toISOString(),source_captured_at:sourceCapturedAt,source_sha256:sourceSha256,
   minutes_played:Number(m.toFixed(3)),...data,
   projection_eligible:m>=10&&data.pts!==null&&data.reb!==null&&data.ast!==null&&data.fg3m!==null
  });
 }
 return rows;
}
export function syntheticGoatPropInputs(facts){
 return facts.map(f=>({
  capturedAt:f.source_captured_at,
  stat:{player:{id:f.player_id},game:{id:f.provider_game_id,datetime:f.game_datetime,status_state:'final'},min:f.minutes_played,
   pts:f.pts,reb:f.reb,ast:f.ast,fg3m:f.fg3m}
 }));
}
