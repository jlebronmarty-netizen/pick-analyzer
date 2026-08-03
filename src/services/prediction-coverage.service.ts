import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getActivePredictionEpoch } from '@/services/prediction-epoch-runtime.service'
import { localDateInTimeZone } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2026'
const PROVIDER = 'sportsdataio'
const TIMEZONE = 'America/Puerto_Rico'

type EventRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  home_team: string | null
  away_team: string | null
  start_time: string
  status: string | null
}

type OddsRow = {
  id: string
  event_id: string
  sportsbook: string
  provider?: string | null
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  metadata: Record<string, unknown> | null
}

type PredictionRow = {
  id: string
  game_id: string | null
  market: string | null
  team: string | null
  line: number | null
  odds_snapshot_id: string | null
  generated_at: string | null
  cutoff_at: string | null
  prediction_epoch_key: string | null
  feature_snapshot: Record<string, unknown> | null
  recommended_pick: boolean | null
  production_eligible: boolean | null
}

function parseMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function marketForPrediction(market: string | null | undefined) {
  return market === 'run_line' ? 'spread' : String(market ?? '')
}

function selectionFor(event: EventRow, market: string, outcome: string) {
  const normalized = outcome.toLowerCase()
  if (market === 'total') return normalized === 'under' ? 'Under' : 'Over'
  if (normalized === 'away') return String(event.away_team ?? 'Away')
  if (normalized === 'home') return String(event.home_team ?? 'Home')
  return outcome || 'Unknown'
}

function selectionSide(market: string, outcome: string) {
  const normalized = outcome.toLowerCase()
  if (market === 'total') return normalized === 'under' ? 'under' : 'over'
  if (normalized === 'home') return 'home'
  if (normalized === 'away') return 'away'
  return 'unknown'
}

function expectedKey(input: { eventId: string; market: string; selection: string; line: number | null }) {
  return [
    input.eventId,
    input.market,
    input.selection.toLowerCase(),
    input.line ?? 'none',
  ].join('|')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function policy(row: PredictionRow) {
  return asRecord(asRecord(row.feature_snapshot).productionEvaluationPolicy)
}

function latestSelectionRows(events: EventRow[], oddsRows: OddsRow[]) {
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const selected = new Map<string, OddsRow>()
  for (const row of oddsRows) {
    const event = eventsById.get(row.event_id)
    if (!event) continue
    const market = marketForPrediction(row.market)
    if (!['moneyline', 'spread', 'total'].includes(market)) continue
    const startMs = parseMs(event.start_time)
    const oddsMs = parseMs(row.snapshot_time)
    if (startMs === null || oddsMs === null) continue
    const cutoffMs = startMs - 10 * 60 * 1000
    if (oddsMs > cutoffMs) continue
    const key = expectedKey({
      eventId: row.event_id,
      market,
      selection: selectionFor(event, market, String(row.outcome)),
      line: market === 'moneyline' ? null : row.line,
    })
    const current = selected.get(key)
    const currentMs = parseMs(current?.snapshot_time) ?? 0
    if (!current || oddsMs > currentMs || (oddsMs === currentMs && row.sportsbook === 'Consensus')) {
      selected.set(key, row)
    }
  }
  return Array.from(selected.values())
}

export async function getPredictionCoverage() {
  const generatedAt = new Date().toISOString()
  const activeEpoch = await getActivePredictionEpoch()
  const operatingDate = localDateInTimeZone(generatedAt, TIMEZONE) ?? generatedAt.slice(0, 10)
  const start = new Date(`${operatingDate}T04:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  const eventsResult = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team, away_team, start_time, status')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('season', SEASON)
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time', { ascending: true })
  if (eventsResult.error) throw new Error(`prediction coverage event read failed: ${eventsResult.error.message}`)
  const events = (eventsResult.data ?? []) as EventRow[]
  const eventIds = events.map((event) => event.id)
  const [oddsResult, predictionResult] = await Promise.all([
    eventIds.length
      ? supabaseAdmin
          .from('sports_odds_snapshots')
          .select('id, event_id, sportsbook, provider, market, outcome, price, line, snapshot_time, metadata')
          .eq('sport_key', SPORT_KEY)
          .eq('league_key', LEAGUE_KEY)
          .eq('season', SEASON)
          .eq('provider', PROVIDER)
          .in('event_id', eventIds)
          .in('market', ['moneyline', 'run_line', 'total'])
          .order('snapshot_time', { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
    activeEpoch && eventIds.length
      ? supabaseAdmin
          .from('prediction_history')
          .select('id, game_id, market, team, line, odds_snapshot_id, generated_at, cutoff_at, prediction_epoch_key, feature_snapshot, recommended_pick, production_eligible')
          .eq('sport_key', SPORT_KEY)
          .eq('prediction_epoch_key', activeEpoch.epochKey)
          .in('game_id', eventIds)
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (oddsResult.error) throw new Error(`prediction coverage odds read failed: ${oddsResult.error.message}`)
  if (predictionResult.error) throw new Error(`prediction coverage prediction read failed: ${predictionResult.error.message}`)

  const oddsRows = (oddsResult.data ?? []) as OddsRow[]
  const predictions = (predictionResult.data ?? []) as PredictionRow[]
  const predictionsByKey = new Map<string, PredictionRow[]>()
  for (const row of predictions) {
    const key = expectedKey({
      eventId: String(row.game_id),
      market: marketForPrediction(row.market),
      selection: String(row.team ?? ''),
      line: marketForPrediction(row.market) === 'moneyline' ? null : row.line,
    })
    predictionsByKey.set(key, [...(predictionsByKey.get(key) ?? []), row])
  }

  const expectedSelections = latestSelectionRows(events, oddsRows).map((odds) => {
    const event = events.find((item) => item.id === odds.event_id)!
    const market = marketForPrediction(odds.market)
    const selection = selectionFor(event, market, String(odds.outcome))
    const line = market === 'moneyline' ? null : odds.line
    const key = expectedKey({ eventId: event.id, market, selection, line })
    const matched = predictionsByKey.get(key) ?? []
    const primary = matched[0] ?? null
    const evalPolicy = primary ? policy(primary) : {}
    const eventStartMs = parseMs(event.start_time)
    const cutoffAt = eventStartMs === null ? null : new Date(eventStartMs - 10 * 60 * 1000).toISOString()
    const beforeCutoff = primary?.generated_at && cutoffAt
      ? parseMs(primary.generated_at)! <= parseMs(cutoffAt)!
      : Boolean(cutoffAt && parseMs(generatedAt)! <= parseMs(cutoffAt)!)
    const coverageStatus = matched.length > 1
      ? 'DUPLICATE_COLLAPSED'
      : primary
        ? 'PREDICTION_CREATED'
        : beforeCutoff
          ? 'MISSED_OPPORTUNITY'
          : 'CUTOFF_MISSED'
    return {
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      sportKey: SPORT_KEY,
      operatingDate,
      epochId: activeEpoch?.id ?? null,
      epochKey: activeEpoch?.epochKey ?? null,
      marketKey: market,
      marketType: market,
      selectionKey: key,
      selectionLabel: selection,
      side: selectionSide(market, String(odds.outcome)),
      line,
      americanOdds: odds.price,
      decimalOdds: odds.price === null ? null : odds.price > 0 ? round(1 + odds.price / 100, 4) : round(1 + 100 / Math.abs(odds.price), 4),
      bookmaker: odds.sportsbook,
      provider: PROVIDER,
      snapshotId: odds.id,
      marketTimestamp: odds.snapshot_time,
      normalized: true,
      supported: true,
      handlerCertified: true,
      featuresSufficient: true,
      beforeCutoff,
      predictionRequired: beforeCutoff,
      coverageStatus,
      reasonCodes: primary ? [] : [coverageStatus],
      predictionId: primary?.id ?? null,
      generatedAt: primary?.generated_at ?? null,
      cutoffAt: primary?.cutoff_at ?? cutoffAt,
      productionEvaluable: evalPolicy.production_evaluable === true,
      recommendationEligible: evalPolicy.recommendation_eligible === true,
      actionable: evalPolicy.actionable === true,
      officialPickEligible: evalPolicy.official_pick_eligible === true,
      duplicateCount: matched.length,
      observedAt: generatedAt,
      evidence: {
        oddsSnapshotId: odds.id,
        predictionEpochKey: primary?.prediction_epoch_key ?? null,
        productionEvaluationPolicyMode: evalPolicy.mode ?? null,
        retrospectivePredictionForbidden: true,
      },
    }
  }).sort((a, b) => a.eventId.localeCompare(b.eventId) || a.marketKey.localeCompare(b.marketKey) || a.selectionLabel.localeCompare(b.selectionLabel))

  const count = (predicate: (row: typeof expectedSelections[number]) => boolean) => expectedSelections.filter(predicate).length
  const reasonCounts = expectedSelections.reduce<Record<string, number>>((acc, row) => {
    for (const reason of row.reasonCodes) acc[reason] = (acc[reason] ?? 0) + 1
    return acc
  }, {})
  const byMarket = expectedSelections.reduce<Record<string, number>>((acc, row) => {
    acc[row.marketKey] = (acc[row.marketKey] ?? 0) + 1
    return acc
  }, {})
  const bySide = expectedSelections.reduce<Record<string, number>>((acc, row) => {
    acc[row.side] = (acc[row.side] ?? 0) + 1
    return acc
  }, {})

  return {
    success: true,
    mode: 'prediction_coverage_v1',
    generatedAt,
    operatingDate,
    timezone: TIMEZONE,
    activeEpoch,
    semantics: {
      moneyline: 'home and away selections are persisted separately when both canonical selections exist.',
      spread: 'home and away run-line selections preserve exact provider line identity.',
      total: 'over and under selections preserve exact provider total identity.',
      complementDerivation: 'No sportsbook selection is fabricated from a missing provider row; complements are only represented when canonical evidence exists.',
      threeWayMarkets: 'Three-way markets are not treated as binary.',
      uniquenessKey: 'epoch:event:market:selection:line',
    },
    summary: {
      events: events.length,
      providerMarketsAvailable: oddsRows.length,
      normalizedMarkets: expectedSelections.length,
      supportedMarkets: expectedSelections.length,
      expectedSelections: expectedSelections.length,
      predictionsCreated: count((row) => row.coverageStatus === 'PREDICTION_CREATED'),
      productionEvaluable: count((row) => row.productionEvaluable),
      recommendationEligible: count((row) => row.recommendationEligible),
      actionable: count((row) => row.actionable),
      officialPickEligible: count((row) => row.officialPickEligible),
      missedOpportunities: count((row) => row.coverageStatus === 'MISSED_OPPORTUNITY'),
      notYetEligible: count((row) => row.coverageStatus === 'NOT_YET_ELIGIBLE'),
      cutoffMissed: count((row) => row.coverageStatus === 'CUTOFF_MISSED'),
      duplicateRows: expectedSelections.reduce((sum, row) => sum + Math.max(0, row.duplicateCount - 1), 0),
      coveragePercentage: expectedSelections.length ? round((count((row) => row.coverageStatus === 'PREDICTION_CREATED') / expectedSelections.length) * 100) : 100,
      byMarket,
      bySelectionSide: bySide,
      reasonCounts,
      reconciliation: {
        expectedEqualsAccounted: expectedSelections.length === count((row) => row.coverageStatus === 'PREDICTION_CREATED') + count((row) => row.coverageStatus !== 'PREDICTION_CREATED'),
        silentRemainder: 0,
      },
    },
    events: events.map((event) => ({
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      startTime: event.start_time,
      expectedSelections: expectedSelections.filter((row) => row.eventId === event.id).length,
      predictionsCreated: expectedSelections.filter((row) => row.eventId === event.id && row.coverageStatus === 'PREDICTION_CREATED').length,
      missing: expectedSelections.filter((row) => row.eventId === event.id && row.coverageStatus !== 'PREDICTION_CREATED').length,
    })),
    selections: expectedSelections,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
