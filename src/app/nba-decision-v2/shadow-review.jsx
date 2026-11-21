'use client';
import {useState} from 'react';
const fmt=(n,k=2)=>Number.isFinite(n)?n.toFixed(k):'—';
const pct=n=>Number.isFinite(n)?fmt(n*100,1)+'%':'—';
const pr=s=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(s));
const periods={q1:'Primer cuarto',q2:'Segundo cuarto',q3:'Tercer cuarto',q4:'Cuarto final',h1:'Primera mitad',h2:'Segunda mitad',ft:'Partido'};
const labels={win:'Ganado',loss:'Perdido',push:'Devuelto',pending:'Pendiente',disputed:'Disputado'};
const reasons={NONPOSITIVE_EV:'El EV estimado es igual o menor que cero.',PROBABILITY_NOT_VALIDATED:'Faltan validación prospectiva y confirmación del precio ejecutable.'};
const excluded={CONTRACT_UNVERIFIED:'Contrato pendiente',STALE:'Precio o partido fuera de vigencia',PARTIAL:'Evidencia parcial',
 INCOMPLETE_HISTORY:'Faltan partidos en el historial',OUTSIDE_MODEL_OR_CANONICAL_SIDE:'Mercado o lado fuera de esta versión'};
export default function ShadowReview({data}){
  const [day,setDay]=useState('all'),[status,setStatus]=useState('all');
  const rows=data.contracts.filter(r=>(day==='all'||r.day===day)&&(status==='all'||r.status===status))
    .toSorted((a,b)=>a.day.localeCompare(b.day)||a.matchup.localeCompare(b.matchup)||a.period.localeCompare(b.period));
  const overall=data.report.find(s=>s.scope==='ALL_DESCRIPTIVE');
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 text-slate-100">
    <header><a href="/nba-decision-board" className="text-sky-300">Decision Board NBA</a>
      <h1 className="mt-3 text-3xl font-bold">Evaluación prospectiva V2</h1>
      <p className="mt-2 text-slate-300">{data.source==='ledger'?'Última lectura del registro diario':'Corte del archivo'} {pr(data.asOf)} PR · SHADOW</p></header>
    <section aria-label="Challenge" className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold">Challenge · {data.challenge}</h2>
      <p className="text-2xl font-semibold tabular-nums">${fmt(data.bankroll.currentCents/100)} <small className="text-sm text-slate-400">de ${data.bankroll.objectiveCents/100}</small></p>
      <p className="text-sm text-slate-300">Ganancias de Atlanta ${fmt(data.bankroll.atlantaProfit/100)} · Cash out de Oklahoma City ${fmt(data.bankroll.okcCashOutProfit/100)}</p></section>
    <section aria-label="Validación por mercado"><h2 className="font-semibold">Partidos prospectivos liquidados por mercado</h2>
      <p className="mb-2 text-sm text-slate-300">El umbral de revisión es 100 por versión y mercado. En total hay {overall.settledIndependentGames} partidos liquidados y {overall.metrics.contracts} contratos evaluados.</p>
      {data.metricsAsOf&&<p>Métricas al {pr(data.metricsAsOf)} PR. Contratos posteriores visibles en las dos últimas jornadas: {data.pendingAfterReport}.</p>}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{data.report.filter(s=>s.scope!=='ALL_DESCRIPTIVE').map(s=>
        <div key={s.scope} className="rounded bg-slate-900 p-2"><strong>{({moneyline:'Moneyline',spread:'Spread',total:'Total',props_assists:'Asistencias'})[s.scope]??periods[s.scope.replace('total_','')]}</strong>
        <p>{s.settledIndependentGames}/100 · {s.pending} pendientes</p>
        <small>{s.status==='INDEPENDENT_REVIEW_REQUIRED'?'Pendiente de revisión independiente':s.settledIndependentGames?'Muestra insuficiente':'SIN DATOS · Sin resultados V2'}</small></div>)}</div></section>
    <section><div className="flex flex-wrap items-end gap-4"><h2 className="text-xl font-semibold">Contratos congelados</h2>
      <label>Jornada PR <select aria-label="Jornada PR" value={day} onChange={e=>setDay(e.target.value)} className="bg-slate-900 p-1"><option value="all">Todas</option>{[...new Set(data.contracts.map(r=>r.day))].map(d=><option key={d}>{d}</option>)}</select></label>
      <label>Resultado <select aria-label="Resultado" value={status} onChange={e=>setStatus(e.target.value)} className="bg-slate-900 p-1"><option value="all">Todos</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
      {!rows.length&&<p className="mt-3">No hay contratos con estos filtros.</p>}
      {rows.map(r=><details key={r.id} className="mt-2 rounded border border-slate-700 bg-slate-900 p-3">
        <summary className="cursor-pointer"><strong>{r.matchup}</strong> · {periods[r.period]} · {r.playerName??(r.playerId?'Jugador '+r.playerId:'')} {r.statistic} {r.selection} {r.line} · {labels[r.status]}</summary>
        <p className="mt-2">{r.classification} al corte · {reasons[r.reason]??r.reason}</p>
        <p>Probabilidad V2 {pct(r.p)} · Implícita del precio {pct(r.implied)} · EV {pct(r.ev)}</p>
        <p>Proyección {fmt(r.projection)} · Resultado del período {fmt(r.actual,0)} · {r.book} {r.odds}</p>
        <p>Precio del operador {pr(r.quoteAt)} PR · Capturado {pr(r.capturedAt)} PR · Congelado {pr(r.frozenAt)} PR</p>
        <p>Historial {r.quality} · {r.sample.join(' / ')} partidos · L5/L10 {fmt(r.l5,1)} / {fmt(r.l10,1)}</p>
        {r.l5==null&&<p>Los promedios L5/L10 no constan en este recibo.</p>}
        <p>Contexto {r.warnings?.join(' · ')||'Sin alertas adicionales en el recibo'} · Ejecución regional pendiente</p>
        <small>{r.model}</small></details>)}</section>
    <section><h2 className="font-semibold">Descartes de la última congelación{data.exclusionsAt?' · '+pr(data.exclusionsAt)+' PR':''}</h2>
      {Object.entries(data.exclusions).map(([reason,count])=><p key={reason}>{excluded[reason]??reason} · {count}</p>)}</section>
  </main>;
}
