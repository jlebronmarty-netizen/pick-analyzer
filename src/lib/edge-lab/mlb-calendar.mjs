// Reconcile official postponed/resumed entries by gamePk. Conflicts fail closed.
const score=x=>x!==null&&x!==undefined&&x!==''&&typeof x!=='boolean'&&Number.isInteger(Number(x))&&Number(x)>=0?Number(x):null;
const optionalTime=x=>x&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
function normalize(g){
 const h=g.teams?.home,a=g.teams?.away,at=Date.parse(g.gameDate);
 if(!Number.isInteger(g.gamePk)||!h?.team?.id||!a?.team?.id||h.team.id===a.team.id||!h.team.name||!a.team.name||!Number.isFinite(at))throw Error('MLB_INVALID_IDENTITY');
 return {id:String(g.gamePk),scheduled_at:new Date(at).toISOString(),gameType:g.gameType,home:{id:String(h.team.id),name:h.team.name,score:score(h.score)},away:{id:String(a.team.id),name:a.team.name,score:score(a.score)},state:g.status?.abstractGameState,code:g.status?.codedGameState,timeValid:g.status?.startTimeTBD===false,resume_date:optionalTime(g.resumeDate),resumed_from:optionalTime(g.resumedFrom),official_date:g.officialDate??null};
}
const inactive=g=>['D','C'].includes(g.code);
function resumedOriginal(versions){
 if(versions.length!==2||versions.some(g=>g.code!=='F'))return null;
 const original=versions.find(g=>!g.resumed_from),resumed=versions.find(g=>g.resumed_from);
 if(!original||!resumed||resumed.resumed_from!==original.scheduled_at||original.resume_date!==resumed.scheduled_at||Date.parse(resumed.scheduled_at)<=Date.parse(original.scheduled_at))return null;
 if(original.home.score===null||original.away.score===null||original.home.score!==resumed.home.score||original.away.score!==resumed.away.score||original.official_date!==resumed.official_date)return null;
 return original;
}
export function parseMlbSchedule(body){
 if(!Array.isArray(body?.dates)||body.dates.some(d=>!Array.isArray(d.games)))throw Error('MLB_SCHEDULE_SCHEMA_CHANGED');
 const raw=body.dates.flatMap(d=>d.games);if(body.totalGames!==undefined&&body.totalGames!==raw.length)throw Error('MLB_SCHEDULE_COUNT_MISMATCH');
 const grouped=new Map();for(const original of raw){const g=normalize(original),versions=grouped.get(g.id)??[];versions.push(g);grouped.set(g.id,versions);}
 const games=[];for(const all of grouped.values()){
  if(all.some(g=>g.home.id!==all[0].home.id||g.away.id!==all[0].away.id||g.gameType!==all[0].gameType))throw Error('MLB_DUPLICATE_IDENTITY_CONFLICT');
  const unique=[...new Map(all.map(g=>[JSON.stringify(g),g])).values()],active=unique.filter(g=>!inactive(g));
  let chosen;if(active.length===1)chosen=active[0];else if(active.length===0)chosen=[...unique].sort((a,b)=>b.scheduled_at.localeCompare(a.scheduled_at))[0];else chosen=resumedOriginal(active);
  if(!chosen)throw Error('MLB_CONFLICTING_ACTIVE_VERSIONS');
  games.push({...chosen,calendar_observations:unique.length,prior_schedule_versions:unique.filter(g=>g!==chosen).map(g=>({scheduled_at:g.scheduled_at,code:g.code,state:g.state,resumed_from:g.resumed_from,resume_date:g.resume_date}))});
 }
 return games.sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.id.localeCompare(b.id));
}
