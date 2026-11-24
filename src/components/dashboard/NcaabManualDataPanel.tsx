'use client';

import {useEffect,useRef,useState} from 'react';
import type {NcaabManualDataReport,NcaabManualFixture,NcaabManualTeam,NcaabManualAggregate,NcaabManualMetric} from '@/types/ncaab-manual-data';

const tabs=['Resumen','Partidos','Equipos','Últimos 10','Estadísticas'] as const;
type Tab=typeof tabs[number];
const number=(v:number|null,p=1)=>v===null||!Number.isFinite(v)?'—':v.toLocaleString('es-PR',{maximumFractionDigits:p});
const percent=(v:number|null)=>v===null?'—':number(v*100)+'%';
const odds=(v:number|null)=>v===null?'—':v>0?'+'+v:String(v);
const stamp=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'short',timeStyle:'short'}).format(new Date(v))+' PR':'Sin hora';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const control='min-h-11 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300';
const coverage=(t:NcaabManualTeam)=>t.last10.coverage==='COMPLETE_TEN'?'Diez verificados':t.last10.coverage==='SEASON_UNDER_TEN'?t.last10.games+' juegos de temporada; aún no diez':t.last10.coverage==='NO_HISTORY'?'Sin historial':'Historial parcial';
const states:Record<NcaabManualFixture['state'],string>={PREGAME:'Por comenzar',LIVE:'En juego',FINAL:'Final',POSTPONED:'Pospuesto',CANCELLED:'Cancelado',UNKNOWN:'Estado sin verificar'};
const venues={HOME:'Local',AWAY:'Visitante',NEUTRAL:'Neutral',UNKNOWN:'Sin verificar'};

function SmallAggregate({title,data}:{title:string;data:NcaabManualAggregate}) {
  return <div className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-400">{title} · {data.games} juegos</p><p className="mt-1 font-semibold">{data.wins}–{data.losses} · {number(data.pointsFor)} / {number(data.pointsAgainst)} pts</p></div>;
}
function TeamSummary({team:t}:{team:NcaabManualTeam|undefined}) {
  if(!t)return <p className="text-sm text-slate-400">Sin historial verificado para este equipo.</p>;
  return <div className="min-w-0 space-y-2 rounded-lg border border-slate-700 p-3 text-sm">
    <p className="font-semibold text-teal-300">{t.name}</p>
    <p>Récord reportado: <strong>{t.reportedRecord?.overall??'Sin dato'}</strong></p>
    <p className="text-xs text-slate-400">Fuente: {stamp(t.reportedRecord?.capturedAt??null)}</p>
    <p>Archivo observado: {t.archive.wins}–{t.archive.losses} en {t.archive.games} juegos · {t.archive.completeSeason?'coincide con el récord reportado':'temporada parcial'}</p>
    <p>Puntos a favor / contra: {number(t.archive.pointsFor)} / {number(t.archive.pointsAgainst)} por juego</p>
    <p>Recientes: {t.last10.wins}–{t.last10.losses} · {coverage(t)}</p>
    <p>Puntos recientes: {number(t.last10.pointsFor)} / {number(t.last10.pointsAgainst)} · margen {number(t.last10.margin)}</p>
    <p>Descanso: {t.rest.verified?number(t.rest.daysOff,0)+' días sin partido':'Último partido sin secuencia completa'}</p>
  </div>;
}
function Fixture({fixture:f,teams}:{fixture:NcaabManualFixture;teams:Map<string,NcaabManualTeam>}) {
  const forecast=f.forecast;
  return <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="min-w-0 text-base font-semibold text-white">{f.awayName} @ {f.homeName}</h4><span className="rounded-full border border-slate-600 px-2 py-1 text-xs text-slate-300">{states[f.state]}</span></div>
    <p className="text-xs text-slate-400">{stamp(f.scheduledAt)} · {f.neutralSite===true?'Sede neutral':f.neutralSite===false?'Localía reportada':'Sede sin verificar'} · Captura {stamp(f.capturedAt)}</p>
    {f.state!=='PREGAME'&&f.homeScore!==null&&f.awayScore!==null?<p className="font-semibold">Marcador {f.awayScore} – {f.homeScore}</p>:null}
    <div className="grid gap-3 lg:grid-cols-2"><TeamSummary team={teams.get(f.awayId)}/><TeamSummary team={teams.get(f.homeId)}/></div>
    <details className="rounded-lg border border-slate-700 p-3 text-sm"><summary className="cursor-pointer font-semibold text-teal-300">Proyección y cuotas archivadas</summary>
      {forecast?<div className="mt-3 space-y-1"><p>Proyección guardada: <strong>{number(forecast.awayPoints)} – {number(forecast.homePoints)}</strong> · total {number(forecast.projectedTotal)} · margen local {number(forecast.projectedMargin)}</p><p>Probabilidad del modelo: {f.awayName} {percent(forecast.awayProbability)} · {f.homeName} {percent(forecast.homeProbability)}</p><p className="break-words text-xs text-slate-400">{forecast.model} · emisión {stamp(forecast.emittedAt)} · experimental, sin calibración certificada.</p></div>:<p className="mt-3 text-slate-400">No hay una proyección guardada que coincida con este partido y su horario.</p>}
      {f.markets.quotes.length?<div className="mt-3 space-y-2">{f.markets.quotes.map(q=><p key={q.sportsbook+q.market} className="rounded-lg bg-slate-900 p-2 text-xs"><strong>{q.sportsbook} · {q.market==='MONEYLINE'?'Moneyline':q.market==='SPREAD'?'Spread':'Total'}</strong><br/>{q.first.side==='OVER'?'Over':f.homeName}{q.first.line===null?'':' '+number(q.first.line)} ({odds(q.first.americanOdds)}) · {q.second.side==='UNDER'?'Under':f.awayName}{q.second.line===null?'':' '+number(q.second.line)} ({odds(q.second.americanOdds)})</p>)}</div>:<p className="mt-3 text-slate-400">Sin un par de cuotas verificable en la captura correspondiente.</p>}
      {f.markets.knownAtOriginalEmission===false?<p className="mt-3 text-xs text-amber-200">La cuota se capturó después de emitirse la proyección; no es el precio original de esa decisión.</p>:null}
      <p className="mt-3 text-xs text-amber-200">Cuotas de referencia al {stamp(f.markets.capturedAt)}. La disponibilidad actual y las reglas de prórroga no están certificadas; estos datos no generan una recomendación ni EV.</p>
    </details>
  </article>;
}
function MetricCell({metric,isPercent=false}:{metric:NcaabManualMetric;isPercent?:boolean}) {
  return <span>{isPercent?percent(metric.value):number(metric.value)} <span className="block text-[11px] text-slate-500">{metric.games} juegos</span></span>;
}
function HeaderRow({labels}:{labels:string[]}) {
  return <thead className="border-b border-slate-700 text-xs text-slate-400"><tr>{labels.map(c=><th key={c} className="px-2 py-3">{c}</th>)}</tr></thead>;
}

export function NcaabManualDataContent({report}:{report:NcaabManualDataReport}) {
  const [tab,setTab]=useState<Tab>('Resumen'),[search,setSearch]=useState(''),[dayOnly,setDayOnly]=useState(true),[page,setPage]=useState(0),[selected,setSelected]=useState('');
  const onDay=new Set(report.fixtures.flatMap(f=>[f.homeId,f.awayId]));
  const teamMap=new Map(report.teams.map(t=>[t.id,t]));
  const query=search.trim().toLocaleLowerCase('es');
  const filtered=report.teams.filter(t=>(!dayOnly||onDay.has(t.id))&&(!query||(t.name+' '+(t.abbreviation??'')+' '+(t.conference??'')).toLocaleLowerCase('es').includes(query))).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const fixtures=report.fixtures.filter(f=>!query||(f.homeName+' '+f.awayName).toLocaleLowerCase('es').includes(query));
  const focusTeam=filtered.find(t=>t.id===selected)??filtered[0];
  const pageSize=tab==='Partidos'?12:25,total=tab==='Partidos'?fixtures.length:filtered.length;
  const pages=Math.max(1,Math.ceil(total/pageSize)),index=Math.min(page,pages-1),start=index*pageSize;
  const changeTab=(value:Tab)=>{setTab(value);setPage(0);};
  if(report.status==='UNAVAILABLE')return <div role="alert" className="mt-4 rounded-lg border border-amber-400/30 p-4 text-sm text-amber-200">No se pudo verificar la lectura completa del archivo. {report.warnings[0]} No se muestran estadísticas parciales.</div>;
  return <div className="mt-4 space-y-4">
    <p className="text-xs text-slate-400">Fecha PR: {report.date} · Datos del calendario: {stamp(report.source.slateCapturedAt)} · Lectura: {stamp(report.readAt)}</p>
    <div role="tablist" aria-label="Datos compartidos NCAAB" className="flex flex-wrap gap-2">{tabs.map((value,i)=><button key={value} id={'ncaab-data-tab-'+i} type="button" role="tab" aria-selected={tab===value} aria-controls="ncaab-data-content" tabIndex={tab===value?0:-1} onClick={()=>changeTab(value)} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const next=(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;changeTab(tabs[next]);document.getElementById('ncaab-data-tab-'+next)?.focus();}}} className={control+' '+(tab===value?'border-teal-300 text-teal-300':'text-slate-300')}>{value}</button>)}</div>
    {tab!=='Resumen'?<div className="flex flex-wrap items-end gap-3"><label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400">Buscar equipo<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} className={control} placeholder="Nombre de universidad"/></label>{tab!=='Partidos'?<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={dayOnly} onChange={e=>{setDayOnly(e.target.checked);setPage(0);}}/>Solo equipos de esta fecha</label>:null}</div>:null}
    <div id="ncaab-data-content" role="tabpanel" aria-labelledby={'ncaab-data-tab-'+tabs.indexOf(tab)} className="min-w-0">
      {tab==='Resumen'?<div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Partidos de la fecha',report.coverage.games],['Equipos en el archivo',report.coverage.teams],['Finales observados',report.coverage.archivedFinals],['Equipos con diez verificados',report.coverage.teamsWithCompleteLast10]].map(([label,value])=><div key={label} className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div>)}</div><p className="text-sm leading-6 text-slate-300">El historial usa finales anteriores al {report.date}. Los récords reportados por la fuente y los promedios del archivo se muestran por separado. El archivo incluye rivales de distintas divisiones; no es un listado completo de División I.</p><p className="text-xs text-slate-400">Archivo: {report.source.archiveFrom??'Sin inicio'} a {report.source.archiveThrough??'Sin corte'} · {report.coverage.gamesWithPeriods} juegos con períodos · {report.coverage.gamesWithDetailedStats} con estadísticas detalladas.</p>{report.warnings.length?<ul className="list-disc space-y-2 pl-5 text-sm text-amber-200">{report.warnings.slice(0,6).map((w,i)=><li key={i}>{w}</li>)}</ul>:null}</div>:null}
      {tab==='Partidos'?<div className="space-y-4"><p role="status" className="text-sm text-slate-400">{fixtures.length} partidos · horarios de Puerto Rico</p>{fixtures.slice(start,start+pageSize).map(f=><Fixture key={f.eventId} fixture={f} teams={teamMap}/>)}{!fixtures.length?<p className="py-4 text-slate-400">Sin partidos disponibles para esta fecha y búsqueda.</p>:null}</div>:null}
      {tab==='Equipos'?<div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><caption className="pb-3 text-left text-xs text-slate-400">{filtered.length} equipos · promedios calculados solo con los juegos observados</caption><HeaderRow labels={['Equipo','Récord reportado','Archivo W–L','Puntos a favor','Puntos en contra','Margen','Recientes']}/><tbody>{filtered.slice(start,start+pageSize).map(t=><tr key={t.id} className="border-b border-slate-800 align-top"><th scope="row" className="px-2 py-3 font-semibold">{t.name}<span className="mt-1 block text-xs font-normal text-slate-500">{t.conference??'Conferencia sin verificar'}</span></th><td className="px-2 py-3">{t.reportedRecord?.overall??'—'}<span className="block text-[11px] text-slate-500">{stamp(t.reportedRecord?.capturedAt??null)}</span></td><td className="px-2 py-3">{t.archive.wins}–{t.archive.losses}<span className="block text-[11px] text-slate-500">{t.archive.games} juegos · {t.archive.completeSeason?'verificado':'parcial'}</span></td><td className="px-2 py-3">{number(t.archive.pointsFor)}</td><td className="px-2 py-3">{number(t.archive.pointsAgainst)}</td><td className="px-2 py-3">{number(t.archive.margin)}</td><td className="px-2 py-3">{t.last10.wins}–{t.last10.losses}<span className="block text-[11px] text-slate-500">{coverage(t)}</span></td></tr>)}</tbody></table></div>:null}
      {tab==='Últimos 10'?<div className="space-y-4"><label className="block text-sm">Equipo<select className={'ml-0 mt-2 block w-full '+control} value={focusTeam?.id??''} onChange={e=>setSelected(e.target.value)}>{filtered.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{focusTeam?<><p className="text-sm text-amber-200">{coverage(focusTeam)}. Los juegos faltantes no se cuentan como cero.</p><div className="grid gap-3 sm:grid-cols-3"><SmallAggregate title="Recientes" data={focusTeam.last10}/><SmallAggregate title="Local · archivo" data={focusTeam.archive.home}/><SmallAggregate title="Visitante · archivo" data={focusTeam.archive.away}/></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><HeaderRow labels={['Fecha PR','Rival','Sede','Marcador','Resultado']}/><tbody>{focusTeam.recentGames.map(g=><tr key={g.eventId} className="border-t border-slate-800"><td className="px-2 py-3">{g.date}</td><td className="px-2 py-3">{g.opponentName}</td><td className="px-2 py-3">{venues[g.venue]}</td><td className="px-2 py-3">{g.pointsFor}–{g.pointsAgainst}</td><td className="px-2 py-3 font-semibold">{g.result==='W'?'Ganó':'Perdió'}</td></tr>)}</tbody></table></div>{!focusTeam.recentGames.length?<p className="text-slate-400">Sin finales anteriores disponibles.</p>:null}</>:<p className="text-slate-400">Sin equipos para este filtro.</p>}</div>:null}
      {tab==='Estadísticas'?<div className="space-y-4"><p className="text-sm text-slate-400">Estadísticas de los juegos recientes disponibles. Cada métrica muestra su propio número de partidos. Porcentajes calculados con la suma de aciertos e intentos.</p><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><HeaderRow labels={['Equipo','FG%','3P%','FT%','Rebotes','Asistencias','Pérdidas']}/><tbody>{filtered.slice(start,start+pageSize).map(t=><tr key={t.id} className="border-t border-slate-800"><th scope="row" className="px-2 py-3">{t.name}</th><td className="px-2 py-3"><MetricCell metric={t.last10.stats.fieldGoalPct} isPercent/></td><td className="px-2 py-3"><MetricCell metric={t.last10.stats.threePointPct} isPercent/></td><td className="px-2 py-3"><MetricCell metric={t.last10.stats.freeThrowPct} isPercent/></td><td className="px-2 py-3"><MetricCell metric={t.last10.stats.rebounds}/></td><td className="px-2 py-3"><MetricCell metric={t.last10.stats.assists}/></td><td className="px-2 py-3"><MetricCell metric={t.last10.stats.turnovers}/></td></tr>)}</tbody></table></div><details className="rounded-lg border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold text-teal-300">Puntos por primera y segunda mitad</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{filtered.slice(start,start+pageSize).map(t=><div key={t.id} className="rounded-lg bg-slate-950 p-3 text-sm"><p className="font-semibold">{t.name}</p>{t.last10.periods.map(p=><p key={p.period} className="mt-2 text-xs text-slate-400">{p.period}H: {number(p.pointsFor)} / {number(p.pointsAgainst)} pts · {p.games} juegos</p>)}{!t.last10.periods.length?<p className="mt-2 text-xs text-slate-400">Sin períodos verificados.</p>:null}</div>)}</div></details></div>:null}
    </div>
    {['Partidos','Equipos','Estadísticas'].includes(tab)&&pages>1?<div className="flex flex-wrap items-center gap-3"><button type="button" disabled={index===0} onClick={()=>setPage(index-1)} className={control+' disabled:opacity-40'}>Anterior</button><span className="text-xs text-slate-400">Página {index+1} de {pages}</span><button type="button" disabled={index+1>=pages} onClick={()=>setPage(index+1)} className={control+' disabled:opacity-40'}>Siguiente</button></div>:null}
    <p className="border-t border-slate-700 pt-3 text-xs leading-5 text-slate-400">Información descriptiva del archivo de Pick. Esta consulta no recalcula pronósticos, no modifica selecciones y no utiliza proveedores adicionales.</p>
  </div>;
}

export default function NcaabManualDataPanel() {
  const [date,setDate]=useState(today),[report,setReport]=useState<NcaabManualDataReport|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function load() {
    request.current?.abort();const controller=new AbortController();request.current=controller;setLoading(true);setError(null);setReport(null);
    try {
      const response=await fetch('/api/ncaab/manual-data?date='+encodeURIComponent(date),{cache:'no-store',signal:controller.signal});
      const data=await response.json() as NcaabManualDataReport;
      if(data.schemaVersion!=='NCAAB_MANUAL_DATA_V1'||data.date!==date||data.readOnly!==true||data.providerCalls!==0||data.databaseWrites!==0||data.predictionAdjustment!==false||data.modelPromoted!==false||!['READY','PARTIAL','EMPTY','UNAVAILABLE'].includes(data.status)||!Array.isArray(data.fixtures)||!Array.isArray(data.teams)||!Array.isArray(data.warnings))throw Error('INVALID_RESPONSE');
      if(!controller.signal.aborted)setReport(data);
    } catch {if(!controller.signal.aborted)setError('No se pudo consultar el archivo compartido. Puedes volver a intentarlo.');}
    finally {if(!controller.signal.aborted)setLoading(false);}
  }
  return <section aria-label="Datos NCAAB compartidos" className="rounded-xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
    <h2 className="text-xl font-bold text-white">Datos compartidos para el análisis</h2>
    <p className="mt-2 text-sm leading-6 text-slate-300">Partidos, récords, últimos juegos, puntos, mitades y estadísticas de los equipos. La misma información que utiliza el panel privado.</p>
    <div className="mt-3 flex flex-wrap items-end gap-3"><label className="flex flex-col gap-1 text-xs text-slate-400">Fecha en Puerto Rico<input type="date" value={date} onChange={e=>{request.current?.abort();setDate(e.target.value);setReport(null);setError(null);setLoading(false);}} className={control}/></label><button type="button" onClick={load} disabled={loading||!date} className={control+' border-teal-400/40 font-semibold text-teal-300 disabled:opacity-50'}>{loading?'Consultando archivo…':report?'Actualizar datos compartidos':'Consultar datos compartidos'}</button></div>
    {loading?<p role="status" className="mt-3 text-sm text-slate-400">Comprobando el calendario y el historial guardado…</p>:null}
    {error?<p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>:null}
    {report?<NcaabManualDataContent key={report.date+report.readAt} report={report}/>:null}
  </section>;
}
