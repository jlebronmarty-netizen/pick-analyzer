'use client'

import { useEffect, useState } from 'react'

type MaturityResponse = {
  success: boolean
  overallBsnModelMaturityScore: number
  recommendation: string
  providerCallsMade: number
  remoteMutationsMade: number
  backtesting: {
    summary: {
      gamesReplayed: number
      correct: number
      incorrect: number
      accuracy: number
      brierScore: number | null
      confidence: number
      predictionQuality: number
    }
    validationGate1: { passed: boolean }
  }
  calibration: {
    calibrationComplete: boolean
    reliabilityScore: number
    calibrationError: number
    confidenceImprovement: number
    validationGate2: { passed: boolean }
  }
  performanceCenter: {
    validationGate3: { passed: boolean }
    dailyPerformance: Array<{ date: string; games: number; accuracy: number }>
  }
  explanationEngine: {
    explanationQuality: number
    coverage: number
    missingExplanations: number
    validationGate4: { passed: boolean }
  }
  readiness: {
    readinessScore: number
    predictionReady: boolean
    calibrationReady: boolean
    recommendationReady: boolean
    officialPickReady: boolean
    blockingFactors: string[]
    validationGate5: { passed: boolean }
  }
  shadowMarketIntelligence: {
    validationGate6: { passed: boolean }
    predictions: Array<{ gameId: string; matchup: string; probability: number | null; confidence: number; readiness: string }>
  }
  activationAudit: {
    eligibleForFutureBettingActivation: boolean
    recommendation: string
    reasons: string[]
  }
  regression: {
    championUnchanged: boolean
    thresholdsUnchanged: boolean
    predictionLogicUnchanged: boolean
    officialPicksActivated: boolean
    currentBoardActivated: boolean
  }
}

function statusTone(passed: boolean) {
  return passed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
}

function metric(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined ? 'n/a' : `${value}${suffix}`
}

export default function BsnModelMaturityPanel() {
  const [data, setData] = useState<MaturityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/bsn/model-maturity', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load BSN model maturity.')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load BSN model maturity.')
      }
    }
    load()
  }, [])

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</div>
  if (!data) return <div className="h-64 animate-pulse rounded-lg bg-slate-900" />

  const gates = [
    ['Backtesting', data.backtesting.validationGate1.passed],
    ['Calibration', data.calibration.validationGate2.passed],
    ['Performance', data.performanceCenter.validationGate3.passed],
    ['Explanations', data.explanationEngine.validationGate4.passed],
    ['Readiness', data.readiness.validationGate5.passed],
    ['Shadow Market', data.shadowMarketIntelligence.validationGate6.passed],
  ] as const

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">BSN Model Maturity</p>
          <h3 className="mt-2 text-2xl font-black text-white">Score {data.overallBsnModelMaturityScore}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {data.recommendation}. Provider calls: {data.providerCallsMade}. Mutations: {data.remoteMutationsMade}.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${data.activationAudit.eligibleForFutureBettingActivation ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-100'}`}>
          {data.activationAudit.recommendation}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {gates.map(([label, passed]) => (
          <div key={label} className={`rounded-lg border p-3 ${statusTone(passed)}`}>
            <p className="text-xs font-black uppercase tracking-[0.12em]">{label}</p>
            <p className="mt-1 text-sm font-bold">{passed ? 'Passed' : 'Blocked'}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Replay" value={`${data.backtesting.summary.gamesReplayed}`} sub={`${data.backtesting.summary.correct}-${data.backtesting.summary.incorrect}`} />
        <Card label="Accuracy" value={metric(data.backtesting.summary.accuracy, '%')} sub={`Brier ${metric(data.backtesting.summary.brierScore)}`} />
        <Card label="Reliability" value={`${data.calibration.reliabilityScore}`} sub={`Error ${data.calibration.calibrationError}`} />
        <Card label="Readiness" value={`${data.readiness.readinessScore}`} sub={data.readiness.predictionReady ? 'Prediction ready' : 'Prediction blocked'} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-black text-white">Shadow Market Preview</p>
          <div className="mt-3 space-y-2">
            {data.shadowMarketIntelligence.predictions.slice(0, 6).map((prediction) => (
              <div key={prediction.gameId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 px-3 py-2 text-sm">
                <span className="font-bold text-white">{prediction.matchup}</span>
                <span className="text-slate-300">{metric(prediction.probability, '%')} / {prediction.confidence}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-black text-white">Activation Blockers</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
            {data.activationAudit.reasons.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  )
}
