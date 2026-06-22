'use client'

import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard'

function formatMoney(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''

  return `${sign}$${Math.abs(value).toFixed(2)}`
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toFixed(2)}%`
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-green-400'
      : tone === 'negative'
        ? 'text-red-400'
        : 'text-white'

  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function MiniTable({
  title,
  rows,
}: {
  title: string
  rows: {
    key: string
    picks: number
    settled: number
    winRate: number
    profit: number
    roi: number
  }[]
}) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="font-bold text-white">{title}</p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No settled picks yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Picks</th>
                <th className="py-2">W%</th>
                <th className="py-2">Profit</th>
                <th className="py-2">ROI</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-700">
                  <td className="py-2 text-white">{row.key}</td>
                  <td className="py-2 text-slate-300">{row.settled}</td>
                  <td className="py-2 text-slate-300">
                    {row.winRate.toFixed(2)}%
                  </td>
                  <td
                    className={`py-2 ${
                      row.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatMoney(row.profit)}
                  </td>
                  <td
                    className={`py-2 ${
                      row.roi >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatPercent(row.roi)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPanel() {
  const { data, loading, error } = useAnalyticsDashboard()

  if (loading) {
    return <p className="text-slate-400">Loading analytics...</p>
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/40 p-4">
        <p className="font-bold text-red-400">Could not load analytics.</p>
        <p className="mt-2 text-sm text-red-200">{error}</p>
      </div>
    )
  }

  const overall = data.overall

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="Tracked Picks" value={overall.picks} />
        <StatCard label="Settled Picks" value={overall.settled} />
        <StatCard label="Win Rate" value={`${overall.winRate.toFixed(2)}%`} />
        <StatCard
          label="ROI"
          value={formatPercent(overall.roi)}
          tone={overall.roi >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Wins" value={overall.wins} tone="positive" />
        <StatCard label="Losses" value={overall.losses} tone="negative" />
        <StatCard
          label="Profit"
          value={formatMoney(overall.profit)}
          tone={overall.profit >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <MiniTable title="Performance by Sport" rows={data.bySport} />
        <MiniTable title="Best Teams" rows={data.bestTeams} />
        <MiniTable title="Worst Teams" rows={data.worstTeams} />
      </div>
    </div>
  )
}