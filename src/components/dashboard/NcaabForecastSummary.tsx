import type {LiveObservation} from '@/lib/ncaab-live';
import {ncaabTeamName} from '@/lib/ncaab-team-display';

export default function NcaabForecastSummary({row:r}:{row:LiveObservation}){
 const home=r.predicted_winner===r.home_id,away=r.predicted_winner===r.away_id;
 const winner=home?ncaabTeamName(r.home_id,r.home_name):away?ncaabTeamName(r.away_id,r.away_name):null;
 const probability=home?r.home_win_probability:away?r.away_win_probability:null;
 const status=r.review_required?'En revisión':r.settlement?.outcome==='WIN'?'Ganada':r.settlement?.outcome==='LOSS'?'Perdida':'Pendiente de resultado';
 const tone=r.review_required?'border-amber-400/40 text-amber-200':r.settlement?.outcome==='LOSS'?'border-rose-400/40 text-rose-200':'border-teal-300/40 text-teal-200';
 return <section aria-label="Selección del modelo" className="mt-5 space-y-4">
  <div className={`rounded-xl border bg-slate-950/40 p-4 sm:p-5 ${tone}`}>
   <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-widest">Selección del modelo</p><span className="rounded-full border border-current/30 px-3 py-1 text-xs">{status}</span></div>
   <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0"><p className="break-words text-2xl font-bold text-white sm:text-3xl">{winner?winner+' a ganar':'Sin selección de ganador'}</p><p className="mt-2 text-sm text-slate-300">Ganador proyectado del partido</p></div>
    <div><p className="text-3xl font-bold">{probability===null?'—':(100*probability).toFixed(2)+'%'}</p><p className="mt-1 text-xs text-slate-400">Probabilidad estimada del modelo</p></div>
   </div>
   {winner&&r.projected_margin!==null&&<p className="mt-4 text-sm text-slate-300">{winner} proyectado por {Math.abs(r.projected_margin).toFixed(1)} puntos.</p>}
   <p className="mt-4 text-xs text-slate-400">Selección experimental · sin cuota verificada · no es una apuesta oficial.</p>
  </div>
  <details className="rounded-xl border border-slate-700 p-4">
   <summary className="cursor-pointer text-sm font-semibold text-slate-200">Ver marcador y total proyectados</summary>
   <div className="mt-4 grid grid-cols-2 gap-3">{[
    {id:r.away_id,label:ncaabTeamName(r.away_id,r.away_name),score:r.away_score,p:r.away_win_probability},
    {id:r.home_id,label:ncaabTeamName(r.home_id,r.home_name),score:r.home_score,p:r.home_win_probability},
   ].map(t=><div key={t.id} className="min-w-0 rounded-lg bg-slate-950/40 p-3"><p className="break-words text-sm text-slate-300">{t.label}</p><p className="mt-2 text-xl font-bold">{t.score?.toFixed(1)??'—'}</p><p className="mt-2 text-xs text-slate-400">Probabilidad de ganar: {t.p===null?'—':(100*t.p).toFixed(2)+'%'}</p></div>)}</div>
   <p className="mt-4 text-sm text-slate-300">Total proyectado {r.projected_total?.toFixed(1)??'—'} puntos.</p><p className="mt-2 text-xs text-slate-400">Proyecciones de marcador; sin selección de spread ni de Over/Under.</p>
  </details>
 </section>;
}
