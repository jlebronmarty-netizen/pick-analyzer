'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type DetailProps = {
  eventId: string
}

type ApiData = {
  generatedAt?: string
  providerCallsMade?: number
  remoteMutationsMade?: number
  event: { eventId?: string; homeTeam: string | null; awayTeam: string | null; startTime: string | null; status: string | null; venue: string | null; dataFreshness?: { state: string; ageMinutes: number | null } }
  model?: { homeWinProbability: number | null; awayWinProbability: number | null; confidence: number | null; featureQuality: number | null; dataSufficiency: number | null; generatedAt: string | null; predictionCutoff: string | null; eligibility: string | null } | null
  market?: MarketRow[]
  missingData?: Array<{ input: string; status: string; reason: string }>
  summary?: { state: string; label: string; reason: string; topMarket: string | null }
  gameExperience: {
    tabs: string[]
    overview: { matchup: string; startTime?: string | null; status?: string | null; venue?: string | null; playerIntelligenceAvailable: boolean; bettingActivation: boolean }
    teamProjections: TeamProjections
    startingPitchers: Record<string, StarterRow> | null
    pitcherMatchup?: Record<string, unknown>
    expectedLineups: Record<string, Array<LineupRow>> | null
    playerProjections: { total: number; pitchers: Projection[]; batters: Projection[]; noBettingActivation: boolean }
    markets: MarketCandidate[]
    aiExplanation: { positiveFactors: string[]; negativeFactors: string[]; unavailableInputs: string[]; dataQuality: Record<string, number> }
    explainableIntelligence?: ExplainableIntelligence
    performance: { projectionHistoryRows: number; settledProjectionRows: number; validation?: Record<string, unknown> }
  }
  explainableIntelligence?: ExplainableIntelligence
}

type ExplanationFactor = { label: string; impact: string; status: string; evidence: string; confidenceImpact: string }
type ExplainableIntelligence = {
  summary: string
  positiveDrivers: ExplanationFactor[]
  negativeDrivers: ExplanationFactor[]
  neutralFactors: ExplanationFactor[]
  unavailableFactors: ExplanationFactor[]
  dataQualityLimitations: string[]
  confidenceImpact: string
  recommendationBoundary: string
}

type Projection = {
  projectionId: string
  playerName: string
  projectionType?: string
  projectionLabel?: string
  expectedValue: number | null
  lowRange: number | null
  highRange: number | null
  confidence: number
  lineupStatus?: string | null
  battingOrder?: number | null
  homeOrAway?: string | null
  explanation?: string | null
  exactBlockerReasons?: string[]
  thresholdProbabilities?: Record<string, unknown> | null
  supportingFeatures?: Record<string, unknown> | null
  dataSufficiency?: number | null
  featureQuality?: number | null
}

type StarterRow = {
  playerName?: string | null
  status?: string | null
  confidence?: number | null
  source?: string | null
  sourceTimestamp?: string | null
  historicalStarts?: number | null
  blockerReasons?: string[]
}

type LineupRow = {
  playerName: string
  status: string
  confidence: number
  battingOrder: number | null
  position: string | null
}

type TeamProjections = {
  expectedRuns?: { home: number | null; away: number | null; source?: string }
  winProbability?: { home: number | null; away: number | null; source?: string }
  runLine?: unknown[]
  totals?: unknown[]
  teamTotals?: { status: string; reason: string }
  confidence?: number | null
}

type MarketRow = {
  market: string
  selection: string
  line: number | null
  probability: number | null
  currentStoredPrice: number | null
  sportsbook: string | null
  snapshotTime: string | null
  freshness: string | null
  impliedProbability: number | null
  snapshotEdge: number | null
  snapshotEv: number | null
  actionableEdge: number | null
  actionableEv: number | null
  canonicalReason: string | null
  marketBlockers: string[]
}

type MarketCandidate = {
  predictionId: string
  marketLabel: string
  selection: string
  line: number | null
  sportsbook: string
  semanticLabel?: string
  officialEligibility?: string
  canonicalOutcome?: { selection: string; line: number | null; probability: number; complementDerived?: boolean; pushProbability?: number | null; totalProbability?: number | null }
  canonicalPrice?: { americanOdds: number | null; impliedProbability: number | null; timestamp: string | null; status: string }
  canonicalEv?: { edge: number | null; expectedValue: number | null; actionableEdge: number | null; actionableExpectedValue: number | null; reason: string }
  canonicalReason?: string
  marketAlignment?: { freshnessStatus?: string; actionableUnavailableReason?: string }
  cutoff?: string | null
  officialPick?: unknown
  recommendationPolicyStatus?: string
  blockers?: string[]
}

const tabs = ['Overview', 'Team Intelligence', 'Starting Pitchers', 'Expected Lineups', 'Player Projections', 'Market Intelligence', 'Why the Model Thinks This', 'Performance & Evidence', 'Data Quality'] as const
type Tab = (typeof tabs)[number]

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-lg border border-slate-800 bg-slate-900/75 p-5">{children}</section>
}

function value(value: unknown, suffix = '') {
  if (value === null || value === undefined || value === '') return 'N/A'
  if (typeof value === 'number') return Number.isFinite(value) ? `${Number(value.toFixed(2))}${suffix}` : 'N/A'
  return String(value)
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? 'N/A' : `${Number(value.toFixed(2))}%`
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : 'N/A'
}

function labelize(value: string | null | undefined) {
  return String(value ?? 'unavailable').replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function operationalMarketState(data: ApiData) {
  const status = String(data.event.status ?? '').toLowerCase()
  if (['live', 'in_progress', 'inprogress'].includes(status)) {
    return {
      label: 'Betting locked',
      reason: 'This game is live; it must not wait for or create a new pregame betting opportunity.',
    }
  }
  if (['completed', 'final', 'closed'].includes(status)) {
    return {
      label: 'Settled or closed',
      reason: 'This game is completed; market intelligence is historical/evidence context only.',
    }
  }
  if (!data.gameExperience.markets.length && !(data.market ?? []).length) {
    return {
      label: 'No eligible candidate',
      reason: 'No supported Current Board market row is linked to this game.',
    }
  }
  return {
    label: data.summary?.state ? labelize(data.summary.state) : 'Market available',
    reason: data.summary?.reason ?? 'Stored market rows are available for this game.',
  }
}

function Tile({ label, value: tileValue, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-950 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-2 text-xl font-black text-white">{tileValue}</div>
      {detail ? <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p> : null}
    </div>
  )
}

function EmptyReason({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">{children}</p>
}

function ExplanationList({ title, rows, empty }: { title: string; rows: ExplanationFactor[]; empty: string }) {
  return (
    <div>
      <h2 className="font-black">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        {rows.length ? rows.map((item) => (
          <div key={`${item.label}-${item.evidence}`} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="font-bold text-white">{item.label} <span className="text-xs uppercase text-slate-500">{labelize(item.impact)}</span></p>
            <p className="mt-1 leading-6 text-slate-400">{item.evidence}</p>
          </div>
        )) : <p>{empty}</p>}
      </div>
    </div>
  )
}

function ProjectionTable({ rows }: { rows: Projection[] }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No projections available for this group.</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr><th className="py-2">Player</th><th>Projection</th><th>Expected</th><th>Range</th><th>Confidence</th><th>Status</th><th>Why</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {rows.map((row) => (
            <tr key={row.projectionId}>
              <td className="py-3 font-bold text-white">
                <a href={`/player-projections/${encodeURIComponent(row.projectionId)}`} className="text-white underline decoration-slate-600 underline-offset-4 hover:text-emerald-100 hover:decoration-emerald-300">{row.playerName}</a>
              </td>
              <td>{row.projectionLabel ?? labelize(row.projectionType)}</td>
              <td>{value(row.expectedValue)}</td>
              <td>{value(row.lowRange)} to {value(row.highRange)}</td>
              <td>{percent(row.confidence)}</td>
              <td>{row.lineupStatus ?? 'N/A'}</td>
              <td className="max-w-md text-slate-400">{row.explanation ?? row.exactBlockerReasons?.[0] ?? 'Stored projection evidence did not include a specific driver.'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function projectionValue(rows: Projection[], playerName: string, type: string) {
  return rows.find((row) => row.playerName === playerName && row.projectionType === type)?.expectedValue ?? null
}

function MarketTable({ rows }: { rows: Array<MarketCandidate | MarketRow> }) {
  if (!rows.length) return <EmptyReason>No supported market candidate is linked to this game. Market fields remain N/A until real aligned odds and model rows exist.</EmptyReason>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr><th className="py-2">Market</th><th>Canonical Outcome</th><th>Line</th><th>Price</th><th>Implied</th><th>Model</th><th>Edge</th><th>EV</th><th>Freshness</th><th>Blocker</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {rows.map((row, index) => {
            const candidate = row as MarketCandidate
            const flat = row as MarketRow
            const canonical = candidate.canonicalOutcome
            const price = candidate.canonicalPrice
            const ev = candidate.canonicalEv
            const reason = candidate.canonicalReason ?? flat.canonicalReason ?? price?.status ?? ev?.reason ?? flat.marketBlockers?.[0] ?? 'ALIGNED'
            return (
              <tr key={'predictionId' in row ? candidate.predictionId : `${flat.market}-${index}`}>
                <td className="py-3 font-bold text-white">{candidate.marketLabel ?? flat.market}</td>
                <td>{canonical?.selection ?? flat.selection}</td>
                <td>{value(canonical?.line ?? flat.line)}</td>
                <td>{value(price?.americanOdds ?? flat.currentStoredPrice)}</td>
                <td>{percent(price?.impliedProbability ?? flat.impliedProbability)}</td>
                <td>{percent(canonical?.probability ?? flat.probability)}</td>
                <td>{value(ev?.actionableEdge ?? ev?.edge ?? flat.actionableEdge ?? flat.snapshotEdge, '%')}</td>
                <td>{value(ev?.actionableExpectedValue ?? ev?.expectedValue ?? flat.actionableEv ?? flat.snapshotEv, '%')}</td>
                <td>{labelize(candidate.marketAlignment?.freshnessStatus ?? flat.freshness)}</td>
                <td className="max-w-sm text-slate-400">{reason === 'ALIGNED' ? 'Available' : labelize(reason)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function MlbGameIntelligenceDetailClient({ eventId }: DetailProps) {
  const [data, setData] = useState<ApiData | null>(null)
  const [active, setActive] = useState<Tab>('Overview')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/games/${encodeURIComponent(eventId)}/intelligence`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Game detail failed (${response.status})`)
        return response.json()
      })
      .then((json) => alive && setData(json))
      .catch((loadError) => alive && setError(loadError instanceof Error ? loadError.message : 'Unable to load game intelligence'))
    return () => {
      alive = false
    }
  }, [eventId])

  const allPlayerRows = useMemo(() => [...(data?.gameExperience.playerProjections.pitchers ?? []), ...(data?.gameExperience.playerProjections.batters ?? [])], [data])
  const marketRows = data?.gameExperience.markets?.length ? data.gameExperience.markets : data?.market ?? []
  const operationalState = data ? operationalMarketState(data) : null
  const officialStatus = marketRows.some((row) => 'officialPick' in row && row.officialPick)
    ? 'Official Pick available'
    : data?.summary?.reason ?? 'No Official Pick passed policy for this game.'
  const strongestMarket = marketRows[0] as MarketCandidate | MarketRow | undefined
  const summary = [
    data?.summary?.topMarket ? `${data.summary.topMarket} is the strongest supported market observation currently linked to this game.` : 'No supported market observation is currently linked to this game.',
    data?.gameExperience.aiExplanation.positiveFactors[0] ?? 'Stored intelligence has limited positive-driver evidence for this matchup.',
    data?.gameExperience.aiExplanation.negativeFactors[0] ?? 'No additional negative driver was stored for this matchup.',
    officialStatus,
  ].filter(Boolean)

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-red-100">{error}</main>
  if (!data) return <main className="min-h-screen bg-slate-950 p-6 text-slate-300">Loading game intelligence...</main>

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap gap-2 text-sm font-bold text-slate-400" aria-label="Breadcrumb">
          <a href="/dashboard" className="text-emerald-200 hover:text-emerald-100">Dashboard</a>
          <span>/</span>
          <a href="/game-intelligence" className="text-emerald-200 hover:text-emerald-100">Games</a>
          <span>/</span>
          <span className="text-slate-300">Game Intelligence</span>
        </nav>
        <div className="mt-4 border-b border-slate-800 pb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Game Intelligence</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">{data.gameExperience.overview.matchup}</h1>
          <p className="mt-2 text-sm text-slate-400">{dateTime(data.event.startTime)} | {data.event.venue ?? 'Venue TBD'} | {labelize(data.event.status)}</p>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActive(tab)} className={`whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-black ${active === tab ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{tab}</button>
          ))}
        </div>

        <div className="mt-5">
          {active === 'Overview' && (
            <Panel>
              <div className="grid gap-4 md:grid-cols-3">
                <Tile label="Game State" value={labelize(data.event.status)} detail={data.summary?.label ?? 'Stored event status.'} />
                <Tile label="Prediction Cutoff" value={dateTime(data.model?.predictionCutoff ?? (strongestMarket as MarketCandidate | undefined)?.cutoff)} detail="No post-start production projection is created by this page." />
                <Tile label="Last Refresh" value={dateTime(data.generatedAt ?? data.model?.generatedAt)} detail={`${data.providerCallsMade ?? 0} provider calls, ${data.remoteMutationsMade ?? 0} remote mutations.`} />
                <Tile label="Team Expected Runs" value="N/A" detail={data.gameExperience.teamProjections.expectedRuns?.source ?? 'Stored team expected-run rows are unavailable for this game.'} />
                <Tile label="Win Probability" value={`${percent(data.model?.awayWinProbability)} / ${percent(data.model?.homeWinProbability)}`} detail={`${data.event.awayTeam ?? 'Away'} / ${data.event.homeTeam ?? 'Home'}`} />
                <Tile label="Supported Markets" value={marketRows.length} detail={marketRows.length ? 'Moneyline, Run Line or Total candidates are linked where real rows exist.' : 'No eligible candidate is linked to this game.'} />
                <Tile label="Official Pick" value={marketRows.some((row) => 'officialPick' in row && row.officialPick) ? 'Available' : 'None'} detail={officialStatus} />
                <Tile label="Data Readiness" value={data.gameExperience.overview.playerIntelligenceAvailable ? 'Player context available' : 'Limited'} detail={`${data.gameExperience.playerProjections.total} player projections linked.`} />
                <Tile label="Market State" value={operationalState?.label ?? 'Insufficient data'} detail={operationalState?.reason ?? 'No Current Board market row is linked.'} />
              </div>
              <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm font-black text-white">AI Game Summary</p>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-300">
                  {summary.map((item) => <p key={item}>{item}</p>)}
                </div>
              </div>
            </Panel>
          )}
          {active === 'Team Intelligence' && (
            <Panel>
              <div className="grid gap-4 lg:grid-cols-2">
                {(['away', 'home'] as const).map((side) => (
                  <div key={side} className="rounded-lg bg-slate-950 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{side}</p>
                    <h2 className="mt-1 text-2xl font-black">{side === 'home' ? data.event.homeTeam : data.event.awayTeam}</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Tile label="Expected Runs" value={value(data.gameExperience.teamProjections.expectedRuns?.[side])} detail={data.gameExperience.teamProjections.expectedRuns?.source ?? 'Unavailable in stored team rows.'} />
                      <Tile label="Win Probability" value={percent(data.gameExperience.teamProjections.winProbability?.[side])} detail={data.gameExperience.teamProjections.winProbability?.source ?? 'Unavailable.'} />
                      <Tile label="Run Line Probability" value={data.gameExperience.teamProjections.runLine?.length ?? 0} detail="Linked run-line candidates, not a separate team stat." />
                      <Tile label="Total Contribution" value="N/A" detail="Team total contribution is not stored as an activated market." />
                      <Tile label="Offense / Recent Form" value="N/A" detail="Full-season split and recent-form rows are not fabricated." />
                      <Tile label="Starter / Bullpen / Park" value="Limited" detail="Starter and park context appears only where stored; bullpen impact is unavailable." />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {active === 'Starting Pitchers' && (
            <Panel>
              <div className="grid gap-4 lg:grid-cols-2">
                {(['away', 'home'] as const).map((side) => {
                  const starter = data.gameExperience.startingPitchers?.[side]
                  const projections = data.gameExperience.playerProjections.pitchers.filter((row) => row.homeOrAway === side)
                  const byType = (type: string) => projections.find((row) => row.projectionType === type)?.expectedValue ?? null
                  return (
                    <div key={side} className="rounded-lg bg-slate-950 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{side} starter</p>
                      <h2 className="mt-1 text-2xl font-black">{starter?.playerName ?? 'Unavailable'}</h2>
                      <p className="mt-2 text-sm text-slate-400">{labelize(starter?.status)} | confidence {percent(starter?.confidence ?? null)} | source {starter?.source ?? 'N/A'} | update {dateTime(starter?.sourceTimestamp)}</p>
                      {!starter?.playerName ? <EmptyReason>{starter?.blockerReasons?.[0] ?? 'Starter identity is unavailable, so pitcher projections remain blocked.'}</EmptyReason> : null}
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Tile label="Historical Starts" value={value(starter?.historicalStarts)} />
                        <Tile label="Projected Innings" value={value(byType('pitcher_projected_innings'))} detail={byType('pitcher_projected_innings') === null ? 'N/A: no stored pitcher innings projection.' : undefined} />
                        <Tile label="Projected Outs" value={value(byType('pitcher_outs_recorded'))} />
                        <Tile label="Expected Strikeouts" value={value(byType('pitcher_strikeouts'))} />
                        <Tile label="Hits Allowed" value={value(byType('pitcher_hits_allowed'))} />
                        <Tile label="Earned Runs / Walks" value={`${value(byType('pitcher_earned_runs'))} / ${value(byType('pitcher_walks_allowed'))}`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}
          {active === 'Expected Lineups' && (
            <Panel>
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(data.gameExperience.expectedLineups ?? {}).map(([side, lineup]) => (
                  <div key={side}>
                    <h2 className="text-lg font-black capitalize">{side}</h2>
                    <div className="mt-3 grid gap-2">
                      {lineup.map((player) => (
                        <div key={`${side}-${player.playerName}-${player.battingOrder}`} className="rounded-lg bg-slate-950 p-3 text-sm text-slate-300">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <a href={`/player-projections?search=${encodeURIComponent(player.playerName)}`} className="font-bold text-white underline decoration-slate-600 underline-offset-4 hover:text-emerald-100 hover:decoration-emerald-300">{player.battingOrder ?? '-'} | {player.playerName}</a>
                            <span>{player.position ?? 'POS'} | {labelize(player.status)} | {percent(player.confidence)}</span>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                            <span>PA {value(projectionValue(data.gameExperience.playerProjections.batters, player.playerName, 'batter_plate_appearances'))}</span>
                            <span>Hits {value(projectionValue(data.gameExperience.playerProjections.batters, player.playerName, 'batter_hits'))}</span>
                            <span>Total Bases {value(projectionValue(data.gameExperience.playerProjections.batters, player.playerName, 'batter_total_bases'))}</span>
                            <span>HR {value(projectionValue(data.gameExperience.playerProjections.batters, player.playerName, 'batter_home_runs'))}</span>
                            <span>RBI {value(projectionValue(data.gameExperience.playerProjections.batters, player.playerName, 'batter_rbi'))}</span>
                            <span>Runs {value(projectionValue(data.gameExperience.playerProjections.batters, player.playerName, 'batter_runs'))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {active === 'Player Projections' && <Panel><ProjectionTable rows={allPlayerRows} /></Panel>}
          {active === 'Market Intelligence' && (
            <Panel>
              {operationalState ? <EmptyReason>{operationalState.label}: {operationalState.reason}</EmptyReason> : null}
              <div className="mt-4">
              <MarketTable rows={marketRows} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Tile label="Team Totals" value={labelize(data.gameExperience.teamProjections.teamTotals?.status)} detail={data.gameExperience.teamProjections.teamTotals?.reason} />
                <Tile label="First Five" value="Architecture Ready" detail="Shadow/readiness only unless real First Five odds and policy exist." />
                <Tile label="Player Props" value="Readiness Only" detail="Player prop betting is not activated; no prop EV is fabricated." />
              </div>
            </Panel>
          )}
          {active === 'Why the Model Thinks This' && (
            <Panel>
              {data.gameExperience.explainableIntelligence ? (
                <div className="mb-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <h2 className="font-black text-emerald-100">Explainable Intelligence</h2>
                  <p className="mt-2 text-sm leading-6 text-emerald-50">{data.gameExperience.explainableIntelligence.summary}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{data.gameExperience.explainableIntelligence.confidenceImpact}</p>
                  <p className="mt-2 text-sm leading-6 text-amber-100">{data.gameExperience.explainableIntelligence.recommendationBoundary}</p>
                </div>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-3">
                <ExplanationList title="Positive Drivers" rows={data.gameExperience.explainableIntelligence?.positiveDrivers ?? []} empty="No positive driver was stored." />
                <ExplanationList title="Negative Drivers" rows={data.gameExperience.explainableIntelligence?.negativeDrivers ?? []} empty="No negative driver was stored." />
                <ExplanationList title="Unavailable Factors" rows={data.gameExperience.explainableIntelligence?.unavailableFactors ?? []} empty="No unavailable factor was stored." />
              </div>
              {data.gameExperience.explainableIntelligence?.dataQualityLimitations.length ? (
                <div className="mt-5">
                  <h2 className="font-black">Data-Quality Limitations</h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">{data.gameExperience.explainableIntelligence.dataQualityLimitations.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ) : null}
            </Panel>
          )}
          {active === 'Performance & Evidence' && (
            <Panel>
              <div className="grid gap-4 md:grid-cols-3">
                <Tile label="Projection Rows" value={data.gameExperience.performance.projectionHistoryRows} detail="Bounded stored player projection evidence." />
                <Tile label="Settled Rows" value={data.gameExperience.performance.settledProjectionRows} detail="Sports projection settlement, not betting ROI." />
                <Tile label="Model Version" value={data.model?.eligibility ?? 'N/A'} detail="Official policy remains separate from model evidence." />
              </div>
            </Panel>
          )}
          {active === 'Data Quality' && (
            <Panel>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(data.gameExperience.aiExplanation.dataQuality).map(([key, item]) => <Tile key={key} label={labelize(key)} value={value(item)} />)}
                <Tile label="Freshness" value={data.event.dataFreshness?.state ?? 'UNKNOWN'} detail={data.event.dataFreshness?.ageMinutes === null ? 'No timestamp available.' : `${data.event.dataFreshness?.ageMinutes} minutes old.`} />
                <Tile label="Provider Calls" value={data.providerCallsMade ?? 0} detail="Game Center is read-only." />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </main>
  )
}
