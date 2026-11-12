import DashboardShell from '@/components/dashboard/DashboardShell';
import {getNbaCausalLearningReport} from '@/services/nba-causal-learning.service';
export const dynamic='force-dynamic';
const pct=(v:number|null)=>v===null?'N/A':(v*100).toFixed(1)+'%';
const num=(v:number|null)=>v===null?'N/A':v.toFixed(3);
export default async function NbaLearningPage(){
 const data=await getNbaCausalLearningReport();
 return <DashboardShell>
  <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-6 md:p-8">
   <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">NBA Learning</p>
   <h1 className="mt-3 text-4xl font-black text-white">NBA Causal Learning V3</h1>
   <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">Diagnóstico postgame usando la predicción GOAT congelada, Q1-Q4, play-by-play, lineup esperado vs real, player-game stats y matchups jugador-vs-defensor confirmados cuando estén disponibles. Las etiquetas siguen siendo hipótesis observadas hasta demostrar un patrón fuera de muestra.</p>
  </section>
  <section className="grid gap-4 md:grid-cols-4">
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">Evaluados</p><p className="mt-2 text-3xl font-black text-white">{data.sample.settled}</p></div>
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">W-L</p><p className="mt-2 text-3xl font-black text-white">{data.sample.wins}-{data.sample.losses}</p></div>
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">Accuracy</p><p className="mt-2 text-3xl font-black text-white">{pct(data.sample.accuracy)}</p></div>
   <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-500">Brier</p><p className="mt-2 text-3xl font-black text-white">{num(data.sample.brier)}</p></div>
  </section>
  <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
   <h2 className="text-2xl font-black text-white">Cobertura causal</h2>
   <div className="mt-4 grid gap-3 md:grid-cols-5">
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Parciales por cuarto: {data.evidence.quarterArchive}</p>
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">PBP actual: {data.evidence.pbpCurrent?'Sí':'Pendiente'}</p>
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Lineup esperado vs real: {data.evidence.lineupTruthCurrent?`Sí · ${data.evidence.lineupGames??0} juegos`:'Pendiente'}</p>
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Player-game stats: {data.evidence.playerGameStatsCurrent?`Sí · ${data.evidence.playerStatGames??0} juegos`:'Pendiente'}</p>
    <p className="rounded-lg bg-slate-950/70 p-3 text-sm text-slate-300">Matchup defensor confirmado: {data.evidence.matchupTrackingCurrent?`Sí · ${data.evidence.matchupGames??0} juegos`:'Pendiente'}</p>
   </div>
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
    <h2 className="text-2xl font-black text-white">Patrones observados</h2>
    <div className="mt-4 grid gap-2">{data.patterns.length?data.patterns.map(p=><div key={p.label} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><p className="font-bold text-white">{p.label}</p><p className="mt-1 text-sm text-slate-400">{p.count} casos · loss rate {pct(p.lossRate)}</p></div>):<p className="text-sm text-slate-400">Todavía no hay patrones suficientes.</p>}</div>
   </article>
   <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
    <h2 className="text-2xl font-black text-white">Regla de seguridad</h2>
    <p className="mt-3 text-sm leading-6 text-slate-300">Ninguna etiqueta modifica NBA GOAT. Un patrón repetido debe convertirse en challenger, validarse fuera de muestra y superar holdout antes de poder aparecer como mejora candidata.</p>
   </article>
  </section>
  <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
   <h2 className="text-2xl font-black text-white">Historial jugador vs defensor</h2>
   <p className="mt-2 text-sm text-slate-400">Solo aparecen pares con 2+ juegos confirmados en el ledger V3. Es descriptivo; no se usa automáticamente como probabilidad futura.</p>
   <div className="mt-4 grid gap-3 lg:grid-cols-2">{data.matchupProfiles?.length?data.matchupProfiles.slice(0,20).map((m:any)=><article key={String(m.offensivePlayerId)+'-'+String(m.defenderPlayerId)} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
    <p className="font-black text-white">{m.offensivePlayer??m.offensivePlayerId} vs {m.defender??m.defenderPlayerId}</p>
    <p className="mt-2 text-sm text-slate-400">{m.games} juegos · {Math.round(m.seconds)}s matchup · {m.fgm}-{m.fga} FG · {m.fgPct!=null?(m.fgPct*100).toFixed(1)+'%':'N/A'} · {m.points} pts</p>
   </article>):<p className="text-sm text-slate-400">Todavía no hay pares repetidos suficientes.</p>}</div>
  </section>
  <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
   <h2 className="text-2xl font-black text-white">Diagnósticos recientes</h2>
   <div className="mt-4 grid gap-3">{data.recent.map(r=><article key={r.prediction_id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
    <div className="flex flex-wrap justify-between gap-2"><p className="font-black text-white">{r.selection}</p><p className={r.outcome==='win'?'text-emerald-300':'text-rose-300'}>{String(r.outcome).toUpperCase()}</p></div>
    <p className="mt-2 text-sm text-slate-400">Margen real: {r.actual_margin??'N/A'} · Q1 {r.q1_margin??'N/A'} · Q2 {r.q2_margin??'N/A'} · Q3 {r.q3_margin??'N/A'} · Q4 {r.q4_margin??'N/A'}</p>
    <p className="mt-2 text-sm text-slate-300">{Array.isArray(r.observed_labels)&&r.observed_labels.length?r.observed_labels.join(' · '):'Sin etiqueta diagnóstica fuerte'}</p>
    <div className="mt-2 grid gap-1 text-xs text-slate-400"><p>Cambios de starters: {r.observed_evidence?.lineupComparison?.starterChanges??'N/A'}</p><p>Top scorer: {r.observed_evidence?.playerGameStats?.topScorers?.[0]?.name??'N/A'} {r.observed_evidence?.playerGameStats?.topScorers?.[0]?.pts!=null?`· ${r.observed_evidence.playerGameStats.topScorers[0].pts} pts`:''}</p><p>Turnovers equipo: {r.observed_evidence?.playerGameStats?.totals?.tov??'N/A'}</p><p>Defensor principal confirmado: {r.observed_evidence?.matchupTracking?.primaryDefender?.defender??'N/A'} {r.observed_evidence?.matchupTracking?.primaryDefender?.seconds!=null?`· ${r.observed_evidence.matchupTracking.primaryDefender.seconds}s`:''}</p><p>FG vs defensor: {r.observed_evidence?.matchupTracking?.primaryDefender?.fgPct!=null?`${(r.observed_evidence.matchupTracking.primaryDefender.fgPct*100).toFixed(1)}%`:'N/A'} · Switches equipo: {r.observed_evidence?.matchupTracking?.selectedTeamAdvanced?.switches??'N/A'} · Contested FGA: {r.observed_evidence?.matchupTracking?.selectedTeamAdvanced?.contestedFga??'N/A'}</p></div>
    <p className="mt-2 text-xs text-amber-200">Estado causal: {r.causal_status}</p>
   </article>)}</div>
  </section>
 </DashboardShell>
}
