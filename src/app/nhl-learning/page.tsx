import DashboardShell from '@/components/dashboard/DashboardShell';
import {getNhlCausalLearningReport} from '@/services/nhl-causal-learning.service';
export const dynamic='force-dynamic';
const pct=(v:number|null)=>v===null?'N/A':(v*100).toFixed(1)+'%';
const num=(v:number|null)=>v===null?'N/A':v.toFixed(3);
export default async function NhlLearningPage(){
 const data=await getNhlCausalLearningReport();
 return <DashboardShell>
  <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-6 md:p-8">
   <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">NHL Learning</p>
   <h1 className="mt-3 text-4xl font-black text-white">NHL Causal Learning V1–V3</h1>
   <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">Predicción congelada → flujo oficial play-by-play → goalie y skaters reales → shooter vs goalie confirmado → historial de matchups. Todo es postgame research y no modifica el modelo NHL automáticamente.</p>
  </section>
  <section className="grid gap-4 md:grid-cols-4">
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">Evaluados</p><p className="mt-2 text-3xl font-black text-white">{data.sample.settled}</p></div>
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">W-L</p><p className="mt-2 text-3xl font-black text-white">{data.sample.wins}-{data.sample.losses}</p></div>
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">Accuracy</p><p className="mt-2 text-3xl font-black text-white">{pct(data.sample.accuracy)}</p></div>
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">Brier</p><p className="mt-2 text-3xl font-black text-white">{num(data.sample.brier)}</p></div>
  </section>
  <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
   <h2 className="text-2xl font-black text-white">Cobertura V1–V3</h2>
   <div className="mt-4 grid gap-3 md:grid-cols-4">
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Contexto oficial: {data.evidence.contextGames}</p>
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Play-by-play: {data.evidence.pbpGames}</p>
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Boxscore/goalie/skaters: {data.evidence.boxscoreGames}</p>
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Shooter-vs-goalie: {data.evidence.shooterGoalieObservations}</p>
   </div>
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
    <h2 className="text-2xl font-black text-white">Patrones observados</h2>
    <div className="mt-4 grid gap-2">{data.patterns.length?data.patterns.map(p=><div key={p.label} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><p className="font-bold text-white">{p.label}</p><p className="mt-1 text-sm text-slate-400">{p.count} casos · loss rate {pct(p.lossRate)}</p></div>):<p className="text-sm text-slate-400">Todavía no hay patrones suficientes.</p>}</div>
   </article>
   <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
    <h2 className="text-2xl font-black text-white">Regla de seguridad</h2>
    <p className="mt-3 text-sm leading-6 text-slate-300">Observación ≠ causa. Patrón ≠ mejora. Una mejora debe pasar challenger, validación y holdout antes de llegar a revisión humana.</p>
   </article>
  </section>
  <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
   <h2 className="text-2xl font-black text-white">Historial shooter vs goalie</h2>
   <div className="mt-4 grid gap-3 lg:grid-cols-2">{data.matchupProfiles?.length?data.matchupProfiles.slice(0,20).map((m:any)=><article key={String(m.shooterId)+'-'+String(m.goalieId)} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"><p className="font-black text-white">{m.shooter??m.shooterId} vs {m.goalie??m.goalieId}</p><p className="mt-2 text-sm text-slate-400">{m.games} juegos · {m.goals}/{m.shots} goles/tiros · {m.shootingPct!=null?(m.shootingPct*100).toFixed(1)+'%':'N/A'}</p></article>):<p className="text-sm text-slate-400">Todavía no hay pares repetidos suficientes.</p>}</div>
  </section>
  <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
   <h2 className="text-2xl font-black text-white">Diagnósticos recientes</h2>
   <div className="mt-4 grid gap-3">{data.recent.map(r=><article key={r.prediction_id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-black text-white">{r.selection}</p><p className={r.outcome==='win'?'text-emerald-300':'text-rose-300'}>{String(r.outcome).toUpperCase()}</p></div><p className="mt-2 text-sm text-slate-400">Margen: {r.actual_margin??'N/A'} · evidencia {r.evidence_quality}</p><p className="mt-2 text-sm text-slate-300">{Array.isArray(r.observed_labels)&&r.observed_labels.length?r.observed_labels.join(' · '):'Sin etiqueta fuerte'}</p><p className="mt-2 text-xs text-slate-400">Goalie principal: {r.observed_evidence?.boxscore?.primaryGoalie?.name??'N/A'} · SV% {r.observed_evidence?.boxscore?.primaryGoalie?.savePctg!=null?(Number(r.observed_evidence.boxscore.primaryGoalie.savePctg)*100).toFixed(1)+'%':'N/A'}</p></article>)}</div>
  </section>
 </DashboardShell>
}
