const prDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'});
export function teamHistory(report,name,limit){
 const rows=new Map(),conflicts=new Set();
 for(const f of report.finals){
  const time=Date.parse(f.scheduledAt),home=f.home===name;
  if(!home&&f.away!==name||!Number.isFinite(time)||prDay.format(time)>=report.date||
    !Number.isInteger(f.homeScore)||!Number.isInteger(f.awayScore)||f.homeScore===f.awayScore)continue;
  const id=String(f.gameId),row={id,date:f.scheduledAt,home,opponent:home?f.away:f.home,
   pointsFor:home?f.homeScore:f.awayScore,pointsAgainst:home?f.awayScore:f.homeScore};
  if(rows.has(id)&&JSON.stringify(rows.get(id))!==JSON.stringify(row))conflicts.add(id);
  rows.set(id,row);
 }
 return [...rows.values()].filter(r=>!conflicts.has(r.id)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.id.localeCompare(a.id)).slice(0,limit);
}
export function average(rows,key){
 const values=rows.map(r=>r[key]).filter(Number.isFinite);
 return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}
export function roster(report,fixture,teamId){
 const same=r=>String(r.gameId)===String(fixture.id)&&String(r.teamId)===String(teamId)&&Date.parse(r.capturedAt)<=Math.min(Date.parse(fixture.scheduledAt),Date.parse(report.readAt));
 const rows=new Map();
 const lineup=report.lineups.filter(same).sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt))[0];
 if(lineup){
  for(const p of lineup.players)if(p.playerId!=null)rows.set(String(p.playerId),{...p,lineup:lineup.status,lineupAt:lineup.capturedAt});
 }
 for(const p of report.injuries.filter(same).sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt))){
  if(p.playerId!=null)rows.set(String(p.playerId),{...p,...rows.get(String(p.playerId)),availability:p.status,availabilityAt:p.capturedAt});
 }
 return [...rows.values()];
}
export function previousMeetings(report,f){
 return report.periods.filter(p=>Number.isFinite(Date.parse(p.date))&&prDay.format(Date.parse(p.date))<report.date&&
  ((p.awayId===f.away.id&&p.homeId===f.home.id)||(p.awayId===f.home.id&&p.homeId===f.away.id)));
}
export function appearances(player,report,limit){
 const unique=new Map();
 for(const r of player.recent){
  if(r.gameId==null||unique.has(String(r.gameId))||!Number.isFinite(Date.parse(r.date))||prDay.format(Date.parse(r.date))>=report.date||!(r.minutes_played>0))continue;
  unique.set(String(r.gameId),{...r,pra:[r.pts,r.reb,r.ast].every(Number.isFinite)?r.pts+r.reb+r.ast:null});
 }
 return [...unique.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,limit);
}
export function periodForm(report,name,limit,period,includeOT=false){
 const history=teamHistory(report,name,limit),periods=new Map(report.periods.map(g=>[String(g.id).replace(/^bdl_nba_/,''),g]));
 const rows=[];
 for(const row of history){
  if(period==='FT'){rows.push(row);continue;}
  const g=periods.get(row.id);if(!g||g[row.home?'home':'away']!==name||g.homeScore!==(row.home?row.pointsFor:row.pointsAgainst)||g.awayScore!==(row.home?row.pointsAgainst:row.pointsFor))continue;
  function score(side){
   const q=g[side+'Quarters'],ot=g[side+'Overtime'];
   if(!Array.isArray(q)||q.length!==4||!Array.isArray(ot)||![...q,...ot].every(x=>Number.isInteger(x)&&x>=0)||[...q,...ot].reduce((a,b)=>a+b,0)!==g[side+'Score'])return null;
   return period==='1H'?q[0]+q[1]:period==='2H'?q[2]+q[3]+(includeOT?ot.reduce((a,b)=>a+b,0):0):q[Number(period.slice(1))-1];
  }
  const pf=score(row.home?'home':'away'),pc=score(row.home?'away':'home');
  if(Number.isFinite(pf)&&Number.isFinite(pc))rows.push({...row,pointsFor:pf,pointsAgainst:pc});
 }
 return {n:rows.length,pf:average(rows,'pointsFor'),pc:average(rows,'pointsAgainst'),rows};
}
export function estimates(a,h){
 if(![a.pf,a.pc,h.pf,h.pc].every(Number.isFinite))return {};
 const away=(a.pf+h.pc)/2,home=(h.pf+a.pc)/2;
 return {away,home,total:away+home,margin:away-home};
}
export function archiveGap(q,period,est,includeOT=false){
 if(!Number.isFinite(q.line)||q.period!==period||!q.book||!Number.isFinite(q.american_odds))return null;
 if(period==='FT'&&q.ot!=='INCLUDES_OT'||period==='2H'&&q.ot!==(includeOT?'INCLUDES_OT':'EXCLUDES_OT'))return null;
 if(q.market==='total'&&((q.side==='over'&&q.contract==='STRICT_GREATER_THAN')||(q.side==='under'&&q.contract==='STRICT_LESS_THAN'))&&Number.isFinite(est.total))return est.total-q.line;
 if(q.market==='spread'&&q.contract==='SIGNED_HANDICAP'&&['away','home'].includes(q.side)&&Number.isFinite(est.margin))return (q.side==='away'?est.margin:-est.margin)+q.line;
 return null;
}
