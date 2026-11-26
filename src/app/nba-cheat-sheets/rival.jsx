import {useEffect,useState} from 'react';
import styles from './sheet.module.css';

const metrics={pts:'Puntos',reb:'Rebotes',ast:'Asistencias',fg3m:'Triples',min:'Minutos',pf:'Faltas personales'};
const marketStat={points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'};
const periods=['L5','L10','Temporada'];
const day=v=>v?.length===10?v:new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'medium'}).format(new Date(v));
const number=v=>Number.isFinite(v)?v.toLocaleString('es-PR',{maximumFractionDigits:1}):'—';
function result(row,g){
 const v=g[marketStat[row.market]];
 if(!Number.isFinite(v))return 'Sin dato';
 if(v===row.line)return 'Empate';
 return (row.side.toLowerCase()==='over'?v>row.line:v<row.line)?'Cumplió':'Falló';
}
function Minutes({name,stats}){
 const [five,ten]=stats.min;
 return <p>{name} · {five.n===5&&ten.n===10?number(five.value-ten.value)+' min (L5 menos L10)':'Muestra insuficiente para comparar minutos L5 y L10.'}</p>;
}
export function RivalBody({data:d,row}){
 const [period,setPeriod]=useState(0);
 const other=d.other?.name||'Rival sin identificar';
 return <div className={styles.analysis}>
 <h3>Rival de la misma posición</h3>
 <p>{d.other?other+' · '+d.pos+' · '+d.rival.name:'Sin coincidencia única en las alineaciones archivadas de '+d.rival.name+'.'}</p>
 {d.lineupAt&&<small>Alineación archivada el {day(d.lineupAt)}. </small>}{d.roleDate&&<small>Posición del jugador según el archivo del {day(d.roleDate)}. </small>}
 <p>Compartir posición no confirma quién lo defenderá en este juego.</p>
 <h3>Comparativa por partido</h3>
 <div className={styles.periods}>{periods.map((v,i)=><button type="button" key={v} aria-pressed={i===period} onClick={()=>setPeriod(i)}>{v}</button>)}</div>
 <table><thead><tr><th>Promedio</th><th>{row.name}</th><th>{other}</th></tr></thead><tbody>{Object.entries(metrics).map(([k,v])=><tr key={k}><th>{v}</th>{[d.own,d.comparison].map((s,i)=><td key={i}>{number(s[k][period].value)} <small>({s[k][period].n})</small></td>)}</tr>)}</tbody></table>
 {(d.own.min[period].n<(period===1?10:5)||d.comparison.min[period].n<(period===1?10:5))&&<p><b>Muestra pequeña o incompleta para este período.</b></p>}
 <small>Entre paréntesis, juegos con dato. Las ventanas usan participaciones observadas. Las muestras pueden cubrir fechas distintas o faltar juegos.</small>
 <h3>Historial contra {d.rival.name}</h3>
 <p>Línea de referencia · {row.side.toLowerCase()==='over'?'Más de':'Menos de'} {row.line} {metrics[marketStat[row.market]]?.toLowerCase()}</p>
 {d.meetings.length<5&&<small>{d.meetings.length? 'Muestra pequeña · '+d.meetings.length+' encuentro(s).':'Sin encuentros individuales en el archivo consultado.'}</small>}
 {d.meetings.map(g=><div className={styles.record} key={g.gameId}><b>{day(g.date)} · {result(row,g)}</b><p>{g.score??'Marcador sin verificar'}</p><p>{Object.entries(metrics).map(([k,v])=>number(g[k])+' '+v.toLowerCase()).join(' · ')}</p></div>)}
 <h3>Defensa directa observada</h3>
 {d.direct.length?<><p>{row.name} en ataque ante {other}. {d.direct.length<5?'Muestra pequeña.':''}</p>{d.direct.map(g=><div className={styles.record} key={g.game_id}><b>{day(g.game_date)}</b><p>{number(g.matchup_seconds)} s · {number(g.player_points)} puntos · {number(g.fgm)}/{number(g.fga)} tiros · {number(g.assists)} asistencias · {number(g.turnovers)} pérdidas</p></div>)}</>:<p>Sin registro verificable de este emparejamiento defensivo.</p>}
 <h3>Lesiones y ausencias</h3>
 {[d.team,d.rival].map(t=><p key={t.id}><b>{t.name}</b> · {d.injuries.filter(i=>i.teamId===t.id).map(i=>(i.name||'Nombre sin registrar')+' ('+(i.status||'estado sin registrar')+')').join(', ')||'Sin reporte individual disponible.'}</p>)}
 <h3>Descanso y minutos</h3>
 {[d.team,d.rival].map((t,i)=><p key={t.id}>{t.name} · {d.rest[i]?(d.rest[i].days===0?'Back-to-back':d.rest[i].days+' día(s) desde el último juego final observado, excluyendo los días de partido')+' · '+day(d.rest[i].date):'Descanso sin verificar'}</p>)}
 <Minutes name={row.name} stats={d.own}/>{d.other&&<Minutes name={other} stats={d.comparison}/>}
 </div>;
}
export default function Rival({row,asOf}){
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const url='/api/nba/cheat-rival?'+new URLSearchParams({game:row.gameId,player:row.playerId??row.player,at:asOf});
 useEffect(()=>{
  if(!open)return;
  let active=true;
  const controller=new AbortController();
  setData(null);setFailed(false);
  fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(active)setData(v);}).catch(()=>{if(active)setFailed(true);});
  return ()=>{active=false;controller.abort();};
 },[url,open,retry]);
 return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Análisis del rival y enfrentamientos</summary>{open&&(data?<RivalBody data={data} row={row}/>:<p role="status">{failed?<>Análisis archivado no disponible. <button type="button" onClick={()=>setRetry(retry+1)}>Reintentar</button></>:'Consultando el archivo de Pick…'}</p>)}</details>;
}
