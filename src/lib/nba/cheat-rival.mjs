const metrics=['pts','reb','ast','fg3m','min','pf'];
const localDay=date=>Math.floor((Date.parse(date)-4*3600000)/86400000);
const unique=rows=>rows.length===1?rows[0]:null;
const valid=v=>Number.isFinite(v)&&v>=0;

export function summarizePlayer(appearances){
  return Object.fromEntries(metrics.map(k=>[k,[5,10,appearances.length].map(size=>{
    const window=appearances.slice(0,size), values=window.map(g=>g[k]).filter(valid);
    return {value:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,n:values.length,total:window.length};
  })]));
}

export function rivalAnalysis(report,gameId,playerId,previousRole){
  const f=report.fixtures.find(f=>f.id===gameId);
  if(!f)return null;
  const history=id=>(report.rivalHistory??[]).filter(g=>g.playerId===id && g.min>0 &&
    Date.parse(g.date)<Date.parse(f.scheduledAt)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  const own=history(playerId);
  const lineups=report.lineups.filter(l=>l.gameId===gameId);
  const entries=lineups.flatMap(l=>l.players.map(p=>({...p,teamId:l.teamId})));
  const current=unique(entries.filter(p=>p.playerId===playerId));
  const teamId=current?.teamId??own[0]?.teamId;
  const team=[f.away,f.home].find(t=>t.id===teamId);
  if(!team)return null;
  const rival=f.away.id===team.id?f.home:f.away;
  const pos=current?.position??(previousRole?.teamId===team.id?previousRole.position:null);
  const other=pos?unique(entries.filter(p=>p.teamId===rival.id && p.position===pos)):null;
  const rivalGames=other?history(other.playerId):[];
  const finals=new Map(report.finals.map(g=>[Number(g.gameId),g]));
  function rest(t){
    const prior=report.finals.filter(g=>g.home===t.name||g.away===t.name).sort((a,b)=>Date.parse(b.scheduledAt)-Date.parse(a.scheduledAt))[0];
    return prior?{days:localDay(f.scheduledAt)-localDay(prior.scheduledAt)-1,date:prior.scheduledAt}:null;
  }
  const meetings=own.filter(g=>g.opp===rival.id).map(g=>{
    const score=finals.get(g.gameId);
    return {...g,score:score&&[score.home,score.away].includes(rival.name)&&Date.parse(score.scheduledAt)===Date.parse(g.date)?
      score.away+' '+score.awayScore+' – '+score.homeScore+' '+score.home:null};
  });
  const direct=other?report.matchups.filter(r=>r.offensive_player_id===playerId&&r.defender_player_id===other.playerId):[];
  return {team,rival,pos,roleDate:!current&&pos?previousRole?.capturedAt:null,other,own:summarizePlayer(own),
    comparison:summarizePlayer(rivalGames),meetings,direct,
    injuries:report.injuries.filter(i=>i.gameId===gameId),rest:[rest(team),rest(rival)],
    lineupAt:lineups.find(l=>l.teamId===rival.id)?.capturedAt,cutoff:report.readAt};
}
