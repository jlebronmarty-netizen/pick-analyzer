import DashboardShell from '@/components/dashboard/DashboardShell'
import { getMlbOperationalHealth } from '@/services/pick2-mlb-health.service'

export const dynamic = 'force-dynamic'

export default async function DataHealthPage() {
  const health = await getMlbOperationalHealth()
  return <DashboardShell><section className="mx-auto max-w-5xl space-y-5 p-6 text-slate-200"><h1 className="text-3xl font-bold text-white">MLB Data Health</h1><p>{health.operatingDate} · America/Puerto_Rico</p><p>Automation: {health.automation.activation}. {health.automation.reason}</p><p>Current run: {health.currentRunState.replaceAll('_', ' ').toLowerCase()}.</p><p>{health.accountingNote}</p><p>Stored games: {health.storedGames}; predictions: {health.predictionCount}; value rows: {health.valueCount}; currently actionable Official Picks: {health.officialPickCount}.</p>{health.warnings.map(w => <p key={w} className="text-amber-200">{w}</p>)}<details open className="rounded-xl border border-slate-700 p-4"><summary>Run, provider and DML accounting</summary><pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify({ asOf: health.accountingAsOf, coordinator: health.currentRun, lastRun: health.lastPublishedRun, providers: health.providerAccounting, dml: health.dmlAccounting }, null, 2)}</pre></details><details className="rounded-xl border border-slate-700 p-4"><summary>Freshness and blocked games</summary><pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify({ freshness: health.freshness, blocked: health.blockedGames }, null, 2)}</pre></details><p className="break-words">{health.champion} · {health.featureSet} ({health.featureCount}) · {health.policy}</p><p>Settlement: {health.settlement}</p></section></DashboardShell>
}
