'use client'

import { useEffect, useState, type ReactNode } from 'react'

type Severity = 'info' | 'warning' | 'error' | 'critical'

type CoverageMetric = {
  key: string
  label: string
  total: number
  expected: number
  percent: number
  status: string
}

type DateRange = {
  start: string
  end: string
  days: number
}

type DataQualityIssue = {
  id: string
  severity: Severity
  category: string
  entity: string
  message: string
  count: number
  recommendation: string
}

type ReconciliationPlan = {
  dryRun: boolean
  externalProviderCallsMade: number
  missingDateRanges: {
    events: DateRange[]
    results: DateRange[]
    odds: DateRange[]
  }
  estimatedProviderCalls: {
    teams: number
    events: number
    scores: number
    odds: number
    standings: number
    stats: number
  }
  totalEstimatedProviderCalls: number
  estimatedQuotaImpact: string
  recommendedBatchSize: number
  recommendedExecutionOrder: string[]
  safeIncrementalReconciliationPlan: string[]
  quotaWarning: string
}

type DataQualityResponse = {
  success: boolean
  status: string
  issueSummary: {
    total: number
    bySeverity: Record<Severity, number>
    byCategory: {
      category: string
      count: number
    }[]
  }
  coverage: CoverageMetric[]
  historicalGaps: {
    eventGaps: DateRange[]
    resultGaps: DateRange[]
    oddsGaps: DateRange[]
  }
  issues: DataQualityIssue[]
  reconciliationPlan: ReconciliationPlan
}

function statusClass(status: string) {
  if (status === 'healthy') return 'text-emerald-300'
  if (status === 'warning') return 'text-amber-300'
  return 'text-red-300'
}

function severityClass(severity: Severity) {
  if (severity === 'critical') return 'text-red-300'
  if (severity === 'error') return 'text-orange-300'
  if (severity === 'warning') return 'text-amber-300'
  return 'text-slate-300'
}

function pct(value: number) {
  return `${Number(value ?? 0).toFixed(1)}%`
}

function formatRanges(ranges: DateRange[]) {
  if (!ranges.length) return 'None'
  return ranges
    .slice(0, 2)
    .map((range) =>
      range.start === range.end
        ? `${range.start}`
        : `${range.start} to ${range.end}`
    )
    .join(', ')
}

export default function NbaDataQualityPanel() {
  const [data, setData] = useState<DataQualityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/nba/data-quality', { cache: 'no-store' })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load NBA data quality')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'NBA data quality load failed'
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
        Loading NBA Data Quality Audit...
      </section>
    )
  }

  const severity = data?.issueSummary.bySeverity
  const plan = data?.reconciliationPlan

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            NBA Data Quality Phase A
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Stored Data Audit
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Audits local Supabase data and prepares a dry-run reconciliation plan without provider calls.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'warning')}`}>
            {data?.status ?? 'loading'}
          </p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Audit'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Issues" value={`${data?.issueSummary.total ?? 0}`} />
        <Stat label="Critical" value={`${severity?.critical ?? 0}`} />
        <Stat label="Errors" value={`${severity?.error ?? 0}`} />
        <Stat label="Warnings" value={`${severity?.warning ?? 0}`} />
        <Stat label="Est. Calls" value={`${plan?.totalEstimatedProviderCalls ?? 0}`} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel title="Coverage">
          <div className="space-y-3">
            {(data?.coverage ?? []).slice(0, 8).map((item) => (
              <div key={item.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-bold text-white">
                    {item.total}/{item.expected} ({pct(item.percent)})
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-sky-400"
                    style={{ width: `${Math.min(item.percent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Historical Gaps">
          <div className="space-y-3 text-sm">
            <Gap label="Events" ranges={data?.historicalGaps.eventGaps ?? []} />
            <Gap label="Results" ranges={data?.historicalGaps.resultGaps ?? []} />
            <Gap label="Odds" ranges={data?.historicalGaps.oddsGaps ?? []} />
          </div>
        </Panel>

        <Panel title="Dry-Run Plan">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Mini label="Dry Run" value={plan?.dryRun ? 'true' : 'false'} />
            <Mini label="Calls Made" value={`${plan?.externalProviderCallsMade ?? 0}`} />
            <Mini label="Quota" value={plan?.estimatedQuotaImpact ?? 'none'} />
            <Mini label="Batch" value={`${plan?.recommendedBatchSize ?? 0}`} />
          </div>
          <p className="mt-3 text-xs text-amber-300">
            {plan?.quotaWarning ?? 'Phase A does not execute reconciliation.'}
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="Top Issues">
          <div className="space-y-3">
            {(data?.issues ?? []).slice(0, 8).map((item) => (
              <div key={item.id} className="border-t border-slate-800 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-white">{item.message}</span>
                  <span className={`text-xs font-black uppercase ${severityClass(item.severity)}`}>
                    {item.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {item.category} / {item.entity} / {item.count}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Execution Order">
          <div className="space-y-2">
            {(plan?.recommendedExecutionOrder ?? []).map((step, index) => (
              <div key={step} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 text-xs text-slate-400">
                  {index + 1}
                </span>
                <span className="text-slate-300">{step.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  )
}

function Gap({ label, ranges }: { label: string; ranges: DateRange[] }) {
  return (
    <div>
      <p className="font-bold text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-400">
        {formatRanges(ranges)}
        {ranges.length > 2 ? `, +${ranges.length - 2} more` : ''}
      </p>
    </div>
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
