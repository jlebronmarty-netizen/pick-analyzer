'use client'

import { useEffect, useState } from 'react'

type Segment = {
  key: string
  label: string
  samples: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  roi: number
  units: number
  averageProbability: number
  averageConfidence: number
  brierScore: number | null
}

type MetricsResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    rows: number
    settled: number
    pending: number
    brierScore: number | null
    warnings: string[]
  }
  overall: Segment
  bySport: Segment[]
  byMarket: Segment[]
  byConfidence: Segment[]
}

export default function ModelMetricsFrameworkPanel() {
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/model/metrics', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message ?? json.error ?? 'Unable to load model metrics'
        )
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load model metrics'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Model Metrics...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-300">
            Model Metrics Framework
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Calibration & ROI Splits
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Reusable Brier, ROI, units and segment metrics from stored prediction history.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-2 text-sm font-bold text-purple-100 hover:bg-purple-900/40"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Rows" value={data?.summary.rows ?? 0} />
        <Stat label="Settled" value={data?.summary.settled ?? 0} />
        <Stat label="Win Rate" value={`${data?.overall.winRate ?? 0}%`} />
        <Stat label="ROI" value={`${data?.overall.roi ?? 0}%`} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      {data?.summary.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm text-amber-100">
          {data.summary.warnings.join(' ')}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Split title="By Sport" rows={data?.bySport ?? []} />
        <Split title="By Market" rows={data?.byMarket ?? []} />
        <Split title="By Confidence" rows={data?.byConfidence ?? []} />
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Split({ title, rows }: { title: string; rows: Segment[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <div className="mt-4 grid gap-3">
        {rows.slice(0, 6).map((row) => (
          <div
            key={row.key}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-bold text-white">{row.label}</p>
              <p className="text-xs text-slate-400">{row.samples} samples</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              ROI {row.roi}% · Win {row.winRate}% · Brier {row.brierScore ?? 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
