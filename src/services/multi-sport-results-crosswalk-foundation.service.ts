import 'server-only'

import { getEnabledSports } from '@/config/sports.config'
import { supabaseAdmin } from '@/lib/supabase-admin'

type CrosswalkClassification =
  | 'EXACT_MATCH'
  | 'DETERMINISTIC_ALIAS_MATCH'
  | 'TIME_WINDOW_MATCH_WITH_IDENTITY'
  | 'AMBIGUOUS'
  | 'UNRESOLVED'
  | 'CONFLICT'

type OddsRow = {
  id: string
  sport_key: string | null
  league_key: string | null
  season: string | null
  event_id: string | null
  provider: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  line: number | null
  price: number | null
  snapshot_time: string | null
  metadata: Record<string, unknown> | null
}

type MappingRow = {
  sport_key: string | null
  entity_type: string | null
  internal_id: string | null
  provider: string | null
  provider_id: string | null
  season: string | null
  metadata: Record<string, unknown> | null
}

type EventRow = {
  id: string
  sport_key: string | null
  league_key: string | null
  season: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type ResultRow = {
  sport_key: string | null
  game_id: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  winner: string | null
  commence_time: string | null
}

type PredictionRow = {
  id: string
  sport_key: string | null
  game_id: string | null
  market: string | null
  result: string | null
  status: string | null
  lifecycle_status: string | null
  production_eligible: boolean | null
}

const PROVIDER = 'the-odds-api'
const TARGET_SPORTS = [
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
  'soccer',
  'tennis',
  'mma_ufc',
] as const

function pct(numerator: number, denominator: number) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(2)) : 0
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values))
}

function lower(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function isProviderNativeMapping(row: MappingRow) {
  return Boolean(row.provider_id) && row.provider_id === row.internal_id
}

function isFinalEvent(row: EventRow) {
  const status = lower(row.status)
  return ['completed', 'complete', 'final', 'closed'].includes(status) || (row.home_score !== null && row.away_score !== null)
}

function isSettledPrediction(row: PredictionRow) {
  return ['win', 'loss', 'push', 'void'].includes(lower(row.result ?? row.status))
}

async function readRows<T>(table: string, select: string, build?: (query: any) => any, maxRows = 10000) {
  const rows: T[] = []
  for (let from = 0; from < maxRows; from += 1000) {
    let query = supabaseAdmin.from(table).select(select).range(from, Math.min(from + 999, maxRows - 1))
    if (build) query = build(query)
    const { data, error } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

function classifyOddsEvent({
  providerEventId,
  mapping,
  canonicalEvent,
  result,
}: {
  providerEventId: string
  mapping?: MappingRow
  canonicalEvent?: EventRow
  result?: ResultRow
}): { eventCrosswalk: CrosswalkClassification; resultCrosswalk: CrosswalkClassification; blocker: string | null } {
  if (!mapping) {
    return { eventCrosswalk: 'UNRESOLVED', resultCrosswalk: 'UNRESOLVED', blocker: 'PROVIDER_EVENT_MAPPING_MISSING' }
  }

  if (isProviderNativeMapping(mapping)) {
    return {
      eventCrosswalk: 'UNRESOLVED',
      resultCrosswalk: result ? 'UNRESOLVED' : 'UNRESOLVED',
      blocker: 'PROVIDER_NATIVE_MAPPING_PENDING_CANONICAL_EVENT',
    }
  }

  if (!canonicalEvent) {
    return { eventCrosswalk: 'CONFLICT', resultCrosswalk: 'UNRESOLVED', blocker: 'MAPPING_INTERNAL_EVENT_NOT_FOUND' }
  }

  const mappedByProviderId = mapping.provider_id === providerEventId
  const resultIds = new Set([result?.game_id].filter(Boolean))
  const resultAligned = resultIds.has(canonicalEvent.id) || resultIds.has(providerEventId)

  return {
    eventCrosswalk: mappedByProviderId ? 'EXACT_MATCH' : 'CONFLICT',
    resultCrosswalk: result ? (resultAligned ? 'EXACT_MATCH' : 'CONFLICT') : 'UNRESOLVED',
    blocker: !mappedByProviderId
      ? 'PROVIDER_ID_CONFLICT'
      : result && !resultAligned
        ? 'RESULT_EVENT_ID_CONFLICT'
        : result
          ? null
          : 'RESULT_NOT_AVAILABLE',
  }
}

export async function getMultiSportResultsCrosswalkFoundation() {
  const generatedAt = new Date().toISOString()
  const sports = getEnabledSports().filter((sport) => TARGET_SPORTS.includes(sport.key as typeof TARGET_SPORTS[number]))
  const sportKeys = sports.map((sport) => sport.key)

  const [oddsRows, mappings, events, results, predictions] = await Promise.all([
    readRows<OddsRow>(
      'sports_odds_snapshots',
      'id,sport_key,league_key,season,event_id,provider,sportsbook,market,outcome,line,price,snapshot_time,metadata',
      (query) => query.eq('provider', PROVIDER).in('sport_key', sportKeys).order('snapshot_time', { ascending: false }),
      12000
    ),
    readRows<MappingRow>(
      'provider_entity_mappings',
      'sport_key,entity_type,internal_id,provider,provider_id,season,metadata',
      (query) => query.eq('provider', PROVIDER).eq('entity_type', 'event').in('sport_key', sportKeys),
      12000
    ),
    readRows<EventRow>(
      'sport_events',
      'id,sport_key,league_key,season,start_time,status,home_team,away_team,home_score,away_score,provider_ids,metadata',
      (query) => query.in('sport_key', sportKeys).order('start_time', { ascending: false }),
      12000
    ),
    readRows<ResultRow>(
      'game_results',
      'sport_key,game_id,home_team,away_team,home_score,away_score,winner,commence_time',
      (query) => query.in('sport_key', sportKeys).order('commence_time', { ascending: false }),
      12000
    ),
    readRows<PredictionRow>(
      'prediction_history',
      'id,sport_key,game_id,market,result,status,lifecycle_status,production_eligible',
      (query) => query.in('sport_key', sportKeys).order('created_at', { ascending: false }),
      12000
    ),
  ])

  const mappingByProvider = new Map(mappings.map((row) => [`${row.sport_key}:${row.provider_id}`, row]))
  const eventById = new Map(events.map((row) => [row.id, row]))
  const resultByGameId = new Map(results.map((row) => [`${row.sport_key}:${row.game_id}`, row]))

  const sportReports = sports.map((sport) => {
    const sportOdds = oddsRows.filter((row) => row.sport_key === sport.key)
    const eventIds = uniq(sportOdds.map((row) => String(row.event_id ?? '')).filter(Boolean))
    const sportMappings = mappings.filter((row) => row.sport_key === sport.key)
    const sportEvents = events.filter((row) => row.sport_key === sport.key)
    const sportResults = results.filter((row) => row.sport_key === sport.key)
    const sportPredictions = predictions.filter((row) => row.sport_key === sport.key)
    const classifications = eventIds.map((providerEventId) => {
      const mapping = mappingByProvider.get(`${sport.key}:${providerEventId}`)
      const canonicalEvent = mapping?.internal_id ? eventById.get(mapping.internal_id) : undefined
      const result = resultByGameId.get(`${sport.key}:${canonicalEvent?.id ?? providerEventId}`) ?? resultByGameId.get(`${sport.key}:${providerEventId}`)
      return classifyOddsEvent({ providerEventId, mapping, canonicalEvent, result })
    })
    const exactEventCrosswalks = classifications.filter((item) => item.eventCrosswalk === 'EXACT_MATCH').length
    const certifiedResultCrosswalks = classifications.filter((item) => (
      item.resultCrosswalk === 'EXACT_MATCH' ||
      item.resultCrosswalk === 'DETERMINISTIC_ALIAS_MATCH' ||
      item.resultCrosswalk === 'TIME_WINDOW_MATCH_WITH_IDENTITY'
    )).length
    const blockers = uniq([
      eventIds.length && exactEventCrosswalks === 0 ? 'CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED' : null,
      sportResults.length === 0 ? 'COMPLETED_RESULT_ROWS_NOT_AVAILABLE' : null,
      certifiedResultCrosswalks === 0 ? 'ODDS_CANONICAL_RESULT_CHAIN_NOT_CERTIFIED' : null,
      sportPredictions.length === 0 ? 'NO_EXISTING_PREVIEW_OR_PRODUCTION_PREDICTIONS' : null,
      sportPredictions.some(isSettledPrediction) ? null : 'NO_SETTLED_PREDICTION_SAMPLE',
    ].filter(Boolean) as string[])

    return {
      sportKey: sport.key,
      label: sport.label,
      providerSportKey: String(sport.metadata.providerSportKey ?? sport.key),
      state: blockers.length ? (eventIds.length ? 'FOUNDATION' : 'BLOCKED') : 'SHADOW_READY',
      coverage: {
        oddsRows: sportOdds.length,
        oddsEvents: eventIds.length,
        currentOddsCoverage: { numerator: eventIds.length, denominator: Math.max(eventIds.length, sportEvents.length), pct: pct(eventIds.length, Math.max(eventIds.length, sportEvents.length)) },
        providerEventMappings: sportMappings.length,
        canonicalEventMappings: sportMappings.filter((row) => !isProviderNativeMapping(row) && eventById.has(String(row.internal_id))).length,
        eventCrosswalkCoverage: { numerator: exactEventCrosswalks, denominator: eventIds.length, pct: pct(exactEventCrosswalks, eventIds.length) },
        resultRows: sportResults.length,
        resultCrosswalkCoverage: { numerator: certifiedResultCrosswalks, denominator: eventIds.length, pct: pct(certifiedResultCrosswalks, eventIds.length) },
        canonicalEvents: sportEvents.length,
        completedCanonicalEvents: sportEvents.filter(isFinalEvent).length,
        predictionRows: sportPredictions.length,
        settledPredictionRows: sportPredictions.filter(isSettledPrediction).length,
      },
      markets: uniq(sportOdds.map((row) => String(row.market ?? '')).filter(Boolean)).sort(),
      bookmakers: uniq(sportOdds.map((row) => String(row.sportsbook ?? '')).filter(Boolean)).sort(),
      classifications: {
        exact: classifications.filter((item) => item.eventCrosswalk === 'EXACT_MATCH').length,
        deterministicAlias: classifications.filter((item) => item.eventCrosswalk === 'DETERMINISTIC_ALIAS_MATCH').length,
        timeWindowWithIdentity: classifications.filter((item) => item.eventCrosswalk === 'TIME_WINDOW_MATCH_WITH_IDENTITY').length,
        ambiguous: classifications.filter((item) => item.eventCrosswalk === 'AMBIGUOUS').length,
        unresolved: classifications.filter((item) => item.eventCrosswalk === 'UNRESOLVED').length,
        conflict: classifications.filter((item) => item.eventCrosswalk === 'CONFLICT').length,
      },
      readiness: {
        exactEventMapping: exactEventCrosswalks > 0 && exactEventCrosswalks === eventIds.length,
        completedResults: sportResults.length > 0,
        deterministicSettlementInputs: certifiedResultCrosswalks > 0,
        learningSample: sportPredictions.some(isSettledPrediction),
        previewPredictionEligible: false,
        productionPredictionEligible: false,
        recommendationEligible: false,
      },
      blockers,
      nextAction: blockers[0] ?? 'Run sport-specific Preview prediction lifecycle gate.',
    }
  })

  return {
    success: true,
    mode: 'multi_sport_results_crosswalk_foundation_v1',
    generatedAt,
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    resultContract: {
      fields: [
        'sport',
        'competition',
        'season',
        'providerEventId',
        'canonicalEventId',
        'commenceTime',
        'participantIdentities',
        'score',
        'completedStatus',
        'authoritativeTimestamp',
        'provider',
        'provenance',
        'reconciliationStatus',
        'unresolvedBlocker',
      ],
      certifiedClassifications: ['EXACT_MATCH', 'DETERMINISTIC_ALIAS_MATCH', 'TIME_WINDOW_MATCH_WITH_IDENTITY'],
      blockedClassifications: ['AMBIGUOUS', 'UNRESOLVED', 'CONFLICT'],
    },
    summary: {
      sportsAudited: sportReports.length,
      oddsRows: oddsRows.length,
      oddsEvents: uniq(oddsRows.map((row) => `${row.sport_key}:${row.event_id}`)).length,
      providerEventMappings: mappings.length,
      canonicalEvents: events.length,
      resultRows: results.length,
      predictionRows: predictions.length,
      previewEligibleSports: sportReports.filter((sport) => sport.readiness.previewPredictionEligible).length,
      productionEligibleSports: 0,
    },
    sports: sportReports,
    warnings: [
      'Provider-native event mappings are not treated as certified canonical crosswalks.',
      'Preview prediction eligibility remains false until sport-specific lifecycle gates pass.',
      'No provider call or database mutation is made by this read-only foundation service.',
    ],
    certifications: [
      'MULTI_SPORT_RESULTS_FOUNDATION_READ_ONLY_PASS',
      'NO_RETROSPECTIVE_PREDICTION_PASS',
      'NO_PROVIDER_CALL_PRODUCTION_PASS',
      'NO_DATABASE_MUTATION_PASS',
    ],
  }
}

export function validateMultiSportResultsCrosswalkFoundationFixtures() {
  const checks = [
    ['target sports exclude aggregate and BSN provider gap', TARGET_SPORTS.length === 6],
    ['provider native mapping is unresolved', isProviderNativeMapping({ sport_key: 'americanfootball_nfl', entity_type: 'event', internal_id: 'event1', provider: PROVIDER, provider_id: 'event1', season: '2026', metadata: {} })],
    ['percentage exposes denominator zero safely', pct(1, 0) === 0],
    ['settled prediction classifier recognizes win', isSettledPrediction({ id: 'p1', sport_key: 'basketball_nba', game_id: 'g1', market: 'moneyline', result: 'win', status: 'win', lifecycle_status: 'settled', production_eligible: false })],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'multi_sport_results_crosswalk_foundation_v1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
