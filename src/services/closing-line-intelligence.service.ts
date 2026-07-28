import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { americanToDecimalOdds, marketImpliedProbabilityFromAmerican } from '@/services/market-alignment.service'
import { isProductionEligibleRow } from '@/services/production-data-gate.service'

type PredictionRow = Record<string, unknown>

type OddsSnapshotRow = {
  id: string
  sport_key: string | null
  event_id: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  provider_timestamp?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type EventRow = {
  id: string
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
}

export type ClosingLineFilters = {
  sportKey?: string
  market?: string | null
  sportsbook?: string | null
  limit?: number | null
}

type ClosingLineRecord = {
  predictionId: string
  sportKey: string
  eventId: string
  eventLabel: string
  market: string
  selection: string
  bookmaker: string | null
  predictionTimestamp: string | null
  predictionTimePrice: number | null
  predictionSnapshotId: string | null
  closingCandidateTimestamp: string | null
  closingCandidatePrice: number | null
  closingSnapshotId: string | null
  secondsBeforeStart: number | null
  eventStartTime: string | null
  settlementResult: string | null
  availability:
    | 'CLV_AVAILABLE'
    | 'PREDICTION_PRICE_UNAVAILABLE'
    | 'EVENT_START_UNAVAILABLE'
    | 'CLOSING_CANDIDATE_UNAVAILABLE'
    | 'INVALID_PRICE'
    | 'ALIGNMENT_BLOCKED'
  blocker: string | null
  provenance: {
    sourceTables: string[]
    predictionPriceSource: 'prediction_history' | 'sports_odds_snapshots' | 'unavailable'
    closingCandidateDefinition: string
    postStartPricesExcluded: boolean
    estimatedClosingLineUsed: false
    providerCallsMade: 0
  }
  clv: {
    method: 'decimal_price_ratio_and_implied_probability_change'
    impliedProbabilityChange: number | null
    priceMovementAmerican: number | null
    decimalPriceRatio: number | null
    closingAdvantageStatus: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNAVAILABLE'
    explanation: string
  }
}

function finite(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringValue(row: PredictionRow, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function timestampValue(row: PredictionRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value !== 'string' || !value.trim()) continue
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return value
  }
  return null
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function validAmericanPrice(value: unknown) {
  const price = finite(value)
  if (price === null || price === 0) return null
  if (price < -5000 || price > 5000) return null
  return price
}

function snapshotTimestamp(row: OddsSnapshotRow) {
  return row.snapshot_time ?? row.provider_timestamp ?? row.created_at ?? row.updated_at ?? null
}

function settledResult(row: PredictionRow) {
  const result = normalize(row.result)
  const status = normalize(row.status)
  const lifecycle = normalize(row.lifecycle_status)
  if (['win', 'loss', 'push', 'void'].includes(result)) return result.toUpperCase()
  if (['settled', 'closed'].includes(status) || ['settled', 'closed'].includes(lifecycle)) return 'SETTLED'
  return null
}

function isProductionEvaluable(row: PredictionRow) {
  return isProductionEligibleRow(row) && settledResult(row) !== null
}

function predictionEventId(row: PredictionRow) {
  return stringValue(row, ['game_id', 'event_id'])
}

function predictionSelection(row: PredictionRow) {
  return stringValue(row, ['team', 'selection', 'outcome', 'predicted_outcome'], 'Unknown')
}

function predictionMarket(row: PredictionRow) {
  return stringValue(row, ['market', 'market_type'], 'unknown')
}

function predictionBookmaker(row: PredictionRow) {
  const value = stringValue(row, ['sportsbook', 'bookmaker', 'book'])
  return value || null
}

function predictionTimestamp(row: PredictionRow) {
  return timestampValue(row, ['odds_timestamp', 'generated_at', 'created_at', 'updated_at'])
}

function eventStart(row: PredictionRow, event: EventRow | undefined) {
  return event?.start_time ?? timestampValue(row, ['commence_time', 'game_time', 'start_time'])
}

function eventLabel(row: PredictionRow, event: EventRow | undefined) {
  if (event) return `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`
  const opponent = stringValue(row, ['opponent', 'away_team'])
  const team = predictionSelection(row)
  return opponent ? `${team} vs ${opponent}` : 'Event unavailable'
}

function sameBook(snapshot: OddsSnapshotRow, bookmaker: string | null) {
  if (!bookmaker) return true
  return normalize(snapshot.sportsbook) === normalize(bookmaker)
}

function sameMarket(snapshot: OddsSnapshotRow, market: string) {
  return normalize(snapshot.market) === normalize(market)
}

function sameSelection(snapshot: OddsSnapshotRow, selection: string) {
  return normalize(snapshot.outcome) === normalize(selection)
}

function findPredictionSnapshot({
  prediction,
  snapshots,
}: {
  prediction: PredictionRow
  snapshots: OddsSnapshotRow[]
}) {
  const snapshotId = stringValue(prediction, ['odds_snapshot_id'])
  if (!snapshotId) return null
  return snapshots.find((snapshot) => snapshot.id === snapshotId) ?? null
}

function findClosingCandidate({
  snapshots,
  market,
  selection,
  bookmaker,
  eventStartTime,
}: {
  snapshots: OddsSnapshotRow[]
  market: string
  selection: string
  bookmaker: string | null
  eventStartTime: string
}) {
  const start = Date.parse(eventStartTime)
  if (!Number.isFinite(start)) return null
  return snapshots
    .filter((snapshot) => {
      const timestamp = snapshotTimestamp(snapshot)
      if (!timestamp) return false
      const parsed = Date.parse(timestamp)
      return (
        Number.isFinite(parsed) &&
        parsed < start &&
        sameMarket(snapshot, market) &&
        sameSelection(snapshot, selection) &&
        sameBook(snapshot, bookmaker) &&
        validAmericanPrice(snapshot.price) !== null
      )
    })
    .sort((a, b) => String(snapshotTimestamp(b)).localeCompare(String(snapshotTimestamp(a))))[0] ?? null
}

function calculateClv(predictionPrice: number | null, closingPrice: number | null) {
  if (predictionPrice === null || closingPrice === null) {
    return {
      method: 'decimal_price_ratio_and_implied_probability_change' as const,
      impliedProbabilityChange: null,
      priceMovementAmerican: null,
      decimalPriceRatio: null,
      closingAdvantageStatus: 'UNAVAILABLE' as const,
      explanation: 'CLV is N/A because aligned prediction-time and closing-candidate prices are not both available.',
    }
  }

  const predictionDecimal = americanToDecimalOdds(predictionPrice)
  const closingDecimal = americanToDecimalOdds(closingPrice)
  const predictionImplied = marketImpliedProbabilityFromAmerican(predictionPrice)
  const closingImplied = marketImpliedProbabilityFromAmerican(closingPrice)
  if (predictionDecimal === null || closingDecimal === null || predictionImplied === null || closingImplied === null) {
    return {
      method: 'decimal_price_ratio_and_implied_probability_change' as const,
      impliedProbabilityChange: null,
      priceMovementAmerican: null,
      decimalPriceRatio: null,
      closingAdvantageStatus: 'UNAVAILABLE' as const,
      explanation: 'CLV is N/A because at least one American odds price is invalid.',
    }
  }

  const ratio = round(predictionDecimal / closingDecimal, 4)
  const impliedChange = round(closingImplied - predictionImplied, 2)
  const status: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' =
    ratio > 1.0001 ? 'POSITIVE' : ratio < 0.9999 ? 'NEGATIVE' : 'NEUTRAL'
  return {
    method: 'decimal_price_ratio_and_implied_probability_change' as const,
    impliedProbabilityChange: impliedChange,
    priceMovementAmerican: round(closingPrice - predictionPrice),
    decimalPriceRatio: ratio,
    closingAdvantageStatus: status,
    explanation: 'Positive means the prediction-time decimal price was better than the latest aligned pre-start stored price. It does not guarantee profit.',
  }
}

function buildRecord({
  prediction,
  event,
  snapshots,
}: {
  prediction: PredictionRow
  event: EventRow | undefined
  snapshots: OddsSnapshotRow[]
}): ClosingLineRecord {
  const eventId = predictionEventId(prediction)
  const market = predictionMarket(prediction)
  const selection = predictionSelection(prediction)
  const bookmaker = predictionBookmaker(prediction)
  const generatedAt = predictionTimestamp(prediction)
  const startTime = eventStart(prediction, event)
  const predictionSnapshot = findPredictionSnapshot({ prediction, snapshots })
  const predictionSnapshotPrice = validAmericanPrice(predictionSnapshot?.price)
  const rowPrice = validAmericanPrice(finite(prediction.odds) ?? finite(prediction.current_odds) ?? finite(prediction.book_odds))
  const predictionPrice = predictionSnapshotPrice ?? rowPrice
  const predictionPriceSource = predictionSnapshotPrice !== null ? 'sports_odds_snapshots' : rowPrice !== null ? 'prediction_history' : 'unavailable'

  let candidate: OddsSnapshotRow | null = null
  let blocker: ClosingLineRecord['blocker'] = null
  let availability: ClosingLineRecord['availability'] = 'CLV_AVAILABLE'

  if (predictionPrice === null) {
    availability = 'PREDICTION_PRICE_UNAVAILABLE'
    blocker = 'Prediction-time price is missing or invalid.'
  } else if (!startTime) {
    availability = 'EVENT_START_UNAVAILABLE'
    blocker = 'Event start timestamp is unavailable, so pre-start closing eligibility cannot be proven.'
  } else if (!eventId || !market || selection === 'Unknown') {
    availability = 'ALIGNMENT_BLOCKED'
    blocker = 'Event, market or selection alignment is incomplete.'
  } else {
    candidate = findClosingCandidate({ snapshots, market, selection, bookmaker, eventStartTime: startTime })
    if (!candidate) {
      availability = 'CLOSING_CANDIDATE_UNAVAILABLE'
      blocker = 'No aligned valid stored price exists before event start for the same event, market, selection and bookmaker scope.'
    }
  }

  const closingPrice = validAmericanPrice(candidate?.price)
  if (availability === 'CLV_AVAILABLE' && closingPrice === null) {
    availability = 'INVALID_PRICE'
    blocker = 'Closing candidate price is missing, zero or outside accepted American odds bounds.'
  }

  const candidateTimestamp = candidate ? snapshotTimestamp(candidate) : null
  const secondsBeforeStart =
    candidateTimestamp && startTime
      ? Math.max(0, Math.round((Date.parse(startTime) - Date.parse(candidateTimestamp)) / 1000))
      : null

  return {
    predictionId: stringValue(prediction, ['id']),
    sportKey: stringValue(prediction, ['sport_key'], 'unknown'),
    eventId,
    eventLabel: eventLabel(prediction, event),
    market,
    selection,
    bookmaker,
    predictionTimestamp: generatedAt,
    predictionTimePrice: predictionPrice,
    predictionSnapshotId: predictionSnapshot?.id ?? (stringValue(prediction, ['odds_snapshot_id']) || null),
    closingCandidateTimestamp: candidateTimestamp,
    closingCandidatePrice: closingPrice,
    closingSnapshotId: candidate?.id ?? null,
    secondsBeforeStart,
    eventStartTime: startTime,
    settlementResult: settledResult(prediction),
    availability,
    blocker,
    provenance: {
      sourceTables: ['prediction_history', 'sports_odds_snapshots', 'sport_events'],
      predictionPriceSource,
      closingCandidateDefinition: 'Latest valid aligned stored price before event start for the same event, market, selection and bookmaker scope.',
      postStartPricesExcluded: true,
      estimatedClosingLineUsed: false,
      providerCallsMade: 0,
    },
    clv: calculateClv(availability === 'CLV_AVAILABLE' ? predictionPrice : null, availability === 'CLV_AVAILABLE' ? closingPrice : null),
  }
}

async function loadPredictions(filters: Required<Pick<ClosingLineFilters, 'sportKey'>> & ClosingLineFilters) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, odds_snapshot_id, odds_timestamp, generated_at, created_at, status, lifecycle_status, result, production_eligible, trial, scrambled')
    .eq('production_eligible', true)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(filters.limit ?? 500) || 500, 50), 2000))

  if (filters.sportKey !== 'all') query = query.eq('sport_key', filters.sportKey)
  if (filters.market) query = query.eq('market', filters.market)
  if (filters.sportsbook) query = query.eq('sportsbook', filters.sportsbook)

  const { data, error } = await query
  if (error) throw new Error(`Closing-line prediction read failed: ${error.message}`)
  return ((data ?? []) as PredictionRow[]).filter(isProductionEvaluable)
}

async function loadSnapshots(eventIds: string[], sportKey: string) {
  if (!eventIds.length) return []
  let query = supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, sport_key, event_id, sportsbook, market, outcome, price, line, snapshot_time, provider_timestamp, created_at, updated_at')
    .in('event_id', eventIds.slice(0, 200))
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (sportKey !== 'all') query = query.eq('sport_key', sportKey)
  const { data, error } = await query
  if (error) throw new Error(`Closing-line snapshot read failed: ${error.message}`)
  return (data ?? []) as OddsSnapshotRow[]
}

async function loadEvents(eventIds: string[]) {
  if (!eventIds.length) return new Map<string, EventRow>()
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, home_team, away_team, start_time, status')
    .in('id', eventIds.slice(0, 200))
  if (error) throw new Error(`Closing-line event read failed: ${error.message}`)
  return new Map(((data ?? []) as EventRow[]).map((event) => [event.id, event]))
}

export async function getClosingLineIntelligence(filters: ClosingLineFilters = {}) {
  const sportKey = filters.sportKey ?? 'all'
  const predictions = await loadPredictions({ ...filters, sportKey })
  const eventIds = Array.from(new Set(predictions.map(predictionEventId).filter(Boolean)))
  const [snapshots, events] = await Promise.all([loadSnapshots(eventIds, sportKey), loadEvents(eventIds)])
  const snapshotsByEvent = new Map<string, OddsSnapshotRow[]>()
  for (const snapshot of snapshots) {
    if (!snapshot.event_id) continue
    snapshotsByEvent.set(snapshot.event_id, [...(snapshotsByEvent.get(snapshot.event_id) ?? []), snapshot])
  }

  const records = predictions
    .map((prediction) => buildRecord({
      prediction,
      event: events.get(predictionEventId(prediction)),
      snapshots: snapshotsByEvent.get(predictionEventId(prediction)) ?? [],
    }))
    .sort((a, b) => String(b.closingCandidateTimestamp ?? b.predictionTimestamp ?? '').localeCompare(String(a.closingCandidateTimestamp ?? a.predictionTimestamp ?? '')))

  const available = records.filter((record) => record.availability === 'CLV_AVAILABLE')
  const positive = available.filter((record) => record.clv.closingAdvantageStatus === 'POSITIVE').length
  const negative = available.filter((record) => record.clv.closingAdvantageStatus === 'NEGATIVE').length
  const neutral = available.filter((record) => record.clv.closingAdvantageStatus === 'NEUTRAL').length
  const blockerCounts = records.reduce<Record<string, number>>((acc, record) => {
    if (record.blocker) acc[record.blocker] = (acc[record.blocker] ?? 0) + 1
    return acc
  }, {})
  const status = available.length > 0 ? 'FOUNDATION' : records.length > 0 ? 'BLOCKED' : 'UNAVAILABLE'

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: 'closing_line_intelligence_v1',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    filters: {
      sportKey,
      market: filters.market ?? null,
      sportsbook: filters.sportsbook ?? null,
      limit: Math.min(Math.max(Number(filters.limit ?? 500) || 500, 50), 2000),
    },
    readiness: {
      status,
      eligibleSettledPredictions: records.length,
      predictionTimePriceCoverage: records.filter((record) => record.predictionTimePrice !== null).length,
      closingPriceCoverage: available.length,
      alignedPairCoverage: available.length,
      sampleSizeWarning: available.length < 25 ? 'Closing-line sample is too small for performance conclusions.' : null,
      message:
        available.length > 0
          ? 'Grounded aligned pre-start closing candidates are available for a limited production-evaluable sample.'
          : 'Closing-line coverage is blocked until aligned stored pre-start prices exist for production-evaluable predictions.',
    },
    clvDistribution: {
      samples: available.length,
      positive,
      negative,
      neutral,
      positiveRate: available.length ? round((positive / available.length) * 100) : null,
      averageImpliedProbabilityChange: available.length
        ? round(available.reduce((sum, record) => sum + Number(record.clv.impliedProbabilityChange ?? 0), 0) / available.length)
        : null,
      averageDecimalPriceRatio: available.length
        ? round(available.reduce((sum, record) => sum + Number(record.clv.decimalPriceRatio ?? 0), 0) / available.length, 4)
        : null,
    },
    blockerSummary: Object.entries(blockerCounts).map(([blocker, count]) => ({ blocker, count })),
    dataQuality: {
      level: available.length >= 100 ? 'STRONG' : available.length >= 25 ? 'MODERATE' : records.length > 0 ? 'INSUFFICIENT' : 'INSUFFICIENT',
      totalRecords: records.length,
      settledRecords: records.length,
      recordsWithClosingLine: available.length,
      usesEstimatedClose: false,
      message:
        available.length > 0
          ? 'Grounded pre-start closing candidates were found and used for CLV analysis.'
          : 'No aligned pre-start closing candidate was found. No estimated close is used.',
    },
    summary: {
      samples: available.length,
      averageClv: available.length
        ? round(available.reduce((sum, record) => sum + Number(record.clv.impliedProbabilityChange ?? 0), 0) / available.length)
        : 0,
      positiveClvRate: available.length ? round((positive / available.length) * 100) : 0,
      averageMovementCents: available.length
        ? round(available.reduce((sum, record) => sum + Number(record.clv.priceMovementAmerican ?? 0), 0) / available.length)
        : 0,
      sportsbooksTracked: Array.from(new Set(available.map((record) => record.bookmaker).filter(Boolean))).length,
      currentOpportunities: available.length,
      bestSportsbook: null,
      bestTimingWindow: null,
    },
    sportsbookStats: [],
    timingStats: [],
    opportunities: [],
    method: {
      clvRepresentation: 'decimal_price_ratio_and_implied_probability_change',
      predictionTimePrice: 'Stored prediction price, preferring the linked odds snapshot when available.',
      closingCandidate: 'Latest valid aligned stored price before event start. Post-start prices are excluded.',
      assumptions: ['No provider calls are made.', 'No estimated closing line is used.', 'Positive CLV does not guarantee profit.'],
    },
    records: records.slice(0, 100),
  }
}

function fixturePrediction(overrides: PredictionRow = {}): PredictionRow {
  return {
    id: 'p1',
    sport_key: 'baseball_mlb',
    game_id: 'e1',
    team: 'Yankees',
    market: 'moneyline',
    sportsbook: 'DraftKings',
    odds: -110,
    generated_at: '2026-07-24T17:00:00.000Z',
    commence_time: '2026-07-24T23:00:00.000Z',
    status: 'settled',
    result: 'win',
    production_eligible: true,
    trial: false,
    scrambled: false,
    ...overrides,
  }
}

function fixtureSnapshot(overrides: Partial<OddsSnapshotRow> = {}): OddsSnapshotRow {
  return {
    id: 's1',
    sport_key: 'baseball_mlb',
    event_id: 'e1',
    sportsbook: 'DraftKings',
    market: 'moneyline',
    outcome: 'Yankees',
    price: -130,
    line: null,
    snapshot_time: '2026-07-24T22:55:00.000Z',
    ...overrides,
  }
}

export function validateClosingLineFixtures() {
  const event: EventRow = { id: 'e1', home_team: 'Yankees', away_team: 'Red Sox', start_time: '2026-07-24T23:00:00.000Z', status: 'closed' }
  const valid = buildRecord({ prediction: fixturePrediction(), event, snapshots: [fixtureSnapshot()] })
  const wrongSide = buildRecord({ prediction: fixturePrediction(), event, snapshots: [fixtureSnapshot({ outcome: 'Red Sox' })] })
  const wrongMarket = buildRecord({ prediction: fixturePrediction(), event, snapshots: [fixtureSnapshot({ market: 'spread' })] })
  const postStart = buildRecord({ prediction: fixturePrediction(), event, snapshots: [fixtureSnapshot({ snapshot_time: '2026-07-24T23:01:00.000Z' })] })
  const noPredictionPrice = buildRecord({ prediction: fixturePrediction({ odds: null }), event, snapshots: [fixtureSnapshot()] })
  const noClosing = buildRecord({ prediction: fixturePrediction(), event, snapshots: [] })
  const invalidPrice = buildRecord({ prediction: fixturePrediction(), event, snapshots: [fixtureSnapshot({ price: 0 })] })
  const push = buildRecord({ prediction: fixturePrediction({ result: 'push' }), event, snapshots: [fixtureSnapshot()] })
  const loss = buildRecord({ prediction: fixturePrediction({ result: 'loss' }), event, snapshots: [fixtureSnapshot()] })
  const multiBook = buildRecord({ prediction: fixturePrediction({ sportsbook: null }), event, snapshots: [fixtureSnapshot({ sportsbook: 'BookA', price: -120 }), fixtureSnapshot({ id: 's2', sportsbook: 'BookB', price: -140, snapshot_time: '2026-07-24T22:58:00.000Z' })] })
  const replay = fixturePrediction({ production_eligible: false, trial: true })

  const checks = [
    ['valid prediction and closing pair', valid.availability === 'CLV_AVAILABLE' && valid.clv.closingAdvantageStatus === 'POSITIVE'],
    ['same event wrong side blocked', wrongSide.availability === 'CLOSING_CANDIDATE_UNAVAILABLE'],
    ['same side wrong market blocked', wrongMarket.availability === 'CLOSING_CANDIDATE_UNAVAILABLE'],
    ['post-start snapshot excluded', postStart.availability === 'CLOSING_CANDIDATE_UNAVAILABLE'],
    ['no prediction-time price blocked', noPredictionPrice.availability === 'PREDICTION_PRICE_UNAVAILABLE'],
    ['no closing candidate blocked', noClosing.availability === 'CLOSING_CANDIDATE_UNAVAILABLE'],
    ['zero invalid price blocked', invalidPrice.availability === 'CLOSING_CANDIDATE_UNAVAILABLE'],
    ['push result preserved', push.settlementResult === 'PUSH'],
    ['loss result preserved', loss.settlementResult === 'LOSS'],
    ['multiple bookmakers use latest aligned pre-start candidate', multiBook.closingCandidatePrice === -140],
    ['production vs replay scope excludes replay', isProductionEvaluable(replay) === false],
    ['method disclosure present', valid.clv.method === 'decimal_price_ratio_and_implied_probability_change'],
  ] as const

  return {
    success: checks.every(([, passed]) => passed),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    checks: checks.map(([name, passed]) => ({ name, passed })),
  }
}
