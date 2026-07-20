'use client'

import { useEffect, useState } from 'react'

type PerformancePreview = {
  success: boolean
  publicView: {
    overallAiGrade: string
    trustLabel: string
    recentTrend: string
  }
  aiBrain: {
    selected: {
      trustScore: {
        trustScore: number | null
      }
    }
  }
  sports: Array<{ sportKey: string }>
}

function value(value: number | null | undefined) {
  return value === null || value === undefined ? 'n/a' : String(value)
}

export default function AiPerformancePreviewCard() {
  const [data, setData] = useState<PerformancePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/performance', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Performance unavailable.')
        if (active) setData(json)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Performance unavailable.')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (error) return null
  if (!data) return <div className="h-32 animate-pulse rounded-lg bg-slate-900" />

  return (
    <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">AI Performance</p>
          <h3 className="mt-2 text-2xl font-black text-white">Grade {data.publicView.overallAiGrade}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Trust {value(data.aiBrain.selected.trustScore.trustScore)} / {data.publicView.trustLabel}. {data.sports.length} sports tracked. Trend: {data.publicView.recentTrend}.
          </p>
        </div>
        <a
          href="/performance"
          className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-white"
        >
          View AI Performance
        </a>
      </div>
    </section>
  )
}
