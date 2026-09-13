import type { getMlbOperationalHealth } from '@/services/pick2-mlb-health.service'
import { prTime } from './mlb-presentation'

type Health = Awaited<ReturnType<typeof getMlbOperationalHealth>>
const human = (value: unknown) => value === 'OBSERVED_RECENT_COMPLETION' ? 'Recently completed' : typeof value === 'string' ? value.replaceAll('_', ' ').toLowerCase() : 'Unavailable'
export default function MlbHealthSummary({ health }: { health: Health }) {
  const current = health.currentRun && 'updatedAt' in health.currentRun ? health.currentRun : null
  const operational = health.budgets.operationalDaily
  const consumed = 'consumed' in operational ? operational.consumed : null
  const cap = 'cap' in operational ? operational.cap : null
  const credits = 'observedCredits' in operational ? operational.observedCredits : null
  const failed = health.currentRunState === 'FAILED'
  const unhealthy = failed || /BLOCKED|UNAVAILABLE|DEGRADED/.test(health.automation.observedHealth)
  const lastCompleted = health.currentRunState === 'COMPLETE' ? prTime(current?.updatedAt, true) : 'Not supplied by the current snapshot'
  const facts = [
    ['Configured', health.automation.activation], ['Observed health', human(health.automation.observedHealth)],
    ['Last completed run', lastCompleted], ['Current / unresolved state', human(health.currentRunState)],
    ['Games', health.storedGames], ['Predictions', health.predictionCount],
    ['Current value opportunities', health.valueCount], ['Current Official Picks', health.officialPickCount],
    ['Historical mission Odds', `${health.budgets.historicalCertification.consumed ?? 'Unknown'} / 20`],
    ['Operational daily Odds', consumed == null || cap == null ? 'Unavailable' : `${consumed} / ${cap}`],
    ['Web deployment SHA', health.deployment.webDeploymentSha ?? 'Unavailable'],
    ['Edge version', health.deployment.edgeVersion == null ? 'Unavailable' : `v${health.deployment.edgeVersion}`],
  ] as const
  return <div className="space-y-4">
    <section aria-label="Automation health" className={`rounded-xl border p-4 ${unhealthy ? 'border-amber-300/50 bg-amber-300/5' : 'border-teal-400/30 bg-teal-400/5'}`}>
      <h2 className="font-semibold">{unhealthy ? 'Automation needs attention' : human(health.automation.observedHealth)}</h2>
      {unhealthy && <p className="mt-1 text-sm text-slate-300">Configured enabled does not mean execution is healthy.</p>}
      {current?.failure && <p role="alert" className="mt-2 break-words text-sm text-amber-200">Stage: {current.failure.stage}. Failure: {current.failure.code}. {prTime(current.failure.at, true)}</p>}
      {health.currentRunState === 'RUNNING' && <p className="mt-2 text-sm text-slate-300">A run is in progress; its presence is not an unresolved failure.</p>}
    </section>
    <dl aria-label="Operational summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{facts.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-3"><dt className="text-xs text-slate-400">{label}</dt><dd className={`mt-1 break-words font-semibold ${label === 'Web deployment SHA' ? 'font-mono text-xs leading-5' : 'text-sm'}`}>{value}</dd></div>)}</dl>
    <p className="text-xs leading-5 text-slate-400">Odds credits: {credits == null ? 'not observed' : credits}. Request counts and provider credits are different measures. Current value opportunities include canonical classifications; only Official Picks are recommendations.</p>
  </div>
}
