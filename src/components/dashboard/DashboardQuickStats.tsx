'use client'

import { useDashboard } from '@/context/DashboardContext'

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const color =
    tone === 'positive'
      ? 'text-emerald-400'
      : tone === 'negative'
        ? 'text-red-400'
        : 'text-white'

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-3xl font-black ${color}`}>{value}</p>
    </div>
  )
}

export default function DashboardQuickStats() {
  const { dashboard, loading } = useDashboard()

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-3xl bg-slate-900"
          />
        ))}
      </div>
    )
  }

  const kpis = dashboard?.kpis

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
      <StatCard label="Win Rate" value={`${Number(kpis?.winRate ?? 0).toFixed(2)}%`} />
      <StatCard
        label="ROI"
        value={`${Number(kpis?.roi ?? 0).toFixed(2)}%`}
        tone={Number(kpis?.roi ?? 0) >= 0 ? 'positive' : 'negative'}
      />
      <StatCard
        label="Profit"
        value={`$${Number(kpis?.profit ?? 0).toFixed(2)}`}
        tone={Number(kpis?.profit ?? 0) >= 0 ? 'positive' : 'negative'}
      />
      <StatCard label="Settled" value={kpis?.settled ?? 0} />
      <StatCard label="Best Bets" value={kpis?.bestBets ?? 0} />
    </div>
  )
}