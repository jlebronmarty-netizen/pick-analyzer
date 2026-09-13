import DashboardShell from '@/components/dashboard/DashboardShell'
import MlbHealthSummary from '@/components/pick2/MlbHealthSummary'
import { getMlbOperationalHealth } from '@/services/pick2-mlb-health.service'

export const dynamic = 'force-dynamic'

export default async function DataHealthPage() {
  const health = await getMlbOperationalHealth()
  return <DashboardShell><section className="mlb-ui mx-auto max-w-6xl space-y-4 text-slate-200"><header><h1 className="text-3xl font-semibold text-white">MLB Data Health</h1><p className="mt-2 text-sm text-slate-400">{health.operatingDate} · America/Puerto_Rico</p></header><MlbHealthSummary health={health} />{health.warnings.map(w => <p key={w} role="status" className="text-sm text-amber-200">{w}</p>)}<details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer rounded py-2 font-semibold focus-visible:outline-2 focus-visible:outline-teal-300">Advanced Diagnostics</summary><pre className="mt-3 max-h-[36rem] overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(health, null, 2)}</pre></details><p className="break-words text-xs text-slate-400">{health.champion} · {health.featureSet} ({health.featureCount}) · {health.policy}</p><p className="text-xs text-slate-400">Settlement: {health.settlement}</p></section></DashboardShell>
}
