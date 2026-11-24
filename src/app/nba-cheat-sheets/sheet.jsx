'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {rankSheet,hits,markets,outcome} from '@/lib/nba/cheat-ranking.mjs';
import {topProjections} from '@/lib/nba/cheat-projections.mjs';
import styles from './sheet.module.css';
const windows={ten:'Últimos 10',five:'Últimos 5',h2h:'Contra el rival'};
const time=v=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',hour:'numeric',minute:'2-digit'}).format(new Date(v));
const date=v=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',day:'numeric',month:'short'}).format(new Date(v));
function Buttons({label,options,value,onChange}){
  return <fieldset><legend>{label}</legend><div>{Object.entries(options).map(([id,text])=><button type="button" key={id} aria-pressed={value===id} onClick={()=>onChange(id)}>{text}</button>)}</div></fieldset>;
}
function Card({card:c,window:w,rank,alternatives}){
  const title=c.side==='over'&&c.line%1===0.5?Math.ceil(c.line)+'+':(c.side==='over'?'Más de ':'Menos de ')+c.line;
  return <article className={styles.card}><header><span>{c.matchup}</span><span>{time(c.start)} PR</span></header>
    <h2>{c.name}</h2><p className={styles.line}><strong>{title}</strong> {markets[c.market].toLowerCase()}</p>
    <div className={styles.score}><b>{hits(c,w)}/{c[w].length}</b><span>{windows[w]}<small>veces que cumplió</small></span><i>#{rank}</i></div>
    <div className={styles.stats}>{Object.entries(windows).map(([k,v])=><div key={k}><small>{v}</small><strong>{c[k].length?hits(c,k)+'/'+c[k].length:'—'}</strong></div>)}</div>
    <div className={styles.footer}><span>{c.book} <b>{c.odds>0?'+':''}{c.odds}</b></span><span>Actualizada {time(c.updated)} PR</span></div>
    <details><summary>Ver los {c[w].length} juegos</summary><table><caption>Del más reciente al más antiguo</caption><thead><tr>{['Fecha','Rival','Min','Total','Resultado'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{c[w].map(r=><tr key={r.id}><td>{date(r.date)}</td><td>{r.rival}</td><td>{Math.round(r.minutes)}</td><td>{r.value}</td><td>{{win:'Acierto',push:'Empate',loss:'Fallo'}[outcome(c,r.value)]}</td></tr>)}</tbody></table>{alternatives.length>0 && <section><h3>Otras líneas verificadas</h3><ul>{alternatives.map(a=><li key={a.quoteId}>{a.side==='over'?'Más de':'Menos de'} {a.line} · {hits(a,w)}/{a[w].length} · {a.odds>0?'+':''}{a.odds}</li>)}</ul></section>}</details></article>;
}
export default function Sheet({cards=[],projections=[],day,asOf,showReference=false,captureFailed=false}){
  const [market,setMarket]=useState('points'),[w,setWindow]=useState('ten'),[floor,setFloor]=useState('-300'),[now,setNow]=useState(Date.parse(asOf));
  useEffect(()=>{setNow(Date.now());const id=setInterval(()=>setNow(Date.now()),15000);return ()=>clearInterval(id);},[asOf]);
  const active=cards.filter(c=>Date.parse(c.expiresAt)>now && c.odds>=Number(floor));
  const ranked=rankSheet(active,market,w,Number(floor));
  const projected=topProjections(projections,market,w,Number(floor),now);
  return <main className={styles.sheet}><Link href="/nba-decision-board">← Decision Board</Link>
    <header className={styles.hero}><p>NBA <span> / </span> {date(day+'T12:00:00Z')}</p><h1>Cheat Sheets</h1><p>Las líneas de hoy frente al historial de cada jugador.</p></header>
    {captureFailed && <p role="status">La captura de seguimiento está pendiente.</p>}
    <div className={styles.controls}><Buttons label="Mercado" options={markets} value={market} onChange={setMarket}/><Buttons label="Historial" options={windows} value={w} onChange={setWindow}/><Buttons label="Cuota mínima" options={{'-300':'−300 o mejor','-200':'−200 o mejor'}} value={floor} onChange={setFloor}/></div>
    {w!=='h2h' && <section aria-label="Proyecciones de Pick">
      <h2 className={styles.heading}>Proyecciones de Pick · {markets[market]}</h2>
      <p aria-live="polite">{projected.length} de hasta 10 jugadores · Ordenados por aciertos en {windows[w].toLowerCase()}.</p>
      {projected.length ? <div className={styles.grid}>{projected.map(r=><article key={r.quote} className={styles.card}>
        <header><span>{r.matchup}</span><span>{time(r.start)} PR</span></header><h2>{r.name}</h2>
        <p className={styles.line}><strong>{r.projection.toFixed(1)}</strong> {markets[market].toLowerCase()} · proyección</p>
        <div className={styles.score}><b>{r[w]}/{w==='ten'?10:5}</b><span>{r.side==='Over'?'Más de':'Menos de'} {r.line}<small>veces que cumplió esa línea</small></span></div>
        <div className={styles.stats}><div><small>Promedio L5</small><strong>{r.l5}</strong></div><div><small>Promedio L10</small><strong>{r.l10}</strong></div><div><small>Proyección − línea</small><strong>{(r.projection-r.line>0?'+':'')+(r.projection-r.line).toFixed(1)}</strong></div></div>
        <div className={styles.footer}><span>FanDuel <b>{r.odds>0?'+':''}{r.odds}</b></span><span>Captura {time(r.captured)} PR</span></div>
        <details><summary>{r.warnings.length?'Validación parcial':'Ver cálculo'}</summary><p>Proyección descriptiva de Pick. Usa 65% del promedio L5 y 35% del L10 en juegos con al menos 10 minutos.</p>{r.warnings.map(v=><p key={v}>{v}</p>)}</details>
      </article>)}</div>:<p className={styles.empty}>Sin proyecciones de Pick con línea comparable para estos filtros.</p>}
    </section>}
    <h2 className={styles.heading}>Top 10 verificado · {markets[market]}</h2><p aria-live="polite">{ranked.length} {ranked.length===1?'jugador':'jugadores'} · {windows[w]} · Cuotas al {time(asOf)} PR</p>
    {ranked.length?<div className={styles.grid}>{ranked.map((c,i)=><Card key={c.quoteId} card={c} window={w} rank={i+1} alternatives={active.filter(a=>a.market===market && a.playerId===c.playerId && a.quoteId!==c.quoteId && a[w].length>=(w==='ten'?10:5))}/>)}</div>:<div className={styles.empty}><strong>Sin tarjetas para estos filtros</strong><p>Se necesita una cuota prepartido vigente y un historial verificable. Prueba otro mercado o revisa después de la próxima captura.</p></div>}
    {showReference && <details className={styles.reference}><summary>Ver ejemplo visual de una tarjeta</summary>
      <p>Ejemplo de tu referencia del 18 de noviembre. El ranking de hoy aparece arriba.</p>
      <article className={styles.card}><header><span>NBA · Asistencias</span><span>18 nov</span></header>
        <h2>Klay Thompson</h2><p className={styles.line}><strong>2+</strong> asistencias</p>
        <div className={styles.score}><b>9/10</b><span>Contra Milwaukee<small>veces que cumplió</small></span></div>
      </article></details>}
    <p className={styles.note}>Cada acierto se calcula con la línea indicada. Los empates cuentan como juegos disputados. Contra el rival usa hasta 10 encuentros del archivo de temporada y requiere 5 para entrar al ranking. Las frecuencias son históricas.</p></main>;
}
