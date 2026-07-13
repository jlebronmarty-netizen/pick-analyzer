'use client'

import { useEffect, useState } from 'react'

type SportQuality = {
  sportKey: string
  coverage: {
    events: { total: number; percent: number }
    oddsSnapshots: { total: number; percent: number }
    predictions: { total: number; percent: number }
    settledPredictions: { total: number; percent: number }
  }
  counts: {
    events: number
    odds: number
    jobs: number
    predictions: number
  }
}

type QualityResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    sportsChecked: number
    issues: number
    severityCounts: {
      info: number
      warning: number
      error: number
      critical: number
    }
    events: number
    oddsSnapshots: number
    syncJobs: number
    predictions: number
  }
  sports: SportQuality[]
  issues: {
    id: string
    sportKey: string
    severity: string
    category: string
    message: string
    count: number
    recommendation: string
  }[]
}

type PlanResponse = {
  success: boolean
  totalEstimatedProviderCalls: number
  estimatedQuotaImpact: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  warnings: string[]
}

function statusClass(status: string) {
  if (status === 'healthy') return 'text-emerald-300'
  if (status === 'warning') return 'text-amber-300'
  return 'text-red-300'
}

export default function GlobalDataQualityPanel() {
  const [quality, setQuality] = useState<QualityResponse | null>(null)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const [qualityResponse, planResponse] = await Promise.all([
        fetch('/api/data-quality/global', { cache: 'no-store' }),
        fetch('/api/reconciliation/plan', { cache: 'no-store' }),
      ])
      const qualityJson = await qualityResponse.json()
      const planJson = await planResponse.json()

      if (!qualityResponse.ok || !qualityJson.success) {
        throw new Error(qualityJson.error ?? 'Unable to load global quality')
      }

      setQuality(qualityJson)
      if (planResponse.ok && planJson.success) {
        setPlan(planJson)
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load global quality'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !quality) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Global Data Quality...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
            Global Data Quality
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Cross-Sport Coverage
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Read-only quality audit and dry-run reconciliation planning across shared sport tables.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(quality?.status ?? 'unavailable')}`}>
            {quality?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-lime-500/30 bg-lime-950/30 px-4 py-2 text-sm font-bold text-lime-100 hover:bg-lime-900/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Sports" value={quality?.summary.sportsChecked ?? 0} />
        <Stat label="Issues" value={quality?.summary.issues ?? 0} />
        <Stat label="Events" value={quality?.summary.events ?? 0} />
        <Stat label="Odds" value={quality?.summary.oddsSnapshots ?? 0} />
        <Stat
          label="Provider Calls"
          value={quality?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Sport Coverage</p>
          <div className="mt-4 grid gap-3">
            {quality?.sports.map((sport) => (
              <div
                key={sport.sportKey}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-white">{sport.sportKey}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sport.counts.events} events · {sport.counts.odds} odds · {sport.counts.predictions} predictions
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-right text-xs">
                    <Mini label="Events" value={`${sport.coverage.events.percent}%`} />
                    <Mini label="Odds" value={`${sport.coverage.oddsSnapshots.percent}%`} />
                    <Mini label="Settled" value={`${sport.coverage.settledPredictions.percent}%`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Dry-Run Plan</p>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Estimated Provider Calls
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {plan?.totalEstimatedProviderCalls ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              quota impact {plan?.estimatedQuotaImpact ?? 'none'}
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            {(plan?.warnings ?? []).map((warning) => (
              <p key={warning} className="text-sm text-amber-200">
                {warning}
              </p>
            ))}
          </div>

          <div className="mt-5 grid gap-2">
            {(quality?.issues ?? []).slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <p className="text-sm font-bold text-white">
                  {item.sportKey} · {item.message}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.count} affected · {item.recommendation}
                </p>
              </div>
            ))}
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-black text-white">{value}</p>
    </div>
  )
}
