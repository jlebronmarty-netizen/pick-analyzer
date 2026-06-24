'use client'

import { useEffect, useState } from 'react'

type ParlayPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  odds: number
  confidence: number
  ev: number
  risk_grade?: string
  risk_label?: string
  smart_score?: number
}

type Parlay = {
  name: string
  style: string
  legs: ParlayPick[]
  decimalOdds: number
  americanOdds: number
  estimatedProbability: number
  averageConfidence: number
  averageEv: number
  correlationScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  warnings: string[]
}

type ParlaysResponse = {
  success: boolean
  count: number
  parlays: Parlay[]
  error?: string
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function ParlayCard({ parlay }: { parlay: Parlay }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{parlay.name}</h3>
          <p className="text-xs text-slate-400">
            {parlay.legs.length} legs · {parlay.style}
          </p>
        </div>

        <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-300">
          {formatOdds(parlay.americanOdds)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Est. Probability</p>
          <p className="font-bold text-white">
            {formatPercent(parlay.estimatedProbability)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Avg Confidence</p>
          <p className="font-bold text-white">
            {formatPercent(parlay.averageConfidence)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Avg EV</p>
          <p className="font-bold text-emerald-400">
            {formatPercent(parlay.averageEv)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Correlation</p>
          <p className="font-bold text-white">
            {parlay.riskLevel} · {parlay.correlationScore}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {parlay.legs.map((leg) => (
          <div
            key={`${parlay.name}-${leg.id}`}
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {leg.team} ML
                </p>
                <p className="text-xs text-slate-400">vs {leg.opponent}</p>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold text-white">
                  {formatOdds(leg.odds)}
                </p>
                <p className="text-xs text-slate-500">{leg.sport_key}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {parlay.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-300">Warnings</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100">
            {parlay.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function SmartParlaysPanel() {
  const [data, setData] = useState<ParlaysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/parlays', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load smart parlays')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading smart parlays...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Smart Parlays</h2>
        <p className="text-sm text-slate-400">
          Safe, value and lottery parlays generated from Smart Score and correlation filters.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {data.parlays.map((parlay) => (
          <ParlayCard key={parlay.name} parlay={parlay} />
        ))}
      </div>
    </div>
  )
}