import {Suspense,type ReactNode} from 'react';
import MultisportDay from '@/components/dashboard/MultisportDay';
import type {MlbView} from './mlb-presentation';
export function TodayContent({view,performance,calendar}:{view:MlbView;performance?:ReactNode;calendar?:ReactNode}){
 return <div className="mlb-ui mx-auto max-w-7xl space-y-6">
  <header className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Todos los deportes · {view.date}</p><h1 className="mt-2 text-3xl font-semibold">Today&apos;s picks &amp; performance.</h1><p className="mt-3 text-sm text-slate-400">Elige un deporte para ver sus motores y fórmulas, o consulta los partidos y selecciones del día en un solo lugar.</p></header>
  {performance}
  {calendar??<Suspense fallback={<p role="status">Cargando el calendario de deportes conectados…</p>}><MultisportDay view={view}/></Suspense>}
 </div>;
}
