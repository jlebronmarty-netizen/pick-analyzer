import {Suspense,type ReactNode} from 'react';
import MultisportDay from '@/components/dashboard/MultisportDay';
import SportDecisionNavigation from '@/components/dashboard/SportDecisionNavigation';
import type {MlbView} from './mlb-presentation';
export function TodayContent({view,performance,calendar}:{view:MlbView;performance?:ReactNode;calendar?:ReactNode}){
 return <div className="mlb-ui mx-auto max-w-7xl space-y-5">
  <header className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Todos los deportes · {view.date}</p><h1 className="mt-2 text-3xl font-semibold">Picks y rendimiento de hoy.</h1><p className="mt-3 text-sm text-slate-400">Primero, compara el accuracy registrado por deporte. Después, abre su análisis y sus mercados disponibles; el calendario y las selecciones del día están más abajo.</p></header>
  <section id="rendimiento-deportes" aria-label="Rendimiento por deporte">{performance}</section>
  <section className="rounded-xl border border-slate-700 bg-slate-950/60 p-4"><SportDecisionNavigation/></section>
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Actividad de hoy</h2><p className="text-xs text-slate-400">Calendario y oportunidades · filtros por deporte y mercado</p></div>
  {calendar??<Suspense fallback={<p role="status">Cargando el calendario de deportes conectados…</p>}><MultisportDay view={view}/></Suspense>}
 </div>;
}
