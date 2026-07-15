'use client'

import { useEffect, useState } from 'react'

type MlbPrediction = {
  id: string
  market: string
  selection: string
  opponent: string
  americanOdds: number
  line: number | null
  modelProbability: number
  impliedProbability: number
  edge: number
  expectedValue: number
  confidence: number
  recommendation: string
  featureQualityScore: number
  dataSufficiencyScore: number
}

type MlbPredictionResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  completionLabels: string[]
  summary: {
    predictionsGenerated: number
    recommended: number
    markets: string[]
    averageFeatureQuality: number
    averageDataSufficiency: number
    noLeakage: boolean
    persisted: boolean
    productionRecommendations: boolean
  }
  compatibility: {
    usesSharedSportPredictionSdk: boolean
    usesFeatureStoreSnapshot: boolean
    usesRawProviderPayloads: boolean
    requiresMigration: boolean
    persistenceEnabled: boolean
    settlementCompatible: boolean
  }
  predictions: MlbPrediction[]
  warnings: string[]
  error?: string
}

type ReplayPrediction = {
  id: string
  eventId: string
  matchup: {
    homeTeam: string
    awayTeam: string
    scheduledStart: string
  }
  market: string
  selectedSide: string
  team: string
  opponent: string
  line: number | null
  offeredAmericanOdds: number
  formattedOdds: string | null
  predictedProbability: number
  impliedProbability: number
  confidence: number
  edge: number
  ev: number
  recommendationStatusAtPredictionTime: string
  currentRecommendationStatus: string
  recommendationLabel: string
  confidenceLabel: string
  reliabilityLabel: string
  valueLabel: string
  qualificationBlockers: string[]
  wouldPassCurrentOfficialPickPolicy: boolean
  riskGrade: string
  dataQualityScore: number | null
  dataSufficiencyScore: number | null
  featureSnapshotId: string
  modelVersion: string
  featureSetVersion: string
  predictionTimestamp: string
  cutoffTimestamp: string
  oddsTimestamp: string
  sportsbook: string
  finalScore: {
    homeScore: number | null
    awayScore: number | null
  }
  settlement: {
    result: string
    technicalUnits: number | null
    profit: number | null
    stake: number | null
  }
  flags: {
    trial: boolean
    scrambled: boolean
    productionEligible: boolean
    quarantined: boolean
  }
  explanation: {
    summary: string
    positiveFactors?: Array<{ label: string; explanation: string }>
    negativeFactors?: Array<{ label: string; explanation: string }>
    factors: Array<{ label: string; detail: string }>
    warnings: string[]
  }
}

type ReplayResponse = {
  success: boolean
  labels: string[]
  providerUsage: {
    externalProviderCallsMade: number
  }
  productionGate: {
    productionEligibleRows: number
    recommendedPicks: number
  }
  summary: {
    predictions: number
    wins: number
    losses: number
    pushes: number
    voids: number
    pending: number
    winRate: number
    technicalUnits: number
    brierScore: number | null
    featureSnapshotsLinked: number
    events: number
    noProductionLeakage: boolean
  }
  byMarket: Array<{
    key: string
    predictions: number
    wins: number
    losses: number
    pushes: number
    voids: number
    winRate: number
  }>
  predictions: ReplayPrediction[]
  warnings: string[]
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'partial' || status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

export default function MlbPredictionEnginePanel() {
  const [data, setData] = useState<MlbPredictionResponse | null>(null)
  const [replay, setReplay] = useState<ReplayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [replayLoading, setReplayLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replayError, setReplayError] = useState<string | null>(null)
  const [marketFilter, setMarketFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [matchupFilter, setMatchupFilter] = useState('')
  const [sortMode, setSortMode] = useState('chronological')
  const [showAllReplayMatchups, setShowAllReplayMatchups] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/mlb/predictions', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load MLB Prediction Engine')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load MLB Prediction Engine'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function loadReplay() {
    try {
      setReplayLoading(true)
      setReplayError(null)

      const response = await fetch(
        '/api/predictions/by-sport?sport=baseball_mlb&historicalValidation=true&validationMode=quarantined&date=2026-07-12',
        { cache: 'no-store' }
      )
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load MLB historical replay')
      }

      setReplay(json)
    } catch (loadError) {
      setReplayError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load MLB historical replay'
      )
    } finally {
      setReplayLoading(false)
    }
  }

  useEffect(() => {
    loadReplay()
  }, [])

  const replayRows = (replay?.predictions ?? [])
    .filter((prediction) => marketFilter === 'all' || prediction.market === marketFilter)
    .filter((prediction) => resultFilter === 'all' || prediction.settlement.result === resultFilter)
    .filter((prediction) => {
      if (confidenceFilter === 'all') return true
      if (confidenceFilter === '70_plus') return Number(prediction.confidence) >= 70
      if (confidenceFilter === '60_69') {
        return Number(prediction.confidence) >= 60 && Number(prediction.confidence) < 70
      }
      return Number(prediction.confidence) < 60
    })
    .filter((prediction) => {
      const query = matchupFilter.trim().toLowerCase()
      if (!query) return true
      return `${prediction.matchup.awayTeam} ${prediction.matchup.homeTeam} ${prediction.team} ${prediction.opponent}`
        .toLowerCase()
        .includes(query)
    })
    .sort((left, right) => {
      if (sortMode === 'confidence') return Number(right.confidence) - Number(left.confidence)
      if (sortMode === 'edge') return Number(right.edge) - Number(left.edge)
      if (sortMode === 'wins_losses') {
        return resultRank(left.settlement.result) - resultRank(right.settlement.result)
      }
      return (
        new Date(left.matchup.scheduledStart).getTime() -
          new Date(right.matchup.scheduledStart).getTime() ||
        left.matchup.homeTeam.localeCompare(right.matchup.homeTeam) ||
        left.market.localeCompare(right.market)
      )
    })

  const replayMatchups = Array.from(
    replayRows
      .reduce((map, prediction) => {
        const key = prediction.eventId
        const existing = map.get(key) ?? []
        existing.push(prediction)
        map.set(key, existing)
        return map
      }, new Map<string, ReplayPrediction[]>())
      .entries()
  ).map(([eventId, predictions]) => ({
    eventId,
    predictions: predictions.sort((left, right) => left.market.localeCompare(right.market)),
    first: predictions[0],
  }))
  const visibleReplayMatchups = showAllReplayMatchups
    ? replayMatchups
    : replayMatchups.slice(0, 5)

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading MLB Prediction Engine...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
            MLB Engine Contract Test
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Prediction Engine V1
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Deterministic moneyline, run line and total previews using the
            Shared Prediction SDK and MLB Feature Store contracts. These are
            fixture validation checks, not real matchup analysis or live betting recommendations.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-lime-500/30 bg-lime-950/30 px-4 py-2 text-sm font-bold text-lime-100 hover:bg-lime-900/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Previews" value={data?.summary.predictionsGenerated ?? 0} />
        <Stat label="Markets" value={data?.summary.markets.length ?? 0} />
        <Stat label="Quality" value={data?.summary.averageFeatureQuality ?? 0} />
        <Stat label="Sufficiency" value={data?.summary.averageDataSufficiency ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-white">Fixture validation passed</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Deterministic fixture teams are hidden from the primary Model Lab flow.
              </p>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">
              Contract details
            </span>
          </div>
        </summary>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {(data?.predictions ?? []).map((prediction) => (
            <div
              key={prediction.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase text-white">
                    {prediction.market}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {prediction.selection} vs {prediction.opponent}
                  </p>
                </div>
                <p className="text-xs font-black uppercase text-amber-300">
                  Fixture validation passed
                </p>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <MiniRow label="Odds" value={formatOdds(prediction.americanOdds)} />
                <MiniRow label="Line" value={prediction.line === null ? '-' : String(prediction.line)} />
                <MiniRow label="Model" value={`${prediction.modelProbability}%`} />
                <MiniRow label="Implied" value={`${prediction.impliedProbability}%`} />
                <MiniRow label="Edge" value={`${prediction.edge}%`} />
                <MiniRow label="EV" value={`${prediction.expectedValue}%`} />
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Compatibility</p>
          <div className="mt-4 grid gap-3">
            <MiniRow
              label="Shared SDK"
              value={data?.compatibility.usesSharedSportPredictionSdk ? 'yes' : 'no'}
            />
            <MiniRow
              label="Feature Snapshot"
              value={data?.compatibility.usesFeatureStoreSnapshot ? 'yes' : 'no'}
            />
            <MiniRow
              label="Raw Provider Payloads"
              value={data?.compatibility.usesRawProviderPayloads ? 'yes' : 'no'}
            />
            <MiniRow
              label="Persists Picks"
              value={data?.compatibility.persistenceEnabled ? 'yes' : 'no'}
            />
            <MiniRow
              label="No Leakage"
              value={data?.summary.noLeakage ? 'true' : 'false'}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Warnings</p>
          <div className="mt-4 grid gap-3">
            {(data?.warnings ?? []).slice(0, 4).map((warning) => (
              <p
                key={warning}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300"
              >
                {warning}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/10 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
              MLB Historical Validation Replay
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              July 12, 2026
            </h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-100">
              REAL NON-SCRAMBLED DATA | QUARANTINED HISTORICAL VALIDATION |
              GAMES ALREADY COMPLETED | NOT A CURRENT WAGERING RECOMMENDATION |
              NOT PRODUCTION PERFORMANCE
            </p>
          </div>
          <button
            type="button"
            onClick={loadReplay}
            className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-900/40"
          >
            Refresh Replay
          </button>
        </div>

        {replayError ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
            {replayError}
          </div>
        ) : null}

        {replayLoading && !replay ? (
          <p className="mt-5 text-sm text-slate-400">Loading historical replay...</p>
        ) : null}

        {replay ? (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
              <Stat label="Predictions" value={replay.summary.predictions} />
              <Stat label="Wins" value={replay.summary.wins} />
              <Stat label="Losses" value={replay.summary.losses} />
              <Stat label="Win Rate" value={`${replay.summary.winRate}%`} />
              <Stat label="Units" value={replay.summary.technicalUnits} />
              <Stat label="Brier" value={replay.summary.brierScore ?? 'n/a'} />
              <Stat label="Prod Leaks" value={replay.productionGate.productionEligibleRows} />
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-5">
              <select
                value={marketFilter}
                onChange={(event) => setMarketFilter(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">All markets</option>
                <option value="moneyline">Moneyline</option>
                <option value="spread">Run line</option>
                <option value="total">Total</option>
              </select>
              <select
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">All results</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="push">Push</option>
                <option value="void">Void</option>
              </select>
              <select
                value={confidenceFilter}
                onChange={(event) => setConfidenceFilter(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">All confidence</option>
                <option value="70_plus">70%+</option>
                <option value="60_69">60-69%</option>
                <option value="under_60">Under 60%</option>
              </select>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="chronological">Chronological</option>
                <option value="confidence">Highest confidence</option>
                <option value="edge">Largest edge</option>
                <option value="wins_losses">Wins/losses</option>
              </select>
              <input
                value={matchupFilter}
                onChange={(event) => setMatchupFilter(event.target.value)}
                placeholder="Filter matchup"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {replay.byMarket.map((market) => (
                <div
                  key={market.key}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                >
                  <p className="text-sm font-black uppercase text-white">
                    {market.key}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {market.predictions} analyzed | {market.wins}-{market.losses}
                    {market.pushes ? `-${market.pushes}` : ''} | {market.winRate}%
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4">
              {visibleReplayMatchups.map((matchup) => (
                <ReplayMatchupCard
                  key={matchup.eventId}
                  matchup={matchup.first}
                  predictions={matchup.predictions}
                />
              ))}
            </div>

            {replayMatchups.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllReplayMatchups((value) => !value)}
                className="mt-5 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-900/30"
              >
                {showAllReplayMatchups ? 'Show first 5 matchups' : `Show all ${replayMatchups.length} matchups`}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}

function resultRank(value: string) {
  if (value === 'win') return 0
  if (value === 'loss') return 1
  if (value === 'push') return 2
  if (value === 'void') return 3
  return 4
}

function formatSigned(value: number | null | undefined, suffix = '') {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'n/a'
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}${suffix}`
}

function resultClass(value: string) {
  if (value === 'win') return 'text-emerald-300'
  if (value === 'loss') return 'text-red-300'
  if (value === 'push') return 'text-blue-300'
  return 'text-slate-300'
}

function ReplayMatchupCard({
  matchup,
  predictions,
}: {
  matchup: ReplayPrediction
  predictions: ReplayPrediction[]
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-black text-white">
            {matchup.matchup.awayTeam} at {matchup.matchup.homeTeam}
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(matchup.matchup.scheduledStart).toLocaleString()}
          </p>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
          {predictions.length} analyzed markets
        </p>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {predictions.map((prediction) => (
          <ReplayCard key={prediction.id} prediction={prediction} compact />
        ))}
      </div>
    </article>
  )
}

function ReplayCard({
  prediction,
  compact = false,
}: {
  prediction: ReplayPrediction
  compact?: boolean
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className={compact ? 'grid gap-4' : 'grid gap-4 xl:grid-cols-[1.1fr_1fr_1.2fr]'}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase text-amber-200">
              {prediction.market}
            </span>
            <span className={`text-xs font-black uppercase ${resultClass(prediction.settlement.result)}`}>
              {prediction.settlement.result}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase text-slate-300">
              {prediction.recommendationLabel}
            </span>
          </div>
          <h4 className="mt-3 text-lg font-black text-white">
            {prediction.selectedSide}
          </h4>
          <p className="mt-1 text-sm text-slate-400">
            {prediction.matchup.awayTeam} at {prediction.matchup.homeTeam}
          </p>
          {!compact ? (
            <p className="mt-1 text-xs text-slate-500">
              {new Date(prediction.matchup.scheduledStart).toLocaleString()}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2 text-sm">
          <MiniRow label="Price" value={prediction.formattedOdds ?? formatOdds(prediction.offeredAmericanOdds)} />
          <MiniRow label="Line" value={prediction.line === null ? '-' : String(prediction.line)} />
          <MiniRow label="Model" value={`${Number(prediction.predictedProbability ?? 0).toFixed(2)}%`} />
          <MiniRow label="Implied" value={`${Number(prediction.impliedProbability ?? 0).toFixed(2)}%`} />
          <MiniRow label="Confidence" value={`${Number(prediction.confidence ?? 0).toFixed(2)}%`} />
          <MiniRow label="Conf. Label" value={prediction.confidenceLabel} />
          <MiniRow label="Reliability" value={prediction.reliabilityLabel} />
          <MiniRow label="Edge" value={formatSigned(prediction.edge, '%')} />
          <MiniRow label="EV" value={formatSigned(prediction.ev, '%')} />
          <MiniRow label="Value" value={prediction.valueLabel} />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            After Game
          </p>
          <p className="mt-2 text-sm font-bold text-white">
            Final: {prediction.matchup.awayTeam} {prediction.finalScore.awayScore ?? '-'} -{' '}
            {prediction.matchup.homeTeam} {prediction.finalScore.homeScore ?? '-'}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Technical result: {prediction.settlement.result} - units{' '}
            {prediction.settlement.technicalUnits ?? 'n/a'}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Current official policy:{' '}
            {prediction.wouldPassCurrentOfficialPickPolicy ? 'passes' : 'blocked'}
          </p>
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <summary className="cursor-pointer text-sm font-black text-white">
          Why the model analyzed this side
        </summary>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {prediction.explanation.summary}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FactorList
            title="Positive factors"
            factors={prediction.explanation.positiveFactors ?? []}
          />
          <FactorList
            title="Negative factors"
            factors={prediction.explanation.negativeFactors ?? []}
          />
        </div>
        {prediction.qualificationBlockers.length ? (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-950/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
              Qualification blockers
            </p>
            <p className="mt-2 text-sm leading-5 text-amber-100">
              {prediction.qualificationBlockers.slice(0, 6).join(', ')}
            </p>
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {prediction.explanation.factors.map((factor) => (
            <div key={factor.label} className="rounded-xl bg-slate-950/70 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                {factor.label}
              </p>
              <p className="mt-2 text-sm leading-5 text-slate-300">{factor.detail}</p>
            </div>
          ))}
        </div>
        <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Advanced lineage
          </summary>
          <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
            <MiniRow label="Snapshot" value={prediction.featureSnapshotId ?? 'n/a'} />
            <MiniRow label="Feature Set" value={prediction.featureSetVersion ?? 'n/a'} />
            <MiniRow label="Model" value={prediction.modelVersion ?? 'n/a'} />
            <MiniRow label="Cutoff" value={prediction.cutoffTimestamp ?? 'n/a'} />
            <MiniRow label="Odds Time" value={prediction.oddsTimestamp ?? 'n/a'} />
            <MiniRow label="Quarantined" value={prediction.flags.quarantined ? 'true' : 'false'} />
          </div>
        </details>
        <div className="mt-3 grid gap-2">
          {prediction.explanation.warnings.slice(0, 4).map((warning) => (
            <p key={warning} className="text-xs leading-5 text-amber-100">
              {warning}
            </p>
          ))}
        </div>
      </details>
    </article>
  )
}

function FactorList({
  title,
  factors,
}: {
  title: string
  factors: Array<{ label: string; explanation: string }>
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {factors.length ? (
        <div className="mt-2 space-y-2">
          {factors.map((factor) => (
            <p key={`${factor.label}-${factor.explanation}`} className="text-sm leading-5 text-slate-300">
              <span className="font-semibold text-white">{factor.label}:</span>{' '}
              {factor.explanation}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None available from snapshot lineage.</p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}
