'use client';
import Link from 'next/link';
import {useState} from 'react';
import {displayedModelTotal,type SportModelCard} from '@/lib/sport-model-overview';
const pct=(v:number|null)=>v===null?'—':(100*v).toFixed(2)+'%';
export default function SportModelOverview({cards}:{cards:SportModelCard[]}){
  const [phase,setPhase]=useState('REGULAR_SEASON');
  const shown=cards.filter(c=>c.cohorts.length).map(c=>c.cohorts.find(s=>s.key===phase)??c.cohorts[0]);
  const total=displayedModelTotal(shown);
  return <section aria-label="Accuracy de modelos por deporte" className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-teal-400/25 bg-slate-900 p-5">
      <div><p className="text-xs font-bold uppercase tracking-widest text-teal-300">Todos los modelos conectados · resultados registrados</p><h2 className="mt-2 text-2xl font-bold">Accuracy global de modelos</h2><p className="mt-2 text-sm text-slate-400">Subtotal operativo de las cohortes mostradas abajo.</p></div>
      <div className="text-right"><p className="text-4xl font-bold">{pct(total.accuracy)}</p><p className="mt-2 text-sm">{total.available?`${total.wins} W / ${total.losses} L · ${total.pending} pendientes`:'Conjunto completo no disponible'}</p></div>
    </header>
    <p className="text-xs leading-6 text-slate-400">Se suman WIN y LOSS; no se promedian porcentajes. Cada registro cuenta una vez; distintos modelos pueden seleccionar el mismo partido. Fórmulas y pestañas son vistas del mismo ledger. No es accuracy de juegos únicos, probabilidad calibrada, ROI ni certificación conjunta. OPEN, PUSH y VOID quedan fuera.</p>
    <div role="group" aria-label="Fase MLB de las tarjetas" className="flex flex-wrap items-center gap-2"><span className="text-sm text-slate-400">MLB:</span>{[['REGULAR_SEASON','Temporada regular'],['POSTSEASON','Playoffs']].map(([key,name])=><button type="button" key={key} onClick={()=>setPhase(key)} aria-pressed={phase===key} className={`rounded-lg border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-teal-300 ${phase===key?'border-teal-400 bg-teal-500/10':'border-slate-600'}`}>{name}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card=>{const c=card.cohorts.find(c=>c.key===phase)??card.cohorts[0];return <Link key={card.key} href={card.href} className="rounded-xl border border-slate-700 bg-slate-900 p-5 transition hover:border-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300">
      <div className="flex justify-between gap-3"><h3 className="text-lg font-bold">{card.label}</h3><span className="text-right text-xs text-slate-400">{card.classification}</span></div>
      <p className="mt-4 text-3xl font-bold">{pct(c?.accuracy??null)}</p><p className="mt-2 text-sm">{c?.available?`${c.wins} W / ${c.losses} L · ${c.pending} pendientes`:'Resultados no conectados o no disponibles'}</p>
      {c&&<><p className="mt-3 text-xs text-teal-300">{c.label}</p><p className="mt-2 text-xs leading-5 text-slate-400">{c.note}</p></>}
      <p className="mt-4 text-sm font-semibold text-teal-300">{c?'Ver motores, fórmulas y resultados →':'Ver estado de integración →'}</p>
    </Link>;})}</div>
    <p className="text-xs text-slate-400">Regular y playoffs de MLB se mantienen separados. NHL conserva su propio historial MODEL_ONLY. Solo deportes con fuentes conectadas aportan resultados; una caída de lectura no se sustituye por cero.</p>
  </section>;
}
