export const windows = {L5:'Últimos 5',L10:'Últimos 10',H5:'H2H 5',H10:'H2H 10'};
export const markets = {ALL:'General',MONEYLINE:'Moneyline',SPREAD:'Spread',TOTAL:'Total',TEAM:'Total de equipo'};
export function sample(team, pair, window, away=false) {
  const n = window.endsWith('10') ? 10 : 5;
  if (!window.startsWith('H')) return team.recentGames.slice(0,n);
  return pair.slice(0,n).map(g=>away ? {...g,pointsFor:g.pointsAgainst,pointsAgainst:g.pointsFor,
    periods:g.periods.map(p=>({...p,pointsFor:p.pointsAgainst,pointsAgainst:p.pointsFor}))} : g);
}
export function measure(g, period) {
  if (period==='FT') return g;
  const parts=g.periods.filter(p=>period==='OT'?p.period>2:p.period===Number(period));
  if (!parts.length) return null;
  return {pointsFor:parts.reduce((n,p)=>n+p.pointsFor,0),pointsAgainst:parts.reduce((n,p)=>n+p.pointsAgainst,0)};
}
function margin(g,market,side) {
  if(market==='TOTAL') return (g.pointsFor+g.pointsAgainst-side.line)*(side.side==='OVER'?1:-1);
  return g.pointsFor-g.pointsAgainst+(market==='SPREAD'?side.line:0);
}
function rate(rows,market,side) {
  const wins=rows.filter(g=>margin(g,market,side)>0).length;
  return {wins,n:rows.length,rate:rows.length?wins/rows.length:null};
}
export function efficiency(games,samples) {
  const rows=games.map(g=>samples?.[g.eventId]).filter(Boolean);
  const sum=key=>rows.reduce((n,r)=>n+r[key],0);
  const pos=sum('possessions');
  return {n:rows.length,pace:pos?40*pos/sum('minutes'):null,
    offense:pos?100*sum('pointsFor')/pos:null,defense:pos?100*sum('pointsAgainst')/pos:null};
}
export function candidates(report,pairs,{window,market,band,period,game,conference},possessions={}) {
  if(period!=='FT'||market==='TEAM'||!report.coverage.readComplete)return [];
  const teams=new Map(report.teams.map(t=>[t.id,t])), result=[];
  for(const f of report.fixtures) {
    const home=teams.get(f.homeId),away=teams.get(f.awayId),pair=pairs[f.eventId]??[];
    if(!home||!away|| (game && game!==f.eventId) || (conference && ![home.conference,away.conference].includes(conference)))continue;
    if(f.state!=='PREGAME'||Date.parse(f.scheduledAt)<=Date.parse(report.readAt)||f.markets.status!=='REFERENCE_ONLY'||
      !(Date.parse(f.markets.capturedAt)<=Date.parse(report.readAt)))continue;
    for(const q of f.markets.quotes) {
      if(q.period!=='FULL_GAME'||(market!=='ALL'&&market!==q.market))continue;
      for(const side of [q.first,q.second]) {
        if(side.americanOdds < -650 || (band==='heavy' && side.americanOdds>=-250)||(band==='standard'&&side.americanOdds< -250))continue;
        const isAway=side.side==='AWAY',team=isAway?away:home,other=isAway?home:away,total=q.market==='TOTAL';
        const hist=sample(team,pair,window,isAway),required=window.endsWith('10')?10:5,h2h=window.startsWith('H');
        if((!h2h && (!team.last10.sequenceVerified||hist.length!==required)) || hist.length<5)continue;
        if(total&&!h2h&&(!other.last10.sequenceVerified||other.recentGames.length<required))continue;
        const unique=rows=>[...new Map(rows.map(g=>[g.eventId,g])).values()];
        const rows=total&&!h2h?unique([...hist,...sample(other,pair,window)]):hist;
        const frequency=rate(rows,q.market,side);
        const conditions=[];
        function add(label,ok,n){conditions.push({label,ok,n});}
        function threshold(label,games){const r=rate(games,q.market,side);add(label,r.n>=5?r.rate>=0.6:null,r.n);}
        const recent=team.last10.sequenceVerified?team.recentGames:[];
        threshold('Forma L5 a la línea de referencia',recent.slice(0,5));
        threshold('Forma L10 a la línea de referencia',recent.length===10?recent:[]);
        const venue=f.neutralSite===true?'NEUTRAL':f.neutralSite===false?(isAway?'AWAY':'HOME'):null;
        threshold('Rendimiento en la sede',recent.filter(g=>g.venue===venue));
        threshold('Ante el rival',sample(team,pair,'H10',isAway));
        const gap=rows.reduce((s,g)=>s+margin(g,q.market,side),0)/rows.length;
        add(total?'Margen medio sobre el total':'Margen medio favorable',gap>=2,rows.length);
        if(!total) add('Ventaja de descanso',team.rest.verified&&other.rest.verified?team.rest.daysOff>other.rest.daysOff:null,Number(team.rest.verified)+Number(other.rest.verified));
        const e=efficiency(recent,possessions[team.id]),o=efficiency(other.last10.sequenceVerified?other.recentGames:[],possessions[other.id]);
        const n=Math.min(e.n,o.n);
        if(total){
          const expected=(e.pace+o.pace)/2*(e.offense+o.defense+o.offense+e.defense)/200;
          add('Ritmo y eficiencia frente al total',n>=5?(expected-side.line)*(side.side==='OVER'?1:-1)>=2:null,n);
        }else add('Ventaja de eficiencia neta',n>=5?e.offense-e.defense-(o.offense-o.defense)>=3:null,n);
        result.push({f,q,side,team,frequency,conditions,rows});
      }
    }
  }
  return result.sort((a,b)=>b.frequency.rate-a.frequency.rate||b.frequency.n-a.frequency.n||a.f.eventId.localeCompare(b.f.eventId)||a.q.sportsbook.localeCompare(b.q.sportsbook)||a.side.side.localeCompare(b.side.side)).slice(0,10);
}
