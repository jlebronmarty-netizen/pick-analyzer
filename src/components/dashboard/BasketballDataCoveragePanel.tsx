'use client'

import { useEffect, useState } from 'react'

type CoverageRow = {
  dataset: string
  records: number
  target: number | null
  status: string
  coveragePct: number
}

type CoverageResponse = {
  success: boolean
  generatedAt: string
  providerCallsMade: number
  remoteMutationsMade: number
  coverage: CoverageRow[]
  summary: {
    completionPct: number
    supportedRecords: number
    teams: number
    standings: number
    games: number
    players: number
    statistics: number
  }
  warnings: string[]
}

function tone(status: string) {
  if (status === 'complete') return 'bg-emerald-400 text-emerald-100 border-emerald-500/30'
  if (status === 'partial') return 'bg-sky-300 text-sky-100 border-sky-500/30'
  if (status === 'empty') return 'bg-amber-300 text-amber-100 border-amber-500/30'
  return 'bg-slate-500 text-slate-200 border-slate-700'
}

function statusLabel(status: string) {
  if (status === 'complete') return 'Complete'
  if (status === 'partial') return 'Partial'
  if (status === 'empty') return 'Empty'
  return 'Not Available'
}

export default function BasketballDataCoveragePanel() {
  const [data, setData] = useState<CoverageResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/basketball/bsn/data-coverage', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load BSN coverage.')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load BSN coverage.')
      }
    }
    load()
  }, [])

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</div>
  if (!data) return <div className="h-48 animate-pulse rounded-lg bg-slate-900" />

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">BSN Data Coverage</p>
          <h3 className="mt-2 text-2xl font-black text-white">{data.summary.completionPct}% Complete</h3>
          <p className="mt-2 text-sm text-slate-400">{data.summary.supportedRecords} normalized records stored. Provider calls: {data.providerCallsMade}. Mutations: {data.remoteMutationsMade}.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {data.coverage.map((row) => (
          <div key={row.dataset} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{row.dataset}</p>
                <p className="mt-1 text-xs text-slate-400">{row.records} records{row.target ? ` / ${row.target}` : ''}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tone(row.status).replace('bg-', 'bg-').replace(' text-', '/10 text-')}`}>{statusLabel(row.status)}</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label={`${row.dataset} coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.coveragePct}>
              <div className={`h-full rounded-full ${tone(row.status).split(' ')[0]}`} style={{ width: `${Math.min(100, row.coveragePct)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Limitations</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
          {data.warnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </div>
    </section>
  )
}