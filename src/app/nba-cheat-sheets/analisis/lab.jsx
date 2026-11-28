'use client';
import {useJornada,JornadaControls,ContextLink,useSheetFilter} from "@/components/cheat-sheets/jornada";
import {eligible} from "@/lib/cheat-sheets/jornada.mjs";
import {useState} from 'react';
import Link from 'next/link';
import {SheetCard,TrendBars} from '@/components/cheat-sheets/presentation';
import styles from '@/components/cheat-sheets/sheet.module.css';
import labStyles from './lab.module.css';
import {oddsBands} from '@/lib/nba/cheat-ranking.mjs';
import {marketLabels,rankContracts,sorts} from '@/lib/nba/sheet-lab/rank.mjs';
import {playerValues} from '@/lib/nba/sheet-lab/nba-props.mjs';
import {segmentValues} from '@/lib/nba/sheet-lab/nba-evidence.mjs';
const periods={FT:'Partido completo',Q1:'Q1',Q2:'Q2',Q3:'Q3',Q4:'Q4','1H':'Primera mitad','2H':'Segunda mitad',OT:'Prórroga'};
const num=v=>Number.isFinite(v)?Number(v.toFixed(2)):'—';
const date=v=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',month:'short',day:'numeric'}).format(new Date(v));
function Select({label,value,options,onChange}){
 return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}>{Object.entries(options).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>;
}
function Profile({profile,row}){
 const [period,setPeriod]=useState(row.period);
 const series=profile.history.slice().reverse().map(g=>{const v=period==='FT'?g.FT:playerValues(segmentValues(g.periods[period]));return {date:g.date,id:g.id,value:v[row.metric]};});
 const comparable=period===row.period&&series.some(g=>Number.isFinite(g.value));
 return <details><summary>Perfil y auditoría de participaciones</summary><div className={styles.analysis}>
 <Select label="Período del historial " value={period} options={periods} onChange={setPeriod}/>
 {comparable&&<><p>Línea {row.side==='over'?'Over':'Under'} {row.line} · {series.filter(g=>Number.isFinite(g.value)).length} juegos con dato</p>
 <TrendBars scale={Math.max(1,row.line,...series.map(g=>g.value??0))} bars={series.filter(g=>Number.isFinite(g.value)).map(g=>({id:g.id,value:g.value,hit:row.side==='over'?g.value>row.line:g.value<row.line,title:date(g.date),label:date(g.date)+' · '+g.value}))}/></>}
 {!comparable&&<p>Sin línea e historial comparables para esta gráfica.</p>}
 <table><thead><tr><th>Partido</th><th>{marketLabels[row.market]} · {period}</th></tr></thead><tbody>{series.map(g=><tr key={g.id}><td>{date(g.date)}</td><td>{num(g.value)}</td></tr>)}</tbody></table>
 <h3>Participaciones del calendario</h3>{!profile.audit.length&&<p>Equipo o calendario sin verificar.</p>}{profile.audit.map(g=><p key={g.id}>{date(g.start)} · {g.state}{g.missing?' · faltan '+g.missing:''}</p>)}</div></details>;
}
export default function Lab({fixtures=[],frozen,data,initialGame='',initialPlayer=''}){
 const [filters,set]=useState({market:'',period:'',side:'',game:initialGame,player:initialPlayer,band:'-250',sort:'rate'});
 const state=useJornada(data.date,data.at,[...fixtures.map(g=>g.start),...data.rows.map(r=>r.expires)],frozen),{now}=state;
 const fixtureMap=new Map(fixtures.map(g=>[g.id,g]));
 const [linkedBand,setLinkedBand]=useSheetFilter("nba","band","-250");
 const band=linkedBand==="both"?filters.band:linkedBand;
 const update=k=>v=>k==="band"?setLinkedBand(v):set(f=>({...f,[k]:v,...(k==='game'?{player:''}:{})}));
 const live=data.rows.filter(r=>state.visible(fixtureMap.get(String(r.gameId))??{}) && eligible(fixtureMap.get(String(r.gameId)),now,r.expires)&&Date.parse(r.start)>now);
 const ranked=rankContracts(live,{...filters,band},now);
 const games=Object.fromEntries(live.map(r=>[r.gameId,r.game])),players=Object.fromEntries(live.filter(r=>!filters.game||String(r.gameId)===filters.game).map(r=>[r.playerId,r.name]));
 const profileRow=filters.player&&live.find(r=>String(r.playerId)===filters.player&&(!filters.game||String(r.gameId)===filters.game)&&(!filters.market||filters.market===r.market)&&(!filters.period||filters.period===r.period));
 return <main className={styles.sheet}><ContextLink href="/nba-cheat-sheets">← Cheat Sheets</ContextLink>
 <header className={styles.hero}><p>NBA / {data.date}</p><h1>Análisis por contrato</h1><p>Frecuencias y condiciones observadas en líneas archivadas de FanDuel.</p></header>
 <JornadaControls state={state} games={fixtures} list/>
 <div className={styles.controls+" "+labStyles.filters}>{Object.entries({
 market:['Mercado',{'':'Top 10 general',...marketLabels}],game:['Partido',{'':'Todos',...games}],player:['Jugador',{'':'Todos',...players}],side:['Lado',{'':'Ambos',over:'Over',under:'Under'}],period:['Período',{'':'Todos',...periods}],band:['Rango de cuotas',oddsBands],sort:['Orden',sorts]
 }).map(([k,[label,options]])=><Select key={k} label={label+' '} options={options} value={k==="band"?band:filters[k]} onChange={update(k)}/>)}</div>
 <h2 className={styles.heading}>Top 10 · {marketLabels[filters.market]??'General'}</h2>
 <p>Al menos cinco valores comparables en diez apariciones observadas. La brecha se orienta al lado del contrato. Las condiciones cuentan criterios descriptivos.</p>
 {data.coverage&&<p className={styles.note}>Archivo del corte · {data.coverage.periodGames}/{data.coverage.selectedBoxes} boxes con parciales individuales conciliados. {data.coverage.calendarIssues>0?'Hay incidencias en el calendario histórico.':''}</p>}
 {profileRow&&<SheetCard><h2>{profileRow.name}</h2><Profile key={profileRow.id} profile={data.profiles[profileRow.key]} row={profileRow}/></SheetCard>}
 {!ranked.length&&<p className={styles.empty}>Sin contratos vigentes con muestra comparable para estos filtros.</p>}
 <div className={styles.grid}>{ranked.map((r,i)=><SheetCard key={r.id}><header><span>{r.game}</span><span>#{i+1} · {r.period}</span></header><h2>{r.name}</h2>
 <p className={styles.line}><strong>{r.line}</strong> {r.side==='over'?'Over':'Under'} · {marketLabels[r.market]}</p>
 <div className={styles.score}><b>{Math.round(r.rate*r.n)}/{r.n}</b><span>veces que cumplió<small>{r.principal?'Línea principal':'Alternativa'}</small></span></div>
 <div className={styles.stats}><div><small>Media</small>{num(r.avg)}</div><div><small>Brecha</small>{num(r.gap)}</div><div><small>Brecha %</small>{num(r.pct)}</div></div>
 <div className={styles.footer}>FanDuel {r.odds>0?'+':''}{r.odds} · {r.ot==='NOT_VERIFIED'?'Regla OT pendiente':r.ot}</div>
 {r.limitations.includes('PLAYER_AVAILABILITY_UNCONFIRMED')&&<p className={styles.limits}>Disponibilidad pendiente</p>}
 <details><summary>Condiciones favorables · {num(r.conditions)}/8</summary><div className={styles.analysis}>{Object.entries(r.checks).map(([k,v])=><p key={k}><b>{v==null?'Sin evidencia':v?'Cumple':'No cumple'}</b> · {k}</p>)}</div></details>
 <Profile profile={data.profiles[r.key]} row={r}/></SheetCard>)}</div></main>;
}
