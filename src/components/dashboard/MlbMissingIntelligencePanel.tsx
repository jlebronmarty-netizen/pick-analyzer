'use client'

import { useEffect, useState } from 'react'

type Health = {
  success: boolean
  coverage: {
    playerMetadata: {
      rows: number
      identityCoveragePct: number
      teamMappingCoveragePct: number
      activeRosterCoveragePct: number
    }
    rosterAvailability: {
      status: string
      playerStatusCoveragePct: number
      injuredListStatusRows: number
      inactivePlayers: number
      unknownStatusCount: number
      staleStatusCount: number
    }
    handedness: {
      battingHandCoveragePct: number
      throwingHandCoveragePct: number
    }
    lineups: {
      status: string
      rows: number
      confirmedRows: number
    }
    injuries: {
      status: string
      rows: number
      detailedInjuryFeed: string
    }
    pitcherGameStats: {
      rows: number
      reliefAppearanceRows: number
    }
    bullpen: {
      readiness: string
      signals?: {
        fatigueSignal?: string
      }
    }
  }
  operationsMonitor: {
    stages: Array<{ stage: string; status: string }>
    providerCallsToday: number
    budgetRemaining: number
    cacheHits: number
    nextAction: string
  }
  replayCalibrationLearning: {
    historicalPilot: string
    replay: string
    calibration: string
    settlement: string
    learning: string
  }
  providerCallsMade: number
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('complete') || normalized.includes('ready')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (normalized.includes('block')) return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  if (normalized.includes('degraded') || normalized.includes('waiting')) return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  return 'border-slate-700 bg-slate-900 text-slate-200'
}

function label(value: string) {
  return value.replace(/_/g, ' ')
}

export default function MlbMissingIntelligencePanel() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/mlb/missing-intelligence/health?includeValidation=true', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        if (!payload.success) {
          setError(payload.error?.message ?? 'Unable to load MLB missing intelligence health.')
          return
        }
        setHealth(payload.data ?? payload)
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load MLB missing intelligence health.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-100">
        {error}
      </div>
    )
  }

  if (!health) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
        Loading MLB missing intelligence health...
      </div>
    )
  }

  const cards = [
    ['Players', `${health.coverage.playerMetadata.rows} cached`, `${health.coverage.playerMetadata.identityCoveragePct}% identity`],
    ['Status', label(health.coverage.rosterAvailability.status), `${health.coverage.rosterAvailability.playerStatusCoveragePct}% covered`],
    ['Injured List', `${health.coverage.rosterAvailability.injuredListStatusRows} players`, 'from Player.Status'],
    ['Bats', `${health.coverage.handedness.battingHandCoveragePct}%`, 'unknown stays unknown'],
    ['Throws', `${health.coverage.handedness.throwingHandCoveragePct}%`, 'starter hand context'],
    ['Lineups', label(health.coverage.lineups.status), `${health.coverage.lineups.confirmedRows} confirmed rows`],
    ['Injury Feed', label(health.coverage.injuries.detailedInjuryFeed), 'diagnosis unavailable'],
    ['Bullpen', label(health.coverage.bullpen.readiness), label(health.coverage.bullpen.signals?.fatigueSignal ?? 'no fatigue signal')],
  ]

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">MLB Operations Monitor</p>
        <h3 className="mt-1 text-xl font-black text-white">Missing Intelligence</h3>
        <p className="mt-1 text-sm text-slate-400">
          Read-only coverage for lineups, injuries, handedness, bullpen, replay, calibration and learning.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {cards.map(([title, value, detail]) => (
          <div key={title} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
            <p className="mt-2 text-lg font-black text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        {health.operationsMonitor.stages.map((stage) => (
          <div key={stage.stage} className={`rounded-lg border px-3 py-2 text-xs font-bold ${statusClass(stage.status)}`}>
            <p>{label(stage.stage)}</p>
            <p className="mt-1 opacity-80">{stage.status}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-slate-500">Provider calls today</p>
          <p className="mt-1 font-bold text-white">{health.operationsMonitor.providerCallsToday}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-slate-500">Budget remaining</p>
          <p className="mt-1 font-bold text-white">{health.operationsMonitor.budgetRemaining}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-slate-500">Cache-ready domains</p>
          <p className="mt-1 font-bold text-white">{health.operationsMonitor.cacheHits}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-slate-500">Learning</p>
          <p className="mt-1 font-bold text-white">{label(health.replayCalibrationLearning.learning)}</p>
        </div>
      </div>

      <p className="text-sm text-slate-300">Next safe action: {health.operationsMonitor.nextAction}</p>
    </div>
  )
}
