'use client'

import { useEffect, useState } from 'react'

type CalibrationBucket = {
  bucket: string
  min: number
  max: number
  total: number
  wins: number
  losses: number
  pushes: number
  expectedWinRate: number
  actualWinRate: number
  calibrationError: number
  averageConfidence: number
  averageOdds: number
  recommendation:
    | 'UNDERCONFIDENT'
    | 'OVERCONFIDENT'
    | 'CALIBRATED'
    | 'INSUFFICIENT_DATA'
}

type CalibrationResponse = {
  success: boolean
  generatedAt: string
  sample: {
    settledRows: number
    recommendedSettledRows: number
  }
  overall: {
    totalBuckets: number
    validBuckets: number
    averageCalibrationError: number
    calibratedBuckets: number
    overconfidentBuckets: number
    underconfidentBuckets: number
    calibrationScore: number
    modelStatus:
      | 'WELL_CALIBRATED'
      | 'NEEDS_MONITORING'
      | 'NEEDS_RECALIBRATION'
      | 'INSUFFICIENT_DATA'
  }
  buckets: CalibrationBucket[]
  error?: string
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function statusClass(status: string) {
  if (status === 'WELL_CALIBRATED') return 'text-emerald-300'
  if (status === 'NEEDS_MONITORING') return 'text-amber-300'
  if (status === 'NEEDS_RECALIBRATION') return 'text-red-300'

  return 'text-slate-300'
}

function recommendationClass(value: string) {
  if (value === 'CALIBRATED') return 'bg-emerald-500/15 text-emerald-300'
  if (value === 'OVERCONFIDENT') return 'bg-red-500/15 text-red-300'
  if (value === 'UNDERCONFIDENT') return 'bg-blue-500/15 text-blue-300'

  return 'bg-slate-700 text-slate-300'
}

function errorClass(value: number) {
  if (Math.abs(value) <= 8) return 'text-emerald-400'
  if (Math.abs(value) <= 18) return 'text-amber-400'

  return 'text-red-400'
}

function CalibrationBar({ bucket }: { bucket: CalibrationBucket }) {
  const expected = Math.min(Math.max(bucket.expectedWinRate, 0), 100)
  const actual = Math.min(Math.max(bucket.actualWinRate, 0), 100)

  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{bucket.bucket}</p>
          <p className="text-xs text-slate-500">
            {bucket.total} picks · {bucket.wins}W / {bucket.losses}L
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${recommendationClass(
            bucket.recommendation
          )}`}
        >
          {bucket.recommendation}
        </span>
      </div>

      <div className="space-y-2 pt-2">
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Expected</span>
            <span>{formatPercent(bucket.expectedWinRate)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${expected}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Actual</span>
            <span>{formatPercent(bucket.actualWinRate)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${actual}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
        <div>
          <p className="text-slate-500">Error</p>
          <p className={`font-bold ${errorClass(bucket.calibrationError)}`}>
            {formatPercent(bucket.calibrationError)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Avg Conf.</p>
          <p className="font-bold text-white">
            {formatPercent(bucket.averageConfidence)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Avg Odds</p>
          <p className="font-bold text-white">{bucket.averageOdds.toFixed(0)}</p>
        </div>
      </div>
    </div>
  )
}

export default function ModelCalibrationPanel() {
  const [data, setData] = useState<CalibrationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/model/calibration', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load model calibration')
        }

        setData(json)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unknown calibration error'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading model calibration...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Model Calibration</h2>
        <p className="text-sm text-slate-400">
          Compares predicted win probability against actual win rate by bucket.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Calibration Score</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.overall.calibrationScore.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Model Status</p>
          <p
            className={`mt-1 text-lg font-bold ${statusClass(
              data.overall.modelStatus
            )}`}
          >
            {data.overall.modelStatus}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Settled Picks</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.sample.settledRows}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Recommended Settled</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.sample.recommendedSettledRows}
          </p>
        </div>
      </div>

      {data.overall.modelStatus === 'INSUFFICIENT_DATA' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
          <p className="text-sm font-semibold text-amber-300">
            Not enough settled recommended picks yet.
          </p>
          <p className="mt-2 text-sm text-amber-100">
            Calibration becomes more reliable after each bucket has at least 5
            settled recommended picks. Keep capturing and settling predictions.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {data.buckets.map((bucket) => (
          <CalibrationBar key={bucket.bucket} bucket={bucket} />
        ))}
      </div>
    </div>
  )
}