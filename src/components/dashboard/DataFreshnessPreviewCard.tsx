'use client'

import { useEffect, useMemo, useState } from 'react'

type Freshness = {
  domain: string
  label: string
  status: string
  userMessage: string
  ageMinutes: number | null
}

type FreshnessResponse = {
  success: boolean
  activeSlateDate: string | null
  freshness: Freshness[]
  blockers: string[]
}

function tone(status: string) {
  const value = status.toLowerCase()
  if (value === 'fresh') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (value === 'aging' || value === 'pending') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (value === 'stale' || value === 'failed') return 'border-red-500/30 bg-red-500/10 text-red-100'
  return 'border-slate-700 bg-slate-900/80 text-slate-100'
}

export default function DataFreshnessPreviewCard() {
  const [data, setData] = useState<FreshnessResponse | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/operations/data-freshness', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (alive && json) setData(json)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const items = useMemo(() => {
    const freshness = data?.freshness ?? []
    return ['odds', 'prediction', 'recommendation', 'lineups']
      .map((domain) => freshness.find((item) => item.domain === domain))
      .filter(Boolean) as Freshness[]
  }, [data])

  if (!data || !items.length) return null

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Data Freshness</p>
          <h3 className="mt-1 text-xl font-black text-white">Today&apos;s Inputs</h3>
        </div>
        <a href="#advanced-details" className="text-sm font-black text-sky-300">Advanced Status</a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.domain} className={`rounded-lg border p-4 ${tone(item.status)}`}>
            <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">{item.label}</p>
            <p className="mt-2 text-sm font-black">{item.status.replaceAll('_', ' ')}</p>
            <p className="mt-2 text-xs leading-5 opacity-80">{item.ageMinutes === null ? item.userMessage : `${item.ageMinutes} minutes old`}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
