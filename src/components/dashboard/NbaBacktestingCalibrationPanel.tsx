'use client'

import { useEffect, useState, type ReactNode } from 'react'

type SegmentSummary = {
  total: number
  settled: number
  wins: number
  losses: number
  pushes: number
  voids: number
  winRate: number
  roi: number
  profit: number
  units: number
  averageOdds: number
  averageProbability: number
  averageConfidence: number
  averageEdge: number
  averageEv: number
  brierScore: number | null
}

type BacktestResponse = {
  success: boolean
  sample: {
    totalRows: number
    settledRows: number
    recommendedRows: number
    markets: string[]
    modelVersions: string[]
  }
  summary: SegmentSummary
  calibration: {
    sample: number
    brierScore: number | null
    score: number
    status: string
    buckets: {
      bucket: string
      sample: number
      expectedWinRate: number
      actualWinRate: number
      calibrationError: number
      recommendation: string
    }[]
  }
  leakageChecks: {
    cutoffAfterStart: number
    generatedAfterStart: number
    oddsAfterGenerated: number
    missingFeatureSnapshot: number
    missingModelVersion: number
    leakageRisk: number
  }
  byMarket: (SegmentSummary & { market: string })[]
  byConfidence: (SegmentSummary & { bucket: string })[]
  warnings: string[]
}

function pct(value?: number | null) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function numberValue(value?: number | null) {
  return `${Number(value ?? 0).toFixed(2)}`
}

function statusClass(status: string) {
  if (status === 'WELL_CALIBRATED') return 'text-emerald-300'
  if (status === 'NEEDS_MONITORING' || status === 'INSUFFICIENT_DATA') return 'text-amber-300'
  return 'text-red-300'
}

export default function NbaBacktestingCalibrationPanel() {
  const [data, setData] = useState<BacktestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/nba/predictions/backtest', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load NBA backtest')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'NBA backtest load failed'
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
        Loading NBA Backtesting & Calibration...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            NBA Backtesting & Calibration V1
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            NBA Model Measurement
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Measures settled NBA predictions, calibration buckets, leakage risk and market-level backtest performance.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-900/40 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Rows" value={`${data?.sample.totalRows ?? 0}`} />
        <Stat label="Settled" value={`${data?.sample.settledRows ?? 0}`} />
        <Stat label="Win Rate" value={pct(data?.summary.winRate)} />
        <Stat label="ROI" value={pct(data?.summary.roi)} />
        <Stat label="Brier" value={data?.summary.brierScore === null ? 'N/A' : numberValue(data?.summary.brierScore)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel title="Calibration">
          <p className={`text-2xl font-black ${statusClass(data?.calibration.status ?? 'INSUFFICIENT_DATA')}`}>
            {data?.calibration.status?.replace('_', ' ') ?? 'INSUFFICIENT DATA'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini label="Sample" value={`${data?.calibration.sample ?? 0}`} />
            <Mini label="Score" value={numberValue(data?.calibration.score)} />
          </div>
        </Panel>

        <Panel title="Leakage Checks">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Mini label="Risk" value={`${data?.leakageChecks.leakageRisk ?? 0}`} />
            <Mini label="Cutoff" value={`${data?.leakageChecks.cutoffAfterStart ?? 0}`} />
            <Mini label="Generated" value={`${data?.leakageChecks.generatedAfterStart ?? 0}`} />
            <Mini label="Odds Time" value={`${data?.leakageChecks.oddsAfterGenerated ?? 0}`} />
          </div>
        </Panel>

        <Panel title="Metadata Quality">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Mini label="Snapshots" value={`${data?.leakageChecks.missingFeatureSnapshot ?? 0}`} />
            <Mini label="Versions" value={`${data?.leakageChecks.missingModelVersion ?? 0}`} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Missing counts represent rows that cannot support reliable calibration.
          </p>
        </Panel>
      </div>

      {data?.warnings.length ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
          <p className="font-bold text-amber-300">Backtest Warnings</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {data.warnings.slice(0, 5).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="Market Backtest">
          <div className="space-y-2">
            {(data?.byMarket ?? []).slice(0, 6).map((row) => (
              <div key={row.market} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">{row.market.replace('_', ' ')}</span>
                <span className="font-bold text-white">
                  {row.wins}-{row.losses}-{row.pushes} / {pct(row.roi)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Calibration Buckets">
          <div className="space-y-2">
            {(data?.calibration.buckets ?? []).map((bucket) => (
              <div key={bucket.bucket} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">{bucket.bucket}</span>
                <span className="font-bold text-white">
                  {pct(bucket.actualWinRate)} / {bucket.sample}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="mb-3 text-sm font-bold text-white">{title}</p>
      {children}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}
