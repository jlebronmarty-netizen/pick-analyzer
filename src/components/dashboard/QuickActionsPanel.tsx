'use client'

import { useState } from 'react'
import { useDashboard } from '@/context/DashboardContext'

type ActionResult = {
  label: string
  success: boolean
  message: string
}

const actions = [
  {
    label: 'Capture Picks',
    description: 'Save current model predictions.',
    endpoint: '/api/cron/capture-predictions',
    method: 'GET',
  },
  {
    label: 'Settle Picks',
    description: 'Grade completed predictions.',
    endpoint: '/api/predictions/settle',
    method: 'GET',
  },
  {
    label: 'Update CLV',
    description: 'Refresh closing line value.',
    endpoint: '/api/clv/update',
    method: 'GET',
  },
  {
    label: 'Run Learning',
    description: 'Update model weights.',
    endpoint: '/api/model/learning?sport=baseball_mlb',
    method: 'GET',
  },
  {
    label: 'Sync Results',
    description: 'Pull completed game scores.',
    endpoint: '/api/results/sync',
    method: 'GET',
  },
  {
    label: 'Team Stats',
    description: 'Recalculate team stats.',
    endpoint: '/api/team-stats/recalculate',
    method: 'GET',
  },
]

async function clearDashboardCache() {
  await fetch('/api/dashboard/cache/clear', {
    method: 'POST',
    cache: 'no-store',
  })
}

export default function QuickActionsPanel() {
  const { refresh } = useDashboard()
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)

  async function runAction(action: (typeof actions)[number]) {
    try {
      setRunning(action.label)
      setResult(null)

      const response = await fetch(action.endpoint, {
        method: action.method,
        cache: 'no-store',
      })

      const json = await response.json().catch(() => null)

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error ?? json?.message ?? 'Action failed')
      }

      await clearDashboardCache()
      await refresh()

      setResult({
        label: action.label,
        success: true,
        message:
          json?.message ??
          `${action.label} completed successfully. Dashboard cache cleared.`,
      })
    } catch (error) {
      setResult({
        label: action.label,
        success: false,
        message:
          error instanceof Error ? error.message : 'Unexpected action error',
      })
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Operations
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Quick Actions
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Run core sync, settlement, CLV and learning jobs from one command panel.
          </p>
        </div>

        {running && (
          <span className="rounded-full border border-blue-500/30 bg-blue-950/30 px-3 py-1 text-xs font-semibold text-blue-300">
            Running {running}...
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {actions.map((action) => (
          <button
            key={action.label}
            disabled={running !== null}
            onClick={() => runAction(action)}
            className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-950/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <p className="text-sm font-bold text-white">{action.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {action.description}
            </p>
          </button>
        ))}
      </div>

      {result && (
        <div
          className={
            result.success
              ? 'mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-200'
              : 'mt-5 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200'
          }
        >
          <p className="font-semibold">
            {result.success ? 'Action completed' : 'Action failed'} · {result.label}
          </p>
          <p className="mt-1 text-xs opacity-90">{result.message}</p>
        </div>
      )}
    </div>
  )
}