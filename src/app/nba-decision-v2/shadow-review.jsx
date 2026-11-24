'use client';
import {useState} from 'react';
const fmt=(n,k=2)=>Number.isFinite(n)?n.toFixed(k):'—';
const pct=n=>Number.isFinite(n)?fmt(n*100,1)+'%':'—';
const interval=range=>Array.isArray(range)&&range.length===2?`${fmt(range[0],3)} a ${fmt(range[1],3)}`:'—';
const pr=s=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(s));
const periods={q1:'Primer cuarto',q2:'Segundo cuarto',q3:'Tercer cuarto',q4:'Cuarto final',h1:'Primera mitad',h2:'Segunda mitad',ft:'Partido'};
const scopeLabel=scope=>({moneyline:'Moneyline',spread:'Spread',total:'Total',props_assists:'Asistencias'})[scope]??periods[scope.replace('total_','')]??scope;
const labels={win:'Ganado',loss:'Perdido',push:'Devuelto',pending:'Pendiente',disputed:'Disputado'};
const reasons={NONPOSITIVE_EV:'El EV estimado es igual o menor que cero.',PROBABILITY_NOT_VALIDATED:'Faltan validación prospectiva y confirmación del precio ejecutable.'};
const excluded={CONTRACT_UNVERIFIED:'Contrato pendiente',STALE:'Precio o partido fuera de vigencia',PARTIAL:'Evidencia parcial',
 INCOMPLETE_HISTORY:'Faltan partidos en el historial',OUTSIDE_MODEL_OR_CANONICAL_SIDE:'Mercado o lado fuera de esta versión'};
export default function ShadowReview({data}){
  const [day,setDay]=useState('all'),[status,setStatus]=useState('all');
  const rows=data.contracts.filter(r=>(day==='all'||r.day===day)&&(status==='all'||r.status===status))
    .toSorted((a,b)=>a.day.localeCompare(b.day)||a.matchup.localeCompare(b.matchup)||a.period.localeCompare(b.period));
  const overall=data.report.find(s=>s.scope==='ALL_DESCRIPTIVE');
  return <main className="mx-auto w-full min-w-0 max-w-5xl space-y-5 break-words px-4 py-6 text-slate-100">
    <header><a href="/nba-decision-board" className="text-sky-300">Decision Board NBA</a>
      <h1 className="mt-3 text-3xl font-bold">Evaluación prospectiva V2</h1>
      <p className="mt-2 text-slate-300">{data.source==='ledger'?'Última lectura del registro diario':'Corte del archivo'} {pr(data.asOf)} PR · SHADOW</p>
      <p className="text-sm text-slate-300">Versión {data.contracts[0]?.model??'Sin contratos visibles'}</p></header>
    <section aria-label="Challenge" className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold">Challenge · {data.challenge}</h2>
      <p className="text-2xl font-semibold tabular-nums">${fmt(data.bankroll.currentCents/100)} <small className="text-sm text-slate-400">de ${data.bankroll.objectiveCents/100}</small></p>
      <p className="text-sm text-slate-300">Ganancias de Atlanta ${fmt(data.bankroll.atlantaProfit/100)} · Cash out de Oklahoma City ${fmt(data.bankroll.okcCashOutProfit/100)}</p></section>
    <section aria-label="Validación por mercado"><h2 className="font-semibold">Partidos prospectivos liquidados por mercado</h2>
      <p className="mb-2 text-sm text-slate-300">El umbral de revisión es 100 por versión y mercado. En total hay {overall.settledIndependentGames} partidos liquidados y {overall.metrics.contracts} contratos evaluados.</p>
      {data.metricsAsOf&&<p>Métricas al {pr(data.metricsAsOf)} PR. Contratos posteriores visibles en las dos últimas jornadas: {data.pendingAfterReport}.</p>}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{data.report.filter(s=>s.scope!=='ALL_DESCRIPTIVE').map(s=>
        <div key={s.scope} className="rounded bg-slate-900 p-2"><strong>{scopeLabel(s.scope)}</strong>
        <p>{s.settledIndependentGames}/100 · {s.pending} pendientes</p>
        <small>{s.status==='INDEPENDENT_REVIEW_REQUIRED'?'Pendiente de revisión independiente':s.settledIndependentGames?'Muestra insuficiente':'SIN DATOS · Sin resultados V2'}</small></div>)}</div>
      <p className="mt-3 text-sm text-slate-300">Cada mercado debe alcanzar su propia muestra. Varios períodos del mismo juego cuentan como un partido en el total combinado. Alcanzar el umbral requiere después revisar calibración, incertidumbre y evidencia histórica separada.</p>
    </section>
    <section aria-label="Métricas prospectivas por mercado">
      <h2 className="font-semibold">Resultados frente al precio archivado</h2>
      <p className="mt-2 text-sm text-slate-300">Métricas al {pr(data.metricsAsOf??data.asOf)} PR, agrupadas por partido. Brier y Log Loss menores indican mejor ajuste a los resultados. La diferencia Brier resta el operador sin margen al modelo. Los intervalos del 95% remuestrean partidos completos.</p>
      <div className="mt-3 max-w-full overflow-x-auto rounded border border-slate-700">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">Evaluación experimental por versión y mercado</caption>
          <thead className="bg-slate-900"><tr>{['Mercado','Juegos','Ganados / perdidos / devueltos','Brier V2','Brier operador','Diferencia Brier e IC 95%','Log Loss','MAE','Accuracy','EV congelado','ROI simulado'].map(label=><th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
          <tbody>{data.report.filter(s=>s.scope!=='ALL_DESCRIPTIVE').map(s=><tr key={s.scope} className="border-t border-slate-700">
            <th scope="row" className="p-3">{scopeLabel(s.scope)}</th>
            <td className="p-3">{s.settledIndependentGames}</td>
            <td className="p-3">{s.metrics.wins} / {s.metrics.losses} / {s.metrics.pushes}</td>
            <td className="p-3">{fmt(s.metrics.brier,4)}</td>
            <td className="p-3">{fmt(s.metrics.bookBrier,4)}</td>
            <td className="p-3">{fmt(s.metrics.pairedBrierDifference,4)} · {interval(s.metrics.intervals95?.pairedBrierDifference)}</td>
            <td className="p-3">{fmt(s.metrics.logLoss,4)}</td>
            <td className="p-3">{fmt(s.metrics.mae)}</td>
            <td className="p-3">{pct(s.metrics.accuracy)}</td>
            <td className="p-3">{pct(s.metrics.meanEv)}</td>
            <td className="p-3">{pct(s.metrics.simulatedRoi)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-300">Accuracy evalúa el clasificador al umbral de 50%. Ganados y perdidos corresponden al lado congelado. ROI simula una unidad a cada precio archivado y pondera por partido. La ejecución regional sigue pendiente. Las probabilidades continúan experimentales y JUGADA sigue desactivado.</p>
      <p className="mt-2 text-sm text-slate-300">Capital del Challenge informado el {data.bankroll.dayPR}. La evaluación del modelo usa el ledger de pronósticos y resultados.</p>
    </section>
    <section aria-label="Contratos congelados"><div className="flex flex-wrap items-end gap-4"><h2 className="text-xl font-semibold">Contratos congelados</h2>
      <label>Jornada PR <select aria-label="Jornada PR" value={day} onChange={e=>setDay(e.target.value)} className="bg-slate-900 p-1"><option value="all">Todas</option>{[...new Set(data.contracts.map(r=>r.day))].map(d=><option key={d}>{d}</option>)}</select></label>
      <label>Resultado <select aria-label="Resultado" value={status} onChange={e=>setStatus(e.target.value)} className="bg-slate-900 p-1"><option value="all">Todos</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
      {data.source==='ledger'&&<p className="mt-2 text-sm text-slate-300">Detalle de las dos últimas jornadas disponibles. Las métricas anteriores abarcan toda la cohorte del informe.</p>}
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
