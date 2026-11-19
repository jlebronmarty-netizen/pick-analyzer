'use client';
import {useEffect,useMemo,useState} from 'react';

const NAV=[
 {id:'top',title:'Top 25',subtitle:'Oportunidades para revisar'},
 {id:'ml',title:'Moneyline',subtitle:'Ganador y margen'},
 {id:'spread',title:'Spread',subtitle:'Hándicap'},
 {id:'total',title:'Total',subtitle:'Puntos del partido'},
 {id:'props',title:'Player props',subtitle:'Jugadores y combinaciones'},
 {id:'periods',title:'Cuartos / Mitades',subtitle:'Q1–Q4, H1 y H2'}
];
const markets={moneyline:'Moneyline',spread:'Spread',total:'Total',props:'Prop',team_total_home:'Total local',team_total_away:'Total visitante'};
const periodLabels={ft:'Partido',q1:'1Q',q2:'2Q',q3:'3Q',q4:'4Q',h1:'1H',h2:'2H (+OT)'};
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
function decimal(v,d=1){return num(v)===null?'—':v.toFixed(d);}
function odds(v){return num(v)===null?'Sin cuota':v>0?'+'+v:String(v);}
function date(v){if(!v)return 'Sin fecha';return new Date(v).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function humanReason(row){
 if(row.reason==='INSUFFICIENT_TEAM_HISTORY')return 'Faltan resultados previos de ambos equipos';
 if(row.reason==='PLAYER_IDENTITY_OR_HISTORY_UNVERIFIED')return 'Falta historial suficiente o identidad/equipo del jugador';
 if(row.reason==='NO_CALIBRATED_PROBABILITY')return 'Brecha descriptiva sin probabilidad calibrada';
 if(row.reason==='UNVALIDATED_NUMERIC_GAP')return 'Brecha y contexto histórico favorables, sin validación de EV';
 return row.reason??'Sin evidencia suficiente';
}
function Row({row}){
 const [expanded,setExpanded]=useState(false);
 return <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0 flex-1">
    <p className="text-xs text-slate-400">{row.matchup} · {periodLabels[row.period]??row.period} · {markets[row.market]??row.market}</p>
    <p className="mt-1 font-semibold text-slate-100">{row.label}</p>
    <p className="mt-1 text-xs text-slate-400">Precio capturado {date(row.capturedAt)} · {row.source} · {row.quoteFreshness==='RECENT'?'Reciente':'Desactualizado'}</p>
   </div>
   <span className={'rounded-full px-2 py-1 text-xs font-medium '+(row.classification==='VIGILAR'?'bg-amber-950 text-amber-200':'bg-slate-800 text-slate-300')}>{row.classification}</span>
  </div>
  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
   <div><p className="text-xs text-slate-400">FanDuel / Línea</p><p className="font-semibold tabular-nums">{row.line===null?'ML':decimal(row.line)} <span className="text-sky-200">{odds(row.odds)}</span></p></div>
   <div><p className="text-xs text-slate-400">{row.market==='moneyline'?'Margen estimado':'Proyección'}</p><p className="font-semibold tabular-nums">{decimal(row.projection,2)}</p></div>
   <div><p className="text-xs text-slate-400">Brecha favorable</p><p className="font-semibold tabular-nums">{row.advantage===null?'—':(row.advantage>0?'+':'')+decimal(row.advantage,2)}</p></div>
   <div><p className="text-xs text-slate-400">L5 / L10</p><p className="font-semibold tabular-nums">{decimal(row.l5)}/{decimal(row.l10)}</p></div>
   <div><p className="text-xs text-slate-400">Historial / aciertos</p><p className="font-semibold tabular-nums">{row.hit10!=null?row.hit10+'/'+row.sample:row.sample!=null?row.sample+' partidos':'—'}</p></div>
   <div><p className="text-xs text-slate-400">Probabilidad / EV</p><p className="font-semibold text-amber-200">Sin calibrar</p></div>
  </div>
  <div className="mt-3 flex items-center justify-between gap-2">
   <p className="text-xs text-slate-300">{humanReason(row)}</p>
   <button type="button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded} className="shrink-0 rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-100">{expanded?'Ocultar':'Ver contexto'}</button>
  </div>
  {expanded&&<div className="mt-3 rounded-lg bg-slate-950 p-3 text-sm leading-6 text-slate-200">
   <p><strong>Modelo:</strong> {row.method??'Sin modelo aplicable a este contrato.'}</p>
   {row.playerId!=null&&<p><strong>Jugador:</strong> {row.playerName} (ID GOAT {row.playerId}). Minutos L5/L10: {decimal(row.minutesL5)}/{decimal(row.minutesL10)}.</p>}
   {row.hit5!=null&&<p><strong>Frecuencia histórica al umbral de hoy:</strong> {row.hit5}/5 y {row.hit10}/{row.sample}; no es probabilidad futura.</p>}
   <p><strong>Riesgo:</strong> lesiones, descansos, cambios de rotación, disponibilidad regional y movimientos de cuota no están cuantificados en esta proyección.</p>
   <p><strong>Decisión:</strong> {row.classification==='VIGILAR'?'Investigar y confirmar antes de apostar.':'PASAR hasta tener evidencia suficiente.'}</p>
  </div>}
 </article>;
}
export default function DecisionBoard(){
 const [data,setData]=useState(null),[learning,setLearning]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [tab,setTab]=useState('top'),[search,setSearch]=useState(''),[gameId,setGameId]=useState('all');
 const [period,setPeriod]=useState('all'),[limit,setLimit]=useState(30);
 async function refresh(){
  setLoading(true);setError('');
  try{const res=await fetch('/api/nba/decision-board',{cache:'no-store'});
   const out=await res.json();if(!res.ok)throw Error(out.status??'NO_DATA');
   setData(out);
   try {
    const lr=await fetch('/api/nba/decision-learning',{cache:'no-store'});
    if(lr.ok)setLearning(await lr.json());
    else setLearning(null);
   } catch {setLearning(null);}
  }catch(e){setError(e?.message??'NO_DATA');}finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 const entries=useMemo(()=>{
  if(!data)return [];
  const input=tab==='top'?data.top25:data.rows[tab]??[];
  return input.filter(x=>(gameId==='all'||String(x.gameId)===gameId)&&
   (tab!=='periods'||period==='all'||x.period===period)&&
   (!search||(x.label+' '+x.matchup+' '+x.market).toLowerCase().includes(search.toLowerCase())));
 },[data,tab,search,gameId,period]);
 function activate(next){setTab(next);setGameId('all');setPeriod('all');setSearch('');setLimit(30);}
 return <main className="mx-auto max-w-7xl space-y-5 px-3 py-6 text-slate-100">
  <header className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
   <div className="flex flex-wrap justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-widest text-sky-300">Pick Analyzer · NBA</p>
     <h1 className="mt-2 text-2xl font-bold">Decision Board</h1>
     <p className="mt-2 text-sm text-slate-300">Un solo panel para comparar proyecciones, FanDuel e historial. Todas las recomendaciones son SHADOW hasta calibrarse.</p>
    </div>
    <div className="flex flex-wrap items-start gap-2">
     <a href="/nba-market-data" className="inline-flex h-9 items-center rounded-lg border border-slate-600 px-4 text-sm text-slate-200">Vista técnica GOAT</a>
     <button type="button" onClick={refresh} disabled={loading} className="h-9 rounded-lg border border-sky-600 px-4 text-sm text-sky-200 disabled:opacity-50">{loading?'Actualizando…':'Actualizar sin consumir API'}</button>
    </div>
   </div>
   <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
    {[['Partidos',data?.summary?.games??'—'],['En observación',data?.summary?.watchCandidates??'—'],['Picks calibrados',data?.summary?.calibratedPicks??0],['Última captura Hoops',data?.summary?.latestHoopsCapture?date(data.summary.latestHoopsCapture):'—']].map(([name,value])=>
    <div key={name} className="rounded-lg bg-slate-900 p-3"><p className="text-xs text-slate-400">{name}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>)}
   </div>
   <p className="mt-3 text-xs text-slate-400">Datos almacenados · {data?.asOf?date(data.asOf):'—'} · Sin llamadas a proveedores ni cambios a modelos oficiales.</p>
  </header>
  <nav aria-label="Mercados NBA" className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
   {NAV.map(t=><button type="button" key={t.id} onClick={()=>activate(t.id)}
    aria-current={tab===t.id?'page':undefined}
    className={'rounded-xl border px-3 py-3 text-left '+(tab===t.id?'border-sky-500 bg-sky-950':'border-slate-700 bg-slate-900')}>
    <p className="font-semibold">{t.title}</p><p className="mt-1 text-xs text-slate-400">{t.subtitle}</p></button>)}
  </nav>
  <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
   <h2 className="text-lg font-semibold">Seguimiento y aprendizaje</h2>
   <p className="mt-1 text-sm text-slate-300">Resultados liquidados de los modelos originales (no del Top 25). La mejora automática propone candidatos; nunca modifica pesos sin validación externa.</p>
   <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
    {['moneyline','spread','total','props','periods'].map(m=>{const a=data?.accuracy?.[m];return <div key={m} className="rounded-lg bg-slate-950 p-3">
     <p className="text-xs text-slate-400">{markets[m]??(m==='periods'?'Cuartos/mitades':m)}</p>
     <p className="mt-1 font-semibold">{a?.hitRate!=null?a.hitRate.toFixed(1)+'%':'Sin calibrar'}</p>
     <p className="text-xs text-slate-400">Liquidaciones: {a?.settled??0} · MAE: {decimal(a?.projectionMae,2)}</p>
    </div>})}
   </div>
   {learning&&<div className="mt-3 rounded-lg border border-sky-800 p-3 text-sm">
    <p className="font-semibold text-sky-200">Aprendizaje prospectivo SHADOW</p>
    <p className="mt-1 text-slate-300">Predicciones congeladas: {learning.frozenRowsSeen}. Resultados evaluados: {learning.outcomesSeen}. Ajustes automáticos a modelos oficiales: 0.</p>
    {learning.metrics?.length>0&&<div className="mt-2 flex flex-wrap gap-2">
     {learning.metrics.slice(0,8).map((r,i)=><span key={i} className="rounded-lg bg-slate-950 px-2 py-1 text-xs text-slate-300">{r.market} {periodLabels[r.period]??r.period}: MAE {decimal(r.mae,2)} · {r.uniqueGames} juegos</span>)}
    </div>}
    {!learning.fullHistoryExhaustive&&<p className="text-amber-200">Muestra paginada; no es el acumulado completo.</p>}
   </div>}
   <p className="mt-2 text-xs text-amber-200">Las muestras pequeñas no certifican probabilidad; props y cuartos requieren seguimiento prospectivo congelado, liquidaciones y validación independiente.</p>
  </section>
  <section className="space-y-3">
   <div className="flex flex-wrap items-center gap-2">
    <label className="text-xs text-slate-300" htmlFor="nba-game-filter">Partido</label>
    <select id="nba-game-filter" value={gameId} onChange={e=>{setGameId(e.target.value);setLimit(30);}} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
     <option value="all">Todos</option>{(data?.games??[]).map(g=><option key={g.id} value={String(g.id)}>{g.away} @ {g.home}</option>)}
    </select>
    {tab==='periods'&&<select aria-label="Período" value={period} onChange={e=>{setPeriod(e.target.value);setLimit(30);}} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
     <option value="all">Todos los períodos</option>{['q1','q2','q3','q4','h1','h2','ft'].map(p=><option key={p} value={p}>{periodLabels[p]}</option>)}
    </select>}
    <input aria-label="Buscar jugador, mercado o equipo" value={search} onChange={e=>{setSearch(e.target.value);setLimit(30);}} placeholder="Buscar jugador, equipo o mercado" className="min-w-56 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"/>
   </div>
   <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">{NAV.find(t=>t.id===tab)?.title} <span className="text-sm font-normal text-slate-400">({entries.length})</span></h2>
    {tab==='top'&&<p className="text-sm text-amber-200">Orden de revisión · NO es ranking de probabilidades certificadas</p>}
   </div>
   {error&&<p role="alert" className="rounded-xl border border-rose-700 bg-rose-950 p-4 text-sm">No pude cargar el panel: {error}</p>}
   {!loading&&!error&&entries.length===0&&<p role="status" className="rounded-xl border border-slate-700 p-6 text-slate-300">No hay selecciones con evidencia suficiente para este filtro. Se mantiene PASAR.</p>}
   {entries.slice(0,limit).map(r=><Row key={r.id} row={r}/>)}
   {entries.length>limit&&<button type="button" onClick={()=>setLimit(x=>x+30)} className="rounded-xl border border-sky-500 px-4 py-2 text-sm text-sky-200">Ver 30 selecciones más</button>}
  </section>
  <footer className="border-t border-slate-700 py-4 text-xs text-slate-400">
   <p>Mercados y cuotas son capturas históricas de proveedores etiquetadas FanDuel. La región de Puerto Rico, disponibilidad de ejecución, lesiones y liquidación individual no están certificadas.</p>
   <p className="mt-1">Versión {data?.version??'—'}. Los modelos no se promueven automáticamente. Histórico GOAT archivado {data?.evidence?.historyCaptureAt?date(data.evidence.historyCaptureAt):'no disponible'}.</p>
  </footer>
 </main>;
}
