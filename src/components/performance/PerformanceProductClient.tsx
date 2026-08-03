'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { productDateTime, sportReadinessLabel } from '@/components/product/ProductStatus'

type TrustComponent = { key: string; label: string; value?: number | null; normalizedScore: number | null; weight: number; contribution?: number; availability: string; explanation?: string }
type HistoryRow = { id?: string; timestamp: string | null; sport: string; league: string | null; matchup: string | null; prediction: string | null; probability: number | null; confidence: number | null; modelVersion: string | null; category: string; result: string; lifecycleBadge?: string; actualResult?: string | null; correct: boolean | null; probabilityError?: number | null; probabilityErrorLabel?: string; brierContribution?: number | null; brierContributionLabel?: string; push: boolean; pending: boolean; official: boolean; shadow: boolean; featureSnapshot?: Record<string, unknown> | null; missingData?: string[]; settlement?: { settledAt?: string | null; details?: Record<string, unknown> | null }; outcomeExplanation?: string }
type SportSummary = { sportKey: string; label: string; shortLabel: string; productionReady: boolean; metrics: { predictions: number; settled: number; correct: number; incorrect: number; pushes: number; accuracy: number | null; brierScore: number | null; calibrationError: number | null; predictionConfidence: number; coverage: number; shadowAccuracy: number | null; officialAccuracy: number | null; aiLeanAccuracy: number | null; watchlistAccuracy: number | null; avoidAccuracy: number | null }; trust: { trustScore: number | null; trustLabel: string; trustStatus: string; trustConfidence: number; sampleQualification: string; blockers: string[] }; dailyReportCard: { overallGrade: string }; readiness: { readinessScore: number; providerReady: boolean; officialReady: boolean; predictionReady: boolean; calibrationReady: boolean } }
type ApiData = {
  success: boolean
  generatedAt: string
  publicView: { overallAiGrade: string; trustLabel: string; settledSample: number; accuracy: number | null; recentTrend: string; modelStatus: string; lastUpdate: string; disclaimer: string }
  sports: SportSummary[]
  trendAnalysis?: { source: string; storedSnapshotCount: number; daily: Array<{ period: string; trustTrend?: number; accuracyTrend: number; snapshotCount?: number; predictions: number; settled?: number }> }
  evolutionSnapshots?: { existingSnapshots: number; historyTimeline: Array<{ period: string; trustTrend?: number; accuracyTrend: number; snapshotCount?: number; predictions: number }>; trendCalculationsUseStoredSnapshots: boolean }
  performanceTimeline?: Array<{ label: string; generated?: number; totalAnalyzedRows?: number; productionEligible?: number; canonicalPredictionRows?: number; recommendationEligibleRows?: number; actionableRows?: number; officialPickEligibleRows?: number; productionSettled?: number; settledCanonicalRows?: number; productionPending?: number; nonProductionRows?: number; nonProductionAnalysisRows?: number; wins?: number; losses?: number; pushes?: number; record: string; accuracy: number | null; displayAccuracy?: string; predictions: number; zeroSampleMessage?: string | null }>
  performancePresentation?: { contract: string; activeEpoch: string | null; epochId: string | null; epochName: string | null; eraMode?: string; productionScopeVersion?: string; metricDefinitionsVersion?: string; totalAnalyzedRows: number; canonicalPredictionRows: number; nonProductionAnalysisRows: number; recommendationEligibleRows: number; actionableRows: number; officialPickEligibleRows: number; settledCanonicalRows: number; trust: number | null; accuracy: number | null; explanation: string }
  aiBrain: {
    selected: { sport: string | null; modelVersion: string | null; overallHealth: string; sampleSize: number; predictionStatus: string; settlementStatus: string; calibrationStatus: string; dataStatus: string; blockers: string[]; readiness: { score: number; status: string }; trustScore: { trustScore: number | null; trustLabel: string; trustStatus: string; trustConfidence: number; sampleQualification: string; blockers: string[]; warnings: string[]; components: TrustComponent[] } }
    dailyReportCard: { overallGrade: string; dimensions: Record<string, { score: number | null; label: string; explanation: string; sampleSize: number; blockers?: string[]; provisional: boolean }> }
    goals: { goals: Array<{ key: string; label: string; currentValue: number | null; target: number; direction: string; progressPercentage: number; status: string; sampleQualification: string; blocker: string | null }> }
    maturityPipeline: Record<string, { status: string; score: number; evidence: string[]; blockers: string[]; nextAction: string }> | null
    trustChange: Record<string, { previousScore: number | null; currentScore: number | null; absoluteChange: number | null; direction: string; mainPositiveContributors: Array<{ label: string; delta: number }>; mainNegativeContributors: Array<{ label: string; delta: number }>; newBlockers: string[]; resolvedBlockers: string[]; explanation: string }>
    evolution: Record<string, { period: string; status?: string; scopeExplanation?: string; trendDirection: string; sampleCounts: { current: number; previous: number }; trustScore: { currentValue: number | null; absoluteChange: number | null }; accuracy: { currentValue: number | null; absoluteChange: number | null }; brierScore: { currentValue: number | null; absoluteChange: number | null }; calibration: { currentValue: number | null; absoluteChange: number | null }; readiness: { currentValue: number | null; absoluteChange: number | null }; dataQuality: { currentValue: number | null; absoluteChange: number | null }; featureQuality: { currentValue: number | null; absoluteChange: number | null }; confidenceQuality: { currentValue: number | null; absoluteChange: number | null } }>
    engineeringAdvisor: { currentStrengths: string[]; currentWeaknesses: string[]; currentBlockers: string[]; estimatedReadiness: string; nextRecommendedImprovements: string[]; highestImpactTasks: string[] }
    internalView: { brierScore: number | null; logLoss: number | null; calibrationError: number | null; featureDrift: number; confidenceDrift: number; modelDrift: number; dataQuality: number; providerHealth: string; reliabilityBuckets?: Array<{ bucket: string; expected: number; actual: number | null; predictions: number; settled: number }>; trustComponents: TrustComponent[]; blockers: string[]; rawDiagnostics?: { status?: string; historyPagination?: { rowsRead: number; pagesRead: number; capApplied: boolean }; advancedSettlementAudit?: Record<string, unknown> } }
  }
  providerCallsMade: number
  remoteMutationsMade: number
}
type HistoryResponse = { success: boolean; rows: HistoryRow[]; totalRows: number; page: number; limit: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean; categories?: string[]; providerCallsMade: number; remoteMutationsMade: number; cutoffExclusions?: { rows: number; byState: Record<string, number> } }

const DEFAULT_SPORTS = [['all', 'All Sports'], ['baseball_mlb', 'MLB'], ['basketball_bsn', 'BSN'], ['basketball_nba', 'NBA'], ['americanfootball_nfl', 'NFL'], ['soccer', 'Soccer']]

function sportAlias(value: string | null) { const normalized = String(value ?? 'all').toLowerCase(); if (normalized === 'mlb') return 'baseball_mlb'; if (normalized === 'bsn') return 'basketball_bsn'; if (normalized === 'nba') return 'basketball_nba'; if (normalized === 'nfl') return 'americanfootball_nfl'; return normalized || 'all' }
function displayNumber(value: number | null | undefined, suffix = '') { return value === null || value === undefined || !Number.isFinite(Number(value)) ? 'N/A' : `${value}${suffix}` }
function dateTime(value: string | null | undefined) { return productDateTime(value) }
function dateOnly(value: string | null | undefined) { return productDateTime(value) }
function width(value: number | null | undefined) { const parsed = Number(value ?? 0); return `${Math.max(0, Math.min(100, Number.isFinite(parsed) ? parsed : 0))}%` }
function labelize(value: string) {
  const normalized = String(value ?? '').replaceAll('_', ' ').trim().toLowerCase()
  const labels: Record<string, string> = {
    'production scope': 'Production-scope sample',
    'no settled sample': 'No settled sample',
    'qualified sample': 'Qualified sample',
    'small sample': 'Small sample',
    'limited sample': 'Limited sample',
    'insufficient data': 'Insufficient data',
    'brier score above target': 'Brier score above target',
    'value above target': 'Value is above target',
    'insufficient sample': 'Insufficient sample',
    'maximum brier score': 'Maximum Brier Score',
    'needs improvement': 'Needs improvement',
    'approaching target': 'Approaching target',
    'no settled production predictions': 'No settled production predictions',
    'low settled sample': 'Low settled sample',
    'no matching production cohort': 'No matching production cohort',
    'no previous model version': 'No previous model version',
  }
  return labels[normalized] ?? String(value ?? '').replaceAll('_', ' ').replaceAll(/([a-z])([A-Z])/g, '$1 $2').trim()
}
function codeLike(value: string | null | undefined) { return String(value ?? '').replaceAll('_', ' ').trim().toLowerCase() }
function isAvailable(value: string | null | undefined) { return codeLike(value) === 'available' }
function isInsufficientData(value: string | null | undefined) { return codeLike(value) === 'insufficient data' }
function statusTone(value: string | null | undefined): 'green' | 'blue' | 'yellow' | 'red' | 'gray' { const text = String(value ?? '').toLowerCase(); if (/(excellent|strong|complete|achieved|ready|production|correct)/.test(text)) return 'green'; if (/(active|moderate|on track|success|approaching)/.test(text)) return 'blue'; if (/(limited|watch|provisional|shadow|pending|needs improvement)/.test(text)) return 'yellow'; if (/(blocked|incorrect|avoid|error)/.test(text)) return 'red'; return 'gray' }
function toneClass(tone: 'green' | 'blue' | 'yellow' | 'red' | 'gray') { return { green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100', blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100', yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100', red: 'border-red-500/30 bg-red-500/10 text-red-100', gray: 'border-slate-700 bg-slate-900 text-slate-100' }[tone] }
function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'blue' | 'yellow' | 'red' | 'gray' }) { return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${toneClass(tone)}`}>{children}</span> }
function resultLabel(row: HistoryRow) { if (row.lifecycleBadge) return row.lifecycleBadge; if (row.push) return 'Push'; if (row.pending) return 'Awaiting Result'; if (row.correct === true) return 'Settled Win'; if (row.correct === false) return 'Settled Loss'; return labelize(row.result || 'Unknown') }
function resultTone(row: HistoryRow): 'green' | 'blue' | 'yellow' | 'red' | 'gray' { if (row.correct === true) return 'green'; if (row.correct === false) return 'red'; if (row.pending) return 'yellow'; if (row.push) return 'blue'; return 'gray' }
function absoluteProbabilityError(row: HistoryRow) { if (row.probabilityError !== undefined) return row.probabilityError; if (row.correct === null || row.probability === null) return null; return Number((row.correct ? 100 - row.probability : row.probability).toFixed(2)) }
function brierContribution(row: HistoryRow) { if (row.brierContribution !== undefined) return row.brierContribution; if (row.correct === null || row.probability === null) return null; return Number((((row.probability / 100) - (row.correct ? 1 : 0)) ** 2).toFixed(4)) }

export default function PerformanceProductClient() {
  const [sportKey, setSportKey] = useState(() => {
    if (typeof window === 'undefined') return 'all'
    const params = new URLSearchParams(window.location.search)
    return sportAlias(params.get('sport') ?? params.get('sportKey'))
  })
  const [data, setData] = useState<ApiData | null>(null)
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [trustOpen, setTrustOpen] = useState(false)
  const [selectedPrediction, setSelectedPrediction] = useState<HistoryRow | null>(null)
  const [historyStatus, setHistoryStatus] = useState('all')
  const [historyMode, setHistoryMode] = useState('all')
  const [historyCategory, setHistoryCategory] = useState('all')
  const [minConfidence, setMinConfidence] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (sportKey === 'all') params.delete('sport')
    else params.set('sport', sportKey)
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`)
  }, [sportKey])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- filter changes intentionally reset pagination.
  useEffect(() => { setHistoryPage(1) }, [sportKey, historyMode, historyCategory, historyStatus, minConfidence])

  useEffect(() => {
    let active = true
    async function load() {
      setError(null); setData(null)
      try {
        const response = await fetch(`/api/performance${sportKey === 'all' ? '' : `?sportKey=${sportKey}`}`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load performance.')
        if (active) setData(json)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load performance.')
      }
    }
    load()
    return () => { active = false }
  }, [sportKey])

  useEffect(() => {
    let active = true
    async function loadHistory() {
      setHistoryError(null); setHistory(null); setSelectedPrediction(null)
      const params = new URLSearchParams()
      if (sportKey !== 'all') params.set('sportKey', sportKey)
      if (historyMode !== 'all') params.set('mode', historyMode)
      if (historyCategory !== 'all') params.set('category', historyCategory)
      if (historyStatus !== 'all') params.set('status', historyStatus)
      if (minConfidence.trim()) params.set('minConfidence', minConfidence.trim())
      params.set('page', String(historyPage))
      params.set('limit', '25')
      try {
        const response = await fetch(`/api/performance/history?${params.toString()}`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load prediction history.')
        if (active) setHistory(json)
      } catch (loadError) {
        if (active) setHistoryError(loadError instanceof Error ? loadError.message : 'Unable to load prediction history.')
      }
    }
    loadHistory()
    return () => { active = false }
  }, [sportKey, historyMode, historyCategory, historyStatus, minConfidence, historyPage])

  const sportOptions = useMemo(() => { const merged = new Map<string, string>(DEFAULT_SPORTS as Array<[string, string]>); for (const sport of data?.sports ?? []) merged.set(sport.sportKey, sport.shortLabel || sport.label); return Array.from(merged.entries()) }, [data])
  const selectedSport = data && sportKey !== 'all' ? data.sports.find((sport) => sport.sportKey === sportKey) ?? null : null
  const trust = data?.aiBrain.selected.trustScore
  const historyRows = history?.rows ?? []
  const visibleHistory = historyRows
  const categories = history?.categories?.length ? history.categories : Array.from(new Set(historyRows.map((row) => row.category).filter(Boolean)))
  const snapshotCount = data?.evolutionSnapshots?.historyTimeline?.length ?? 0
  const presentation = data?.performancePresentation

  if (error) return <main className="min-h-screen overflow-x-hidden bg-slate-950 p-6 text-red-100"><p className="font-black">Performance is temporarily unavailable.</p><p className="mt-2 text-sm">{error}</p><button className="mt-4 rounded-lg border border-red-400/30 px-4 py-2 text-sm font-bold" onClick={() => window.location.reload()}>Retry</button></main>
  if (!data || !trust) return <main className="min-h-screen overflow-x-hidden bg-slate-950 p-6"><div className="mx-auto max-w-7xl space-y-4"><a href="/dashboard" className="inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">Back to Dashboard</a><div className="h-56 animate-pulse rounded-lg bg-slate-900" /><div className="grid gap-4 md:grid-cols-3"><div className="h-40 animate-pulse rounded-lg bg-slate-900" /><div className="h-40 animate-pulse rounded-lg bg-slate-900" /><div className="h-40 animate-pulse rounded-lg bg-slate-900" /></div></div></main>

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm" aria-label="Primary">
          <TopLink href="/dashboard">Today</TopLink>
          <a className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-bold text-emerald-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" href="/performance" aria-current="page">Performance</a>
          <TopLink href="/mlb-operations">MLB</TopLink>
          <TopLink href="/dashboard#data-operations">BSN</TopLink>
          <TopLink href="/dashboard#advanced-details">Advanced</TopLink>
        </nav>

        <section className="rounded-lg border border-emerald-500/20 bg-slate-900/80 p-5 md:p-6">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">AI Brain</p>
              <h1 className="mt-2 text-4xl font-black text-white md:text-6xl">Performance Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Trust reflects settled canonical prediction evidence. Pipeline readiness confirms the workflow is prepared; it does not mean the model has demonstrated current-era accuracy.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={statusTone(trust.trustLabel)}>{trust.trustLabel}</Badge>
                <Badge tone={statusTone(data.aiBrain.selected.overallHealth)}>Health {data.aiBrain.selected.overallHealth}</Badge>
                {selectedSport?.sportKey === 'basketball_bsn' ? <Badge tone="yellow">PREVIEW / NOT BETTING ENABLED</Badge> : null}
                {selectedSport?.sportKey === 'baseball_mlb' ? <Badge tone="green">Production Stable / Maintenance Mode</Badge> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Grade" value={data.publicView.overallAiGrade} sub="Current report grade" />
              <MetricCard label="Trust" value={displayNumber(trust.trustScore)} sub={`${labelize(trust.trustStatus)} / confidence ${trust.trustConfidence}`} />
              <MetricCard label="Pipeline Readiness" value={displayNumber(data.aiBrain.selected.readiness.score)} sub={`${labelize(data.aiBrain.selected.readiness.status)} / not model accuracy`} />
              <MetricCard label="Settled Sample" value={`${data.aiBrain.selected.sampleSize}`} sub={`Updated ${dateTime(data.publicView.lastUpdate)}`} />
            </div>
          </div>
        </section>

        {presentation ? <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{presentation.activeEpoch ?? 'Current Era'}</p><h2 className="mt-1 text-xl font-black text-white">Current Era Canonical Predictions</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{presentation.explanation}</p></div><Badge tone="blue">{presentation.metricDefinitionsVersion ?? 'presentation metrics'}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5"><Mini label="Canonical Predictions" value={`${presentation.canonicalPredictionRows}`} /><Mini label="Settled" value={`${presentation.settledCanonicalRows}`} /><Mini label="Recommendation Eligible" value={`${presentation.recommendationEligibleRows}`} /><Mini label="Non-production Analysis" value={`${presentation.nonProductionAnalysisRows}`} /><Mini label="Total Analyzed" value={`${presentation.totalAnalyzedRows}`} /></div><p className="mt-3 text-sm text-slate-500">Accuracy: {displayNumber(presentation.accuracy, '%')} / Trust: {displayNumber(presentation.trust)}. Historical evidence remains separate from the Current V2 default.</p></section> : null}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Sport filter">
          {sportOptions.map(([key, label]) => <button key={key} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-black outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${key === sportKey ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`} onClick={() => setSportKey(key)} role="tab" aria-selected={key === sportKey}>{label}</button>)}
        </div>

        <div className="mt-6 grid gap-5">
          <AllSportsSummary sports={data.sports} selected={sportKey} />
          {selectedSport ? <SportSpecific sport={selectedSport} timeline={data.performanceTimeline ?? []} /> : null}
          <div className="grid gap-5 xl:grid-cols-2">
            <EvolutionSection data={data} snapshotCount={snapshotCount} />
            <ReportCardSection dimensions={data.aiBrain.dailyReportCard.dimensions} />
            <TrustSection trust={trust} open={trustOpen} setOpen={setTrustOpen} />
            <TrustChangeSection trustChange={data.aiBrain.trustChange} snapshotCount={snapshotCount} />
            <MaturitySection pipeline={data.aiBrain.maturityPipeline} />
            <GoalsSection goals={data.aiBrain.goals.goals} />
          </div>
          <PredictionHistorySection rows={visibleHistory} totalRows={history?.totalRows ?? 0} page={history?.page ?? historyPage} totalPages={history?.totalPages ?? 1} limit={history?.limit ?? 25} hasPreviousPage={history?.hasPreviousPage ?? historyPage > 1} hasNextPage={history?.hasNextPage ?? false} setPage={setHistoryPage} cutoffExclusions={history?.cutoffExclusions ?? null} loading={!history && !historyError} error={historyError} categories={categories} historyStatus={historyStatus} setHistoryStatus={setHistoryStatus} historyMode={historyMode} setHistoryMode={setHistoryMode} historyCategory={historyCategory} setHistoryCategory={setHistoryCategory} minConfidence={minConfidence} setMinConfidence={setMinConfidence} onSelect={setSelectedPrediction} />
          <TimelineSection timeline={data.performanceTimeline ?? []} trust={trust.trustScore} grade={data.publicView.overallAiGrade} />
          <AdvisorSection advisor={data.aiBrain.engineeringAdvisor} />
          <InternalDetails data={data} advanced={advanced} setAdvanced={setAdvanced} />
        </div>
      </div>
      {selectedPrediction ? <PredictionModal row={selectedPrediction} onClose={() => setSelectedPrediction(null)} /> : null}
    </main>
  )
}

function TopLink({ href, children }: { href: string; children: ReactNode }) { return <a className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 font-bold text-slate-200 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-300" href={href}>{children}</a> }
function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs leading-5 text-slate-400">{sub}</p></div> }
function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-black text-white">{title}</h2>{action}</div><div className="mt-4">{children}</div></section> }
function ProgressRow({ label, value, detail }: { label: string; value: number | null | undefined; detail: string }) { const numeric = Number(value ?? 0); return <div className="text-sm"><div className="flex items-center justify-between gap-3"><span className="font-bold capitalize text-slate-100">{label}</span><span className="text-right text-slate-400">{detail}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-slate-800" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : undefined}><div className="h-full bg-emerald-400" style={{ width: width(value) }} /></div></div> }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div> }

function AllSportsSummary({ sports, selected }: { sports: SportSummary[]; selected: string }) {
  return <Section title="All Sports"><div className="grid gap-3 lg:grid-cols-2">{sports.map((sport) => { const readiness = sportReadinessLabel(sport.sportKey); const modelState = sport.productionReady ? 'Production-ready results are included in the product view.' : 'This sport has not yet reached production-certified prediction readiness.'; return <article key={sport.sportKey} className={`rounded-lg border p-4 ${selected === sport.sportKey ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/60'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-black text-white">{sport.label}</p><p className="mt-1 text-sm text-slate-400">{modelState}</p></div><div className="flex flex-wrap gap-2"><Badge tone={readiness.tone}>{readiness.label}</Badge><Badge tone={statusTone(sport.trust.trustLabel)}>{sport.trust.trustLabel}</Badge></div></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><Mini label="Grade" value={sport.dailyReportCard.overallGrade} /><Mini label="Trust" value={displayNumber(sport.trust.trustScore)} /><Mini label="Accuracy" value={sport.metrics.accuracy === null ? 'N/A' : `${sport.metrics.accuracy}%`} /><Mini label="Settled Sample" value={`${sport.metrics.settled} settled`} /><Mini label="Brier" value={displayNumber(sport.metrics.brierScore)} /><Mini label="Calibration Error" value={displayNumber(sport.metrics.calibrationError)} /><Mini label="Pipeline Readiness" value={displayNumber(sport.readiness.readinessScore)} /><Mini label="Trend" value={labelize(sport.trust.trustStatus)} /></div>{sport.metrics.settled === 0 ? <p className="mt-3 text-sm text-slate-400">No eligible predictions settled in this period. Why: the selected sport or date range has not accumulated production-evaluable results yet.</p> : null}</article> })}</div></Section>
}

function SportSpecific({ sport, timeline }: { sport: SportSummary; timeline: NonNullable<ApiData['performanceTimeline']> }) {
  const categories = [['Official Picks', sport.metrics.officialAccuracy], ['AI Leans', sport.metrics.aiLeanAccuracy], ['Watchlist', sport.metrics.watchlistAccuracy], ['Avoid', sport.metrics.avoidAccuracy], ['Preview Rows', sport.metrics.shadowAccuracy]]
  const readiness = sportReadinessLabel(sport.sportKey)
  return <Section title={`${sport.shortLabel} View`} action={<Badge tone={readiness.tone}>{readiness.label}</Badge>}><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Mini label="Canonical Predictions" value={`${sport.metrics.predictions}`} /><Mini label="Correct" value={`${sport.metrics.correct}`} /><Mini label="Incorrect" value={`${sport.metrics.incorrect}`} /><Mini label="Accuracy" value={sport.metrics.accuracy === null ? 'N/A' : `${sport.metrics.accuracy}%`} /><Mini label="Brier" value={displayNumber(sport.metrics.brierScore)} /><Mini label="Reliability" value={displayNumber(sport.trust.trustConfidence)} /><Mini label="Calibration Error" value={displayNumber(sport.metrics.calibrationError)} /><Mini label="Pipeline Readiness" value={displayNumber(sport.readiness.readinessScore)} /></div><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"><p className="text-sm font-black text-white">Category Performance</p><div className="mt-3 grid gap-2">{categories.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-slate-900/80 px-3 py-2 text-sm"><span className="text-slate-300">{label}</span><span className="font-black text-white">{value === null ? 'N/A' : `${value}%`}</span></div>)}</div>{sport.sportKey === 'basketball_bsn' ? <p className="mt-3 text-sm text-amber-200">No betting recommendations enabled.</p> : null}{sport.sportKey === 'baseball_mlb' ? <p className="mt-3 text-sm text-emerald-200">MLB remains Production Stable / Maintenance Mode.</p> : null}</div></div><div className="mt-4 grid gap-2 md:grid-cols-5">{timeline.slice(0, 5).map((item) => <Mini key={item.label} label={item.label} value={`${item.settledCanonicalRows ?? item.productionSettled ?? 0} settled / ${item.displayAccuracy ?? 'N/A'}`} />)}</div></Section>
}

function EvolutionSection({ data, snapshotCount }: { data: ApiData; snapshotCount: number }) { const rows = Object.values(data.aiBrain.evolution).filter((item) => item && typeof item === 'object' && 'period' in item).slice(0, 6); return <Section title="AI Evolution" action={<Badge tone="blue">Stored daily snapshots</Badge>}>{snapshotCount <= 1 ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">Evolution tracking started today. More daily snapshots are needed to show a trend.</div> : null}<div className="mt-3 grid gap-3">{rows.map((item) => <div key={item.period} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3"><p className="font-black capitalize text-white">{item.period.replaceAll('_', ' ')}</p><Badge tone={statusTone(item.status ?? item.trendDirection)}>{labelize(item.status ?? item.trendDirection)}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4"><Mini label="Trust" value={displayNumber(item.trustScore.currentValue)} /><Mini label="Accuracy" value={displayNumber(item.accuracy.currentValue, '%')} /><Mini label="Brier" value={displayNumber(item.brierScore.currentValue)} /><Mini label="Calibration Error" value={displayNumber(item.calibration.currentValue)} /></div><p className="mt-2 text-xs leading-5 text-slate-500">{item.scopeExplanation ?? `Trend: ${labelize(item.trendDirection)}`}</p></div>)}</div></Section> }
function ReportCardSection({ dimensions }: { dimensions: ApiData['aiBrain']['dailyReportCard']['dimensions'] }) { return <Section title="Daily AI Report Card"><div className="grid gap-3">{Object.entries(dimensions).map(([key, item]) => <div key={key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-black capitalize text-white">{labelize(key)}</p><p className="mt-1 text-sm text-slate-400">{item.explanation}</p></div><Badge tone={statusTone(item.label)}>{item.score === null ? 'Not enough data' : item.label}</Badge></div><p className="mt-2 text-xs text-slate-500">{item.provisional ? 'Provisional' : 'Qualified'} / sample {item.sampleSize}</p></div>)}</div></Section> }
function TrustSection({ trust, open, setOpen }: { trust: ApiData['aiBrain']['selected']['trustScore']; open: boolean; setOpen: (value: boolean) => void }) { const available = trust.components.filter((item) => isAvailable(item.availability)).sort((a, b) => (b.normalizedScore ?? 0) - (a.normalizedScore ?? 0)); return <Section title="Trust Score" action={<Badge tone={statusTone(trust.trustLabel)}>{labelize(trust.trustLabel)}</Badge>}><div className="grid gap-3 md:grid-cols-3"><Mini label="Score" value={displayNumber(trust.trustScore)} /><Mini label="Trust Evidence" value={displayNumber(trust.trustConfidence)} /><Mini label="Sample" value={labelize(trust.sampleQualification)} /></div><div className="mt-4 grid gap-3 md:grid-cols-2"><ListCard title="Main strengths" items={available.slice(0, 3).map((item) => item.key === 'calibration_quality' ? `${item.label}: ${displayNumber(item.normalizedScore)} / 100; Calibration Error: ${displayNumber(item.value)} pts` : `${item.label}: ${displayNumber(item.normalizedScore)}`)} empty="No available trust strengths yet." /><ListCard title="Main blockers" items={trust.blockers.map(labelize)} empty="No current blockers reported." /></div><button className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm font-black outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-300" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'How Trust is calculated'}</button>{open ? <div className="mt-4 grid gap-3">{trust.components.map((item) => <div key={item.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3"><p className="font-black text-white">{item.label}</p><Badge tone={statusTone(item.availability)}>{labelize(item.availability)}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4"><Mini label="Score" value={displayNumber(item.normalizedScore)} /><Mini label="Weight" value={`${item.weight}`} /><Mini label="Contribution" value={displayNumber(item.contribution ?? null)} /><Mini label={item.key === 'calibration_quality' ? 'Calibration Error' : 'Value'} value={item.key === 'calibration_quality' ? `${displayNumber(item.value ?? null)} pts` : displayNumber(item.value ?? null)} /></div><p className="mt-2 text-sm text-slate-400">{item.explanation}</p></div>)}</div> : null}</Section> }
function TrustChangeSection({ trustChange, snapshotCount }: { trustChange: ApiData['aiBrain']['trustChange']; snapshotCount: number }) { const entries = [['Previous day', trustChange.previousDay], ['Previous 7 days', trustChange.previous7DayWindow], ['Previous 30 days', trustChange.previous30DayWindow], ['Previous model version', trustChange.previousModelVersion]].filter((entry): entry is [string, NonNullable<ApiData['aiBrain']['trustChange'][string]>] => Boolean(entry[1])); return <Section title="Why Trust Changed">{snapshotCount <= 1 ? <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">Trust history started today. Daily comparisons will appear as snapshots accumulate.</p> : null}<div className="mt-3 grid gap-3">{entries.map(([label, item]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3"><p className="font-black text-white">{label}</p><Badge tone={statusTone(item.direction)}>{isInsufficientData(item.direction) ? 'Comparison unavailable' : labelize(item.direction)}</Badge></div><p className="mt-2 text-sm text-slate-400">{item.explanation}</p><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><Mini label="Previous" value={displayNumber(item.previousScore)} /><Mini label="Current" value={displayNumber(item.currentScore)} /><Mini label="Change" value={displayNumber(item.absoluteChange)} /></div></div>)}</div></Section> }
function MaturitySection({ pipeline }: { pipeline: ApiData['aiBrain']['maturityPipeline'] }) { return <Section title="Model Maturity">{pipeline ? <div className="grid gap-3">{Object.entries(pipeline).map(([key, stage]) => <div key={key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3"><p className="font-black text-white">{labelize(key)}</p><Badge tone={statusTone(stage.status)}>{labelize(stage.status)}</Badge></div><ProgressRow label="Stage score" value={stage.score} detail={`${stage.score}/100`} /><p className="mt-2 text-sm text-slate-400">{stage.evidence[0] ?? 'Evidence not available.'}</p><p className="mt-1 text-sm text-slate-500">Next: {stage.nextAction}</p></div>)}</div> : <p className="text-sm text-slate-400">No maturity pipeline is available for this scope.</p>}</Section> }
function GoalsSection({ goals }: { goals: ApiData['aiBrain']['goals']['goals'] }) { return <Section title="Goals & Progress"><div className="grid gap-3">{goals.map((goal) => <div key={goal.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3"><p className="font-black text-white">{goal.label}</p><Badge tone={statusTone(goal.status)}>{labelize(goal.status)}</Badge></div><ProgressRow label={goal.label} value={goal.progressPercentage} detail={`${displayNumber(goal.currentValue)} / target ${goal.target}`} /><p className="mt-2 text-xs text-slate-500">{labelize(goal.sampleQualification)}{goal.blocker ? ` / blocker: ${labelize(goal.blocker)}` : ''}</p></div>)}</div></Section> }

function PredictionHistorySection(props: { rows: HistoryRow[]; totalRows: number; page: number; totalPages: number; limit: number; hasPreviousPage: boolean; hasNextPage: boolean; setPage: (value: number) => void; cutoffExclusions: HistoryResponse['cutoffExclusions'] | null; loading: boolean; error: string | null; categories: string[]; historyStatus: string; setHistoryStatus: (value: string) => void; historyMode: string; setHistoryMode: (value: string) => void; historyCategory: string; setHistoryCategory: (value: string) => void; minConfidence: string; setMinConfidence: (value: string) => void; onSelect: (row: HistoryRow) => void }) {
  const exclusions = props.cutoffExclusions
  const exclusionText = exclusions?.rows ? Object.entries(exclusions.byState ?? {}).map(([key, value]) => `${labelize(key)} ${value}`).join(' / ') : 'No cutoff exclusions detected.'
  const start = props.totalRows === 0 ? 0 : (props.page - 1) * props.limit + 1
  const end = Math.min(props.totalRows, (props.page - 1) * props.limit + props.rows.length)
  return <Section title="Canonical Prediction History" action={<Badge tone="blue">{props.totalRows} Current Era predictions</Badge>}><div className="grid gap-3 md:grid-cols-4"><Select label="Mode" value={props.historyMode} onChange={props.setHistoryMode} options={[['all', 'Product'], ['official', 'Official']]} /><Select label="Lifecycle" value={props.historyStatus} onChange={props.setHistoryStatus} options={[['all', 'Win/Loss/Push'], ['win', 'Settled Win'], ['loss', 'Settled Loss'], ['push', 'Push']]} /><Select label="Category" value={props.historyCategory} onChange={props.setHistoryCategory} options={[['all', 'All'], ...props.categories.map((item) => [item, labelize(item)] as [string, string])]} /><label className="text-sm"><span className="font-bold text-slate-300">Min confidence</span><input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" value={props.minConfidence} onChange={(event) => props.setMinConfidence(event.target.value)} inputMode="numeric" placeholder="Any" /></label></div><div className="mt-3 grid gap-2 md:grid-cols-2"><p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">Production-evaluable: {props.totalRows}</p><p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">Excluded from canonical history: {exclusions?.rows ?? 0}. {exclusionText}</p></div><p className="mt-3 text-sm text-slate-400">Default history shows canonical production-evaluable Current Era predictions only. Preview, diagnostic, superseded, post-start, invalid cutoff, Legacy, Historical, Replay and Shadow rows remain diagnostic-only.</p>{props.loading ? <div className="mt-4 h-40 animate-pulse rounded-lg bg-slate-950" /> : null}{props.error ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{props.error}</p> : null}{!props.loading && !props.error ? <div className="mt-4 grid gap-3"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300"><span>Showing {start}-{end} of {props.totalRows} / page {props.page} of {props.totalPages}</span><span className="flex gap-2"><button className="rounded-md border border-slate-700 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40" disabled={!props.hasPreviousPage} onClick={() => props.setPage(Math.max(1, props.page - 1))}>Previous</button><button className="rounded-md border border-slate-700 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40" disabled={!props.hasNextPage} onClick={() => props.setPage(props.page + 1)}>Next</button></span></div>{props.rows.length ? props.rows.map((row, index) => <button key={row.id ?? `${row.timestamp}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left outline-none transition hover:border-slate-600 focus-visible:ring-2 focus-visible:ring-emerald-300" onClick={() => props.onSelect(row)}><div className="grid gap-3 md:grid-cols-[0.7fr_0.7fr_1.2fr_0.8fr_0.6fr_0.6fr_auto] md:items-center"><span className="text-sm text-slate-400">{dateOnly(row.timestamp)}</span><span className="text-sm font-bold text-slate-200">{labelize(row.sport)}</span><span className="font-black text-white">{row.matchup ?? 'Matchup unavailable'}</span><span className="text-sm text-slate-300">{row.prediction ?? 'Prediction unavailable'}</span><span className="text-sm text-slate-300">{displayNumber(row.probability, '%')}</span><span className="text-sm text-slate-300">{displayNumber(row.confidence, '%')}</span><span className="flex flex-wrap gap-2"><Badge tone={resultTone(row)}>{resultLabel(row)}</Badge>{row.shadow ? <Badge tone="yellow">Shadow</Badge> : null}{row.official ? <Badge tone="green">Official</Badge> : null}</span></div></button>) : <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">No settled production predictions match these filters. Why: either this sport has not accumulated eligible settled results or the current filters are too narrow.</p>}</div> : null}</Section>
}

function TimelineSection({ timeline, trust, grade }: { timeline: NonNullable<ApiData['performanceTimeline']>; trust: number | null; grade: string }) { return <Section title="Performance Timeline"><div className="grid gap-3 md:grid-cols-5">{timeline.map((item) => <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="font-black text-white">{item.label}</p><p className="mt-2 text-sm text-slate-400">Total Analyzed {item.totalAnalyzedRows ?? item.generated ?? 0}</p><p className="mt-1 text-sm text-slate-300">Canonical Predictions {item.canonicalPredictionRows ?? item.productionEligible ?? 0}</p><p className="mt-1 text-sm text-slate-300">Recommendation Eligible {item.recommendationEligibleRows ?? 0}</p><p className="mt-1 text-sm text-slate-300">Settled {item.settledCanonicalRows ?? item.productionSettled ?? 0}</p><p className="mt-1 text-sm text-slate-300">Wins {item.wins ?? 0} / Losses {item.losses ?? 0} / Pushes {item.pushes ?? 0}</p><p className="mt-1 text-sm font-black text-white">Accuracy {item.displayAccuracy ?? displayNumber(item.accuracy, '%')}</p>{(item.nonProductionAnalysisRows ?? item.nonProductionRows) ? <p className="mt-2 text-xs leading-5 text-slate-500">Non-production Analysis {item.nonProductionAnalysisRows ?? item.nonProductionRows}</p> : null}{item.zeroSampleMessage ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.zeroSampleMessage}</p> : null}</div>)}</div><p className="mt-3 text-sm text-slate-500">Current trust {displayNumber(trust)} / grade {grade}. Accuracy, Trust and Settled use canonical production predictions only; total analyzed can include preview, diagnostic or superseded evidence.</p></Section> }
function AdvisorSection({ advisor }: { advisor: ApiData['aiBrain']['engineeringAdvisor'] }) { return <Section title="AI Engineering Advisor" action={<Badge tone={statusTone(advisor.estimatedReadiness)}>{labelize(advisor.estimatedReadiness)}</Badge>}><div className="grid gap-4 lg:grid-cols-3"><ListCard title="Strengths" items={advisor.currentStrengths.map(labelize)} empty="No strengths reported yet." /><ListCard title="Weaknesses" items={advisor.currentWeaknesses.map(labelize)} empty="No weaknesses reported yet." /><ListCard title="Highest-impact next actions" items={advisor.highestImpactTasks.map(labelize)} empty="No next actions reported yet." /></div></Section> }
function InternalDetails({ data, advanced, setAdvanced }: { data: ApiData; advanced: boolean; setAdvanced: (value: boolean) => void }) { return <Section title="Internal Diagnostics" action={<button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-black outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-300" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>{advanced ? 'Hide' : 'Show'}</button>}>{advanced ? <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300"><p>Brier Score: {data.aiBrain.internalView.brierScore}</p><p>Log Loss: {data.aiBrain.internalView.logLoss}</p><p>Absolute Calibration Error: {data.aiBrain.internalView.calibrationError}</p><p>Model Drift: {data.aiBrain.internalView.modelDrift}</p><p>Confidence Drift: {data.aiBrain.internalView.confidenceDrift}</p><p>Feature Drift: {data.aiBrain.internalView.featureDrift}</p><p>Provider Health: {data.aiBrain.internalView.providerHealth}</p><p>Snapshot Source: {data.trendAnalysis?.source ?? 'Not available'}</p><p>History Rows Read: {data.aiBrain.internalView.rawDiagnostics?.historyPagination?.rowsRead ?? 'Not available'}</p><p>Provider Calls: {data.providerCallsMade}</p><p>Remote Mutations: {data.remoteMutationsMade}</p></div><div className="space-y-3">{data.aiBrain.internalView.trustComponents.map((component) => <ProgressRow key={component.key} label={component.label} value={component.normalizedScore} detail={`${component.availability} / weight ${component.weight}`} />)}</div></div> : <p className="text-sm text-slate-400">Internal metrics, drift, provider health, raw blockers and snapshot source are collapsed by default.</p>}</Section> }

function PredictionModal({ row, onClose }: { row: HistoryRow; onClose: () => void }) {
  const snapshot = row.featureSnapshot ?? {}
  return <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Prediction details"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Prediction Details</p><h3 className="mt-2 text-2xl font-black text-white">{row.matchup ?? 'Matchup unavailable'}</h3></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-black outline-none hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-300" onClick={onClose}>Close</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><DetailBlock title="Prediction Before the Game" items={[['Predicted outcome', row.prediction ?? 'Unavailable'], ['Probability', displayNumber(row.probability, '%')], ['Confidence', displayNumber(row.confidence, '%')], ['Category', labelize(row.category)], ['Model version', row.modelVersion ?? 'Unavailable']]} /><DetailBlock title="Actual Result" items={[['Result', resultLabel(row)], ['Settlement', row.settlement?.settledAt ? `Settled ${dateTime(row.settlement.settledAt)}` : labelize(row.result)], ['Actual state', row.actualResult ?? 'Unavailable']]} /><DetailBlock title="Why the Model Picked It" items={[['Feature quality', displayNumber(Number(snapshot.featureQualityScore ?? snapshot.feature_quality ?? snapshot.featureQuality ?? Number.NaN))], ['Data sufficiency', displayNumber(Number(snapshot.dataSufficiencyScore ?? snapshot.data_sufficiency ?? snapshot.dataSufficiency ?? Number.NaN))], ['Missing data', row.missingData?.length ? row.missingData.slice(0, 4).join(', ') : 'No stored missing-data details']]} /><DetailBlock title="Evaluation" items={[['Outcome', resultLabel(row)], ['Absolute probability error', absoluteProbabilityError(row) === null ? 'Not available' : `${absoluteProbabilityError(row)} percentage points`], ['Brier contribution', brierContribution(row) === null ? 'Not available' : String(brierContribution(row))], ['Calibration bucket', row.probability === null ? 'Not available' : row.probability >= 70 ? '70+' : row.probability >= 60 ? '60-69' : row.probability >= 50 ? '50-59' : '<50']]} /></div><p className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">{row.outcomeExplanation ?? 'Key differences between the pregame model view and the final result are available only when stored evidence supports them.'}</p></div></div>
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <label className="text-sm"><span className="font-bold text-slate-300">{label}</span><select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label> }
function ListCard({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"><p className="font-black text-white">{title}</p><ul className="mt-3 space-y-2 text-sm text-slate-300">{(items.length ? items : [empty]).slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></div> }
function DetailBlock({ title, items }: { title: string; items: Array<[string, string]> }) { return <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"><p className="font-black text-white">{title}</p><div className="mt-3 space-y-2">{items.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-bold text-slate-100">{value}</span></div>)}</div></div> }
