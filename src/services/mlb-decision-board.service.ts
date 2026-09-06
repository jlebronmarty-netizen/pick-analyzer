import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { activeEventBlockingReasons, isActiveBettingEvent, puertoRicoUtcRange } from '@/services/active-event.service'
import { getMlbPlayerProjectionEngine } from '@/services/mlb-player-projection-engine.service'
import { getUniversalMarketInventory } from '@/services/universal-market-intelligence.service'
import { getUniversalProjectionEngine, type UniversalProjection } from '@/services/universal-projection-engine.service'
import type {
  MlbBookQuote,
  MlbDecisionBoardData,
  MlbDecisionConfidence,
  MlbDecisionItem,
  MlbDecisionStatus,
  MlbPropGroup,
} from '@/types/mlb-decision-board'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const REFRESH_SECONDS = 300
const PYTHAGOREAN_EXPONENT = 1.83
const MIN_LEAN_EDGE = 0.05

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  home_team: string
  away_team: string
  home_team_id: string | null
  away_team_id: string | null
  start_time: string
  status: string
  metadata: Record<string, unknown> | null
}

type RawOddsRow = {
  id: string
  event_id: string
  provider: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  metadata: Record<string, unknown> | null
}

type ProjectionEngineResult = {
  mode?: string
  generatedAt?: string
  projections?: UniversalProjection[]
  projectionHealth?: Record<string, unknown>
  summary?: Record<string, unknown>
}

type PlayerProjectionRow = {
  projectionId: string
  eventId: string | null
  playerId: string | null
  canonicalPlayerId: string | null
  playerName: string
  team: string | null
  opponent: string | null
  projectionType: string
  projectionLabel: string
  expectedValue: number | null
  confidence: number
  dataSufficiency: number
  featureQuality: number
  lineupOrStarterStatus: string
  lineupStatus: string | null
  modelVersion: string
  exactBlockerReasons: string[]
  explanation: string
  supportingFeatures: Array<{ feature: string; status: string; contribution: number; explanation: string }>
}

type PlayerEngineResult = {
  mode?: string
  generatedAt?: string
  projections?: PlayerProjectionRow[]
  pitcherProjections?: PlayerProjectionRow[]
  batterProjections?: PlayerProjectionRow[]
  currentSlate?: {
    lineupAndStarterCoverage?: {
      confirmedStarters?: number
      probableStarters?: number
      expectedStarters?: number
      confirmedLineups?: number
      expectedLineups?: number
    }
    blockerSummary?: Record<string, number>
  }
}

function nowIso() {
  return new Date().toISOString()
}

function selectedPuertoRicoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function stable(value: unknown) {
  return String(value ?? 'none').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_')
}

function normalizeBook(value: unknown): 'FanDuel' | 'Caesars' | null {
  const book = normalize(value)
  if (book.includes('fanduel')) return 'FanDuel'
  if (book.includes('caesars')) return 'Caesars'
  return null
}

function impliedProbability(odds: number | null) {
  if (odds === null || odds === 0) return null
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100)
}

function noVigPair(first: number | null, second: number | null) {
  const a = impliedProbability(first)
  const b = impliedProbability(second)
  if (a === null || b === null || a + b <= 0) return [null, null] as const
  return [a / (a + b), b / (a + b)] as const
}

function probabilityToAmerican(probability: number | null) {
  if (probability === null || probability <= 0 || probability >= 1) return null
  const odds = probability >= 0.5
    ? -(probability / (1 - probability)) * 100
    : ((1 - probability) / probability) * 100
  return Math.round(odds)
}

function poissonPmf(lambda: number, k: number) {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let factorial = 1
  for (let i = 2; i <= k; i += 1) factorial *= i
  return Math.exp(-lambda) * lambda ** k / factorial
}

function countSideProbability(lambda: number, line: number, side: 'over' | 'under') {
  const maxK = Math.max(40, Math.ceil(lambda + 10 * Math.sqrt(Math.max(lambda, 1))))
  let over = 0
  let under = 0
  let push = 0
  for (let k = 0; k <= maxK; k += 1) {
    const probability = poissonPmf(Math.max(0.01, lambda), k)
    if (k > line) over += probability
    else if (k < line) under += probability
    else push += probability
  }
  const noPush = Math.max(0.000001, 1 - push)
  return side === 'over' ? over / noPush : under / noPush
}

function gameWinProbability(awayRuns: number, homeRuns: number, side: 'away' | 'home') {
  const awayStrength = Math.max(0.05, awayRuns) ** PYTHAGOREAN_EXPONENT
  const homeStrength = Math.max(0.05, homeRuns) ** PYTHAGOREAN_EXPONENT
  const awayProbability = awayStrength / (awayStrength + homeStrength)
  return side === 'away' ? awayProbability : 1 - awayProbability
}

function canonicalGameMarket(value: unknown) {
  const market = normalize(value).replace(/ /g, '_')
  if (['moneyline', 'ml', 'h2h'].includes(market)) return 'moneyline'
  if (['total', 'totals', 'over_under'].includes(market)) return 'total'
  return null
}

function canonicalPropMarket(value: unknown): { key: string; group: MlbPropGroup; label: string } | null {
  const market = normalize(value).replace(/ /g, '_')
  const definitions = [
    { keys: ['pitcher_strikeouts', 'pitcher_strikeout', 'pitcher_k'], key: 'pitcher_strikeouts', group: 'pitcher' as const, label: 'Pitcher Strikeouts' },
    { keys: ['pitcher_outs_recorded', 'pitcher_outs', 'pitching_outs'], key: 'pitcher_outs_recorded', group: 'pitcher' as const, label: 'Pitcher Outs' },
    { keys: ['batter_hits', 'player_hits'], key: 'batter_hits', group: 'batter' as const, label: 'Batter Hits' },
    { keys: ['batter_total_bases', 'player_total_bases'], key: 'batter_total_bases', group: 'batter' as const, label: 'Batter Total Bases' },
  ]
  return definitions.find((definition) => definition.keys.some((key) => market === key || market.includes(key))) ?? null
}

function stringLeaves(value: unknown, depth = 0): string[] {
  if (depth > 3) return []
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (Array.isArray(value)) return value.flatMap((item) => stringLeaves(item, depth + 1))
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap((item) => stringLeaves(item, depth + 1))
  return []
}

function sideFromRow(row: RawOddsRow): 'over' | 'under' | null {
  const values = [row.outcome, ...stringLeaves(row.metadata)].map(normalize)
  if (values.some((value) => value === 'over' || value.startsWith('over '))) return 'over'
  if (values.some((value) => value === 'under' || value.startsWith('under '))) return 'under'
  return null
}

function findPlayerName(row: RawOddsRow, projectionNames: Map<string, string>) {
  const candidates = [row.outcome, ...stringLeaves(row.metadata)]
  for (const candidate of candidates) {
    const exact = projectionNames.get(normalize(candidate))
    if (exact) return exact
  }
  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate)
    if (normalizedCandidate.length < 5) continue
    for (const [key, display] of projectionNames.entries()) {
      if (normalizedCandidate.includes(key) || key.includes(normalizedCandidate)) return display
    }
  }
  return null
}

function resolveTeamSelection(selection: string | null, event: EventRow): 'away' | 'home' | null {
  const value = normalize(selection)
  if (!value) return null
  if (value === 'away' || value === normalize(event.away_team) || value.includes(normalize(event.away_team))) return 'away'
  if (value === 'home' || value === normalize(event.home_team) || value.includes(normalize(event.home_team))) return 'home'
  return null
}

function latestRows(rows: RawOddsRow[]) {
  const seen = new Map<string, RawOddsRow>()
  for (const row of rows) {
    const key = [row.event_id, normalizeBook(row.sportsbook), normalize(row.market), normalize(row.outcome), row.line, JSON.stringify(row.metadata ?? {})].join('|')
    const current = seen.get(key)
    if (!current || String(row.snapshot_time ?? '') > String(current.snapshot_time ?? '')) seen.set(key, row)
  }
  return Array.from(seen.values())
}

function decisionFromEdge(params: {
  edge: number | null
  confidenceScore: number | null
  dataSufficiency: number | null
  featureQuality: number | null
  blockers: string[]
}) {
  const { edge, confidenceScore, dataSufficiency, featureQuality, blockers } = params
  const hardBlocked = blockers.some((blocker) => [
    'EVENT_STARTED',
    'EVENT_STATUS_NOT_PREGAME',
    'NO_PAIRED_PRICE',
    'NO_MODEL_PROJECTION',
    'PLAYER_MAPPING_UNRESOLVED',
    'MISSING_PROBABLE_STARTER',
  ].includes(blocker))
  if (hardBlocked) return { decision: 'BLOCKED' as MlbDecisionStatus, confidence: 'BLOCKED' as MlbDecisionConfidence }
  if (edge === null) return { decision: 'NO_BET' as MlbDecisionStatus, confidence: 'LOW' as MlbDecisionConfidence }
  const quality = Math.min(dataSufficiency ?? 0, featureQuality ?? 0)
  if (edge >= MIN_LEAN_EDGE && (confidenceScore ?? 0) >= 50 && quality >= 45) {
    return {
      decision: 'LEAN' as MlbDecisionStatus,
      confidence: edge >= 0.08 && (confidenceScore ?? 0) >= 60 && quality >= 55 ? 'MEDIUM' as MlbDecisionConfidence : 'LOW' as MlbDecisionConfidence,
    }
  }
  return { decision: 'NO_BET' as MlbDecisionStatus, confidence: 'LOW' as MlbDecisionConfidence }
}

function bestQuote(quotes: MlbBookQuote[]) {
  return quotes.reduce<MlbBookQuote | null>((best, quote) => !best || quote.odds > best.odds ? quote : best, null)
}

function maxAcceptablePrice(modelProbability: number | null) {
  if (modelProbability === null) return null
  return probabilityToAmerican(Math.max(0.01, Math.min(0.99, modelProbability - 0.03)))
}

async function loadEvents(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, home_team, away_team, home_team_id, away_team_id, start_time, status, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB Decision Board event load failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function loadOdds(date: string, eventIds: string[]) {
  if (!eventIds.length) return [] as RawOddsRow[]
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, metadata')
    .eq('sport_key', SPORT_KEY)
    .in('event_id', eventIds)
    .gte('snapshot_time', range.utcStart)
    .lt('snapshot_time', range.utcEndExclusive)
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (error) return [] as RawOddsRow[]
  return latestRows((data ?? []) as RawOddsRow[]).filter((row) => normalizeBook(row.sportsbook) !== null)
}

function buildRunProjectionMap(result: ProjectionEngineResult) {
  const map = new Map<string, { away: UniversalProjection | null; home: UniversalProjection | null }>()
  for (const projection of result.projections ?? []) {
    if (projection.projectionKey !== 'projected_runs' || !projection.eventId || !projection.side) continue
    const current = map.get(projection.eventId) ?? { away: null, home: null }
    current[projection.side] = projection
    map.set(projection.eventId, current)
  }
  return map
}

function buildGameMarketDecisions(events: EventRow[], oddsRows: RawOddsRow[], projections: ProjectionEngineResult) {
  const runsByEvent = buildRunProjectionMap(projections)
  const candidates: MlbDecisionItem[] = []

  for (const event of events) {
    const blockers = activeEventBlockingReasons(event, { sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY })
    const runPair = runsByEvent.get(event.id)
    const awayRuns = runPair?.away?.projectedValue ?? null
    const homeRuns = runPair?.home?.projectedValue ?? null
    const quality = Math.min(runPair?.away?.featureQuality ?? 0, runPair?.home?.featureQuality ?? 0)
    const sufficiency = Math.min(runPair?.away?.dataSufficiency ?? 0, runPair?.home?.dataSufficiency ?? 0)
    const confidenceScore = Math.min(runPair?.away?.confidence ?? 0, runPair?.home?.confidence ?? 0)
    const matchup = `${event.away_team} @ ${event.home_team}`
    const eventOdds = oddsRows.filter((row) => row.event_id === event.id)

    for (const book of ['FanDuel', 'Caesars'] as const) {
      const bookRows = eventOdds.filter((row) => normalizeBook(row.sportsbook) === book)
      const moneylineRows = bookRows.filter((row) => canonicalGameMarket(row.market) === 'moneyline' && row.price !== null)
      const awayQuote = moneylineRows.filter((row) => resolveTeamSelection(row.outcome, event) === 'away').sort((a, b) => String(b.snapshot_time ?? '').localeCompare(String(a.snapshot_time ?? '')))[0]
      const homeQuote = moneylineRows.filter((row) => resolveTeamSelection(row.outcome, event) === 'home').sort((a, b) => String(b.snapshot_time ?? '').localeCompare(String(a.snapshot_time ?? '')))[0]
      if (awayQuote && homeQuote && awayQuote.price !== null && homeQuote.price !== null) {
        const [awayNoVig, homeNoVig] = noVigPair(awayQuote.price, homeQuote.price)
        for (const side of ['away', 'home'] as const) {
          const quote = side === 'away' ? awayQuote : homeQuote
          const modelProbability = awayRuns !== null && homeRuns !== null ? gameWinProbability(awayRuns, homeRuns, side) : null
          const noVigProbability = side === 'away' ? awayNoVig : homeNoVig
          const edge = modelProbability !== null && noVigProbability !== null ? modelProbability - noVigProbability : null
          const itemBlockers = [...blockers]
          if (modelProbability === null) itemBlockers.push('NO_MODEL_PROJECTION')
          const classification = decisionFromEdge({ edge, confidenceScore, dataSufficiency: sufficiency, featureQuality: quality, blockers: itemBlockers })
          const team = side === 'away' ? event.away_team : event.home_team
          candidates.push({
            id: stable(['market', event.id, 'moneyline', team, book]),
            kind: 'market', eventId: event.id, matchup, scheduledTime: event.start_time, eventStatus: event.status,
            category: 'Moneyline', marketKey: 'moneyline', label: `${team} ML`, subject: team, propGroup: null,
            side: team, line: null, bestBook: book, bestOdds: quote.price,
            quotes: [{ book, odds: quote.price, line: null, observedAt: quote.snapshot_time }],
            projectedValue: modelProbability, modelProbability, noVigProbability, edge,
            confidence: classification.confidence, decision: classification.decision,
            reasons: [
              modelProbability !== null ? `Shadow win probability ${(modelProbability * 100).toFixed(1)}%.` : 'No run projection available.',
              edge !== null ? `Edge vs ${book} no-vig ${(edge * 100).toFixed(1)} pp.` : 'No edge calculation available.',
              awayRuns !== null && homeRuns !== null ? `Projected runs: ${event.away_team} ${awayRuns.toFixed(2)} - ${event.home_team} ${homeRuns.toFixed(2)}.` : 'Projected runs unavailable.',
            ],
            risks: ['Moneyline probability is a shadow V1 transform of projected runs.', 'Official-pick persistence remains disabled.'],
            blockers: itemBlockers, modelVersion: 'mlb_moneyline_shadow_v1', capturedAt: quote.snapshot_time,
            maxPrice: maxAcceptablePrice(modelProbability), lineupStatus: null, starterStatus: null,
            dataSufficiency: sufficiency, featureQuality: quality,
          })
        }
      }

      const totalRows = bookRows.filter((row) => canonicalGameMarket(row.market) === 'total' && row.price !== null && row.line !== null)
      const lines = Array.from(new Set(totalRows.map((row) => row.line).filter((line): line is number => line !== null)))
      for (const line of lines) {
        const over = totalRows.filter((row) => row.line === line && sideFromRow(row) === 'over').sort((a, b) => String(b.snapshot_time ?? '').localeCompare(String(a.snapshot_time ?? '')))[0]
        const under = totalRows.filter((row) => row.line === line && sideFromRow(row) === 'under').sort((a, b) => String(b.snapshot_time ?? '').localeCompare(String(a.snapshot_time ?? '')))[0]
        if (!over || !under || over.price === null || under.price === null) continue
        const [overNoVig, underNoVig] = noVigPair(over.price, under.price)
        const expectedTotal = awayRuns !== null && homeRuns !== null ? awayRuns + homeRuns : null
        for (const side of ['over', 'under'] as const) {
          const quote = side === 'over' ? over : under
          const modelProbability = expectedTotal !== null ? countSideProbability(expectedTotal, line, side) : null
          const noVigProbability = side === 'over' ? overNoVig : underNoVig
          const edge = modelProbability !== null && noVigProbability !== null ? modelProbability - noVigProbability : null
          const itemBlockers = [...blockers]
          if (modelProbability === null) itemBlockers.push('NO_MODEL_PROJECTION')
          const classification = decisionFromEdge({ edge, confidenceScore, dataSufficiency: sufficiency, featureQuality: quality, blockers: itemBlockers })
          candidates.push({
            id: stable(['market', event.id, 'total', line, side, book]), kind: 'market', eventId: event.id,
            matchup, scheduledTime: event.start_time, eventStatus: event.status, category: 'Total', marketKey: 'total',
            label: `${side === 'over' ? 'Over' : 'Under'} ${line}`, subject: matchup, propGroup: null,
            side: side.toUpperCase(), line, bestBook: book, bestOdds: quote.price,
            quotes: [{ book, odds: quote.price, line, observedAt: quote.snapshot_time }],
            projectedValue: expectedTotal, modelProbability, noVigProbability, edge,
            confidence: classification.confidence, decision: classification.decision,
            reasons: [
              expectedTotal !== null ? `Projected total ${expectedTotal.toFixed(2)} runs vs ${line}.` : 'No total projection available.',
              edge !== null ? `Edge vs ${book} no-vig ${(edge * 100).toFixed(1)} pp.` : 'No edge calculation available.',
            ],
            risks: ['Total probability uses a Poisson shadow distribution from projected runs.', 'Bullpen, weather and umpire refinements are not yet promoted into this V1 probability.'],
            blockers: itemBlockers, modelVersion: 'mlb_total_shadow_v1', capturedAt: quote.snapshot_time,
            maxPrice: maxAcceptablePrice(modelProbability), lineupStatus: null, starterStatus: null,
            dataSufficiency: sufficiency, featureQuality: quality,
          })
        }
      }
    }
  }

  const consolidated = new Map<string, MlbDecisionItem>()
  for (const item of candidates) {
    const key = [item.eventId, item.marketKey, item.side, item.line].join('|')
    const current = consolidated.get(key)
    if (!current) {
      consolidated.set(key, item)
      continue
    }
    const quotes = [...current.quotes, ...item.quotes]
    const best = bestQuote(quotes)
    const winner = best?.book === item.bestBook ? item : current
    consolidated.set(key, { ...winner, quotes, bestBook: best?.book ?? null, bestOdds: best?.odds ?? null, capturedAt: best?.observedAt ?? winner.capturedAt })
  }
  return Array.from(consolidated.values()).sort((a, b) => (b.edge ?? -99) - (a.edge ?? -99))
}

function buildPropDecisions(events: EventRow[], oddsRows: RawOddsRow[], playerEngine: PlayerEngineResult) {
  const eventById = new Map(events.map((event) => [event.id, event]))
  const projections = playerEngine.projections ?? []
  const projectionNames = new Map<string, string>()
  for (const projection of projections) projectionNames.set(normalize(projection.playerName), projection.playerName)

  const latestPropRows = oddsRows.filter((row) => canonicalPropMarket(row.market) !== null && row.price !== null && row.line !== null)
  const pairedGroups = new Map<string, { over?: RawOddsRow; under?: RawOddsRow; playerName: string; market: NonNullable<ReturnType<typeof canonicalPropMarket>>; book: 'FanDuel' | 'Caesars'; line: number }>()
  for (const row of latestPropRows) {
    const market = canonicalPropMarket(row.market)
    const book = normalizeBook(row.sportsbook)
    const playerName = findPlayerName(row, projectionNames)
    const side = sideFromRow(row)
    if (!market || !book || !playerName || !side || row.line === null) continue
    const key = [row.event_id, book, market.key, normalize(playerName), row.line].join('|')
    const group = pairedGroups.get(key) ?? { playerName, market, book, line: row.line }
    const current = group[side]
    if (!current || String(row.snapshot_time ?? '') > String(current.snapshot_time ?? '')) group[side] = row
    pairedGroups.set(key, group)
  }

  const candidates: MlbDecisionItem[] = []
  for (const [groupKey, group] of pairedGroups.entries()) {
    const [eventId] = groupKey.split('|')
    const event = eventById.get(eventId)
    if (!event || !group.over || !group.under || group.over.price === null || group.under.price === null) continue
    const projection = projections.find((row) =>
      row.eventId === event.id && row.projectionType === group.market.key && normalize(row.playerName) === normalize(group.playerName)
    )
    if (!projection) continue
    const [overNoVig, underNoVig] = noVigPair(group.over.price, group.under.price)
    const matchup = `${event.away_team} @ ${event.home_team}`
    const eventBlockers = activeEventBlockingReasons(event, { sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY })
    for (const side of ['over', 'under'] as const) {
      const quote = side === 'over' ? group.over : group.under
      const noVigProbability = side === 'over' ? overNoVig : underNoVig
      const modelProbability = projection.expectedValue !== null ? countSideProbability(projection.expectedValue, group.line, side) : null
      const edge = modelProbability !== null && noVigProbability !== null ? modelProbability - noVigProbability : null
      const blockers = [...eventBlockers]
      if (projection.expectedValue === null) blockers.push('NO_MODEL_PROJECTION')
      if (group.market.group === 'pitcher' && ['UNVERIFIED', 'UNKNOWN'].includes(String(projection.lineupOrStarterStatus).toUpperCase())) blockers.push('MISSING_PROBABLE_STARTER')
      const classification = decisionFromEdge({
        edge,
        confidenceScore: projection.confidence,
        dataSufficiency: projection.dataSufficiency,
        featureQuality: projection.featureQuality,
        blockers,
      })
      candidates.push({
        id: stable(['prop', event.id, group.market.key, projection.playerName, group.line, side, group.book]),
        kind: 'prop', eventId: event.id, matchup, scheduledTime: event.start_time, eventStatus: event.status,
        category: group.market.label, marketKey: group.market.key, label: `${projection.playerName} ${side === 'over' ? 'O' : 'U'}${group.line}`,
        subject: projection.playerName, propGroup: group.market.group, side: side.toUpperCase(), line: group.line,
        bestBook: group.book, bestOdds: quote.price,
        quotes: [{ book: group.book, odds: quote.price, line: group.line, observedAt: quote.snapshot_time }],
        projectedValue: projection.expectedValue, modelProbability, noVigProbability, edge,
        confidence: classification.confidence, decision: classification.decision,
        reasons: [
          projection.expectedValue !== null ? `Projection ${projection.expectedValue.toFixed(2)} vs line ${group.line}.` : 'Projection unavailable.',
          edge !== null ? `Edge vs ${group.book} no-vig ${(edge * 100).toFixed(1)} pp.` : 'No edge calculation available.',
          ...projection.supportingFeatures.filter((feature) => feature.status !== 'MISSING').slice(0, 2).map((feature) => feature.explanation),
        ],
        risks: [
          'Player prop probability uses the projection engine Poisson baseline and remains shadow-only.',
          projection.lineupStatus && projection.lineupStatus !== 'CONFIRMED' ? `Lineup status: ${projection.lineupStatus}.` : '',
          ...projection.exactBlockerReasons.filter((blocker) => !['NO_SPORTSBOOK_LINE', 'NO_SPORTSBOOK_PRICE', 'NO_EV_CALCULATION', 'NO_OFFICIAL_PICK'].includes(blocker)).slice(0, 2),
        ].filter(Boolean),
        blockers, modelVersion: projection.modelVersion, capturedAt: quote.snapshot_time,
        maxPrice: maxAcceptablePrice(modelProbability), lineupStatus: projection.lineupStatus,
        starterStatus: projection.lineupOrStarterStatus, dataSufficiency: projection.dataSufficiency, featureQuality: projection.featureQuality,
      })
    }
  }

  const consolidated = new Map<string, MlbDecisionItem>()
  for (const item of candidates) {
    const key = [item.eventId, item.marketKey, normalize(item.subject), item.line, item.side].join('|')
    const current = consolidated.get(key)
    if (!current) {
      consolidated.set(key, item)
      continue
    }
    const quotes = [...current.quotes, ...item.quotes]
    const best = bestQuote(quotes)
    const winner = best?.book === item.bestBook ? item : current
    consolidated.set(key, { ...winner, quotes, bestBook: best?.book ?? null, bestOdds: best?.odds ?? null, capturedAt: best?.observedAt ?? winner.capturedAt })
  }
  return {
    items: Array.from(consolidated.values()).sort((a, b) => (b.edge ?? -99) - (a.edge ?? -99)),
    rawRows: latestPropRows.length,
    pairedGroups: Array.from(pairedGroups.values()).filter((group) => group.over && group.under).length,
  }
}

export async function getMlbDecisionBoard(date?: string | null): Promise<MlbDecisionBoardData> {
  const selectedDate = date ?? selectedPuertoRicoDate()
  const generatedAt = nowIso()
  const events = await loadEvents(selectedDate)
  const eventIds = events.map((event) => event.id)

  const [oddsRows, playerEngineRaw, marketInventoryRaw, projectionEngineRaw] = await Promise.all([
    loadOdds(selectedDate, eventIds),
    getMlbPlayerProjectionEngine({ date: selectedDate, persist: false, limit: 200 }).catch(() => ({ mode: 'mlb_player_projection_engine_error', projections: [] })),
    getUniversalMarketInventory().catch(() => ({ mode: 'universal_market_inventory_error', canonicalMarkets: [] })),
    getUniversalProjectionEngine({ sportKey: SPORT_KEY, date: selectedDate, dryRun: true }).catch(() => ({ mode: 'universal_projection_engine_error', projections: [] })),
  ])

  const playerEngine = playerEngineRaw as PlayerEngineResult
  const projectionEngine = projectionEngineRaw as ProjectionEngineResult
  const marketInventory = marketInventoryRaw as Record<string, unknown>
  const markets = buildGameMarketDecisions(events, oddsRows, projectionEngine)
  const propsBuilt = buildPropDecisions(events, oddsRows, playerEngine)
  const props = propsBuilt.items
  const allDecisions = [...props, ...markets]
  const latestOddsAt = oddsRows.map((row) => row.snapshot_time).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
  const coverage = playerEngine.currentSlate?.lineupAndStarterCoverage
  const pregameGames = events.filter((event) => isActiveBettingEvent(event, { sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY })).length
  const blockers = [
    events.length === 0 ? 'NO_MLB_EVENTS_FOR_SELECTED_DATE' : null,
    oddsRows.length === 0 ? 'NO_CURRENT_FANDUEL_OR_CAESARS_ODDS' : null,
    markets.length === 0 ? 'NO_MAPPED_GAME_MARKETS' : null,
    props.length === 0 ? 'NO_PAIRED_PLAYER_PROP_ODDS_MAPPED' : null,
  ].filter(Boolean) as string[]

  return {
    success: events.length > 0,
    mode: 'mlb_decision_board_v1',
    selectedDate,
    generatedAt,
    refreshSeconds: REFRESH_SECONDS,
    productionActivationEnabled: false,
    summary: {
      games: events.length,
      pregameGames,
      decisions: allDecisions.length,
      betCount: allDecisions.filter((item) => item.decision === 'APOSTAR').length,
      leanCount: allDecisions.filter((item) => item.decision === 'LEAN').length,
      noBetCount: allDecisions.filter((item) => item.decision === 'NO_BET').length,
      blockedCount: allDecisions.filter((item) => item.decision === 'BLOCKED').length,
      props: props.length,
      markets: markets.length,
      confirmedLineups: Number(coverage?.confirmedLineups ?? 0),
      expectedLineups: Number(coverage?.expectedLineups ?? 0),
      confirmedStarters: Number(coverage?.confirmedStarters ?? 0),
      latestOddsAt,
      sportsbooks: Array.from(new Set(oddsRows.map((row) => normalizeBook(row.sportsbook)).filter((book): book is 'FanDuel' | 'Caesars' => Boolean(book)))),
    },
    props,
    markets,
    blockers,
    diagnostics: {
      playerProjectionMode: playerEngine.mode ?? null,
      marketInventoryMode: typeof marketInventory.mode === 'string' ? marketInventory.mode : null,
      projectionMode: projectionEngine.mode ?? null,
      rawPropOddsRows: propsBuilt.rawRows,
      mappedPropPairs: propsBuilt.pairedGroups,
      currentMarketRows: oddsRows.length,
      notes: [
        'Read-only MLB Decision Board. No Official Pick writes are performed.',
        'APOSTAR is intentionally disabled while V1 models remain shadow/informational; qualifying edges are capped at LEAN.',
        'Only FanDuel/Caesars rows captured on the selected Puerto Rico date are eligible for display.',
      ],
    },
  }
}
