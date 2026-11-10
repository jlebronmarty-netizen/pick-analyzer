import {notFound} from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {getTennisSourceHealth} from '@/services/tennis-source-preflight.service.mjs';
import {getFreeLeagueReport} from '@/services/free-sports.service';
import {metrics,modelId,SPORT_LEAGUES,SPORT_NAMES,type Outcome,type Sport} from '@/lib/free-sports/model';

export const dynamic='force-dynamic';
const time=new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'});
const showTime=(value:string)=>time.format(new Date(value))+' PR';
const pct=(n:number|null)=>n===null?'—':n.toFixed(2)+'%';
const outcome:Record<Outcome,string>={WIN:'Ganada',LOSS:'Perdida',OPEN:'Pendiente',AWAITING_RESULT:'Esperando resultado',EXCLUDED:'Excluida',REVIEW:'En revisión'};
export default async function FreeSportPage({params}:{params:Promise<{sport:string}>}){
 const {sport:slug}=await params;
 if(!Object.hasOwn(SPORT_LEAGUES,slug))notFound();
 const sport=slug as Sport;
 const sourceHealth=sport==='tennis'?await getTennisSourceHealth():null;
 const reports=await Promise.all(SPORT_LEAGUES[sport].map(getFreeLeagueReport));
 const total=metrics(reports.flatMap(r=>r.rows));
 const complete=reports.every(r=>r.status!=='UNAVAILABLE');
 return <DashboardShell><main className="mx-auto max-w-6xl space-y-6 px-4 py-6 text-slate-100">
  <header><p className="text-sm font-semibold text-teal-300">SHADOW / RESEARCH · fuentes gratuitas</p>
   <h1 className="mt-2 text-3xl font-bold">{SPORT_NAMES[sport]}</h1>
   <p className="mt-2 text-sm text-slate-300">{sport==='nfl'?'NFL · ganador de temporada regular.':sport==='tennis'?'ATP y WTA · ganador de individuales.':'Baloncesto Superior Nacional de Puerto Rico · ganador del partido.'} Pronósticos experimentales de Elo; sin selecciones oficiales.</p>
  </header>
  {!complete&&<p role="status" className="text-sm text-amber-200">Resumen global no disponible: falta el registro de al menos un modelo.</p>}
  <section aria-label="Resumen del deporte" className="grid gap-3 sm:grid-cols-3">
   <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p>Accuracy global</p><strong className="text-2xl">{pct(complete?total.accuracy:null)}</strong><p className="text-sm text-slate-400">{complete?total.wins+' ganadas · '+total.losses+' perdidas':'Sin lectura completa'}</p></div>
   <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p>ROI simulado</p><strong className="text-2xl">{pct(complete?total.roi:null)}</strong><p className="text-sm text-slate-400">{complete?total.priced+' decisiones liquidadas con cuota':'Sin lectura completa'}</p></div>
   <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p>Seguimiento</p><strong className="text-2xl">{complete?total.pending:'—'}</strong><p className="text-sm text-slate-400">{complete?'Pendientes · '+total.excluded+' excluidas · '+total.review+' en revisión':'Sin lectura completa'}</p></div>
  </section>
  <p className="text-sm text-slate-300">Accuracy = ganadas ÷ (ganadas + perdidas). El ROI simula 1 unidad por selección con cuota archivada antes del inicio. Empates, retiros, cancelaciones y casos en revisión quedan fuera. Una muestra vacía se muestra como «—».</p>
  {sport==='bsn'&&<p className="rounded-xl border border-amber-400/40 p-4 text-sm text-amber-200">Pick conserva resultados históricos de BSN. Para emitir pronósticos hace falta un calendario autorizado o un CSV con origen atestado. No hay una fuente de cuotas aprobada para este módulo.</p>}
  {sourceHealth&&<p className="rounded-xl border border-slate-700 p-4 text-sm">Conexión gratuita: {sourceHealth.status==='CAPTURED_PENDING_HISTORY_AND_TERMS'?'Captura recibida; falta validar el historial antes de emitir pronósticos.':sourceHealth.status==='SOURCE_REVIEW_REQUIRED'?'La captura necesita revisión técnica.':'Esperando clave o primera comprobación.'} La comprobación no emite picks y hace como máximo una solicitud por día UTC.</p>}
  {sport==='tennis'&&<p className="rounded-xl border border-slate-700 p-4 text-sm">ATP y WTA están preparados para medir accuracy. La emisión está en espera de una fuente autorizada para el calendario y los resultados. El ROI requiere además cuotas prepartido verificadas.</p>}
  {sport==='nfl'&&<p className="text-sm text-slate-300">Calendario y resultados: <a href="https://github.com/nflverse/nflverse-data/releases/tag/schedules" className="text-teal-300 underline">nflverse</a>, <a href="https://creativecommons.org/licenses/by/4.0/" className="text-teal-300 underline">CC BY 4.0</a>. Los datos se filtran y el modelo genera sus propias proyecciones. El calendario abierto no acredita precios prepartido.</p>}
  {reports.map(r=>{
   const current=new Map(r.rows.filter(row=>row.outcome==='OPEN').map(row=>[row.forecast.event.id,row]));
   return <section key={r.league} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
    <header><h2 className="text-xl font-bold">{r.league} · Elo</h2><p className="mt-1 break-all text-xs text-slate-400">{modelId(r.league)}</p>
     <p className="mt-2 text-sm">{r.status==='UNAVAILABLE'?'Registro no disponible.':r.sourceAt?'Última captura válida: '+showTime(r.sourceAt)+' · '+r.history+' resultados para el modelo.':'Esperando la primera captura.'}</p>
     <p className="mt-1 text-sm text-slate-300">Accuracy {pct(r.metrics.accuracy)} · {r.metrics.wins} G / {r.metrics.losses} P · ROI {pct(r.metrics.roi)} · {r.metrics.priced} con cuota liquidada</p></header>
    <h3 className="font-semibold">Próximos partidos y pronósticos</h3>
    {r.upcoming.length===0?<p className="text-sm text-slate-400">No hay próximos partidos en una captura reciente y válida.</p>:
     <ul className="grid gap-3 sm:grid-cols-2">{r.upcoming.map(e=>{
      const row=current.get(e.id),f=row?.forecast;
      const selected=f?.selectedId===e.a.id?e.a:e.b;
      const valid=!!f&&f.event.start===e.start&&[f.event.a.id,f.event.b.id].every(id=>id===e.a.id||id===e.b.id);
      return <li key={e.id} className="rounded-xl border border-slate-700 p-4">
       <p className="text-xs text-slate-400">{showTime(e.start)}</p><h4 className="mt-1 font-semibold">{e.a.name} vs {e.b.name}</h4>
       {valid&&f?<><p className="mt-2 text-teal-300">Ganador proyectado: <strong>{selected.name}</strong> · {pct(100*Math.max(f.probabilityA,1-f.probabilityA))}</p>
        <p className="mt-1 text-xs text-slate-400">{row?.price==null?'Sin cuota archivada':(row.price>0?'+':'')+row.price+' · DraftKings · cuota archivada'}</p></>:
        <p className="mt-2 text-sm text-slate-400">Sin pronóstico registrado para este horario.</p>}
      </li>;
     })}</ul>}
    <h3 className="font-semibold">Liquidación y registro de pronósticos</h3>
    {r.rows.length===0?<p className="text-sm text-slate-400">Aún no hay pronósticos registrados.</p>:<div className="overflow-x-auto">
     <table className="w-full min-w-[38rem] text-left text-sm">
      <thead><tr className="border-b border-slate-700 text-slate-300">{['Partido','Selección','Resultado','Cuota','Unidades'].map(h=><th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
      <tbody>{[...r.rows].sort((a,b)=>b.forecast.event.start.localeCompare(a.forecast.event.start)).slice(0,150).map(row=>{
       const f=row.forecast,e=f.event;
       return <tr key={e.id} className="border-b border-slate-800">
        <td className="p-2">{e.a.name} vs {e.b.name}<span className="block text-xs text-slate-400">{showTime(e.start)}</span></td>
        <td className="p-2">{f.selectedId===e.a.id?e.a.name:e.b.name}</td><td className="p-2">{outcome[row.outcome]}</td>
        <td className="p-2">{row.price===null?'—':(row.price>0?'+':'')+row.price}</td>
        <td className="p-2">{row.profit===null?'—':row.profit.toFixed(2)}</td>
       </tr>;
      })}</tbody>
     </table>
    </div>}
    {r.rows.length>150&&<p className="text-xs text-slate-400">Mostrando 150 de {r.rows.length} pronósticos; las métricas usan el registro completo.</p>}
   </section>;
  })}
 </main></DashboardShell>;
}
