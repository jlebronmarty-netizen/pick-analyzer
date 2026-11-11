import DashboardShell from '@/components/dashboard/DashboardShell';
import {getMultisportLearningOverview} from '@/services/multisport-learning-overview.service';

const pct=(v:number|null)=>v===null?'N/A':(100*v).toFixed(1)+'%';
const mae=(v:number|null)=>v===null?'N/A':v.toFixed(2);
const stateLabel:Record<string,string>={
  COLLECTING:'Recolectando evidencia',
  MONITORING:'Monitoreando',
  PATTERN_DETECTED:'Patrón detectado',
  VALIDATED_CANDIDATE:'Mejora candidata validada',
};
const stateClass:Record<string,string>={
  COLLECTING:'border-slate-700 bg-slate-900 text-slate-300',
  MONITORING:'border-cyan-500/30 bg-cyan-500/10 text-cyan-100',
  PATTERN_DETECTED:'border-amber-500/40 bg-amber-500/10 text-amber-100',
  VALIDATED_CANDIDATE:'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
};

export default async function MultisportLearningCenter(){
  const data=await getMultisportLearningOverview();
  return <DashboardShell>
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-6 md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Model Learning</p>
          <h1 className="mt-3 text-4xl font-black text-white md:text-5xl">Aprendizaje multideporte</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">Pick analiza resultados y patrones de error sin cambiar automáticamente ningún modelo. Una alerta de mejora solo aparece cuando existe evidencia de validación fuera de muestra o holdout que justifica evaluarla.</p>
        </div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-50">
          Auto-aplicar: DESACTIVADO
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Deportes monitoreados</p>
        <p className="mt-2 text-3xl font-black text-white">{data.sports.length}</p>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Patrones para investigar</p>
        <p className="mt-2 text-3xl font-black text-white">{data.sports.filter(s=>s.state==='PATTERN_DETECTED').length}</p>
      </div>
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Mejoras candidatas</p>
        <p className="mt-2 text-3xl font-black text-white">{data.alerts.length}</p>
        <p className="mt-2 text-sm text-emerald-100">{data.alerts.length?'Requieren evaluación humana antes de cualquier cambio.':'No hay cambios validados pendientes de aprobación.'}</p>
      </div>
    </section>

    {data.alerts.length>0&&<section className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-6">
      <h2 className="text-2xl font-black text-white">⚠️ Pick recomienda revisar una mejora</h2>
      <div className="mt-4 grid gap-3">
        {data.alerts.map(a=><article key={a.sport} className="rounded-lg border border-emerald-400/30 bg-slate-950/70 p-4">
          <p className="font-black text-emerald-100">{a.sport} · {a.candidate!.title}</p>
          <p className="mt-2 text-sm text-slate-300">{a.candidate!.reason}</p>
          <p className="mt-2 text-xs text-slate-400">Validación: {a.candidate!.validation}</p>
        </article>)}
      </div>
    </section>}

    <section className="grid gap-4 xl:grid-cols-2">
      {data.sports.map(s=><article key={s.sport} className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-black text-white">{s.sport}</h2><p className="mt-1 text-sm text-slate-400">{s.model}</p></div>
          <span className={'rounded-full border px-3 py-1 text-xs font-bold '+stateClass[s.state]}>{stateLabel[s.state]}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><p className="text-xs text-slate-500">Liquidados</p><p className="mt-1 text-xl font-black text-white">{s.settled}</p></div>
          <div><p className="text-xs text-slate-500">W-L</p><p className="mt-1 text-xl font-black text-white">{s.wins}-{s.losses}</p></div>
          <div><p className="text-xs text-slate-500">Accuracy</p><p className="mt-1 text-xl font-black text-white">{pct(s.accuracy)}</p></div>
          <div><p className="text-xs text-slate-500">MAE numérico</p><p className="mt-1 text-xl font-black text-white">{mae(s.mae)}</p></div>
        </div>
        <p className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">{s.summary}</p>
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Evidencia disponible</p>
          <div className="mt-2 grid gap-2">{s.evidence.map(x=><p key={x} className="text-sm text-slate-300">• {x}</p>)}</div>
        </div>
      </article>)}
    </section>

    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
      <h2 className="text-2xl font-black text-white">Regla de promoción</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">Un patrón no es una mejora. Para notificar una mejora candidata, Pick exigirá una hipótesis concreta, muestra suficiente, repetición del patrón, prueba challenger y mejora fuera de muestra/holdout. Después de eso, nosotros decidimos si se implementa.</p>
      {data.errors.length>0&&<p className="mt-4 text-sm text-amber-200">Lecturas parciales: {data.errors.join(' · ')}</p>}
    </section>
  </DashboardShell>
}
