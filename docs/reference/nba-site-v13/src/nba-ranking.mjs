import {periodRows,auditRows} from './nba-evidence.mjs';
import {appearances,average,roster} from './nba-history.mjs';
import {lineState,mainQuote,marketPeriod,playerValues,propMetrics,scoreComparison,windowStats} from './nba-props.mjs';

export function fixturePrices(report,f){
 const cutoff=Math.min(Date.parse(report.readAt),Date.parse(f.scheduledAt)-1);
 return (report.archivedMarkets??[]).filter(g=>String(g.gameId)===String(f.id)&&g.status==='ARCHIVED')
  .flatMap(g=>g.quotes).filter(q=>Date.parse(q.source_received_at)<=cutoff);
}

export function rankingMembers(report,f,prices){
 const members=new Map();
 for(const t of [f.away,f.home]){
  for(const p of roster(report,f,t.id))members.set(String(p.playerId),{...p,t,rival:t===f.home?f.away:f.home});
 }
 for(const q of prices){
  if(q.market!=='props'||q.player_id==null||members.has(String(q.player_id)))continue;
  const player=report.players.find(p=>String(p.playerId)===String(q.player_id));
  members.set(String(q.player_id),{playerId:q.player_id,name:player?.name,t:{name:'Equipo sin confirmar'},rival:{name:'Rival sin confirmar'}});
 }
 return [...members.values()];
}

export function rankLines(report){
 const keys=new Map(Object.entries(propMetrics).map(([key,[,stat]])=>[stat,key]));
 const players=new Map(report.players.map(p=>[String(p.playerId),p]));
 const result=[];
 for(const f of report.fixtures){
  const prices=fixturePrices(report,f);
  const members=new Map(rankingMembers(report,f,prices).map(m=>[String(m.playerId),m]));
  const groups=new Map();
  for(const q of prices){
   if(q.market!=='props'||q.book?.toLowerCase()!=='fanduel'||q.player_id==null)continue;
   const group=JSON.stringify([String(q.player_id),q.statistic,marketPeriod(q)]);
   if(!groups.has(group))groups.set(group,new Map());
   const lines=groups.get(group);
   const type=['over','under'].includes(q.side)&&lineState(q)!=='Línea parcialmente verificada'?'ou':q.contract;
   const key=JSON.stringify([q.line,q.ot,type]);
   if(!lines.has(key))lines.set(key,{});
   const sides=lines.get(key),prev=sides[q.side];
   if(!prev||Date.parse(q.source_received_at)>Date.parse(prev.source_received_at)||
     (q.source_received_at===prev.source_received_at&&String(q.quote_id)<String(prev.quote_id)))sides[q.side]=q;
  }
  for(const lines of groups.values()){
   const pairs=[...lines.values()],quotes=pairs.flatMap(Object.values);
   const principal=mainQuote(quotes),first=quotes[0],id=String(first.player_id),m=members.get(id);
   const key=keys.get(first.statistic),period=marketPeriod(first),p=players.get(id);
   const full=p?appearances({...p,recent:[...p.recent,...(p.earlierAppearances??[])]},report,10).map(playerValues):[];
   const history=periodRows(full,report,id,period).map(playerValues);
   const audit=auditRows(report,m,full,10);
   for(const sides of pairs){
    const rows=[];
    for(const q of Object.values(sides)){
     const threshold=scoreComparison(q)?q.line:null;
     const row={f,m,key,period,q,player:m.name??'Jugador #'+id,team:m.t.name,rival:m.rival.name,
      game:f.away.name+' @ '+f.home.name,stat:propMetrics[key]?.[0]??q.statistic,
      availability:m.availability??'Sin reporte',side:q.side,line:q.line,price:q.american_odds,
      capture:Date.parse(q.source_received_at),principal:!!principal&&Object.values(sides).includes(principal)};
     for(const n of [5,10]){
      const window=history.slice(0,n),s=windowStats(window,key,threshold);
      row['avg'+n]=s.avg;row['n'+n]=s.n;row['minutes'+n]=average(window,'minutes_played');
      row['gap'+n]=s.gap==null?null:q.side==='under'?-s.gap:s.gap;
      row['pct'+n]=q.line>0&&s.gap!=null?100*row['gap'+n]/q.line:null;
      for(const field of ['over','under','push'])row[field+n]=s[field]==null?null:s[field]/s.n;
      row['sample'+n]=s;
     }
     const a=row.gap5,b=row.gap10;
     row.agree=a==null||b==null?'Sin comparación':a===0||b===0?'Igual a la línea':Math.sign(a)===Math.sign(b)?'Coinciden':'Difieren';
     const rivalRows=history.filter(h=>m.rival.id!=null&&String(h.opponentId)===String(m.rival.id)&&Number.isFinite(h[key]));
     const current=(report.matchups??[]).filter(x=>String(x.offensive_player_id)===id&&x.game_date<report.date&&Date.parse(x.captured_at)<=Date.parse(report.readAt));
     const defenders=new Set([...members.values()].filter(x=>x.t.id!=null&&x.t.id===m.rival.id).map(x=>String(x.playerId)));
     const defenderGames=new Set(current.filter(x=>defenders.has(String(x.defender_player_id))&&x.matchup_seconds>0).map(x=>x.provider_game_id??x.game_id));
     const favorable=v=>q.side==='over'?v>q.line:v<q.line;
     const checks={
      'Brecha positiva L5':a==null?null:a>0,'Brecha positiva L10':b==null?null:b>0,
      'Frecuencia del lado ≥60 % L10':row.n10<5||b==null?null:row[q.side+'10']>=0.6,
      'Minutos estables (±15 %)':row.minutes10>0&&row.minutes5!=null?Math.abs(row.minutes5/row.minutes10-1)<=0.15:null,
      'Rival ≥2 juegos y mayoría favorable':rivalRows.length<2||b==null?null:rivalRows.filter(g=>favorable(g[key])).length>rivalRows.length/2,
      'Cruce defensivo documentado ≥3 juegos':defenderGames.size>=3?true:null,
      'Disponibilidad confirmada':m.availability?/^(active|available)$/i.test(m.availability):null,
      'L10 con datos y participación auditada':audit.length===10&&row.n10===10&&audit.every(x=>['Jugó','DNP · 0 min registrados'].includes(x.state)&&!x.missing)
     };
     row.checks=checks;row.conditions=b==null||/^(out|inactive|doubtful)$/i.test(m.availability??'')?null:Object.values(checks).filter(v=>v===true).length;
     rows.push(row);
    }
    result.push(rows);
   }
  }
 }
 return result;
}

export function selectRankSide(rows,side){
 if(side)return rows.find(r=>r.side===side);
 return rows.find(r=>r.gap10>0)??rows.find(r=>r.gap5>0)??rows[0];
}
