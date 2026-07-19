'use client'

import { useEffect, useMemo, useState } from 'react'

type SportDashboard = {
  sportKey: string
  label: string
  shortLabel: string
  productionReady: boolean
  metrics: {
    predictions: number
    settled: number
    accuracy: number
    roi: number | null
    brierScore: number
    calibrationError: number
    predictionConfidence: number
    coverage: number
    shadowAccuracy: number | null
    officialAccuracy: number | null
  }
  reportCard: {
    overallGrade: string
    predictionHealth: string
    calibration: string
    learning: string
    confidence: string
    dataQuality: string
    readiness: string
  }
  readiness: {
    predictionReady: boolean
    calibrationReady: boolean
    marketReady: boolean
    officialReady: boolean
    learningReady: boolean
    providerReady: boolean
    overallGrade: string
    readinessScore: number
  }
}

type AipecResponse = {
  success: boolean
  generatedAt: string
  performanceCenter: {
    sportsIntegrated: number
    allSports: SportDashboard['metrics']
  }
  sports: SportDashboard[]
  predictionHistory: {
    totalRows: number
    storedRows: number
    shadowRows: number
  }
  reportCards: {
    allSports: {
      todayGrade: string
      overallGrade: string
      predictionHealth: string
      calibration: string
      learning: string
      confidence: string
      dataQuality: string
      readiness: string
      score: number
    }
  }
  performanceTimeline: Array<{ label: string; record: string; accuracy: number; predictions: number }>
  modelEvolution: {
    versions: Array<{ sportKey: string; modelVersion: string; role: string; predictions: number; promotionReadiness: string }>
  }
  dailyUpdate: {
    automaticAfterSettlement: boolean
    updateMode: string
    durableWritesMade: number
  }
  providerCallsMade: number
  remoteMutationsMade: number
  regression: Record<string, boolean>
  readiness: {
    overallAiPerformanceCenterReadiness: string
    score: number
    status: string
  }
}

function metric(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined ? 'n/a' : `${value}${suffix}`
}

function badgeClass(ok: boolean) {
  return ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-100'
}

export default function AiPerformanceCenterPanel() {
  const [data, setData] = useState<AipecResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/ai-performance-center', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load AI Performance Center.')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load AI Performance Center.')
      }
    }
    load()
  }, [])

  const regressionsOk = useMemo(() => {
    if (!data) return false
    return Object.values(data.regression).every((value) => value === false)
  }, [data])

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</div>
  if (!data) return <div className="h-64 animate-pulse rounded-lg bg-slate-900" />

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">AI Performance Center</p>
          <h3 className="mt-2 text-2xl font-black text-white">Grade {data.reportCards.allSports.overallGrade}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {data.performanceCenter.sportsIntegrated} sports integrated. History rows: {data.predictionHistory.totalRows}. Provider calls: {data.providerCallsMade}. Mutations: {data.remoteMutationsMade}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(data.dailyUpdate.automaticAfterSettlement)}`}>Daily Update</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(regressionsOk)}`}>No Mutations</span>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-100">{data.readiness.overallAiPerformanceCenterReadiness}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card label="Predictions" value={`${data.performanceCenter.allSports.predictions}`} sub={`${data.predictionHistory.storedRows} stored, ${data.predictionHistory.shadowRows} shadow`} />
        <Card label="Accuracy" value={metric(data.performanceCenter.allSports.accuracy, '%')} sub={`Brier ${metric(data.performanceCenter.allSports.brierScore)}`} />
        <Card label="Confidence" value={metric(data.performanceCenter.allSports.predictionConfidence)} sub={`Error ${metric(data.performanceCenter.allSports.calibrationError)}`} />
        <Card label="Coverage" value={metric(data.performanceCenter.allSports.coverage, '%')} sub={data.reportCards.allSports.dataQuality} />
        <Card label="Readiness" value={`${data.readiness.score}`} sub={data.reportCards.allSports.readiness} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-black text-white">Sports</p>
          <div className="mt-3 space-y-2">
            {data.sports.map((sport) => (
              <div key={sport.sportKey} className="grid gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-sm md:grid-cols-[1fr_auto_auto]">
                <span className="font-bold text-white">{sport.shortLabel}</span>
                <span className="text-slate-300">{sport.reportCard.overallGrade}</span>
                <span className="text-slate-400">{sport.metrics.predictions} predictions</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm font-black text-white">Timeline</p>
          <div className="mt-3 space-y-2">
            {data.performanceTimeline.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 px-3 py-2 text-sm">
                <span className="font-bold text-white">{item.label}</span>
                <span className="text-slate-300">{item.record} / {metric(item.accuracy, '%')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-sm font-black text-white">Model Evolution</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {data.modelEvolution.versions.slice(0, 9).map((version) => (
            <div key={`${version.sportKey}:${version.modelVersion}:${version.role}`} className="rounded-lg bg-slate-950/70 p-3 text-sm">
              <p className="font-bold text-white">{version.sportKey}</p>
              <p className="mt-1 text-slate-400">{version.modelVersion} / {version.role}</p>
              <p className="mt-1 text-slate-300">{version.predictions} predictions / {version.promotionReadiness}</p>
            </div>
          ))}
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
