"use client";
import Link from "next/link";
import { useState } from "react";
import type { NhlReport } from "@/lib/nhl-external-report";
import { filterNhlHistory, nhlDate, nhlOpportunities } from "@/lib/nhl-view";
const pct=(v:number|null)=>v===null?"—":`${v.toFixed(2)}%`;
const american=(v:number)=>v>0?`+${v}`:String(v);
const units=(v:number|null)=>v===null?"—":`${v>0?"+":""}${v.toFixed(2)}u`;
const time=(s:string|null)=>s?new Intl.DateTimeFormat("es-PR",{timeZone:"America/Puerto_Rico",dateStyle:"medium",timeStyle:"short"}).format(new Date(s))+" PR":"Sin dato";
const button="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-300";
const input="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100";
export default function NhlDashboard({report}:{report:NhlReport}){
  const [date,setDate]=useState("");const[outcome,setOutcome]=useState("ALL");const[page,setPage]=useState(0);
  if(report.status==="UNAVAILABLE")return <section className="mlb-ui space-y-4"><h1 className="text-3xl font-bold">NHL</h1><p role="status" className="rounded-xl border border-amber-400/30 p-5 text-amber-200">{report.warning}</p><Link href="/today" className="text-teal-300">Volver a Today</Link></section>;
  const r=report,s=r.summary,history=filterNhlHistory(r,date,outcome),pages=Math.max(1,Math.ceil(history.length/25)),current=Math.min(page,pages-1);
  const today=r.history.filter(p=>nhlDate(p.scheduledAt)===r.date),opportunities=nhlOpportunities(r);
  return <section className="mlb-ui mx-auto max-w-7xl space-y-6 text-slate-200">
    <header className="rounded-2xl border border-teal-400/30 bg-slate-900 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-300">Sports Edge Hub · MODEL_ONLY</p>
      <h1 className="mt-2 text-3xl font-bold text-white">NHL — predicciones y resultados</h1>
      <p className="mt-3 text-sm leading-6">Moneyline de partido completo, incluyendo overtime. Pronósticos externos de DRatings con precios Circa; cada selección conserva su cuota y probabilidad originales.</p>
      <p className="mt-2 text-xs text-amber-200">Modelo externo sin certificación de rentabilidad. Estas selecciones MODEL_ONLY conservan métricas independientes de los Official Picks de MLB.</p>
      <nav aria-label="NHL navigation" className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-teal-300"><Link href="/today">Today</Link><Link href="/mlb/overview">MLB general</Link><a href="https://sports-edge-hub.vercel.app/nhl-status" target="_blank" rel="noreferrer">Estado de la fuente ↗</a></nav>
    </header>
    <section aria-label="NHL source health" className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm">
      <p>Operación: <strong>{r.health.status}</strong> · Último ciclo: {r.health.runStatus??"Sin dato"} · Cobertura futura: {r.health.coverage??"—"}/{r.health.eligible??"—"}</p>
      <p className="mt-2 text-xs text-slate-400">Último ciclo: {time(r.health.latestRunAt)} · Lectura: {time(r.readAt)}. La fuente actualiza cada 30 minutos; esta página muestra snapshots.</p>
      {!!r.health.issues.length&&<p role="status" className="mt-2 text-amber-200">Atención de la fuente: {r.health.issues.join(" · ")}</p>}
      <p className="mt-2 text-xs text-slate-400">Cobertura incompleta significa que faltan pronósticos o precios para algunos partidos. Los datos ausentes quedan sin selección.</p>
    </section>
    <section aria-label="NHL MODEL_ONLY performance" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[["Accuracy",pct(s.accuracyPct)],["Ganadas / perdidas",`${s.wins} / ${s.losses}`],["Beneficio · 1u por selección",units(s.profitUnits)],["ROI · cuotas originales",pct(s.roiPct)]].map(([label,value])=><div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold text-white">{value}</p></div>)}
    </section>
    <p className="text-xs leading-6 text-slate-400">n W/L = {s.wins+s.losses} · {s.pending} pendientes · {s.pushes} PUSH · {s.voids} VOID. Accuracy = WIN/(WIN+LOSS). ROI usa una unidad por WIN/LOSS/PUSH y excluye VOID. Es contabilidad de los resultados almacenados, no un registro de apuestas reales ni garantía de ganancia. CLV de cierre no certificado.</p>
    <section aria-label="NHL daily forecasts" className="rounded-xl border border-slate-700 p-4">
      <h2 className="text-xl font-bold text-white">Pronósticos del día · {r.date}</h2><p className="mt-2 text-xs text-slate-400">Probabilidades del modelo externo; un pronóstico puede existir sin selección. Los precios mostrados aquí son los de esa captura, no ofertas en vivo.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{r.forecasts.map(f=><article key={f.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4"><h3 className="font-bold text-white">{f.eventName}</h3><p className="mt-2">{f.away}: {pct(f.awayProbability*100)} · {f.home}: {pct(f.homeProbability*100)}</p><p className="mt-1 text-sm text-slate-300">Circa: {american(f.awayOdds)} / {american(f.homeOdds)}</p><p className="mt-2 text-xs text-slate-400">Inicio: {time(f.scheduledAt)} · Captura: {time(f.capturedAt)}</p><p className="mt-2 text-xs text-amber-200">{Date.parse(f.scheduledAt)<=Date.parse(r.readAt)?"Partido iniciado · snapshot histórico":Date.parse(r.readAt)-Date.parse(f.capturedAt)>45*60000?"Captura vencida · sin oportunidad vigente":"Snapshot prepartido · verificar oferta actual"}</p></article>)}</div>
      {!r.forecasts.length&&<p className="py-4 text-sm text-slate-400">Sin pronósticos sincronizados para hoy.</p>}
    </section>
    <section aria-label="NHL recorded daily selections" className="rounded-xl border border-slate-700 p-4">
      <h2 className="text-xl font-bold text-white">Selecciones registradas de hoy · MODEL_ONLY</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{today.map(p=><article key={p.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4"><h3 className="font-bold text-white">{p.eventName}</h3><p className="mt-2 text-teal-300">{p.direction} · {american(p.odds)} · {p.sportsbook??"Casa no registrada"}</p><p className="mt-2 text-sm">Al seleccionar: {pct(p.modelProbability*100)} · edge {p.edgePp===null?"—":p.edgePp.toFixed(2)+" pp"}</p><p className="mt-2 text-xs text-slate-400">{p.tier} · calidad {p.quality} · {p.settlement?.outcome??p.status} · {p.locked||Date.parse(p.scheduledAt)<=Date.parse(r.readAt)?"Congelada / partido iniciado":"Registro prepartido"}</p></article>)}</div>
      {!today.length&&<p className="py-4 text-sm text-slate-400">No hay selecciones registradas para hoy.</p>}
    </section>
    <section aria-label="NHL informational edge" className="rounded-xl border border-slate-700 p-4">
      <h2 className="text-xl font-bold text-white">Mayor edge del modelo · informativo</h2><p className="mt-2 text-xs text-slate-400">Diferencia frente al par Circa sin margen calculada por la fuente. Solo snapshots recientes de partidos no iniciados con operación saludable; no convierte un pronóstico en recomendación.</p>
      <ol className="mt-4 space-y-3">{opportunities.map(p=><li key={p.key} className="rounded-lg border border-slate-700 p-3"><p className="font-semibold">{p.eventName} · {p.selection}</p><p className="mt-1 text-sm text-teal-300">+{p.edgePp.toFixed(2)} pp · {pct(p.probability*100)} · {american(p.odds)}</p><p className="mt-1 text-xs text-slate-400">Captura: {time(p.capturedAt)}</p></li>)}</ol>{!opportunities.length&&<p className="py-4 text-sm text-slate-400">Sin oportunidades positivas recientes verificables.</p>}
    </section>
    <section aria-label="NHL settlement history" className="space-y-4 rounded-xl border border-slate-700 p-4">
      <h2 className="text-xl font-bold text-white">Historial y settlement</h2>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Fecha PR<input type="date" className={input} value={date} onChange={e=>{setDate(e.target.value);setPage(0);}}/></label><label className="text-sm">Resultado<select className={input} value={outcome} onChange={e=>{setOutcome(e.target.value);setPage(0);}}>{["ALL","WIN","LOSS","OPEN","PUSH","VOID","CANCELLED"].map(o=><option key={o} value={o}>{o==="ALL"?"Todos":o}</option>)}</select></label><button type="button" className={button} onClick={()=>{setDate(r.date);setPage(0);}}>Hoy</button><button type="button" className={button} onClick={()=>{setDate("");setOutcome("ALL");setPage(0);}}>Limpiar filtros</button></div>
      <p className="text-xs text-slate-400">Los filtros afectan al historial; las métricas superiores conservan el historial completo MODEL_ONLY.</p><p role="status" className="text-sm">{history.length} selecciones · página {current+1} de {pages}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">NHL selecciones originales y resultados registrados</caption><thead className="text-xs text-slate-400"><tr>{["Partido / inicio","Selección original","Resultado","Beneficio 1u","Detalle"].map(h=><th scope="col" key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{history.slice(current*25,(current+1)*25).map(p=><tr key={p.id} className="border-t border-slate-800"><td className="px-3 py-4"><p className="font-semibold">{p.eventName}</p><p className="mt-1 text-xs text-slate-400">{time(p.scheduledAt)}</p></td><td className="px-3 py-4"><p className="font-semibold text-teal-300">{p.direction} · {american(p.odds)}</p><p className="mt-1 text-xs">{p.sportsbook??"Sin casa registrada"}</p><p className="mt-1 text-xs text-slate-400">{pct(p.modelProbability*100)} · {p.edgePp===null?"—":p.edgePp.toFixed(2)+" pp"}</p></td><td className={`px-3 py-4 font-semibold ${p.settlement?.outcome==="WIN"?"text-teal-300":p.settlement?.outcome==="LOSS"?"text-rose-300":"text-amber-200"}`}>{p.settlement?.outcome??(p.status==="ACTIVE"?"OPEN":p.status)}</td><td className="px-3 py-4">{units(p.settlement?.profitUnits??null)}</td><td className="max-w-xs px-3 py-4"><details className="text-xs text-slate-400"><summary className="cursor-pointer py-2 text-teal-300">Ver detalle</summary><p>Registrada: {time(p.createdAt)}</p><p className="mt-2">{p.model??"Modelo de origen no registrado"}</p><p className="mt-2">Calidad: {p.quality} · {p.tier}</p><p className="mt-2">{p.settlement?.result??"Sin resultado final almacenado"}</p><p className="mt-2">Liquidada: {time(p.settlement?.settledAt??null)}</p></details></td></tr>)}</tbody></table></div>
      {!history.length&&<p className="py-4 text-sm text-slate-400">Sin selecciones con estos filtros.</p>}
      <div className="flex gap-3"><button type="button" className={button} disabled={!current} onClick={()=>setPage(current-1)}>Anterior</button><button type="button" className={button} disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Siguiente</button></div>
    </section>
  </section>;
}
