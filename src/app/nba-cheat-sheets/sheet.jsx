'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {oddsBands,inOddsBand,rankSheet,hits,markets,outcome} from '@/lib/nba/cheat-ranking.mjs';
import {topProjections} from '@/lib/nba/cheat-projections.mjs';
import Rival from './rival';
import {FilterGroup, SheetCard, TrendBars} from '@/components/cheat-sheets/presentation';
import styles from '@/components/cheat-sheets/sheet.module.css';
const windows={ten:'Últimos 10',five:'Últimos 5',h2h:'Contra el rival'};
const time=v=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',hour:'numeric',minute:'2-digit'}).format(new Date(v));
const date=v=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',day:'numeric',month:'short'}).format(new Date(v));
function Trend({row:r,initial}){
  const [window,setWindow]=useState(initial);
  const series=(r.trend??[]).slice(0,window==='five'?5:10).reverse();
  const scale=Math.max(1,r.line,...series.map(g=>g.value));
  return <div className={styles.trend}><div className={styles.stats}>
    {['five','ten'].map((k,i)=><button type="button" key={k} aria-pressed={k===window} onClick={()=>setWindow(k)}><small>Promedio L{i?10:5}</small><strong>{i?r.l10:r.l5}</strong></button>)}
    <div><small>{r.threshold!=null?'Proyección − umbral':'Proyección − línea'}</small><strong>{(r.projection-r.line>0?'+':'')+(r.projection-r.line).toFixed(1)}</strong></div></div>
    {series.length ? <figure><figcaption>{windows[window]} · del más antiguo al reciente</figcaption>
      <TrendBars scale={scale} bars={series.map(g=>({
        id:g.id, value:g.value, hit:r.threshold!=null?g.value>=r.threshold:outcome({side:r.side.toLowerCase(),line:r.line},g.value)==='win',
        title:date(g.date)+' · '+g.rival+' · '+g.value,
        label:date(g.date)+' contra '+g.rival+': '+g.value
      }))}/><small>{r.threshold!=null?'Verde = alcanzó el umbral de ':'Verde = cumplió la línea de '}{r.line}</small></figure>:<small>Desglose por juego pendiente.</small>}
  </div>;
}
function Limits({row:r}){
  return r.warnings.length>0&&<p className={styles.limits}><b>Pendiente de validar</b> · {r.warnings.map(v=>({'Box score original pendiente de cotejo':'box score original','Regla de tiempo extra pendiente':'regla de tiempo extra','Disponibilidad del jugador pendiente':'disponibilidad del jugador'}[v]??v)).join(' · ')}</p>;
}
function ProfileLink({row}){
 return <p className={styles.limits}><Link href={"/nba-cheat-sheets/analisis?game="+row.gameId+"&player="+(row.playerId??row.player)}>Perfil detallado del jugador →</Link></p>;
}
function Card({card:c,window:w,rank,alternatives,asOf}){
  const title=c.side==='over'&&c.line%1===0.5?Math.ceil(c.line)+'+':(c.side==='over'?'Más de ':'Menos de ')+c.line;
  return <SheetCard><header><span>{c.matchup}</span><span>{time(c.start)} PR</span></header>
    <h2>{c.name}</h2><p className={styles.line}><strong>{title}</strong> {markets[c.market].toLowerCase()}</p>
    <div className={styles.score}><b>{hits(c,w)}/{c[w].length}</b><span>{windows[w]}<small>veces que cumplió</small></span><i>#{rank}</i></div>
    <div className={styles.stats}>{Object.entries(windows).map(([k,v])=><div key={k}><small>{v}</small><strong>{c[k].length?hits(c,k)+'/'+c[k].length:'—'}</strong></div>)}</div>
    <div className={styles.footer}><span>{c.book} <b>{c.odds>0?'+':''}{c.odds}</b></span><span>Actualizada {time(c.updated)} PR</span></div>
    <details><summary>Ver los {c[w].length} juegos</summary><table><caption>Del más reciente al más antiguo</caption><thead><tr>{['Fecha','Rival','Min','Total','Resultado'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{c[w].map(r=><tr key={r.id}><td>{date(r.date)}</td><td>{r.rival}</td><td>{Math.round(r.minutes)}</td><td>{r.value}</td><td>{{win:'Acierto',push:'Empate',loss:'Fallo'}[outcome(c,r.value)]}</td></tr>)}</tbody></table>{alternatives.length>0 && <section><h3>Otras líneas verificadas</h3><ul>{alternatives.map(a=><li key={a.quoteId}>{a.side==='over'?'Más de':'Menos de'} {a.line} · {hits(a,w)}/{a[w].length} · {a.odds>0?'+':''}{a.odds}</li>)}</ul></section>}</details><ProfileLink row={c}/><Rival row={c} asOf={asOf}/></SheetCard>;
}
function PlayerCard({row:r,w,asOf,rank}){
  return <SheetCard>
        <header><span>{r.matchup}</span><span>{time(r.start)} PR</span></header><h2>{r.name}</h2>
        <p className={styles.line}><strong>{r.projection.toFixed(1)}</strong> {markets[r.market].toLowerCase()} · proyección</p>
        <div className={styles.score}><b>{r[w]}/{w==='ten'?10:5}</b><span>{r.threshold!=null?r.threshold+'+ '+markets[r.market].toLowerCase():(r.side==='Over'?'Más de ':'Menos de ')+r.line}<small>{r.threshold!=null?'juegos en que alcanzó el umbral':'veces que cumplió esa línea'}</small></span><i>#{rank}</i></div>
        <Trend key={r.quote+w} row={r} initial={w}/>
        <div className={styles.footer}><span>FanDuel <b>{r.odds>0?'+':''}{r.odds}</b></span><span>{r.threshold!=null?'Actualizada':'Captura'} {time(r.threshold!=null?r.updated:r.captured)} PR</span></div>
        <Limits row={r}/>
        <ProfileLink row={r}/><Rival row={r} asOf={asOf}/>
  </SheetCard>;
}
function BandResults({cards,projections,milestones,coverage,market,w,floor,now,asOf}){
  const active=cards.filter(c=>Date.parse(c.expiresAt)>now && inOddsBand(c.odds,Number(floor)));
  const ranked=rankSheet(active,market,w,Number(floor));
  const projected=topProjections(projections,market,w,Number(floor),now);
  const observed=[...new Map(projections.filter(r=>r.market===market && inOddsBand(r.odds,Number(floor)) && Date.parse(r.expires)>now && r.meetings?.length).map(r=>[r.player,r])).values()].sort((a,b)=>b.meetings.length-a.meetings.length || a.name.localeCompare(b.name));
  const seen=new Set();
  const references=w==='h2h'?[]:milestones.filter(r=>r.market===market && inOddsBand(r.odds,Number(floor)) && r.expires>now)
    .sort((a,b)=>b[w]-a[w] || b.odds-a.odds || a.quote.localeCompare(b.quote))
    .filter(r=>{if(seen.has(r.player))return false;seen.add(r.player);return true;}).slice(0,10);
  const totals=coverage?.menus.reduce((sum,menu)=>{
    const counts=menu[market]?.[floor];
    return {strict:sum.strict+(counts?.strict??0),milestones:sum.milestones+(counts?.milestones??0)};
  },{strict:0,milestones:0});
  const [preferred,setPreferred]=useState('projection');
  const options={};
  if(projected.length)options.projection='Proyecciones de Pick';
  if(references.length)options.history='Hitos históricos';
  if(w==='h2h')options.meetings='Encuentros anteriores';
  if(ranked.length)options.verified='Contratos verificados';
  const view=Object.hasOwn(options,preferred)?preferred:Object.keys(options)[0];
  const sources=new Map(projections.map(r=>[r.quote,r]));
  const rows=view==='history'?references.map(m=>{
    const source=sources.get(m.projectionQuote);
    return {...source,...m,line:m.threshold,warnings:[...(source?.warnings??[]),'Reglas del hito pendientes · fuera del tracker']};
  }):projected;
  return <section aria-label={oddsBands[floor]}>
    <h2 className={styles.heading}>{markets[market]} · {oddsBands[floor]}</h2>
    {Object.keys(options).length>1 && <div className={styles.controls}><FilterGroup label="Ver tarjetas" options={options} value={view} onChange={setPreferred}/></div>}
    {(view==='history'||view==='projection') && <section><h3 className={styles.heading}>{options[view]}</h3>
      <p>{rows.length} de hasta 10 jugadores · {windows[w]}{view==='history'?' con al menos 10 minutos · frecuencia histórica del umbral.':'.'}</p>
      <div className={styles.grid}>{rows.map((r,i)=><PlayerCard key={r.quote+w} row={r} rank={i+1} w={w} asOf={asOf}/>)}</div></section>}
    {coverage && <p className={styles.note}>
      {coverage.menus.length>0 && <>Al corte de las {time(asOf)} PR · {totals.strict} líneas Over/Under archivadas · {totals.milestones} hitos excluidos por reglas pendientes. </>}
      {coverage.expected===0 ? 'Sin partidos prepartido en la cartelera consultada.' : <>Cobertura de cuotas de {coverage.menus.length} de {coverage.expected} partidos prepartido.</>}
    </p>}
    {view==='meetings' && <section><h2 className={styles.heading}>Encuentros anteriores · {markets[market]}</h2>
      {observed.length ? <div className={styles.grid}>{observed.map(r=><SheetCard key={r.quote}><header>Contra {r.rival}</header>
        <h2>{r.name}</h2><p className={styles.line}>{r.meetings.length} {r.meetings.length===1?'juego observado':'juegos observados'}</p>
        <div className={styles.footer}>{r.meetings.map(g=><span key={g.id}>{date(g.date)} · <b>{g.value}</b> {markets[market].toLowerCase()}</span>)}</div><Limits row={r}/><ProfileLink row={r}/><Rival row={r} asOf={asOf}/></SheetCard>)}</div>:
      <p className={styles.empty}>El archivo consultado para estos jugadores y líneas no muestra actuaciones previas ante el rival. La consulta cubre hasta 60 días de esta temporada.</p>}
      <p>El Top 10 requiere 5 encuentros verificables por jugador y una línea validada. Aquí puedes ver también muestras menores.</p></section>}
    {(!view||view==='verified') && <><h2 className={styles.heading}>Top 10 verificado · {markets[market]}</h2><p aria-live="polite">{ranked.length} {ranked.length===1?'jugador':'jugadores'} · {windows[w]} · Cuotas al {time(asOf)} PR</p>
    {ranked.length?<div className={styles.grid}>{ranked.map((c,i)=><Card key={c.quoteId} card={c} window={w} rank={i+1} asOf={asOf} alternatives={active.filter(a=>a.market===market && a.playerId===c.playerId && a.quoteId!==c.quoteId && a[w].length>=(w==='ten'?10:5))}/>)}</div>:<div className={styles.empty}><strong>Sin tarjetas para estos filtros</strong><p>Se necesita una cuota prepartido vigente y un historial verificable.</p></div>}
      </>}
  </section>;
}
export default function Sheet({cards=[],projections=[],milestones=[],coverage,day,asOf,showReference=false,captureFailed=false}){
  const [market,setMarket]=useState('points'),[w,setWindow]=useState('ten'),[floor,setFloor]=useState('both'),[now,setNow]=useState(Date.parse(asOf));
  useEffect(()=>{setNow(Date.now());const id=setInterval(()=>setNow(Date.now()),15000);return ()=>clearInterval(id);},[asOf]);
  return <main className={styles.sheet}><Link href="/nba-decision-board">← Decision Board</Link>
    <header className={styles.hero}><p>NBA <span> / </span> {date(day+'T12:00:00Z')}</p><h1>Cheat Sheets</h1><p>Las líneas de hoy frente al historial de cada jugador.</p></header>
    <details className={styles.method}><summary>Metodología y validación</summary><p>Pick calcula la proyección con 65% del promedio de los últimos 5 juegos y 35% del promedio de los últimos 10, en partidos con al menos 10 minutos. La gráfica muestra cuántas veces el jugador cumplió la línea. Las limitaciones de cada contrato aparecen en su tarjeta.</p></details>
    <p><Link href="/nba-cheat-sheets/analisis">Top 10 general, combinados y análisis por contrato →</Link> · <Link href="/nba-cheat-sheets/tracker">Tracker de resultados</Link></p>
    {captureFailed && <p role="status">La captura de seguimiento está pendiente.</p>}
    <div className={styles.controls}><FilterGroup label="Mercado" options={markets} value={market} onChange={setMarket}/><FilterGroup label="Historial" options={windows} value={w} onChange={setWindow}/><FilterGroup label="Rango de cuotas" options={{both:'Ambos rangos',...oddsBands}} value={floor} onChange={setFloor}/></div>
    {(floor==='both'?Object.keys(oddsBands):[floor]).map(band=><BandResults key={band} floor={band}
      cards={cards} projections={projections} milestones={milestones} coverage={coverage} market={market} w={w} now={now} asOf={asOf}/>)}
    {showReference && <details className={styles.reference}><summary>Ver ejemplo visual de una tarjeta</summary>
      <p>Ejemplo de tu referencia del 18 de noviembre. El ranking de hoy aparece arriba.</p>
      <SheetCard><header><span>NBA · Asistencias</span><span>18 nov</span></header>
        <h2>Klay Thompson</h2><p className={styles.line}><strong>2+</strong> asistencias</p>
        <div className={styles.score}><b>9/10</b><span>Contra Milwaukee<small>veces que cumplió</small></span></div>
      </SheetCard></details>}
    <p className={styles.note}>Cada acierto se calcula con la línea indicada. Los empates cuentan como juegos disputados. Contra el rival usa hasta 10 encuentros del archivo de temporada y requiere 5 para entrar al ranking. Las frecuencias son históricas.</p></main>;
}
