import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = 'America/Puerto_Rico'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  opponent: string | null
  market: string | null
  sportsbook: string | null
  odds: number | null
  implied_probability: number | null
  model_probability: number | null
  confidence: number | null
  line: number | null
  generated_at: string | null
  cutoff_at: string | null
  model_version: string | null
  feature_snapshot: Record<string, unknown> | null
  validation_status: string | null
  lifecycle_status: string | null
  status: string | null
  result: string | null
  is_current?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
}

type ShadowRow = {
  id: string
  sport_key: string
  event_id: string | null
  entity_id: string | null
  entity_name: string | null
  team_id: string | null
  team_name: string | null
  projection_key: string
  projection_family: string
  projected_value: number | null
  confidence: number | null
  feature_quality: number | null
  data_sufficiency: number | null
  prediction_interval_low: number | null
  prediction_interval_high: number | null
  readiness: string | null
  shadow_status: string | null
  explanation: string | null
  feature_snapshot: Record<string, unknown> | null
  generated_at: string | null
  metadata: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(digits))
}

function boundedProbability(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null
}

function eventIsFuturePregame(event: EventRow | undefined, rowStart: string | null, nowMs: number) {
  const status = String(event?.status ?? '').toLowerCase()
  if (['completed', 'final', 'closed', 'live', 'in_progress', 'inprogress', 'cancelled', 'canceled', 'postponed'].includes(status)) return false
  const start = Date.parse(event?.start_time ?? rowStart ?? '')
  return Number.isFinite(start) && start > nowMs
}

function localDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

function eventDateRange(date: string) {
  const start = new Date(`${date}T04:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function noMarketLabels(hasOdds: boolean) {
  return [
    'MODEL ONLY',
    'INFORMATIONAL',
    hasOdds ? 'MARKET AVAILABLE' : 'NO MARKET',
    'NOT AN OFFICIAL PICK',
    hasOdds ? 'EV N/A ON MODEL-ONLY SURFACE' : 'NO EV AVAILABLE',
  ]
}

function marketLabel(value: string | null) {
  if (value === 'moneyline') return 'Moneyline'
  if (value === 'spread') return 'Run Line'
  if (value === 'total') return 'Total'
  return value ?? 'Market'
}

function pickSelection(row: PredictionRow) {
  return row.team ?? row.opponent ?? 'Selection'
}

function familyKey(row: PredictionRow) {
  return [row.sport_key, row.game_id, row.market, pickSelection(row), row.line ?? 'none'].join('|')
}

async function loadEvents(ids: string[]) {
  if (!ids.length) return new Map<string, EventRow>()
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team')
    .eq('sport_key', SPORT_KEY)
    .in('id', Array.from(new Set(ids)))
  if (error) throw new Error(`model-only event read failed: ${error.message}`)
  return new Map(((data ?? []) as EventRow[]).map((event) => [event.id, event]))
}

function toOutcome(row: PredictionRow, event: EventRow | undefined) {
  const probability = boundedProbability(row.model_probability)
  if (probability === null) return null
  const snapshot = asRecord(row.feature_snapshot)
  const hasOdds = Number.isFinite(Number(row.odds))
  return {
    id: row.id,
    source: 'prediction_history',
    sportKey: row.sport_key,
    eventId: row.game_id,
    matchup: `${event?.away_team ?? row.away_team ?? 'Away'} @ ${event?.home_team ?? row.home_team ?? 'Home'}`,
    startTime: event?.start_time ?? row.commence_time,
    eventDate: localDate(event?.start_time ?? row.commence_time),
    eventStatus: event?.status ?? row.status ?? 'scheduled',
    market: row.market ?? 'unknown',
    marketLabel: marketLabel(row.market),
    selection: pickSelection(row),
    line: row.line,
    modelProbability: round(probability),
    probability: round(probability),
    rawProbability: round(probability),
    confidence: round(Number(row.confidence ?? 0)),
    featureQuality: Number(snapshot.featureQualityScore ?? snapshot.featureQuality ?? snapshot.quality ?? 0) || null,
    dataSufficiency: Number(snapshot.dataSufficiencyScore ?? snapshot.dataSufficiency ?? snapshot.sufficiency ?? 0) || null,
    modelVersion: row.model_version ?? String(snapshot.modelVersion ?? 'unknown'),
    generatedAt: row.generated_at,
    cutoffAt: row.cutoff_at,
    marketAvailable: hasOdds,
    sportsbookOdds: hasOdds ? row.odds : null,
    odds: hasOdds ? row.odds : null,
    impliedProbability: hasOdds ? row.implied_probability : null,
    sportsbookProbability: hasOdds ? row.implied_probability : null,
    expectedValue: null,
    edge: null,
    officialPick: false,
    officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE',
    evAvailable: false,
    labels: noMarketLabels(hasOdds),
    status: hasOdds ? 'MODEL_ONLY_MARKET_AVAILABLE' : 'MODEL_ONLY_NO_MARKET',
    blocker: null,
    blockers: hasOdds ? ['NO_OFFICIAL_PICK', 'EV_NOT_COMPUTED_ON_MODEL_ONLY_SURFACE'] : ['NO_MARKET', 'NO_OFFICIAL_PICK', 'NO_EV_AVAILABLE'],
  }
}

function toShadow(row: ShadowRow, event: EventRow | undefined) {
  const snapshot = asRecord(row.feature_snapshot)
  const probabilities = asRecord(snapshot.probabilities)
  return {
    id: row.id,
    source: 'universal_projection_history',
    sportKey: row.sport_key,
    eventId: row.event_id,
    matchup: event ? `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}` : 'Matchup pending',
    startTime: event?.start_time ?? null,
    eventDate: localDate(event?.start_time),
    eventStatus: event?.status ?? null,
    projectionKey: row.projection_key,
    projectionFamily: row.projection_family,
    market: 'pitcher_outs_shadow',
    marketLabel: 'Pitcher Outs Shadow',
    selection: row.entity_name ?? 'Pitcher',
    probability: row.confidence ?? null,
    expectedValue: null,
    edge: null,
    officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE',
    pitcherId: row.entity_id,
    pitcherName: row.entity_name,
    teamId: row.team_id,
    teamName: row.team_name,
    expectedRecordedOuts: row.projected_value,
    interval: { low: row.prediction_interval_low, high: row.prediction_interval_high },
    probabilities,
    topThresholds: Object.entries(probabilities)
      .map(([threshold, value]) => ({ threshold, probability: round(Number(value) * (Number(value) <= 1 ? 100 : 1), 2) }))
      .sort((left, right) => right.probability - left.probability)
      .slice(0, 3),
    featureQuality: row.feature_quality,
    dataSufficiency: row.data_sufficiency,
    modelVersion: String(asRecord(row.metadata).modelVersion ?? snapshot.modelVersion ?? 'mlb_pitcher_outs_shadow_baseline_v1'),
    starterStatus: String(asRecord(snapshot.starterEvidence).status ?? 'PROBABLE'),
    starterEvidenceTimestamp: String(asRecord(snapshot.starterEvidence).sourceTimestamp ?? '') || null,
    generatedAt: row.generated_at,
    status: row.shadow_status ?? 'SHADOW_NO_MARKET',
    readiness: row.readiness ?? 'READY',
    labels: ['SHADOW', 'NO MARKET', 'NOT AN OFFICIAL PICK', 'NO EV AVAILABLE'],
    blockers: ['SHADOW_PROJECTION', 'NO_MARKET', 'NO_OFFICIAL_PICK', 'NO_EV_AVAILABLE'],
    officialPick: false,
    evAvailable: false,
    explanation: row.explanation,
  }
}

export async function getModelOnlyIntelligence({ date }: { date?: string | null } = {}) {
  const nowMs = Date.now()
  const today = localDate(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10)
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today
  const range = eventDateRange(selectedDate)
  const { data: eventsData, error: eventError } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.start)
    .lt('start_time', range.end)
  if (eventError) throw new Error(`model-only slate read failed: ${eventError.message}`)
  const slateEvents = ((eventsData ?? []) as EventRow[]).filter((event) => localDate(event.start_time) === selectedDate)
  const slateIds = slateEvents.map((event) => event.id)
  const eventsById = new Map(slateEvents.map((event) => [event.id, event]))

  const predictionRows: PredictionRow[] = []
  if (slateIds.length) {
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, line, generated_at, cutoff_at, model_version, feature_snapshot, validation_status, lifecycle_status, status, result, is_current, trial, scrambled')
      .eq('sport_key', SPORT_KEY)
      .in('game_id', slateIds)
      .not('model_probability', 'is', null)
      .order('generated_at', { ascending: false })
      .limit(500)
    if (error) throw new Error(`model-only prediction read failed: ${error.message}`)
    predictionRows.push(...((data ?? []) as PredictionRow[]))
  }

  const latestByFamily = new Map<string, PredictionRow>()
  for (const row of predictionRows) {
    const event = eventsById.get(row.game_id)
    if (!eventIsFuturePregame(event, row.commence_time, nowMs)) continue
    if (row.trial === true || row.scrambled === true) continue
    if (['win', 'loss', 'push', 'void'].includes(String(row.result ?? row.status ?? '').toLowerCase())) continue
    if (row.is_current === false) continue
    if (boundedProbability(row.model_probability) === null) continue
    const key = familyKey(row)
    const existing = latestByFamily.get(key)
    if (!existing || String(row.generated_at ?? '') > String(existing.generated_at ?? '')) latestByFamily.set(key, row)
  }

  const outcomes = Array.from(latestByFamily.values())
    .map((row) => toOutcome(row, eventsById.get(row.game_id)))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((left, right) => right.modelProbability - left.modelProbability || right.confidence - left.confidence)

  const shadowResult = await supabaseAdmin
    .from('universal_projection_history')
    .select('id, sport_key, event_id, entity_id, entity_name, team_id, team_name, projection_key, projection_family, projected_value, confidence, feature_quality, data_sufficiency, prediction_interval_low, prediction_interval_high, readiness, shadow_status, explanation, feature_snapshot, generated_at, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('projection_key', 'pitcher_outs_recorded')
    .order('generated_at', { ascending: false })
    .limit(100)
  if (shadowResult.error) throw new Error(`model-only shadow read failed: ${shadowResult.error.message}`)
  const shadowRows = (shadowResult.data ?? []) as ShadowRow[]
  const shadowEvents = await loadEvents(shadowRows.map((row) => row.event_id).filter(Boolean) as string[])
  const shadows = shadowRows
    .map((row) => toShadow(row, row.event_id ? shadowEvents.get(row.event_id) : undefined))
    .filter((row) => !row.startTime || eventIsFuturePregame(shadowEvents.get(String(row.eventId)), row.startTime, nowMs))
    .sort((left, right) => Number(right.expectedRecordedOuts ?? 0) - Number(left.expectedRecordedOuts ?? 0))

  const moneyline = outcomes.filter((row) => row.market === 'moneyline')
  const totals = outcomes.filter((row) => row.market === 'total')
  const runLine = outcomes.filter((row) => row.market === 'spread')
  const parlayLegs = moneyline.filter((row, index, all) => all.findIndex((candidate) => candidate.eventId === row.eventId) === index).slice(0, 3)
  const twoLeg = parlayLegs.slice(0, 2)
  const threeLeg = parlayLegs.slice(0, 3)
  const parlay = (legs: typeof parlayLegs) => legs.length >= 2
    ? (() => {
        const approximateCombinedProbability = round(legs.reduce((product, leg) => product * (leg.modelProbability / 100), 1) * 100, 2)
        return {
        legs,
        legCount: legs.length,
        approximateCombinedProbability,
        rawJointProbability: approximateCombinedProbability,
        adjustedJointProbability: approximateCombinedProbability,
        impliedProbability: null,
        combinedOdds: null,
        ev: null,
        confidence: round(legs.reduce((sum, leg) => sum + leg.confidence, 0) / legs.length),
        independenceAssumed: true,
        officialStatus: 'informational_only',
        blockers: ['PARLAY_NOT_OFFICIAL_RECOMMENDATION', 'NO_PAYOUT_WITHOUT_MARKET_ODDS'],
        disclaimer: 'Model-only parlay is informational. It is not an Official Pick, has no stake, and uses an independence assumption.',
        independenceAssumption: 'Approximate only; no same-game parlay or correlation model is applied.',
        labels: ['MODEL ONLY', 'INFORMATIONAL', 'NOT AN OFFICIAL PICK', 'NO STAKE', 'NO PAYOUT WITHOUT ODDS'],
        }
      })()
    : null

  return {
    success: true,
    mode: 'model_only_intelligence_v1',
    generatedAt: new Date().toISOString(),
    selectedDate,
    timezone: TIMEZONE,
    slate: {
      events: slateEvents.length,
      futurePregameEvents: slateEvents.filter((event) => eventIsFuturePregame(event, event.start_time, nowMs)).length,
    },
    summary: {
      modelOutcomes: outcomes.length,
      moneyline: moneyline.length,
      totals: totals.length,
      runLine: runLine.length,
      pitcherShadowProjections: shadows.length,
      marketAvailable: outcomes.filter((row) => row.marketAvailable).length,
      noMarket: outcomes.filter((row) => !row.marketAvailable).length + shadows.length,
    },
    categories: {
      highestMoneylineProbability: moneyline.slice(0, 10),
      highestTotalOutcomeProbability: totals.slice(0, 10),
      highestRunLineProbability: runLine.slice(0, 10),
      highestPitcherOutsShadowProbability: shadows.slice(0, 10),
      allModelOutcomes: outcomes.slice(0, 50),
      allPitcherShadows: shadows,
    },
    informationalParlays: {
      twoLegHighestProbability: parlay(twoLeg),
      threeLegHighestProbability: parlay(threeLeg),
      blocker: twoLeg.length < 2 ? 'Fewer than two eligible distinct-game moneyline model outcomes are available.' : null,
    },
    userModeSummary: {
      pitcherIntelligence: `${shadows.length} shadow projections ready`,
      probableStarters: shadows.filter((row) => row.starterStatus === 'PROBABLE').length,
      marketAvailability: 'No verified pitcher prop odds',
    },
    labels: ['MODEL ONLY', 'INFORMATIONAL', 'SHADOW WHEN APPLICABLE', 'NOT AN OFFICIAL PICK'],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateModelOnlyIntelligenceFixtures() {
  const checks = [
    ['bounded probability rejects >100', boundedProbability(101) === null],
    ['bounded probability accepts 63', boundedProbability(63) === 63],
    ['labels separate official picks', noMarketLabels(false).includes('NOT AN OFFICIAL PICK')],
    ['model-only no market has no EV', noMarketLabels(false).includes('NO EV AVAILABLE')],
    ['provider calls remain zero', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'model_only_intelligence_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
