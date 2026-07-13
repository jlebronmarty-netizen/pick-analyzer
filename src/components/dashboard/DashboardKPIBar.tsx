'use client'

import { useDashboard } from '@/context/DashboardContext'

function formatMoney(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(Number(value ?? 0)).toFixed(2)}`
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value ?? 0).toFixed(2)}%`
}

function getStatusClass(value: number) {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-slate-300'
}

function getModelHealth(dashboard: any) {
  const status =
    dashboard?.calibration?.overall?.modelStatus ??
    'UNKNOWN'

  if (status === 'WELL_CALIBRATED') return 'HEALTHY'
  if (status === 'NEEDS_MONITORING') return 'MONITOR'
  if (status === 'NEEDS_RECALIBRATION') return 'RECALIBRATE'
  return 'LEARNING'
}

function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'positive' | 'negative' | 'warning' | 'neutral'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-400'
      : tone === 'negative'
        ? 'text-red-400'
        : tone === 'warning'
          ? 'text-amber-400'
          : 'text-white'

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function DashboardKPIBar() {
  const { dashboard, loading, error, refresh } = useDashboard()

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-5 text-sm text-red-300">
        Dashboard summary error: {error}
      </div>
    )
  }

  if (!dashboard) return null

  const overall = dashboard.analytics?.overall ?? {}
  const topPicks = dashboard.playOfTheDay?.play
  const clv = dashboard.clv?.summary ?? {}
  const calibration = dashboard.calibration?.overall ?? {}
  const bankroll = dashboard.bankrollManager?.bankroll ?? dashboard.bankroll ?? 1000
  const stakePlan = dashboard.bankrollManager?.stakePlan ?? {}

  const winRate = Number(overall.winRate ?? 0)
  const roi = Number(overall.roi ?? 0)
  const profit = Number(overall.profit ?? 0)
  const pending = Number(overall.pending ?? 0)
  const settled = Number(overall.settled ?? 0)
  const clvAverage = Number(clv.averageClv ?? 0)
  const calibrationScore = Number(calibration.calibrationScore ?? 0)
  const modelHealth = getModelHealth(dashboard)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            Command Center
          </h2>
          <p className="text-sm text-slate-400">
            Unified dashboard powered by one backend engine.
          </p>
        </div>

        <button
          onClick={() => refresh()}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <KpiCard
          label="Bankroll"
          value={`$${Number(bankroll).toFixed(0)}`}
          sub={`Exposure ${Number(stakePlan.exposurePercent ?? 0).toFixed(2)}%`}
        />

        <KpiCard
          label="Profit"
          value={formatMoney(profit)}
          sub={`${settled} settled`}
          tone={profit >= 0 ? 'positive' : 'negative'}
        />

        <KpiCard
          label="ROI"
          value={formatPercent(roi)}
          sub="Model return"
          tone={roi >= 0 ? 'positive' : 'negative'}
        />

        <KpiCard
          label="Win Rate"
          value={`${winRate.toFixed(2)}%`}
          sub="Settled picks"
          tone={winRate >= 55 ? 'positive' : winRate >= 50 ? 'warning' : 'negative'}
        />

        <KpiCard
          label="Pending"
          value={pending}
          sub="Open picks"
        />

        <KpiCard
          label="CLV"
          value={formatPercent(clvAverage)}
          sub={`${clv.trackedPicks ?? 0} tracked`}
          tone={clvAverage >= 0 ? 'positive' : 'negative'}
        />

        <KpiCard
          label="Calibration"
          value={calibrationScore.toFixed(0)}
          sub={calibration.modelStatus ?? 'Learning'}
          tone={calibrationScore >= 70 ? 'positive' : calibrationScore > 0 ? 'warning' : 'negative'}
        />

        <KpiCard
          label="AI Status"
          value={modelHealth}
          sub={topPicks ? `${topPicks.team} ML` : 'No play'}
          tone={
            modelHealth === 'HEALTHY'
              ? 'positive'
              : modelHealth === 'MONITOR'
                ? 'warning'
                : 'negative'
          }
        />
      </div>
    </div>
  )
}