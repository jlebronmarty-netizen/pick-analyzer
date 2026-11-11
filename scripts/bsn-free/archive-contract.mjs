export const BASE='https://v1.basketball.api-sports.io';
export const VERSION='BSN_APISPORTS_ARCHIVE_V1';
export const SEASONS=[2024,2025,2026,2023,2022,2021,2020,2019,2018,2017,2016,2015];
export const BATCH_SOURCE='bsn:apisports:archive-v1';
const int=n=>Number.isInteger(n)&&n>=0;
const positive=n=>int(n)&&n>0;
export function envelope(body){
 if(!body||!Array.isArray(body.response)||!int(body.results)||body.results!==body.response.length)throw Error('INVALID_ENVELOPE_OR_COUNT');
 if(!body.errors||Object.keys(body.errors).length)throw Error('PROVIDER_REPORTED_ERRORS');
 if(body.paging&&body.paging.total>1)throw Error('UNSUPPORTED_PAGINATION');
 return body.response;
}
export function auditGames(rows,season){
 const accepted=[],excluded=[],seen=new Set();
 const duplicates=new Set(rows.filter((r,i)=>rows.findIndex(x=>x.id===r.id)!==i).map(r=>r.id));
 for(const r of rows){
  const reasons=[];
  if(!positive(r.id)||duplicates.has(r.id)||seen.has(r.id))reasons.push('INVALID_OR_DUPLICATE_ID');seen.add(r.id);
  if(r.league?.id!==76||String(r.league?.season)!==String(season))reasons.push('WRONG_LEAGUE_OR_SEASON');
  if(!positive(r.teams?.home?.id)||!positive(r.teams?.away?.id)||r.teams.home.id===r.teams.away.id)reasons.push('INVALID_TEAMS');
  if(!Number.isFinite(Date.parse(r.date))||!positive(r.timestamp)||Math.abs(Date.parse(r.date)-r.timestamp*1000)>1000)reasons.push('INVALID_CLOCK');
  if(!['FT','AOT'].includes(r.status?.short))reasons.push('NOT_DECISIVE_FINAL');
  for(const side of ['home','away']){
   const x=r.scores?.[side];
   if(!x||!int(x.total))reasons.push('INVALID_TOTAL_'+side);
   else{
    const quarters=[1,2,3,4].map(q=>x['quarter_'+q]);
    if(quarters.every(int)&&!(x.over_time===null||int(x.over_time)))reasons.push('INVALID_OVERTIME_'+side);
    else if(quarters.every(int)&&quarters.reduce((a,b)=>a+b,0)+(x.over_time??0)!==x.total)reasons.push('SCORE_SUM_'+side);
   }
  }
  if(r.scores?.home?.total===r.scores?.away?.total)reasons.push('TIED_FINAL');
  if(reasons.length)excluded.push({id:r.id??null,reasons});
  else accepted.push({id:r.id,season:Number(season),date:r.date,stage:r.stage??null,status:r.status.short,
   homeId:r.teams.home.id,awayId:r.teams.away.id,home:r.teams.home.name,away:r.teams.away.name,
   homeScore:r.scores.home.total,awayScore:r.scores.away.total,
   quarterComplete:['home','away'].every(s=>[1,2,3,4].every(q=>int(r.scores[s]['quarter_'+q])))});
 }
 return {accepted,excluded,coverageCertified:false};
}
export function auditTeamStats(rows,games){
 const accepted=[],excluded=[],seen=new Set();
 const counts=new Map();for(const r of rows){const k=r.game?.id+':'+r.team?.id;counts.set(k,(counts.get(k)??0)+1);}
 for(const r of rows){
  const g=games.find(g=>g.id===r.game?.id),team=r.team?.id,k=r.game?.id+':'+team,reasons=[];
  if(!g||![g.homeId,g.awayId].includes(team))reasons.push('UNEXPECTED_GAME_OR_TEAM');
  if(counts.get(k)>1)reasons.push('DUPLICATE_TEAM');seen.add(k);
  for(const field of ['field_goals','threepoint_goals','freethrows_goals']){
   if(!int(r[field]?.total)||!int(r[field]?.attempts)||r[field].total>r[field].attempts)reasons.push('INVALID_'+field);
  }
  if(!reasons.length){
   const points=2*r.field_goals.total+r.threepoint_goals.total+r.freethrows_goals.total;
   if(points!==(team===g.homeId?g.homeScore:g.awayScore))reasons.push('POINTS_MISMATCH');
   if(r.threepoint_goals.total>r.field_goals.total||r.threepoint_goals.attempts>r.field_goals.attempts)reasons.push('INVALID_SHOT_SUBSET');
  }
  if(!['total','offence','defense'].every(f=>int(r.rebounds?.[f]))||r.rebounds.total!==r.rebounds.offence+r.rebounds.defense)reasons.push('REBOUNDS_MISMATCH');
  if(!['assists','steals','blocks','turnovers','personal_fouls'].every(f=>int(r[f])))reasons.push('MISSING_COUNTS');
  if(reasons.length)excluded.push({gameId:r.game?.id??null,teamId:team??null,reasons});else accepted.push({gameId:g.id,teamId:team});
 }
 const missing=games.flatMap(g=>[g.homeId,g.awayId].filter(id=>!seen.has(g.id+':'+id)).map(teamId=>({gameId:g.id,teamId,reasons:['MISSING_TEAM']})));
 return {accepted,excluded:[...excluded,...missing]};
}
export function auditPlayers(rows,games){
 // Preserve raw player rows; identity/points checks are preliminary, not an
 // admission to modeling. Team aggregate reconciliation remains a later gate.
 const seen=new Set(),issues=[];
 for(const r of rows){
  const g=games.find(g=>g.id===r.game?.id),k=r.game?.id+':'+r.team?.id+':'+r.player?.id;
  if(!g||![g.homeId,g.awayId].includes(r.team?.id)||!positive(r.player?.id)||seen.has(k))issues.push({gameId:r.game?.id??null,reason:'PLAYER_IDENTITY'});
  seen.add(k);
 }
 return {rows:rows.length,issues,fields:[...new Set(rows.flatMap(r=>Object.keys(r)))].sort(),admittedForModeling:false};
}
const task=(kind,path,extra={})=>({kind,url:BASE+path,...extra});
export function buildTasks(seasons,games){
 const tasks=[task('leagues','/leagues?id=76')];
 for(const season of SEASONS.filter(y=>seasons.includes(y)))tasks.push(task('games','/games?league=76&season='+season,{season}));
 for(const season of [2024,2025,2026]){
  const ordered=games.filter(g=>g.season===season).sort((a,b)=>a.id-b.id);
  for(let i=0;i<ordered.length;i+=20){
   const group=ordered.slice(i,i+20),ids=group.map(g=>g.id).join('-');
   for(const kind of ['teams','players'])tasks.push(task(kind,'/games/statistics/'+kind+'?ids='+ids,{season,games:group}));
  }
 }
 return tasks;
}
