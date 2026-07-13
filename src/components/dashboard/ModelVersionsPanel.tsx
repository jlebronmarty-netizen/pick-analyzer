'use client'

import { useEffect, useState } from 'react'

type ModelVersion = {
  id: string
  version: number
  created_at: string
  calibration_score: number
  roi: number
  win_rate: number
  sample_size: number
}

type Comparison = {
  status: 'NO_DATA' | 'BASELINE' | 'IMPROVING' | 'STABLE' | 'DECLINING'
  latest: ModelVersion | null
  previous: ModelVersion | null
  changes: {
    roiChange: number
    winRateChange: number
    calibrationChange: number
    sampleChange: number
    score: number
  } | null
}

type Response = {
  success: boolean
  latest: ModelVersion | null
  history: ModelVersion[]
  comparison: Comparison
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function changeClass(value?: number) {
  const number = Number(value ?? 0)

  if (number > 0) return 'text-emerald-400'
  if (number < 0) return 'text-red-400'

  return 'text-slate-300'
}

function statusClass(status?: string) {
  if (status === 'IMPROVING') return 'bg-emerald-500/15 text-emerald-300'
  if (status === 'DECLINING') return 'bg-red-500/15 text-red-300'
  if (status === 'STABLE') return 'bg-blue-500/15 text-blue-300'

  return 'bg-slate-700 text-slate-300'
}

export default function ModelVersionsPanel() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/model/versions', {
          cache: 'no-store',
        })

        const json = await response.json()
        setData(json)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-400">
        Loading model versions...
      </div>
    )
  }

  if (!data?.success) {
    return (
      <div className="rounded-xl border border-red-700 bg-red-950/40 p-6 text-red-300">
        Unable to load model history.
      </div>
    )
  }

  const latest = data.latest
  const comparison = data.comparison

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Model Version Center
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Learning Evolution
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Tracks every model learning cycle and compares the current model
            against the previous version.
          </p>
        </div>

        <span
          className={`rounded-full px-4 py-2 text-xs font-bold ${statusClass(
            comparison?.status
          )}`}
        >
          {comparison?.status ?? 'NO_DATA'}
        </span>
      </div>

      {latest && (
        <div className="mb-6 rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-5">
          <h3 className="text-lg font-semibold text-emerald-300">
            Current Model #{latest.version}
          </h3>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <p className="text-xs text-slate-400">ROI</p>
              <p className="font-bold text-emerald-400">
                {formatPercent(latest.roi)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Win Rate</p>
              <p className="font-bold text-white">
                {formatPercent(latest.win_rate)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Calibration</p>
              <p className="font-bold text-blue-400">
                {formatPercent(latest.calibration_score)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Sample</p>
              <p className="font-bold text-white">{latest.sample_size}</p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Created</p>
              <p className="text-xs font-bold text-slate-300">
                {formatDate(latest.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {comparison?.changes && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">ROI Change</p>
            <p className={`mt-1 text-2xl font-black ${changeClass(comparison.changes.roiChange)}`}>
              {comparison.changes.roiChange > 0 ? '+' : ''}
              {formatPercent(comparison.changes.roiChange)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">Win Rate Change</p>
            <p className={`mt-1 text-2xl font-black ${changeClass(comparison.changes.winRateChange)}`}>
              {comparison.changes.winRateChange > 0 ? '+' : ''}
              {formatPercent(comparison.changes.winRateChange)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">Calibration Change</p>
            <p className={`mt-1 text-2xl font-black ${changeClass(comparison.changes.calibrationChange)}`}>
              {comparison.changes.calibrationChange > 0 ? '+' : ''}
              {formatPercent(comparison.changes.calibrationChange)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500">Sample Change</p>
            <p className={`mt-1 text-2xl font-black ${changeClass(comparison.changes.sampleChange)}`}>
              {comparison.changes.sampleChange > 0 ? '+' : ''}
              {comparison.changes.sampleChange}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.history.map((version) => (
          <div
            key={version.id}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white">
                  Model #{version.version}
                </p>

                <p className="text-xs text-slate-400">
                  {formatDate(version.created_at)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6 text-right text-sm">
                <div>
                  <p className="text-slate-500">ROI</p>
                  <p className={changeClass(version.roi)}>
                    {formatPercent(version.roi)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">WR</p>
                  <p className="text-slate-300">
                    {formatPercent(version.win_rate)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Sample</p>
                  <p className="text-slate-300">{version.sample_size}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}