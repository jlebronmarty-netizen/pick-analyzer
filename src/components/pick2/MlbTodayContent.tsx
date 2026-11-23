import {Suspense,type ReactNode} from 'react';
import MultisportDay from '@/components/dashboard/MultisportDay';
import SportDecisionNavigation from '@/components/dashboard/SportDecisionNavigation';
import type {MlbView} from './mlb-presentation';
export function TodayContent({view,performance,calendar}:{view:MlbView;performance?:ReactNode;calendar?:ReactNode}){
 return <div className="mlb-ui mx-auto max-w-7xl space-y-5">
  <header className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Pick Analyzer · {view.date} · Puerto Rico</p><h1 className="mt-2 text-3xl font-semibold">Deportes</h1><p className="mt-3 text-sm text-slate-400">Selecciona un deporte para abrir su tablero, revisar los partidos y explorar los mercados disponibles.</p></header>
  <section id="deportes" aria-label="Deportes y accuracy">{performance??<SportDecisionNavigation/>}</section>
  <details className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
   <summary className="cursor-pointer rounded text-lg font-semibold focus-visible:outline-2 focus-visible:outline-teal-300">Actividad de hoy · todos los deportes</summary>
   <p className="my-3 text-xs text-slate-400">Calendario y oportunidades · filtros por deporte y mercado</p>
   {calendar??<Suspense fallback={<p role="status">Cargando el calendario de deportes conectados…</p>}><MultisportDay view={view}/></Suspense>}
  </details>
 </div>;
}
