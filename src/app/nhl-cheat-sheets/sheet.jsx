'use client';
import {teamWindow,inBand,rankThresholds} from './windows.mjs';
import {useState} from 'react';
import {FilterGroup,SheetCard,TrendBars} from '@/components/cheat-sheets/presentation';
import s from '@/components/cheat-sheets/sheet.module.css';
const markets={ml:'Moneyline',spread:'Puck line',total:'Total',periodML:'Moneyline por período',periodSpread:'Puck line por período',periodTotal:'Total por período',team:'Total de equipo',skater:'Props de jugador',goalie:'Props de portero'};
const bands={all:'Ambos rangos',standard:'−250 o mejor',heavy:'−251 a −650'};
const na='Sin evidencia';
function percentage(n){return Number.isFinite(n)&&n>=0&&n<=1?(100*n).toFixed(1)+'%':na;}
function Team({team:t,window,opponent}){
  const games=teamWindow(t,window,opponent).reverse();
  const mean=key=>games.length&&games.every(g=>Number.isFinite(g[key]))?(games.reduce((sum,g)=>sum+g[key],0)/games.length).toFixed(1):na;
  const starts=games.flatMap(g=>g.goalies.filter(p=>p.id===t.goalieId));
  const total=k=>starts.reduce((a,p)=>a+p[k],0);
  return <section><h3>{t.abbrev}</h3><p>Temporada {t.season.record??na} · Posición {t.rank??na} · Local {t.homeRecord??na} · Visitante {t.awayRecord??na}</p>
    {games.length?<><p>Marcador final a favor · {games.length} juegos · incluye desempate SO</p><TrendBars bars={games.map(g=>({id:g.id,value:g.score,title:g.opp+' · '+g.score+'–'+g.against+' '+g.finish,label:g.opp+' '+g.score}))} scale={Math.max(1,...games.map(g=>g.score))}/><p>Diferencial {games.reduce((a,g)=>a+g.score-g.against,0)} · Goles a favor/en contra {mean('goals')} / {mean('allowed')} · Tiros a favor/en contra {mean('shots')} / {mean('shotsAgainst')} por juego</p></>:<p>Sin serie comparable para esta ventana.</p>}
    <p>Portero {t.goalie.name??na} · {t.goalie.status}</p>
    <p>Portero observado en la ventana · {starts.length} apariciones · Atajadas {starts.length?total('saves'):na} · SV% {percentage(total('sa')?total('saves')/total('sa'):null)} · GAA {total('seconds')?(3600*total('ga')/total('seconds')).toFixed(2):na}</p>
    {games.length>0&&<details><summary>Jugadores y cruces observados</summary>{games.map(g=><details key={g.id}><summary>{g.id} · vs {g.opp} · {g.finish}</summary><p>Goles {g.goals}–{g.allowed} · Tiros {g.shots??'—'}–{g.shotsAgainst??'—'}</p><table><thead><tr><th>Jugador</th><th>Tiros</th><th>G</th><th>A</th></tr></thead><tbody>{g.skaters.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.s??'—'}</td><td>{p.g??'—'}</td><td>{p.a??'—'}</td></tr>)}</tbody></table>{g.meetings.map(m=><p key={m.shooter+'-'+m.goalie}>#{m.shooter} vs portero #{m.goalie} · {m.s} tiros · {m.g} goles</p>)}</details>)}</details>}
    <p>PP {percentage(t.specialTeams.currentGamesMatch?t.specialTeams.powerPlayPct:null)} · PK {percentage(t.specialTeams.currentGamesMatch?t.specialTeams.penaltyKillPct:null)}</p>
    <p>Descanso {t.rest.verified?t.rest.daysOff??na:na} días · B2B {t.rest.verified&&typeof t.rest.backToBack==='boolean'?(t.rest.backToBack?'Sí':'No'):na}</p>
    {t.last10.complete&&t.last10.sequenceVerified&&<p>Goles a favor/en contra por período (L10) · {t.last10.periods.map(p=>'P'+p.period+' '+(p.goalsForPerGame??'—')+'/'+(p.goalsAgainstPerGame??'—')+' (n='+p.goalsCoverage+')').join(' · ')}</p>}
  </section>;
}
export default function Sheet({date,data}){
 const [market,M]=useState('ml'),[band,B]=useState('all'),[window,W]=useState('10'),[game,G]=useState('all');
 const visible=data?.games.filter(g=>game==='all'||game===g.id)??[];
 const ranks=(band==='all'?['standard','heavy']:[band]).map(b=>({band:b,entries:rankThresholds(visible,data?.prices??[],market,b,window)}));
 return <main className={s.sheet}><a href="/nhl">← Panel NHL</a><header className={s.hero}><b>NHL · {date}</b><h1>Cheat Sheets</h1><p>Comparativas y cuotas archivadas.</p></header>
 <form><label>Jornada <input type="date" name="date" defaultValue={date}/></label> <button>Consultar</button></form>
 <div className={s.controls}><FilterGroup label="Mercado" options={markets} value={market} onChange={M}/><FilterGroup label="Historial" options={{5:'Últimos 5',10:'Últimos 10',h2h:'Contra el rival en L10'}} value={window} onChange={W}/><FilterGroup label="Cuotas" options={bands} value={band} onChange={B}/></div>
 <label>Partido <select value={game} onChange={e=>G(e.target.value)}><option value="all">Todos</option>{data?.games.map(g=><option key={g.id} value={g.id}>{g.away} @ {g.home}</option>)}</select></label>
 {data&&ranks.map(r=><section key={r.band}><h2 className={s.heading}>Top 10 histórico · {markets[market]} · {bands[r.band]}</h2>{r.entries.length?<ol>{r.entries.map(({game:g,quote:q,hits,n,ties},i)=><li key={g.id+q.side}>{i+1}. {g.away} @ {g.home} · {({home:g.home,away:g.away,over:'Más de',under:'Menos de'})[q.side]} {q.line??''} · {q.price>0?'+':''}{q.price} · {hits}/{n} sobre el umbral · {ties} empates</li>)}</ol>:<p>Sin cuotas y muestras comparables de al menos cinco partidos.</p>}</section>)}
 <p className={s.note}>Frecuencia histórica sobre marcadores finales con desempate. En totales se combinan los partidos únicos de ambos equipos. Cuotas descriptivas de Circa. Reglas de reglamentario, prórroga y shootout pendientes de verificación.</p>
 {!data?<p>Lectura incompleta. Revisa la fecha o vuelve a intentar.</p>:!data.games.length?<p>Sin partidos archivados para esta jornada.</p>:<div className={s.grid}>{data.games.filter(g=>game==='all'||game===g.id).map(g=>{
 const prices=data.prices.filter(p=>p.id===g.id&&p.market===market&&inBand(p.price,band));
 return <SheetCard key={g.id}><header><small>{new Date(g.time).toLocaleTimeString('es-PR',{timeZone:'America/Puerto_Rico',hour:'numeric',minute:'2-digit'})} PR</small><h2>{g.away} @ {g.home}</h2></header>
 <div className={s.score}>{markets[market]}</div><div className={s.analysis}>{prices.length?prices.map(p=><p key={p.side}>{({away:g.away,home:g.home,over:'Más de',under:'Menos de'})[p.side]} {p.line??''} · Circa {p.price>0?'+':''}{p.price} · {new Date(p.captured).toLocaleTimeString('es-PR',{timeZone:'America/Puerto_Rico'})} PR</p>):<p>Sin cuota comparable en este rango.</p>}
 <details><summary>Análisis del partido</summary>{g.fixture&&<p>Corte prepartido en Pick · {new Date(g.fixture.availableAsOf).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'})} PR</p>}{g.fixture?Object.entries(g.fixture.teams).map(([side,t])=><Team key={side} team={t} window={window} opponent={g.fixture.teams[side==='home'?'away':'home'].abbrev}/>):<p>Sin corte prepartido de equipos y porteros para este partido.</p>}<p>Lesiones y alineación completa · Sin confirmar en este corte.</p></details></div></SheetCard>;})}</div>}</main>;
}
