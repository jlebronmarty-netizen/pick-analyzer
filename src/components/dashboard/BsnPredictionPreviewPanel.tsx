'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type ShadowPrediction = {
  gameId: string
  matchup: string
  startTime: string | null
  status: 'shadow_prediction' | 'insufficient_data'
  homeTeam: string
  awayTeam: string
  homeWinProbability: number | null
  awayWinProbability: number | null
  confidence: number
  dataQuality: number
  predictionQuality: number
  featureQuality: number
  reasoning: string[]
  unavailable: string[]
}

type BsnPredictionPreviewResponse = {
  success: boolean
  generatedAt: string
  status: string
  shadowMode: boolean
  providerCallsMade: number
  remoteMutationsMade: number
  officialPicks: number
  currentBoardActivated: boolean
  coverage: {
    storedGames: number
    upcomingGames: number
    completedGames: number
    predictions: number
    probabilityPredictions: number
    teamProfiles: number
    featureDefinitions: number
    oddsCoverage: number
  }
  quality: {
    averageDataSufficiency: number
    averageFeatureQuality: number
    averageConfidence: number
  }
  predictions: ShadowPrediction[]
  validation: {
    success: boolean
    passed: number
    failed: number
    failedChecks: string[]
  }
  detailedValidation: {
    success: boolean
    passed: number
    failed: number
  } | null
  warnings: string[]
  disabledSurfaces: Record<string, boolean>
  guardrails: Record<string, boolean>
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'green' | 'blue' | 'yellow' | 'red' | 'slate' }) {
  const classes = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    red: 'border-red-500/30 bg-red-500/10 text-red-100',
    slate: 'border-slate-700 bg-slate-900 text-slate-100',
  }[tone]
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${classes}`}>{children}</span>
}

function metric(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined ? 'n/a' : `${value}${suffix}`
}

export default function BsnPredictionPreviewPanel() {
  const [data, setData] = useState<BsnPredictionPreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/bsn/predictions/preview', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load BSN prediction preview.')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load BSN prediction preview.')
      }
    }
    load()
  }, [])

  const disabled = useMemo(() => Object.entries(data?.disabledSurfaces ?? {}).filter(([, value]) => value).map(([key]) => key), [data])

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</div>
  if (!data) return <div className="h-64 animate-pulse rounded-lg bg-slate-900" />

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">BSN Prediction Preview</p>
          <h3 className="mt-2 text-2xl font-black text-white">
            {data.coverage.probabilityPredictions} shadow predictions
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Probability-only preview from stored BSN intelligence. Provider calls: {data.providerCallsMade}. Mutations: {data.remoteMutationsMade}. Official picks: {data.officialPicks}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={data.shadowMode ? 'blue' : 'red'}>{data.shadowMode ? 'Shadow Mode' : 'Live'}</Badge>
          <Badge tone={data.validation.success ? 'green' : 'red'}>{data.validation.success ? 'Validated' : 'Issue'}</Badge>
          <Badge tone={data.currentBoardActivated ? 'red' : 'slate'}>{data.currentBoardActivated ? 'Board Active' : 'Board Off'}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Upcoming</p>
          <p className="mt-2 text-2xl font-black text-white">{data.coverage.upcomingGames}</p>
          <p className="mt-1 text-xs text-slate-400">stored BSN games</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Teams</p>
          <p className="mt-2 text-2xl font-black text-white">{data.coverage.teamProfiles}</p>
          <p className="mt-1 text-xs text-slate-400">intelligence profiles</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Confidence</p>
          <p className="mt-2 text-2xl font-black text-white">{data.quality.averageConfidence}</p>
          <p className="mt-1 text-xs text-slate-400">average shadow confidence</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Odds</p>
          <p className="mt-2 text-2xl font-black text-white">{data.coverage.oddsCoverage}</p>
          <p className="mt-1 text-xs text-slate-400">not used for V1</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {data.predictions.map((prediction) => (
          <div key={prediction.gameId} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{prediction.matchup}</p>
                <p className="mt-1 text-xs text-slate-500">{prediction.startTime ?? 'time unavailable'}</p>
              </div>
              <Badge tone={prediction.status === 'shadow_prediction' ? 'green' : 'yellow'}>{prediction.status.replaceAll('_', ' ')}</Badge>
            </div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-slate-950/70 p-3 text-slate-300">{prediction.homeTeam}: <b className="text-white">{metric(prediction.homeWinProbability, '%')}</b></div>
              <div className="rounded-lg bg-slate-950/70 p-3 text-slate-300">{prediction.awayTeam}: <b className="text-white">{metric(prediction.awayWinProbability, '%')}</b></div>
              <div className="rounded-lg bg-slate-950/70 p-3 text-slate-300">Confidence: <b className="text-white">{prediction.confidence}</b></div>
              <div className="rounded-lg bg-slate-950/70 p-3 text-slate-300">Quality: <b className="text-white">{prediction.predictionQuality}</b></div>
            </div>
            <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-400">
              {prediction.reasoning.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        ))}
        {!data.predictions.length ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-400">
            Shadow engine is ready, but no upcoming BSN games are present in stored schedule tables.
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Disabled Surfaces</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{disabled.join(', ')}</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
          {data.warnings.slice(0, 5).map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </div>
    </section>
  )
}
