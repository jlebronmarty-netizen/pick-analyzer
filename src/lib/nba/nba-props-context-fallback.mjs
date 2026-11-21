// NBA research fallback: adapt existing, already captured GOAT operational boxscores.
// No provider calls and no writes. Evidence timestamp is the original provider capture.
const time=x=>Date.parse(String(x??''));
const int=x=>x!==null&&x!==undefined&&x!==''&&Number.isSafeInteger(Number(x))&&Number(x)>=0?Number(x):null;
function minutes(x){
 const s=String(x??'').trim();
 if(!s||s.toUpperCase()==='DNP')return 0;
 if(/^\d+:\d{1,2}$/.test(s)){const [m,sec]=s.split(':').map(Number);return sec<60?m+sec/60:0}
 const v=Number(s);return Number.isFinite(v)&&v>=0?v:0;
}
export function compactCapturedGameContexts(contexts,{season=2026,maxContexts=120}={}){
 if(!Array.isArray(contexts)||contexts.length>maxContexts)throw Error('CONTEXT_SCAN_BOUND');
 const result=[],seen=new Set();
 for(const context of contexts){
  const captured=String(context.player_stats_captured_at??''),received=time(captured);
  const gid=int(context.provider_game_id),rows=context.player_stats?.data;
  if(gid===null||!Number.isFinite(received)||!Array.isArray(rows)||rows.length<10||rows.length>100)continue;
  const players=new Set(),converted=[];
  for(const stat of rows){
   const pid=int(stat?.player?.id),gameId=int(stat?.game?.id),start=time(stat?.game?.datetime);
   if(pid===null||gameId!==gid||!Number.isFinite(start)||start>received||
       String(stat?.game?.status_state??'').toLowerCase()!=='final'||players.has(pid)){
    converted.length=0;break; // one malformed row invalidates the entire game
   }
   players.add(pid);
   const min=minutes(stat?.min),value={};
   for(const field of ['pts','reb','ast','fg3m'])value[field]=int(stat?.[field]);
   converted.push({season,provider_game_id:gid,player_id:pid,game_datetime:new Date(start).toISOString(),
    source_captured_at:new Date(received).toISOString(),minutes_played:min,
    projection_eligible:min>=10&&Object.values(value).every(x=>x!==null),...value,
    source_kind:'CAPTURED_OPERATIONAL_GOAT_BOXSCORE'});
  }
  if(converted.length!==rows.length)continue;
  for(const row of converted){
   const key=row.provider_game_id+':'+row.player_id;
   if(seen.has(key))throw Error('DUPLICATE_OPERATIONAL_CONTEXT_IDENTITY');
   seen.add(key);result.push(row);
  }
 }
 return result;
}
export function mergeCapturedGoatFacts(compactFacts,operationalFacts){
 const byKey=new Map();
 for(const f of [...compactFacts,...operationalFacts]){
  const id=Number(f.player_id),gid=Number(f.provider_game_id),at=time(f.source_captured_at);
  if(!Number.isSafeInteger(id)||!Number.isSafeInteger(gid)||!Number.isFinite(at))continue;
  const key=gid+':'+id,prior=byKey.get(key);
  if(!prior||at<time(prior.source_captured_at))byKey.set(key,f);
 }
 return [...byKey.values()];
}
