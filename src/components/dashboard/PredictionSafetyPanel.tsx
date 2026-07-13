'use client'

import { useEffect, useState } from 'react'

type SafetyResponse = {
  success: boolean
  requestId: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  checks: Record<string, boolean>
  deterministicResults: {
    status: 'valid' | 'skipped'
    reason: string | null
    warnings: string[]
  }[]
  summary: {
    checked: number
    valid: number
    skipped: number
    reasons: string[]
  }
  integrationStatus: string
}

export default function PredictionSafetyPanel() {
  const [data, setData] = useState<SafetyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/prediction-safety', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message ?? json.error ?? 'Unable to load prediction safety'
        )
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load prediction safety'
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
        Loading Prediction Safety...
      </section>
    )
  }

  const checkCount = data
    ? Object.values(data.checks).filter(Boolean).length
    : 0

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-300">
            Prediction Safety
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Validation Guardrails
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Shared safety checks for event timing, odds freshness, market compatibility, leakage risk and duplicate prevention.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-900/40"
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
        <Stat label="Checks" value={checkCount} />
        <Stat label="Samples" value={data?.summary.checked ?? 0} />
        <Stat label="Valid" value={data?.summary.valid ?? 0} />
        <Stat label="Skipped" value={data?.summary.skipped ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Safety Checks</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {Object.entries(data?.checks ?? {}).map(([key, enabled]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <p className="text-sm font-bold text-white">
                  {key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`)}
                </p>
                <p className={enabled ? 'text-xs text-emerald-300' : 'text-xs text-red-300'}>
                  {enabled ? 'available' : 'missing'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Typed Skip Reasons</p>
          <div className="mt-4 grid gap-2">
            {(data?.summary.reasons ?? []).map((reason) => (
              <div
                key={reason}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm font-bold text-white"
              >
                {reason}
              </div>
            ))}
            <p className="mt-3 text-sm text-slate-500">
              {data?.integrationStatus}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}
