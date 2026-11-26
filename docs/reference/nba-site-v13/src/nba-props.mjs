// Rates describe observed scores, including pushes in the denominator.
export const propMetrics={
 pts:['Puntos','points'],reb:['Rebotes','rebounds'],ast:['Asistencias','assists'],fg3m:['Triples','threes'],
 pra:['Puntos + rebotes + asistencias','points_rebounds_assists'],pr:['Puntos + rebotes','points_rebounds'],
 pa:['Puntos + asistencias','points_assists'],ra:['Rebotes + asistencias','rebounds_assists'],
 dd:['Doble-doble','double_double'],td:['Triple-doble','triple_double'],
 stl:['Robos','steals'],blk:['Tapones','blocks'],turnover:['Pérdidas','turnovers'],minutes_played:['Minutos','minutes']
};
export const periodNames={FT:'Partido completo',Q1:'Primer cuarto',Q2:'Segundo cuarto',Q3:'Tercer cuarto',Q4:'Cuarto cuarto','1H':'Primera mitad','2H':'Segunda mitad'};
export function marketPeriod(q){return q.period==='FULL_GAME_LABEL_OT_UNVERIFIED'?'FT':q.period;}
export function lineState(q){
 const period=marketPeriod(q);
 const sided=(q.side==='over'&&q.contract==='STRICT_GREATER_THAN')||(q.side==='under'&&q.contract==='STRICT_LESS_THAN');
 const contract=q.market==='moneyline'?q.contract==='WINNER'&&['home','away'].includes(q.side):q.market==='spread'?q.contract==='SIGNED_HANDICAP'&&['home','away'].includes(q.side):sided;
 if(!contract||!q.book||!Number.isFinite(q.american_odds)||!Number.isFinite(Date.parse(q.source_received_at))||!periodNames[period]||(q.market!=='moneyline'&&!Number.isFinite(q.line)))return 'Línea parcialmente verificada';
 if(['FT','2H'].includes(period)&&!['INCLUDES_OT','EXCLUDES_OT'].includes(q.ot))return 'Línea pendiente por regla OT';
 return 'Línea verificada';
}
export function scoreComparison(q){
 if(!q||q.market!=='props'||lineState(q)==='Línea parcialmente verificada')return false;
 const period=marketPeriod(q);
 if(period==='FT')return q.ot!=='EXCLUDES_OT';
 if(q.book?.toLowerCase()!=='fanduel'||Date.parse(q.source_received_at)<Date.parse('2026-07-30T04:00Z'))return false;
 return period==='2H'?q.ot!=='EXCLUDES_OT':periodNames[period]!=null&&q.ot!=='INCLUDES_OT';
}
export function windowStats(rows,key,line){
 const values=rows.map(r=>r[key]).filter(Number.isFinite),n=values.length;
 const avg=n?values.reduce((a,b)=>a+b,0)/n:null;
 const comparable=n>0&&Number.isFinite(line);
 const over=comparable?values.filter(v=>v>line).length:null,under=comparable?values.filter(v=>v<line).length:null;
 return {n,avg,over,under,push:comparable?n-over-under:null,gap:comparable?avg-line:null};
}
export function mainQuote(quotes){
 // Prefer a two-sided threshold, then the least lopsided archived price pair.
 const groups=new Map();
 for(const q of quotes){
  if(!Number.isFinite(q.line)||!['over','under'].includes(q.side)||lineState(q)==='Línea parcialmente verificada')continue;
  const k=JSON.stringify([q.book,q.period,q.ot,q.line]);
  if(!groups.has(k))groups.set(k,{});const pair=groups.get(k);
  if(!pair[q.side]||Date.parse(q.source_received_at)>Date.parse(pair[q.side].source_received_at))pair[q.side]=q;
 }
 const implied=o=>o<0?-o/(100-o):100/(100+o);
 const rank=p=>p.over&&p.under?Math.abs(implied(p.over.american_odds)-implied(p.under.american_odds)):2;
 const list=[...groups.values()].sort((a,b)=>rank(a)-rank(b)||String((a.over??a.under).quote_id).localeCompare(String((b.over??b.under).quote_id)));
 return list.length?list[0].over??list[0].under:null;
}
export function playerValues(r){
 const combo=(...keys)=>keys.every(k=>Number.isFinite(r[k]))?keys.reduce((sum,k)=>sum+r[k],0):null;
 const five=[r.pts,r.reb,r.ast,r.stl,r.blk];
 return {...r,pra:combo('pts','reb','ast'),pr:combo('pts','reb'),pa:combo('pts','ast'),ra:combo('reb','ast'),dd:five.every(Number.isFinite)?Number(five.filter(v=>v>=10).length>=2):null,td:five.every(Number.isFinite)?Number(five.filter(v=>v>=10).length>=3):null};
}
export function defensiveGroups(rows,attacker,defenders,date,readAt){
 const groups=new Map(),seen=new Set();
 for(const r of rows){
  const id=String(r.defender_player_id),game=r.provider_game_id??r.game_id;
  if(String(r.offensive_player_id)!==String(attacker)||!defenders.has(id)||!game||!r.game_date||r.game_date>=date||!(Date.parse(r.captured_at)<=Date.parse(readAt)))continue;
  const key=id+':'+game;if(seen.has(key))continue;seen.add(key);
  if(!groups.has(id))groups.set(id,{id,name:r.defender_player_name??id,rows:[]});groups.get(id).rows.push(r);
 }
 const total=(list,k)=>list.every(r=>Number.isFinite(r[k]))?list.reduce((a,r)=>a+r[k],0):null;
 return [...groups.values()].map(g=>({...g,n:g.rows.length,dates:[...new Set(g.rows.map(r=>r.game_date))].sort(),
  ...Object.fromEntries(['matchup_seconds','player_points','fgm','fga','assists','turnovers'].map(k=>[k,total(g.rows,k)]))})).sort((a,b)=>(b.matchup_seconds??-1)-(a.matchup_seconds??-1)||b.n-a.n);
}
