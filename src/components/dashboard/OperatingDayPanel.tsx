'use client'

import { useEffect, useState } from 'react'

type OperatingDayStatus = {
  success: boolean
  operatingDayId: string | null
  selectedDate: string
  status: string
  stages: Record<string, string | null>
  games: {
    pendingOrInProgress: number
    final: number
  }
  officialPicks: number
  hypotheticalCandidates: number
  providerCallsUsed: number
  providerQuotaWarning: boolean
  lastSuccessfulAction: string | null
  nextRequiredAction: string | null
  blockingReason: string | null
}

function label(value: string | null | undefined) {
  if (!value) return 'Pending'
  return value.replaceAll('_', ' ')
}

function time(value: string | null) {
  if (!value) return 'Not run'
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function Stage({ name, value }: { name: string; value: string | null }) {
  const done = Boolean(value)
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{name}</p>
      <p className={done ? 'mt-1 text-sm font-black text-emerald-200' : 'mt-1 text-sm font-black text-slate-300'}>
        {time(value)}
      </p>
    </div>
  )
}

export default function OperatingDayPanel() {
  const [data, setData] = useState<OperatingDayStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/operating-day/status?sportKey=baseball_mlb', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load operating-day status')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load operating-day status')
      }
    }

    load()
  }, [])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Operating Day</p>
          <h2 className="mt-2 text-2xl font-black text-white">
            MLB Lifecycle Status
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Official performance and hypothetical candidate results are tracked separately.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Date</p>
            <p className="font-bold text-white">{data?.selectedDate ?? 'Loading'}</p>
          </div>
          <div>
            <p className="text-slate-500">State</p>
            <p className="font-bold capitalize text-white">{label(data?.status)}</p>
          </div>
          <div>
            <p className="text-slate-500">Official</p>
            <p className="font-bold text-emerald-300">{data?.officialPicks ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Hypothetical</p>
            <p className="font-bold text-amber-200">{data?.hypotheticalCandidates ?? 0}</p>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      {data && (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Stage name="Morning Sync" value={data.stages.morningSync} />
            <Stage name="Midday Refresh" value={data.stages.middayRefresh} />
            <Stage name="Final Refresh" value={data.stages.finalRefresh} />
            <Stage name="Lock" value={data.stages.recommendationLock} />
            <Stage name="Result Sync" value={data.stages.resultSync} />
            <Stage name="Settlement" value={data.stages.settlement} />
            <Stage name="Replay" value={data.stages.replay} />
            <Stage name="Calibration" value={data.stages.calibration} />
          </div>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
            <div>
              <p className="text-slate-500">Games Pending/In Progress</p>
              <p className="font-bold text-white">{data.games.pendingOrInProgress}</p>
            </div>
            <div>
              <p className="text-slate-500">Games Final</p>
              <p className="font-bold text-white">{data.games.final}</p>
            </div>
            <div>
              <p className="text-slate-500">Provider Calls Used</p>
              <p className="font-bold text-white">{data.providerCallsUsed}</p>
            </div>
            <div>
              <p className="text-slate-500">Next Action</p>
              <p className="font-bold capitalize text-white">{label(data.nextRequiredAction)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.16em]">
            <span className="rounded-full border border-emerald-500/30 px-3 py-1 text-emerald-200">
              Official Performance: {data.officialPicks} picks
            </span>
            <span className="rounded-full border border-amber-500/30 px-3 py-1 text-amber-200">
              Hypothetical Candidates: {data.hypotheticalCandidates}
            </span>
            {data.providerQuotaWarning && (
              <span className="rounded-full border border-red-500/40 px-3 py-1 text-red-200">
                Provider Quota Warning
              </span>
            )}
          </div>

          {data.blockingReason && (
            <p className="mt-4 text-sm leading-6 text-amber-200">{data.blockingReason}</p>
          )}
        </>
      )}
    </section>
  )
}
