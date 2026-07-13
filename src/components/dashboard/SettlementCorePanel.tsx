'use client'

import { useEffect, useState } from 'react'

type SettlementResponse = {
  success: boolean
  providerUsage: {
    externalProviderCallsMade: number
  }
  primitives: Record<string, boolean>
  summary: {
    checked: number
    wins: number
    losses: number
    pushes: number
    voids: number
    pending: number
  }
  decisions: {
    outcome: string
    reason: string
    market: string
    selection: string
  }[]
  integrationStatus: string
}

export default function SettlementCorePanel() {
  const [data, setData] = useState<SettlementResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/settlement/core', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message ?? json.error ?? 'Unable to load settlement core'
        )
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load settlement core'
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
        Loading Settlement Core...
      </section>
    )
  }

  const primitiveCount = data
    ? Object.values(data.primitives).filter(Boolean).length
    : 0

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Settlement Core V2
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Market Grading Primitives
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Shared moneyline, spread, total, push, void and pending settlement contracts.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-900/40"
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
        <Stat label="Primitives" value={primitiveCount} />
        <Stat label="Samples" value={data?.summary.checked ?? 0} />
        <Stat label="Wins" value={data?.summary.wins ?? 0} />
        <Stat label="Pushes" value={data?.summary.pushes ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      <div className="mt-6 grid gap-3">
        {(data?.decisions ?? []).map((decision, index) => (
          <div
            key={`${decision.market}-${decision.selection}-${index}`}
            className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-black text-white">
                  {decision.market} · {decision.selection}
                </p>
                <p className="mt-1 text-xs text-slate-500">{decision.reason}</p>
              </div>
              <p className="text-sm font-black uppercase text-emerald-300">
                {decision.outcome}
              </p>
            </div>
          </div>
        ))}
        <p className="text-sm text-slate-500">{data?.integrationStatus}</p>
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
