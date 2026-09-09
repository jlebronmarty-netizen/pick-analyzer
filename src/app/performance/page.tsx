import DashboardShell from '@/components/dashboard/DashboardShell'
import { getMlbOfficialPerformance } from '@/services/pick2-mlb-performance-read.service'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  const report = await getMlbOfficialPerformance(), s = report.summary
  const percent = (x: number | null) => x === null ? 'Unavailable' : `${(x * 100).toFixed(1)}%`
  return <DashboardShell><section className="mx-auto max-w-5xl space-y-5 p-6 text-slate-200"><h1 className="text-3xl font-bold text-white">MLB performance</h1><p>Certified Official Pick results. One unit per pick for reporting; these are not actual wagers.</p>{report.warning && <p role="status" className="text-amber-200">{report.warning}</p>}<dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{Object.entries({ 'Settled picks': s.pickCount, Wins: s.wins, Losses: s.losses, Pushes: s.pushes, Voids: s.voids, 'Win rate': percent(s.winRate), Units: s.units?.toFixed(3) ?? 'Unavailable', ROI: percent(s.roi), CLV: 'Unavailable' }).map(([label, value]) => <div key={label} className="rounded-xl border border-slate-700 p-4"><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-2 text-xl">{value}</dd></div>)}</dl><p>Sample: {s.sampleSize}. Dates: {s.dateFrom ?? 'none'} — {s.dateTo ?? 'none'}.</p><p className="break-words">Model: {s.modelVersions.join(', ') || 'No settled sample'}. Policy: {s.policyVersions.join(', ') || 'No settled sample'}.</p><p>{s.clvReason}</p><p>No profitability claim is supported by an empty sample.</p></section></DashboardShell>
}
