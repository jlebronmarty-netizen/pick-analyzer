'use client'

import { useEffect, useState } from 'react'

type NextSlateStatus = {
  success: boolean
  selectedSlateDate: string | null
  timezone: string
  eventsFound: number
  readyForAnalysis: number
  waitingForOdds: number
  waitingForPredictions: number
  activeCandidates: number
  officialPicks: number
  providerCallsMade: number
  nextRefreshRecommendedAt: string | null
  blockingReason: string | null
  status: string
}

function formatDate(value: string | null) {
  if (!value) return 'No upcoming slate'
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function message(data: NextSlateStatus | null) {
  if (!data) return 'Resolving next MLB slate from stored data.'
  if (!data.selectedSlateDate) return 'No upcoming MLB games found in the stored slate window.'
  if (data.waitingForOdds > 0) return 'Schedule ready. Refresh odds before recommendations.'
  if (data.waitingForPredictions > 0) return 'Upcoming games found. Preparing odds and model analysis.'
  if (data.activeCandidates > 0 && data.officialPicks === 0) return 'No qualifying bets for this slate.'
  return 'Current slate is ready for review.'
}

export default function NextSlateStatusPanel() {
  const [data, setData] = useState<NextSlateStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/slate/next/status?sportKey=baseball_mlb', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load next slate')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load next slate')
      }
    }

    load()
  }, [])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Current Slate</p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {formatDate(data?.selectedSlateDate ?? null)}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{message(data)}</p>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <div>
            <p className="text-slate-500">Games</p>
            <p className="font-bold text-white">{data?.eventsFound ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Ready</p>
            <p className="font-bold text-emerald-300">{data?.readyForAnalysis ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Waiting Odds</p>
            <p className="font-bold text-amber-200">{data?.waitingForOdds ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Candidates</p>
            <p className="font-bold text-white">{data?.activeCandidates ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Next Refresh</p>
            <p className="font-bold text-white">{formatTime(data?.nextRefreshRecommendedAt ?? null)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
