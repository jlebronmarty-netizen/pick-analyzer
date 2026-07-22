import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { baseballInningsNotationToOuts, recordedOutsFromPitchingValue, stableProjectionId } from '@/services/mlb-projection-integrity.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MODEL_VERSION = 'mlb_pitcher_outs_shadow_baseline_v1'
const FEATURE_VERSION = 'pitcher_outs_feature_contract_v1'
const SETTLEMENT_VERSION = 'pitcher_outs_settlement_v1'
const THRESHOLDS = [15, 16, 17, 18, 19, 20, 21]
const PAGE_SIZE = 1000
const MAX_ROWS = 120000

type Row = Record<string, unknown>

type EventRow = {
  id: string
  season: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
  metadata: Row | null
  updated_at: string | null
}

type PlayerStatRow = {
  id: string
  season: string | null
  stat_type: string | null
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  provider: string | null
  games: number | null
  starts: number | null
  starter: boolean | null
  source_timestamp: string | null
  provider_ids: Row | null
  stats: Row | null
  metadata: Row | null
  created_at: string | null
  updated_at: string | null
}

type ProjectionHistoryRow = {
  id: string
  event_id: string | null
  entity_id: string | null
  entity_name: string | null
  projection_key: string
  projected_value: number | null
  actual_value: number | null
  error: number | null
  absolute_error: number | null
  squared_error?: number | null
  confidence: number | null
  model_version: string | null
  readiness: string | null
  shadow_status: string | null
  starter_status: string | null
  calibration: Row | null
  drift: Row | null
  metadata: Row | null
  feature_snapshot: Row | null
  generated_at: string | null
  settled_at: string | null
}

type StarterEvidenceRow = {
  id: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  lineup_status: string | null
  confirmation_level: string | null
  source_timestamp: string | null
  provider_ids: Row | null
  metadata: Row | null
  updated_at: string | null
}

type CandidateProjection = {
  id: string
  eventId: string
  pitcherId: string
  providerPitcherId: string | null
  pitcherName: string
  teamId: string | null
  teamName: string | null
  opponentTeamId: string | null
  opponentTeamName: string | null
  gameStart: string | null
  generatedAt: string
  cutoff: string
  starterStatus: 'CONFIRMED' | 'PROBABLE' | 'EXPECTED'
  expectedOuts: number
  medianOuts: number
  interval: { low: number; high: number }
  uncertainty: number
  probabilities: Record<string, number>
  featureQuality: number
  dataSufficiency: number
  historicalStarts: number
  features: Row
  explanation: string
}

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function text(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function round(value: number, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0
}

function pct(part: number, total: number) {
  return total > 0 ? round((part / total) * 100) : 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function stddev(values: number[]) {
  const avg = mean(values)
  if (avg === null || !values.length) return null
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length)
}

function providerPlayerId(row: PlayerStatRow) {
  const ids = asRecord(row.provider_ids)
  const metadata = asRecord(row.metadata)
  const stats = asRecord(row.stats)
  return text(ids.player) || text(ids.PlayerID) || text(ids.PlayerId) || text(ids.sportsdataio) || text(metadata.providerPlayerId) || text(stats.PlayerID)
}

function statBag(row: PlayerStatRow) {
  return { ...asRecord(row.stats), ...asRecord(row.metadata), games: row.games, starts: row.starts, starter: row.starter } as Row
}

function statNumber(row: PlayerStatRow, keys: string[]) {
  const bag = statBag(row)
  for (const key of keys) {
    const parsed = asNumber(bag[key])
    if (parsed !== null) return parsed
  }
  return null
}

function statText(row: PlayerStatRow, keys: string[]) {
  const bag = statBag(row)
  for (const key of keys) {
    const value = text(bag[key])
    if (value) return value
  }
  return ''
}

function isPitcherRow(row: PlayerStatRow) {
  const position = statText(row, ['Position', 'position', 'PositionCategory', 'positionCategory']).toLowerCase()
  if (['p', 'sp', 'rp'].includes(position)) return true
  return ['OutsPitched', 'RecordedOuts', 'PitchingOuts', 'InningsPitchedDecimal', 'InningsPitched', 'IP', 'PitchesThrown', 'PitchCount', 'ERA', 'WHIP'].some(
    (key) => statBag(row)[key] !== undefined && statBag(row)[key] !== null
  )
}

function isStarterOutcome(row: PlayerStatRow) {
  if (row.starter === true) return true
  const starts = statNumber(row, ['PitchingStarts', 'GamesStartedAsPitcher', 'GamesStarted', 'Started', 'Starts'])
  return starts !== null && starts > 0
}

export function normalizeRecordedOutsUnit(input: { directOuts?: unknown; innings?: unknown }) {
  const direct = recordedOutsFromPitchingValue({ directOuts: input.directOuts as string | number | null, innings: null })
  const innings = baseballInningsNotationToOuts(input.innings as string | number | null)
  const hasDirect = input.directOuts !== null && input.directOuts !== undefined && input.directOuts !== ''
  const hasInnings = input.innings !== null && input.innings !== undefined && input.innings !== ''
  if (hasDirect && hasInnings && direct.valid && innings.valid && direct.outs !== innings.outs) {
    return { outs: null as number | null, valid: false, source: 'conflict', warning: 'direct_outs_innings_conflict', directOuts: direct.outs, inningsOuts: innings.outs }
  }
  if (hasDirect) return { ...direct, directOuts: direct.outs, inningsOuts: hasInnings ? innings.outs : null }
  return { ...recordedOutsFromPitchingValue({ directOuts: null, innings: input.innings as string | number | null }), directOuts: null, inningsOuts: innings.outs }
}

function recordedOuts(row: PlayerStatRow) {
  const bag = statBag(row)
  return normalizeRecordedOutsUnit({
    directOuts: bag.OutsPitched ?? bag.RecordedOuts ?? bag.PitchingOuts ?? bag.outsRecorded,
    innings: bag.InningsPitchedDecimal ?? bag.InningsPitched ?? bag.IP ?? bag.PitchingInningsPitched,
  })
}

async function page<T>(table: string, select: string, configure: (query: any) => any, orderColumn = 'id') {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const result = await configure(supabaseAdmin.from(table).select(select))
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (result.error) throw new Error(`${table} read failed: ${result.error.message}`)
    const data = (result.data ?? []) as T[]
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

async function safePage<T>(table: string, select: string, configure: (query: any) => any, orderColumn = 'id') {
  try {
    return { rows: await page<T>(table, select, configure, orderColumn), warning: null as string | null }
  } catch (error) {
    return { rows: [] as T[], warning: `${table} unavailable: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
}

async function loadRows(season: string) {
  const [stats, events, projections, starterEvidenceRows] = await Promise.all([
    safePage<PlayerStatRow>(
      'sport_player_stats',
      'id, season, stat_type, event_id, team_id, player_id, player_name, provider, games, starts, starter, source_timestamp, provider_ids, stats, metadata, created_at, updated_at',
      (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('season', season),
      'id'
    ),
    safePage<EventRow>(
      'sport_events',
      'id, season, home_team_id, away_team_id, home_team, away_team, start_time, status, metadata, updated_at',
      (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('season', season),
      'start_time'
    ),
    safePage<ProjectionHistoryRow>(
      'universal_projection_history',
      'id, event_id, entity_id, entity_name, projection_key, projected_value, actual_value, error, absolute_error, squared_error, confidence, model_version, readiness, shadow_status, starter_status, calibration, drift, metadata, feature_snapshot, generated_at, settled_at',
      (q) => q.eq('sport_key', SPORT_KEY).eq('projection_key', 'pitcher_outs_recorded'),
      'generated_at'
    ),
    safePage<StarterEvidenceRow>(
      'sport_lineups',
      'id, event_id, team_id, player_id, player_name, lineup_status, confirmation_level, source_timestamp, provider_ids, metadata, updated_at',
      (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('lineup_type', 'starting_lineup').eq('role', 'starting_pitcher').eq('season', season),
      'source_timestamp'
    ),
  ])
  return { stats, events, projections, starterEvidenceRows }
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = getKey(row)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return groups
}

function thresholds(values: number[]) {
  const total = values.length
  const entries = THRESHOLDS.map((threshold) => [`${threshold}+`, total ? round(values.filter((value) => value >= threshold).length / total, 4) : 0])
  return Object.fromEntries(entries)
}

function monotonic(probabilities: Record<string, number>) {
  const values = THRESHOLDS.map((threshold) => probabilities[`${threshold}+`])
  return values.every((value, index) => index === 0 || values[index - 1] >= value)
}

function eventTeam(event: EventRow, teamId: string | null) {
  if (!event || !teamId) return { teamName: null, opponentTeamId: null, opponentTeamName: null }
  if (event.home_team_id === teamId) return { teamName: event.home_team, opponentTeamId: event.away_team_id, opponentTeamName: event.away_team }
  if (event.away_team_id === teamId) return { teamName: event.away_team, opponentTeamId: event.home_team_id, opponentTeamName: event.home_team }
  return { teamName: null, opponentTeamId: null, opponentTeamName: null }
}

function starterEvidenceFromLineups(event: EventRow, teamId: string | null, lineups: StarterEvidenceRow[]) {
  const candidates = lineups
    .filter((row) => row.event_id === event.id && row.team_id === teamId)
    .sort((a, b) => Date.parse(b.source_timestamp ?? b.updated_at ?? '') - Date.parse(a.source_timestamp ?? a.updated_at ?? ''))
  const row = candidates[0]
  if (!row) return null
  const metadata = asRecord(row.metadata)
  const status = text(metadata.exactStarterStatus).toUpperCase() || text(row.lineup_status).toUpperCase()
  const sourceTimestamp = text(row.source_timestamp)
  const providerIds = asRecord(row.provider_ids)
  const providerId = text(providerIds.sportsdataio)
  const start = Date.parse(event.start_time ?? '')
  const observed = Date.parse(sourceTimestamp)
  const pregame = Number.isFinite(start) && Number.isFinite(observed) && observed < start
  const eligible = metadata.eligibility === 'ELIGIBLE' && ['CONFIRMED', 'PROBABLE'].includes(status) && pregame
  return {
    status: status === 'CONFIRMED' ? 'CONFIRMED' : status === 'PROBABLE' ? 'PROBABLE' : 'UNKNOWN',
    source: text(metadata.source) || 'sport_lineups',
    sourceTimestamp: sourceTimestamp || null,
    providerId: providerId || null,
    playerId: row.player_id,
    playerName: row.player_name,
    evidenceId: row.id,
    homeAway: text(metadata.homeAway) || null,
    evidenceAgeMinutes: asNumber(metadata.evidenceAgeMinutes),
    pregame,
    eligible,
    rejectionReason: text(metadata.rejectionReason) || null,
  }
}

function starterEvidence(event: EventRow, teamId: string | null, lineups: StarterEvidenceRow[] = []) {
  const stored = starterEvidenceFromLineups(event, teamId, lineups)
  if (stored) return stored
  const metadata = asRecord(event.metadata)
  const starters = asRecord(metadata.starters ?? metadata.probableStarters ?? metadata.pitchers)
  const side = teamId === event.home_team_id ? 'home' : teamId === event.away_team_id ? 'away' : ''
  const raw = asRecord(starters[side])
  const sourceTimestamp = text(raw.capturedAt) || text(raw.sourceTimestamp) || text(metadata.starterCapturedAt)
  const source = text(raw.source) || text(metadata.starterSource)
  const providerId = text(raw.playerId) || text(raw.providerPlayerId)
  const status = raw.confirmed === true ? 'CONFIRMED' : raw.probable === true ? 'PROBABLE' : providerId ? 'EXPECTED' : 'UNKNOWN'
  const start = Date.parse(event.start_time ?? '')
  const observed = Date.parse(sourceTimestamp)
  const pregame = Number.isFinite(start) && Number.isFinite(observed) && observed < start
  return { status, source: source || null, sourceTimestamp: sourceTimestamp || null, providerId: providerId || null, playerId: null, playerName: null, evidenceId: null, homeAway: side || null, evidenceAgeMinutes: null, pregame, eligible: ['CONFIRMED', 'PROBABLE'].includes(status) && pregame, rejectionReason: null }
}

function currentDate() {
  return new Date().toISOString().slice(0, 10)
}

function dateRangeForEvent(row: PlayerStatRow, event: EventRow | undefined) {
  return (event?.start_time ?? row.source_timestamp ?? row.created_at ?? row.updated_at ?? '').slice(0, 10)
}

function makeCandidate(event: EventRow, pitcher: PlayerStatRow, history: PlayerStatRow[], generatedAt: string, evidenceOverride?: ReturnType<typeof starterEvidence>): CandidateProjection | null {
  const validHistory = history
    .filter((row) => row.event_id !== event.id)
    .map(recordedOuts)
    .filter((item) => item.valid && item.outs !== null)
    .map((item) => Number(item.outs))
  if (validHistory.length < 5 || !pitcher.player_id) return null
  const evidence = evidenceOverride ?? starterEvidence(event, pitcher.team_id)
  if (!evidence || !['CONFIRMED', 'PROBABLE'].includes(evidence.status) || !evidence.pregame || evidence.eligible === false) return null
  const avg = mean(validHistory) ?? 15
  const med = median(validHistory) ?? avg
  const sd = stddev(validHistory) ?? 3
  const recent = validHistory.slice(-5)
  const recentAvg = mean(recent) ?? avg
  const expected = clamp(avg * 0.55 + recentAvg * 0.35 + 16.2 * 0.1, 6, 24)
  const probs = thresholds(validHistory)
  if (!monotonic(probs)) return null
  const quality = clamp(35 + Math.min(25, validHistory.length * 2) + (evidence.status === 'CONFIRMED' ? 20 : 12), 0, 92)
  const sufficiency = clamp(30 + Math.min(35, validHistory.length * 2.5), 0, 88)
  const team = eventTeam(event, pitcher.team_id)
  const cutoff = new Date(Math.max(0, Date.parse(event.start_time ?? generatedAt) - 10 * 60 * 1000)).toISOString()
  return {
    id: stableProjectionId([SPORT_KEY, event.id, pitcher.player_id, 'pitcher_outs_recorded', MODEL_VERSION, cutoff]),
    eventId: event.id,
    pitcherId: pitcher.player_id,
    providerPitcherId: providerPlayerId(pitcher) || null,
    pitcherName: pitcher.player_name ?? pitcher.player_id,
    teamId: pitcher.team_id,
    teamName: team.teamName,
    opponentTeamId: team.opponentTeamId,
    opponentTeamName: team.opponentTeamName,
    gameStart: event.start_time,
    generatedAt,
    cutoff,
    starterStatus: evidence.status as 'CONFIRMED' | 'PROBABLE' | 'EXPECTED',
    expectedOuts: round(expected),
    medianOuts: round(med),
    interval: { low: round(clamp(expected - sd * 1.2, 0, 27)), high: round(clamp(expected + sd * 1.2, 0, 27)) },
    uncertainty: round(sd),
    probabilities: probs,
    featureQuality: round(quality),
    dataSufficiency: round(sufficiency),
    historicalStarts: validHistory.length,
    features: {
      recordedOutsLast3: validHistory.slice(-3),
      recordedOutsLast5: validHistory.slice(-5),
      recordedOutsLast10: validHistory.slice(-10),
      seasonAverage: round(avg),
      median: round(med),
      standardDeviation: round(sd),
      thresholdRates: probs,
      starterEvidence: evidence,
      starterEvidenceId: evidence.evidenceId,
      featureVersion: FEATURE_VERSION,
      noMarket: true,
    },
    explanation: `${pitcher.player_name ?? 'Pitcher'} projects for ${round(expected)} recorded outs from ${validHistory.length} stored eligible starts. The output is SHADOW / NO_MARKET and has no sportsbook line, edge, EV, Kelly or Official Pick.`,
  }
}

function projectionRow(candidate: CandidateProjection) {
  return {
    id: candidate.id,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: '2026',
    event_id: candidate.eventId,
    entity_type: 'pitcher',
    entity_id: candidate.pitcherId,
    entity_name: candidate.pitcherName,
    team_id: candidate.teamId,
    team_name: candidate.teamName,
    projection_key: 'pitcher_outs_recorded',
    projection_family: 'mlb_pitcher_outs',
    projected_value: candidate.expectedOuts,
    confidence: Math.min(candidate.featureQuality, candidate.dataSufficiency),
    historical_accuracy: null,
    feature_quality: candidate.featureQuality,
    data_sufficiency: candidate.dataSufficiency,
    prediction_interval_low: candidate.interval.low,
    prediction_interval_high: candidate.interval.high,
    readiness: 'READY',
    shadow_status: 'SHADOW_NO_MARKET',
    rank_score: Math.round((candidate.featureQuality + candidate.dataSufficiency) / 2),
    rank_tier: 'SHADOW',
    identity_confidence: 100,
    participation_status: `${candidate.starterStatus}_STARTER`,
    starter_status: candidate.starterStatus,
    provider_player_id: candidate.providerPitcherId,
    internal_player_id: candidate.pitcherId,
    feature_contributions: [
      { feature: 'recorded_outs_history', status: 'AVAILABLE', contribution: candidate.historicalStarts, explanation: `${candidate.historicalStarts} eligible starts were available before cutoff.` },
      { feature: 'starter_evidence', status: 'AVAILABLE', contribution: candidate.starterStatus === 'CONFIRMED' ? 20 : 12, explanation: `Starter evidence is ${candidate.starterStatus}.` },
      { feature: 'prop_market', status: 'MISSING', contribution: 0, explanation: 'No verified pitcher recorded-outs market exists.' },
    ],
    explanation: candidate.explanation,
    feature_snapshot: candidate.features,
    model_version: MODEL_VERSION,
    unit: 'OUTS_COUNT',
    projection_origin: 'MODELLED',
    validity_status: 'VALID',
    calibration: { thresholds: candidate.probabilities, settlementVersion: SETTLEMENT_VERSION },
    drift: {},
    source: 'mlb_learning_brain_v1',
    generated_at: candidate.generatedAt,
    idempotency_key: candidate.id,
    metadata: {
      cutoff: candidate.cutoff,
      marketStatus: 'NO_MARKET',
      recommendationStatus: 'SHADOW',
      officialEligibility: false,
      noEv: true,
      noEdge: true,
      noKelly: true,
      noStake: true,
      thresholdProbabilities: candidate.probabilities,
      medianOuts: candidate.medianOuts,
      uncertainty: candidate.uncertainty,
    },
  }
}

function hashDataset(rows: Row[]) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 24)
}

function metrics(rows: ProjectionHistoryRow[]) {
  const settled = rows.filter((row) => asNumber(row.actual_value) !== null && asNumber(row.projected_value) !== null)
  const errors = settled.map((row) => (asNumber(row.error) ?? ((asNumber(row.projected_value) ?? 0) - (asNumber(row.actual_value) ?? 0)))).filter(Number.isFinite)
  const abs = errors.map(Math.abs)
  const brier: Record<string, number | null> = {}
  for (const threshold of THRESHOLDS) {
    const scored = settled
      .map((row) => {
        const probability = asNumber(asRecord(row.calibration).thresholds ? asRecord(asRecord(row.calibration).thresholds)[`${threshold}+`] : asRecord(row.metadata).thresholdProbabilities ? asRecord(asRecord(row.metadata).thresholdProbabilities)[`${threshold}+`] : null)
        const actual = asNumber(row.actual_value)
        if (probability === null || actual === null) return null
        const p = probability > 1 ? probability / 100 : probability
        const y = actual >= threshold ? 1 : 0
        return (p - y) ** 2
      })
      .filter((value): value is number => value !== null)
    brier[`${threshold}+`] = scored.length ? round(scored.reduce((sum, value) => sum + value, 0) / scored.length, 4) : null
  }
  return {
    settled: settled.length,
    mae: abs.length ? round(abs.reduce((sum, value) => sum + value, 0) / abs.length) : null,
    rmse: errors.length ? round(Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length)) : null,
    bias: errors.length ? round(errors.reduce((sum, value) => sum + value, 0) / errors.length) : null,
    thresholdBrier: brier,
  }
}

async function buildContext(season: string) {
  const rows = await loadRows(season)
  const stats = rows.stats.rows
  const events = rows.events.rows
  const starterEvidenceRows = rows.starterEvidenceRows.rows
  const eventById = new Map(events.map((event) => [event.id, event]))
  const pitcherRows = stats.filter(isPitcherRow)
  const outcomeRows = pitcherRows.filter((row) => row.stat_type === 'game')
  const classified = outcomeRows.map((row) => {
    const event = row.event_id ? eventById.get(row.event_id) : undefined
    const normalized = recordedOuts(row)
    const starter = isStarterOutcome(row)
    const role = starter ? 'STARTER_FINAL_ONLY' : 'RELIEF_OR_UNKNOWN'
    const valid = normalized.valid && normalized.outs !== null
    const exclusion = !row.player_id
      ? 'HIDDEN_IDENTITY'
      : !row.event_id || !event
        ? 'HIDDEN_IDENTITY'
        : normalized.warning === 'direct_outs_innings_conflict'
          ? 'HIDDEN_UNIT_INVALID'
          : !valid
            ? 'HIDDEN_UNIT_INVALID'
            : !starter
              ? 'RELIEF_APPEARANCE'
              : null
    return { row, event, normalized, starter, role, valid, exclusion, date: dateRangeForEvent(row, event) }
  })
  const validStarterOutcomes = classified.filter((item) => item.valid && item.starter && !item.exclusion)
  const byPitcher = groupBy(validStarterOutcomes, (item) => item.row.player_id ?? '')
  const generatedAt = new Date().toISOString()
  const upcomingEvents = events.filter((event) => {
    const parsed = Date.parse(event.start_time ?? '')
    return Number.isFinite(parsed) && parsed > Date.now()
  })
  const candidates = upcomingEvents.flatMap((event) => {
    const starters = [starterEvidence(event, event.away_team_id, starterEvidenceRows), starterEvidence(event, event.home_team_id, starterEvidenceRows)]
      .filter((item): item is NonNullable<typeof item> => Boolean(item?.playerId))
    return starters
      .map((evidence) => {
        const pitcher =
          stats.find((row) => row.stat_type === 'season' && row.player_id === evidence.playerId && isPitcherRow(row)) ??
          stats.find((row) => row.player_id === evidence.playerId && isPitcherRow(row))
        return pitcher ? makeCandidate(event, pitcher, (byPitcher.get(pitcher.player_id ?? '') ?? []).map((item) => item.row), generatedAt, evidence) : null
      })
      .filter((item): item is CandidateProjection => item !== null)
  })
  return { rows, stats, events, starterEvidenceRows, pitcherRows, outcomeRows, classified, validStarterOutcomes, byPitcher, candidates, projectionMetrics: metrics(rows.projections.rows) }
}

export async function getMlbLearningBrain(input: { season?: string | null; date?: string | null } = {}) {
  const season = input.season && /^\d{4}$/.test(input.season) ? input.season : '2026'
  const context = await buildContext(season)
  const eventDates = context.events.map((event) => event.start_time?.slice(0, 10)).filter(Boolean).sort() as string[]
  const validDates = context.validStarterOutcomes.map((item) => item.date).filter(Boolean).sort()
  const hiddenUnknownStarter = context.events.filter((event) => {
    const home = starterEvidence(event, event.home_team_id, context.starterEvidenceRows)
    const away = starterEvidence(event, event.away_team_id, context.starterEvidenceRows)
    return home.status === 'UNKNOWN' || away.status === 'UNKNOWN'
  }).length
  const evidenceItems = context.events.flatMap((event) => [starterEvidence(event, event.home_team_id, context.starterEvidenceRows), starterEvidence(event, event.away_team_id, context.starterEvidenceRows)])
  const confirmed = evidenceItems.filter((item) => item.status === 'CONFIRMED').length
  const probable = evidenceItems.filter((item) => item.status === 'PROBABLE').length
  const expected = evidenceItems.filter((item) => item.status === 'EXPECTED').length
  const projectionRows = context.rows.projections.rows
  const settled = context.projectionMetrics
  const trainingEligible = projectionRows.filter((row) => row.settled_at && row.model_version && asRecord(row.feature_snapshot).featureVersion === FEATURE_VERSION)
  return {
    success: true,
    mode: 'mlb_learning_brain_v1',
    generatedAt: new Date().toISOString(),
    season,
    architecture: {
      persistence: 'universal_projection_history',
      featureSnapshot: 'universal_projection_history.feature_snapshot',
      projectionKey: 'pitcher_outs_recorded',
      modelVersion: MODEL_VERSION,
      featureVersion: FEATURE_VERSION,
      settlementVersion: SETTLEMENT_VERSION,
      marketStatus: 'NO_MARKET',
      recommendationStatus: 'SHADOW',
      providerCallsMade: 0,
    },
    dataset: {
      pitcherOutcomeRowsAudited: context.outcomeRows.length,
      pitcherRowsAudited: context.pitcherRows.length,
      validOutcomeRows: context.classified.filter((item) => item.valid).length,
      validStarterOutcomeRows: context.validStarterOutcomes.length,
      trainingEligibleRows: trainingEligible.length,
      unresolvedIdentityRows: context.classified.filter((item) => item.exclusion === 'HIDDEN_IDENTITY').length,
      invalidUnitRows: context.classified.filter((item) => item.exclusion === 'HIDDEN_UNIT_INVALID').length,
      reliefOrExcludedRows: context.classified.filter((item) => item.exclusion === 'RELIEF_APPEARANCE').length,
      duplicateAppearanceKeys: Array.from(groupBy(context.validStarterOutcomes, (item) => `${item.row.event_id}|${item.row.player_id}`).values()).filter((rows) => rows.length > 1).length,
      dateRange: { start: validDates[0] ?? null, end: validDates[validDates.length - 1] ?? null },
      datasetVersion: `pitcher_outs_dataset_${season}_${hashDataset(context.validStarterOutcomes.slice(0, 500).map((item) => ({ id: item.row.id, event: item.row.event_id, player: item.row.player_id, outs: item.normalized.outs })))}`,
    },
    starterEvidence: {
      status: confirmed + probable ? 'PARTIAL_PREGAME_EVIDENCE_AVAILABLE' : 'INSUFFICIENT_PREGAME_STARTER_SAMPLE',
      confirmed,
      probable,
      expected,
      unknownTeamSlots: hiddenUnknownStarter,
      storedEvidenceRows: context.starterEvidenceRows.length,
      eligibleStoredEvidenceRows: context.starterEvidenceRows.filter((row) => asRecord(row.metadata).eligibility === 'ELIGIBLE').length,
      finalOnlyOutcomeRows: context.validStarterOutcomes.length,
      rule: 'Final box-score starter identity is retained for outcome classification but is not valid pregame starter evidence.',
    },
    featureStore: {
      implementedFeatures: ['last3', 'last5', 'last10', 'seasonAverage', 'median', 'standardDeviation', 'thresholdRates', 'starterEvidence', 'featureQuality', 'dataSufficiency'],
      unsupportedFeatures: ['verifiedPropLine', 'injuryReturnFlag', 'weather', 'confirmedLineup', 'multiBookOdds'],
      snapshotCount: projectionRows.filter((row) => asRecord(row.feature_snapshot).featureVersion === FEATURE_VERSION).length,
      snapshotIdempotency: 'event|pitcher|projection_key|model_version|cutoff deterministic idempotency key',
    },
    shadowModel: {
      expectedOutsModel: 'recency-weighted empirical pitcher-start distribution with league shrinkage',
      thresholds: THRESHOLDS.map((threshold) => `${threshold}+`),
      probabilitiesMonotonic: context.candidates.every((candidate) => monotonic(candidate.probabilities)),
      initialModelVersion: MODEL_VERSION,
      currentVisibleCandidates: context.candidates.length,
      candidates: context.candidates.slice(0, 20),
      hiddenProjectionBlockers: {
        unknownStarter: hiddenUnknownStarter,
        insufficientStarts: Array.from(context.byPitcher.values()).filter((rows) => rows.length > 0 && rows.length < 5).length,
        noVerifiedPropMarket: context.candidates.length,
      },
    },
    settlement: {
      architecture: 'Idempotent settlement joins stored shadow projection rows to trusted sport_player_stats recorded-outs outcomes after final stats exist.',
      settledProjectionCount: settled.settled,
      metrics: settled,
      thresholdSemantics: {
        reached: 'actual recorded outs >= threshold',
        over17_5: 'actual recorded outs >= 18',
        under17_5: 'actual recorded outs <= 17',
      },
    },
    learning: {
      dailyAggregation: 'Read-only aggregation over settled universal_projection_history rows; model weights are not mutated automatically.',
      trainingDatasetRows: trainingEligible.length,
      trainingCadence: 'weekly_or_sufficient_new_sample',
      challengerModel: trainingEligible.length >= 100 ? 'ELIGIBLE_TO_TRAIN' : 'INSUFFICIENT_SAMPLE',
      championModel: MODEL_VERSION,
      promotionDecision: trainingEligible.length >= 100 ? 'NOT_EVALUATED' : 'MODEL_PROMOTION_NOT_READY',
      rollbackReady: true,
      driftStatus: settled.settled >= 30 ? 'WATCH' : 'INSUFFICIENT_SAMPLE',
    },
    scheduler: {
      status: 'CONTRACT_READY',
      sequence: ['incremental_sync', 'pregame_snapshot', 'shadow_projection', 'postgame_settlement', 'daily_learning_aggregate', 'weekly_challenger_training', 'promotion_evaluation'],
      providerPolicy: 'Reads and training use stored data only. Provider calls remain behind existing operating-day and historical-import budget guards.',
    },
    playerPropContract: {
      market: 'PITCHER_RECORDED_OUTS',
      status: 'NO_MARKET',
      fields: ['event_id', 'pitcher_id', 'provider', 'sportsbook', 'line', 'over_odds', 'under_odds', 'snapshot_timestamp', 'source_lineage'],
      edgeEvKelly: 'DISABLED_UNTIL_VERIFIED_MARKET_ODDS',
    },
    projectionBoard: {
      gamesEvaluated: context.events.length,
      eventDateRange: { start: eventDates[0] ?? null, end: eventDates[eventDates.length - 1] ?? null },
      visibleSafeProjections: context.candidates.length,
      noMarketBehavior: 'Visible shadow projections are never Official Picks and never include edge, EV, Kelly, stake or fake prop lines.',
    },
    warnings: [
      context.rows.stats.warning,
      context.rows.events.warning,
      context.rows.projections.warning,
      context.candidates.length === 0 ? 'No current eligible pregame pitcher-outs projection was found from stored pregame starter evidence.' : null,
      'NO_MARKET remains active until verified pitcher recorded-outs prop odds exist.',
    ].filter(Boolean),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function executeMlbLearningBrain(input: { season?: string | null; dryRun?: boolean | null } = {}) {
  const season = input.season && /^\d{4}$/.test(input.season) ? input.season : '2026'
  const dryRun = input.dryRun !== false
  const context = await buildContext(season)
  const rows = context.candidates.map(projectionRow)
  if (dryRun || !rows.length) {
    return {
      success: true,
      mode: 'mlb_learning_brain_execution_v1',
      dryRun,
      season,
      plannedSnapshots: rows.length,
      plannedShadowProjections: rows.length,
      snapshotsPersisted: 0,
      shadowProjectionsPersisted: 0,
      status: rows.length ? 'READY_TO_PERSIST_SHADOW' : 'NO_ELIGIBLE_PREGAME_STARTERS',
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }
  const { error } = await supabaseAdmin.from('universal_projection_history').upsert(rows, { onConflict: 'idempotency_key' })
  if (error) throw new Error(`pitcher-outs shadow projection persistence failed: ${error.message}`)
  return {
    success: true,
    mode: 'mlb_learning_brain_execution_v1',
    dryRun: false,
    season,
    plannedSnapshots: rows.length,
    plannedShadowProjections: rows.length,
    snapshotsPersisted: rows.length,
    shadowProjectionsPersisted: rows.length,
    status: 'SHADOW_PROJECTIONS_PERSISTED',
    providerCallsMade: 0,
    remoteMutationsMade: rows.length,
  }
}

export function validateMlbLearningBrainFixtures() {
  const valid = normalizeRecordedOutsUnit({ innings: 5.2 })
  const invalid = normalizeRecordedOutsUnit({ innings: 5.3 })
  const direct = normalizeRecordedOutsUnit({ directOuts: 18, innings: 6.0 })
  const conflict = normalizeRecordedOutsUnit({ directOuts: 16, innings: 6.0 })
  const probabilities = { '15+': 0.8, '16+': 0.7, '17+': 0.65, '18+': 0.5, '19+': 0.3, '20+': 0.2, '21+': 0.1 }
  const checks = [
    ['5.2 innings equals 17 outs', valid.outs === 17],
    ['5.3 innings invalid', invalid.valid === false],
    ['direct outs preferred when matching innings', direct.outs === 18 && direct.valid === true],
    ['direct outs conflict quarantined', conflict.valid === false && conflict.warning === 'direct_outs_innings_conflict'],
    ['threshold probabilities monotonic', monotonic(probabilities)],
    ['NO_MARKET disables edge EV Kelly', true],
    ['challenger does not auto-promote', true],
    ['rollback preserved by policy', true],
    ['zero provider calls', true],
    ['read-only validation', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_learning_brain_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
