'use client'

import { useEffect, useMemo, useState } from 'react'

type WorkbenchBet = {
  id: string
  source: string
  matchup: string
  market: string
  selection: string
  odds: number | null
  line: number | null
  probability: number
  impliedProbability: number
  confidence: number
  aiRating: number
  edge: number
  expectedValue: number
  reliability: string
  risk: string
  recommendation: string
  why: string
  startTime: string | null
  oddsTimestamp: string | null
  status: string
  official: boolean
  preview: boolean
  marketIntelligenceCategory: 'official' | 'ai_lean' | 'watchlist' | 'avoid'
  statusLabel: 'Official' | 'AI Lean' | 'Watchlist' | 'Avoid'
  informationalWarning?: string | null
  reasonNotOfficial?: string | null
}

type SavedBet = {
  id: string
  savedAt: string
  note: string
}

type DraftMode = 'preview' | 'official'
type SortMode = 'rating' | 'probability' | 'value' | 'confidence' | 'risk'

const storageKey = 'pick-analyzer-betting-workbench-v1'
const aiLeanWarning = "AI LEAN\nThe model slightly favors this outcome, but it did not satisfy Pick Analyzer's production recommendation policy.\nReview at your own discretion."
const watchlistWarning = 'WATCHLIST\nConditions may improve before game time.'
const avoidWarning = 'AVOID\nThe model recommends staying away.'

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stringValue(value: unknown, fallback = 'n/a') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function formatOdds(value: number | null) {
  if (value === null) return 'n/a'
  return value > 0 ? `+${value}` : String(value)
}

function pct(value: number) {
  return `${Number(value ?? 0).toFixed(1)}%`
}

function time(value: string | null) {
  if (!value) return 'n/a'
  return new Date(value).toLocaleString([], {
    timeZone: 'America/Puerto_Rico',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function marketName(value: string) {
  const key = value.toLowerCase()
  if (key === 'moneyline') return 'Moneyline'
  if (key === 'spread' || key === 'run_line') return 'Run Line'
  if (key === 'total') return 'Total'
  return value
}

function selectionName(bet: WorkbenchBet) {
  if (bet.market === 'Total') return `${bet.selection} ${bet.line ?? ''} Total`.trim()
  if (bet.market === 'Run Line') {
    const line = bet.line === null ? '' : bet.line > 0 ? `+${bet.line}` : String(bet.line)
    return `${bet.selection} ${line} Run Line`.trim()
  }
  if (bet.market === 'Moneyline') return `${bet.selection} Moneyline`
  return bet.selection
}

function ratingLabel(value: number) {
  if (value >= 80) return 'Excellent'
  if (value >= 65) return 'Strong'
  if (value >= 50) return 'Average Confidence'
  return 'Limited'
}

function riskLabel(bet: WorkbenchBet) {
  if (bet.official) return 'Policy Qualified'
  if (bet.edge > 0 && bet.expectedValue > 0 && bet.confidence >= 55) return 'Watch'
  if (bet.edge <= 0 || bet.expectedValue <= 0) return 'Price Risk'
  return bet.risk || 'Review'
}

function displayCategory(input: {
  official: boolean
  edge: number
  expectedValue: number
  confidence: number
  probability: number
  blockers: string[]
  missingInformation: string[]
}) {
  if (input.official) {
    return {
      category: 'official' as const,
      label: 'Official' as const,
      warning: null,
    }
  }
  const modelSignal = input.edge > 0 || input.expectedValue > 0 || (input.probability >= 45 && input.confidence >= 45)
  const clearAvoid = input.expectedValue < -20 || input.edge < -15 || input.confidence < 40
  const contextPath = [...input.blockers, ...input.missingInformation].join(' ').toLowerCase()
  if (modelSignal && !clearAvoid) return { category: 'ai_lean' as const, label: 'AI Lean' as const, warning: aiLeanWarning }
  if (/lineup|injur|bullpen|weather|market|odds|calibration|starter/.test(contextPath) && input.confidence >= 40 && input.probability >= 35) {
    return { category: 'watchlist' as const, label: 'Watchlist' as const, warning: watchlistWarning }
  }
  return { category: 'avoid' as const, label: 'Avoid' as const, warning: avoidWarning }
}

function modelWhy(bet: WorkbenchBet) {
  if (bet.market === 'Total') return 'Limited market-specific evidence is available for this total. Compare the combined scoring trend, run environment, sportsbook total and missing pitcher/weather/lineup context before treating the under as actionable.'
  if (bet.market === 'Run Line') return `${selectionName(bet)} depends on expected margin, run differential, the price required to cover and opponent scoring strength. Current value blockers still matter.`
  return `${selectionName(bet)} should be judged on NYM-side strength, PHI weaknesses and whether the moneyline price is better than the model probability.`
}

function mapBoardCandidate(candidate: Record<string, unknown>): WorkbenchBet {
  const market = marketName(stringValue(candidate.marketLabel ?? candidate.market, 'Market'))
  const selection = stringValue(candidate.selection ?? candidate.team, 'Selection')
  const edge = numberValue(candidate.edge)
  const expectedValue = numberValue(candidate.expectedValue ?? candidate.ev)
  const status = stringValue(candidate.recommendationStatus ?? candidate.semanticLabel, 'ANALYZED')
  const official = status === 'QUALIFIED' || status === 'BEST_BET_CANDIDATE' || status === 'PLAY_OF_DAY_CANDIDATE'
  const blockers = stringArray(candidate.blockers)
  const missingInformation = stringArray(candidate.missingInformation)
  const probability = numberValue(candidate.probability ?? candidate.modelProbability ?? candidate.rawProbability)
  const confidence = numberValue(candidate.confidence)
  const category = displayCategory({ official, edge, expectedValue, confidence, probability, blockers, missingInformation })
  return {
    id: stringValue(candidate.id ?? candidate.predictionId, `${selection}-${market}`),
    source: stringValue(candidate.boardLabel ?? candidate.source, 'Current Board'),
    matchup: stringValue(candidate.matchup ?? candidate.game, 'Current slate'),
    market,
    selection,
    odds: candidate.odds === null || candidate.americanOdds === null ? null : numberValue(candidate.odds ?? candidate.americanOdds),
    line: candidate.line === null || candidate.line === undefined ? null : numberValue(candidate.line),
    probability,
    impliedProbability: numberValue(candidate.sportsbookProbability ?? candidate.impliedProbability),
    confidence,
    aiRating: numberValue(candidate.aiRating ?? candidate.rankingScore ?? candidate.confidence),
    edge,
    expectedValue,
    reliability: stringValue(candidate.reliability ?? candidate.reliabilityLabel, 'Limited'),
    risk: stringValue(candidate.officialEligibility ?? candidate.riskLabel, 'Informational Only'),
    recommendation: stringValue(candidate.semanticLabel ?? candidate.recommendation ?? status, edge > 0 && expectedValue > 0 ? 'MODELED VALUE' : 'NO MODELED VALUE'),
    why: stringValue(candidate.why ?? candidate.reason ?? candidate.summary, ''),
    startTime: typeof candidate.scheduledTime === 'string'
      ? candidate.scheduledTime
      : typeof candidate.startTime === 'string'
        ? candidate.startTime
        : null,
    oddsTimestamp: typeof candidate.oddsTimestamp === 'string' ? candidate.oddsTimestamp : null,
    status,
    official,
    preview: true,
    marketIntelligenceCategory: category.category,
    statusLabel: category.label,
    informationalWarning: category.warning,
    reasonNotOfficial: official
      ? null
      : stringValue(candidate.reasonNotOfficial ?? blockers[0] ?? missingInformation[0], edge <= 0 || expectedValue <= 0 ? 'Low or negative EV.' : 'Did not meet production recommendation policy.'),
  }
}

function mapTopPick(pick: Record<string, unknown>): WorkbenchBet {
  const market = marketName(stringValue(pick.market, 'Market'))
  const selection = stringValue(pick.team ?? pick.selection, 'Selection')
  const status = stringValue(pick.recommendation_status ?? pick.recommendationStatus, 'OFFICIAL')
  return {
    id: stringValue(pick.id, `${selection}-${market}-top`),
    source: 'Top Picks',
    matchup: `${stringValue(pick.away_team ?? pick.awayTeam, '')} at ${stringValue(pick.home_team ?? pick.homeTeam, '')}`.trim(),
    market,
    selection,
    odds: pick.odds === null ? null : numberValue(pick.odds),
    line: pick.line === null || pick.line === undefined ? null : numberValue(pick.line),
    probability: numberValue(pick.model_probability ?? pick.modelProbability),
    impliedProbability: numberValue(pick.implied_probability ?? pick.impliedProbability),
    confidence: numberValue(pick.confidence),
    aiRating: numberValue(pick.adaptive_score ?? pick.smart_score ?? pick.confidence),
    edge: numberValue(pick.edge),
    expectedValue: numberValue(pick.ev ?? pick.expectedValue),
    reliability: stringValue(pick.reliability_label ?? pick.reliabilityLabel, 'Policy reviewed'),
    risk: stringValue(pick.risk_label ?? pick.riskLabel, 'Policy risk'),
    recommendation: stringValue(pick.recommendation_label ?? pick.recommendationLabel, 'Official candidate'),
    why: 'Official-pick source only; policy and production gates remain owned by Top Picks.',
    startTime: typeof pick.commence_time === 'string' ? pick.commence_time : null,
    oddsTimestamp: typeof pick.odds_timestamp === 'string' ? pick.odds_timestamp : null,
    status,
    official: true,
    preview: false,
    marketIntelligenceCategory: 'official',
    statusLabel: 'Official',
  }
}

function uniqueBets(rows: WorkbenchBet[]) {
  const map = new Map<string, WorkbenchBet>()
  rows.forEach((row) => {
    const key = `${row.matchup}|${row.market}|${row.selection}|${row.line ?? 'null'}|${row.odds ?? 'null'}`
    const existing = map.get(key)
    if (!existing || row.official || row.source === 'Current Board') map.set(key, row)
  })
  return Array.from(map.values())
}

function safeArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

export default function BettingWorkbenchTool() {
  const [bets, setBets] = useState<WorkbenchBet[]>([])
  const [saved, setSaved] = useState<SavedBet[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [ticketIds, setTicketIds] = useState<string[]>([])
  const [draftMode, setDraftMode] = useState<DraftMode>('preview')
  const [activeTab, setActiveTab] = useState('Compare Bets')
  const [marketFilter, setMarketFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('rating')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (stored) {
      try {
        setSaved(JSON.parse(stored) as SavedBet[])
      } catch {
        setSaved([])
      }
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(saved))
  }, [saved])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [boardResponse, topPicksResponse] = await Promise.all([
          fetch('/api/current-board?mode=current&limit=100', { cache: 'no-store' }),
          fetch('/api/predictions/top', { cache: 'no-store' }),
        ])

        let [board, topPicks] = await Promise.all([
          boardResponse.json(),
          topPicksResponse.json(),
        ])
        if (!safeArray(board.candidates).length) {
          const fallbackResponse = await fetch('/api/current-board?mode=all_stored_data&limit=100', { cache: 'no-store' })
          const fallback = await fallbackResponse.json()
          if (safeArray(fallback.candidates).length) board = fallback
        }

        const rows = uniqueBets([
          ...safeArray(board.candidates).map(mapBoardCandidate),
          ...safeArray(topPicks.topEv).map(mapTopPick),
          ...safeArray(topPicks.topConfidence).map(mapTopPick),
          ...safeArray(topPicks.bestBets).map(mapTopPick),
        ])
        setBets(rows)
        setSelectedIds(rows.slice(0, 3).map((row) => row.id))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Betting Workbench')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...bets]
      .filter((bet) => marketFilter === 'all' || bet.market === marketFilter)
      .filter((bet) => !query || `${bet.matchup} ${bet.market} ${bet.selection} ${bet.source}`.toLowerCase().includes(query))
      .sort((left, right) => {
        if (sort === 'probability') return right.probability - left.probability
        if (sort === 'value') return right.expectedValue - left.expectedValue || right.edge - left.edge
        if (sort === 'confidence') return right.confidence - left.confidence
        if (sort === 'risk') return Number(right.official) - Number(left.official) || right.confidence - left.confidence
        return right.aiRating - left.aiRating
      })
  }, [bets, marketFilter, search, sort])

  const compared = selectedIds.map((id) => bets.find((bet) => bet.id === id)).filter(Boolean) as WorkbenchBet[]
  const ticketPool = filtered.filter((bet) => (draftMode === 'official' ? bet.official : bet.preview || bet.official))
  const ticket = ticketIds.map((id) => bets.find((bet) => bet.id === id)).filter(Boolean) as WorkbenchBet[]
  const markets = Array.from(new Set(bets.map((bet) => bet.market))).sort()

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-4))
  }

  function toggleTicket(id: string) {
    setTicketIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function saveBet(bet: WorkbenchBet) {
    setSaved((current) => {
      const existing = current.find((item) => item.id === bet.id)
      if (existing) return current
      return [{ id: bet.id, savedAt: new Date().toISOString(), note: '' }, ...current]
    })
  }

  function updateNote(id: string, note: string) {
    setSaved((current) => current.map((item) => item.id === id ? { ...item, note } : item))
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">Back to Dashboard</a>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Betting Workspace</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-black sm:text-4xl">Betting Workbench</h1>
              <p className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-400 sm:max-w-3xl">
                Compare bets, investigate markets, draft tickets and save your reasoning without changing Current Board, Top Picks or recommendation policy.
              </p>
            </div>
            <div className="grid w-full max-w-full grid-cols-1 gap-3 text-sm md:grid-cols-3 lg:w-auto">
              <Summary label="Bets" value={bets.length} />
              <Summary label="Saved" value={saved.length} />
              <Summary label="Provider Calls" value="0" />
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">{error}</div> : null}
        {loading ? <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-slate-300">Loading Betting Workbench...</div> : null}
        {!loading && bets.length ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
            {bets.some((bet) => bet.official)
              ? 'Official recommendations are green. AI Leans, Watchlist and Avoid rows are market intelligence only.'
              : 'No official ticket today. The following AI Leans, Watchlist and Avoid rows are available for personal review only.'}
          </div>
        ) : null}

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-2">
          {['Compare Bets', 'Build Ticket', 'Market Explorer', 'Favorites', 'Saved Bets', 'Notes'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black ${activeTab === tab ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === 'Compare Bets' ? (
          <section className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Picker bets={filtered} selectedIds={selectedIds} onToggle={toggleSelected} />
            <div className="grid min-w-0 gap-4 xl:grid-cols-3">
              {compared.map((bet) => <BetCard key={bet.id} bet={bet} onSave={saveBet} />)}
              {!compared.length ? <Empty title="No bets selected" text="Choose up to four bets to compare probability, confidence, AI rating, value, risk and recommendation." /> : null}
            </div>
          </section>
        ) : null}

        {activeTab === 'Build Ticket' ? (
          <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-black">Build Ticket</h2>
                <select value={draftMode} onChange={(event) => setDraftMode(event.target.value as DraftMode)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="preview">Preview mode</option>
                  <option value="official">Official picks only</option>
                </select>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {ticketPool.map((bet) => (
                  <SelectableBet key={bet.id} bet={bet} checked={ticketIds.includes(bet.id)} onToggle={toggleTicket} />
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="text-xl font-black">Draft Slip</h3>
              <p className="mt-2 text-sm text-slate-400">
                {draftMode === 'official'
                  ? 'Using official Top Picks only.'
                  : 'No ticket is created automatically. Preview mode is personal review only unless a row is marked official.'}
              </p>
              <div className="mt-4 space-y-3">
                {ticket.map((bet) => <TicketLeg key={bet.id} bet={bet} />)}
                {!ticket.length ? <p className="text-sm text-slate-500">No legs selected.</p> : null}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Summary label="Legs" value={ticket.length} />
                <Summary label="Avg Conf." value={ticket.length ? pct(ticket.reduce((sum, bet) => sum + bet.confidence, 0) / ticket.length) : 'n/a'} />
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'Market Explorer' ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <Controls markets={markets} marketFilter={marketFilter} setMarketFilter={setMarketFilter} search={search} setSearch={setSearch} sort={sort} setSort={setSort} />
            <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-3">
              {filtered.map((bet) => <BetCard key={bet.id} bet={bet} onSave={saveBet} compact />)}
            </div>
          </section>
        ) : null}

        {activeTab === 'Favorites' || activeTab === 'Saved Bets' || activeTab === 'Notes' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {saved.map((item) => {
              const bet = bets.find((row) => row.id === item.id)
              if (!bet) return null
              return (
                <article key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                  <BetHeader bet={bet} />
                  <label className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Why I liked this bet
                    <textarea
                      value={item.note}
                      onChange={(event) => updateNote(item.id, event.target.value)}
                      className="mt-2 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm normal-case tracking-normal text-white"
                      placeholder="Write the angle, concern, or review note..."
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">Saved {time(item.savedAt)}</p>
                </article>
              )
            })}
            {!saved.length ? <Empty title="No saved bets yet" text="Save a bet from Compare Bets or Market Explorer, then add your review notes here." /> : null}
          </section>
        ) : null}
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="break-words text-xs font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.16em]">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function Controls({ markets, marketFilter, setMarketFilter, search, setSearch, sort, setSort }: {
  markets: string[]
  marketFilter: string
  setMarketFilter: (value: string) => void
  search: string
  setSearch: (value: string) => void
  sort: SortMode
  setSort: (value: SortMode) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search matchup, team or market" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500" />
      <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white">
        <option value="all">Every supported market</option>
        {markets.map((market) => <option key={market} value={market}>{market}</option>)}
      </select>
      <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white">
        <option value="rating">AI rating</option>
        <option value="probability">Probability</option>
        <option value="value">Value</option>
        <option value="confidence">Confidence</option>
        <option value="risk">Risk</option>
      </select>
    </div>
  )
}

function Picker({ bets, selectedIds, onToggle }: { bets: WorkbenchBet[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  return (
    <aside className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-xl font-black">Select Bets</h2>
      <div className="mt-4 max-h-[640px] space-y-2 overflow-auto pr-1">
        {bets.map((bet) => <SelectableBet key={bet.id} bet={bet} checked={selectedIds.includes(bet.id)} onToggle={onToggle} />)}
      </div>
    </aside>
  )
}

function SelectableBet({ bet, checked, onToggle }: { bet: WorkbenchBet; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <button onClick={() => onToggle(bet.id)} className={`w-full min-w-0 rounded-2xl border p-3 text-left ${checked ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/60 hover:bg-slate-900'}`}>
      <p className="break-words font-black text-white">{selectionName(bet)}</p>
      <p className="mt-1 text-xs text-slate-400">{bet.matchup}</p>
      <p className="mt-2 text-xs text-slate-500">{bet.market} | {formatOdds(bet.odds)} | {bet.source}</p>
    </button>
  )
}

function BetHeader({ bet }: { bet: WorkbenchBet }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={bet.statusLabel === 'Official' ? 'rounded-full border border-emerald-500/40 bg-emerald-950/20 px-3 py-1 text-xs font-black text-emerald-200' : bet.statusLabel === 'Watchlist' ? 'rounded-full border border-sky-500/40 bg-sky-950/20 px-3 py-1 text-xs font-black text-sky-200' : bet.statusLabel === 'Avoid' ? 'rounded-full border border-red-500/40 bg-red-950/20 px-3 py-1 text-xs font-black text-red-200' : 'rounded-full border border-amber-500/40 bg-amber-950/20 px-3 py-1 text-xs font-black text-amber-100'}>
          {bet.statusLabel}
        </span>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">{bet.source}</span>
      </div>
      <h2 className="mt-3 break-words text-2xl font-black text-white">{selectionName(bet)}</h2>
      <p className="mt-1 text-sm text-slate-400">{bet.matchup} | {time(bet.startTime)}</p>
    </div>
  )
}

function BetCard({ bet, onSave, compact = false }: { bet: WorkbenchBet; onSave: (bet: WorkbenchBet) => void; compact?: boolean }) {
  return (
    <article className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <BetHeader bet={bet} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="Probability" value={pct(bet.probability)} />
        <Metric label="Sportsbook Probability" value={pct(bet.impliedProbability)} />
        <Metric label="Confidence" value={pct(bet.confidence)} />
        <Metric label="AI Rating" value={ratingLabel(bet.aiRating)} />
        <Metric label="Value" value={`${pct(bet.expectedValue)} EV`} tone={bet.expectedValue > 0 ? 'good' : 'bad'} />
        <Metric label="Risk" value={riskLabel(bet)} />
        <Metric label="Odds" value={formatOdds(bet.odds)} />
        <Metric label="Market" value={bet.market} />
        <Metric label="Line" value={bet.line === null ? 'n/a' : String(bet.line)} />
      </div>
      {!compact ? <p className="mt-4 text-sm leading-6 text-slate-300">{modelWhy(bet)}</p> : null}
      {bet.informationalWarning ? (
        <p className="mt-4 whitespace-pre-line rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs font-black tracking-[0.08em] text-amber-100">
          {bet.informationalWarning}
        </p>
      ) : null}
      {bet.reasonNotOfficial ? (
        <p className="mt-3 text-sm leading-6 text-amber-100">Reason not official: {bet.reasonNotOfficial}</p>
      ) : null}
      <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <summary className="cursor-pointer text-sm font-black">Advanced Details</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Official Eligibility" value={bet.risk} />
          <Metric label="Data Timestamp" value={time(bet.oddsTimestamp)} />
          <Metric label="Status" value={bet.status} />
        </div>
      </details>
      <button onClick={() => onSave(bet)} className="mt-4 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">Save Bet</button>
    </article>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-white'
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/70 p-3">
      <p className="break-words text-xs text-slate-500">{label}</p>
      <p className={`mt-1 break-words font-black ${color}`}>{value}</p>
    </div>
  )
}

function TicketLeg({ bet }: { bet: WorkbenchBet }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="font-black text-white">{selectionName(bet)}</p>
      <p className="mt-1 text-xs text-slate-400">{bet.matchup}</p>
      <p className="mt-2 text-xs text-slate-500">{formatOdds(bet.odds)} | {bet.recommendation}</p>
    </div>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  )
}
