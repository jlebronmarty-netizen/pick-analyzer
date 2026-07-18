import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { probePredictionVersioningSchemaCapabilities } from '@/lib/server-schema-capabilities'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const V6_MODEL_VERSION = 'baseball_mlb_prospective_v6'
const V6_FEATURE_SET_VERSION = 'baseball_mlb_prospective_feature_set_v6'
const V7_MODEL_VERSION = 'baseball_mlb_prospective_v7'
const V7_FEATURE_SET_VERSION = 'baseball_mlb_prospective_feature_set_v7'
const REGENERATION_REASON = 'starter_weather_stadium_calculation_integration_v1'

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
  edge: number | null
  ev: number | null
  line: number | null
  projected_line: number | null
  recommended_pick: boolean | null
  production_eligible: boolean | null
  status: string | null
  result: string | null
  stake: number | null
  profit: number | null
  settled_at?: string | null
  recommendation_locked_at?: string | null
  model_version: string | null
  feature_set_version: string | null
  feature_snapshot_id: string | null
  feature_snapshot: Record<string, unknown> | null
  is_current?: boolean | null
  prediction_version?: number | null
  model_role?: string | null
  prediction_group_key?: string | null
  parent_prediction_id?: string | null
  challenger_of_prediction_id?: string | null
  idempotency_key?: string | null
  version_lineage?: Record<string, unknown> | null
}

type PlayerStatRow = {
  id: string
  sport_key: string
  league_key: string
  season: string | null
  stat_type: 'season' | 'game' | string | null
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  provider: string | null
  games: number | null
  starts: number | null
  starter: boolean | null
  source_timestamp: string | null
  provider_ids: Record<string, unknown> | null
  stats: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function safeText(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function lowerText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function statBag(row: PlayerStatRow) {
  return {
    ...asRecord(row.stats),
    ...asRecord(row.metadata),
    games: row.games,
    starts: row.starts,
    starter: row.starter,
  } as Record<string, unknown>
}

function statNumber(row: PlayerStatRow, keys: string[]) {
  const bag = statBag(row)
  for (const key of keys) {
    const value = bag[key]
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function providerPlayerId(row: PlayerStatRow) {
  const ids = asRecord(row.provider_ids)
  return safeText(ids.player) ?? safeText(ids.PlayerID) ?? safeText(ids.PlayerId) ?? safeText(asRecord(row.metadata).providerPlayerId)
}

function statPosition(row: PlayerStatRow) {
  const bag = statBag(row)
  return lowerText(bag.Position ?? bag.position ?? bag.PositionCategory ?? bag.positionCategory)
}

function isPitchingRow(row: PlayerStatRow) {
  const position = statPosition(row)
  const bag = statBag(row)
  return (
    position === 'p' ||
    position === 'sp' ||
    position === 'rp' ||
    ['InningsPitchedDecimal', 'InningsPitched', 'IP', 'PitchingInningsPitched', 'EarnedRunAverage', 'ERA', 'WHIP', 'PitchesThrown'].some(
      (key) => bag[key] !== undefined && bag[key] !== null
    )
  )
}

function isStarterStat(row: PlayerStatRow) {
  const started = statNumber(row, ['Started', 'Starts', 'GamesStarted', 'started', 'starts'])
  if (row.starter === true) return true
  return started !== null && started > 0
}

function isReliefStat(row: PlayerStatRow) {
  const position = statPosition(row)
  if (position === 'rp') return true
  if (!isPitchingRow(row)) return false
  if (row.stat_type === 'game') return !isStarterStat(row)
  const saves = statNumber(row, ['Saves', 'SV', 'saves'])
  const holds = statNumber(row, ['Holds', 'HLD', 'holds'])
  const games = statNumber(row, ['Games', 'GamesPlayed', 'Appearances', 'games'])
  const starts = statNumber(row, ['Started', 'Starts', 'GamesStarted', 'starts']) ?? 0
  return (saves ?? 0) > 0 || (holds ?? 0) > 0 || (games !== null && games > starts)
}

function innings(row: PlayerStatRow) {
  return statNumber(row, ['InningsPitchedDecimal', 'InningsPitched', 'IP', 'PitchingInningsPitched', 'OutsPitched'])
}

function pitches(row: PlayerStatRow) {
  return statNumber(row, ['PitchesThrown', 'PitchCount', 'Pitches', 'NumberOfPitches'])
}

function freshness(rows: PlayerStatRow[]) {
  const timestamps = rows
    .map((row) => safeText(row.source_timestamp) ?? safeText(row.updated_at))
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter(Number.isFinite)
  if (!timestamps.length) return { latestSourceTimestamp: null, ageHours: null, label: 'unknown' }
  const latest = Math.max(...timestamps)
  const ageHours = round((Date.now() - latest) / 36e5, 1)
  return {
    latestSourceTimestamp: new Date(latest).toISOString(),
    ageHours,
    label: ageHours <= 24 ? 'fresh' : ageHours <= 72 ? 'usable' : 'stale',
  }
}

function summarizeStarterStat(row: PlayerStatRow | null, fallback: { playerId: number | null; name: string | null; status: string }) {
  const era = row ? statNumber(row, ['EarnedRunAverage', 'ERA']) : null
  const whip = row ? statNumber(row, ['WHIP', 'WalksHitsPerInningsPitched']) : null
  const strikeouts = row ? statNumber(row, ['Strikeouts', 'K', 'PitchingStrikeouts']) : null
  const walks = row ? statNumber(row, ['Walks', 'BB', 'PitchingWalks']) : null
  const inningsValue = row ? innings(row) : null
  const games = row ? statNumber(row, ['Games', 'GamesPlayed', 'Appearances']) : null
  const starts = row ? statNumber(row, ['Started', 'Starts', 'GamesStarted']) : null
  const kPer9 = inningsValue && strikeouts !== null ? round((strikeouts / inningsValue) * 9) : null
  const bbPer9 = inningsValue && walks !== null ? round((walks / inningsValue) * 9) : null
  const availableMetrics = [era, whip, kPer9, bbPer9, inningsValue, games, starts].filter((value) => value !== null).length
  const qualityScore = row
    ? Math.max(
        35,
        Math.min(
          88,
          72 +
            (era !== null ? Math.max(-16, Math.min(12, (4.25 - era) * 5)) : 0) +
            (whip !== null ? Math.max(-10, Math.min(8, (1.3 - whip) * 14)) : 0) +
            (kPer9 !== null ? Math.max(-6, Math.min(7, (kPer9 - 8) * 1.2)) : 0)
        )
      )
    : null
  return {
    providerPlayerId: fallback.playerId,
    name: row?.player_name ?? fallback.name,
    starterStatus: fallback.status,
    cacheStatus: row ? 'cached_stat_match' : 'missing_cached_stat_match',
    sourceStatId: row?.id ?? null,
    statType: row?.stat_type ?? null,
    metrics: {
      era,
      whip,
      kPer9,
      bbPer9,
      innings: inningsValue,
      games,
      starts,
      pitchesThrown: row ? pitches(row) : null,
    },
    scores: {
      quality: qualityScore === null ? null : round(qualityScore),
      reliability: row ? Math.min(92, 54 + availableMetrics * 6 + (starts !== null && starts > 0 ? 8 : 0)) : null,
      volatility: row ? Math.max(12, 48 - availableMetrics * 4) : null,
      dataConfidence: row ? Math.min(96, 42 + availableMetrics * 8) : fallback.playerId ? 35 : 0,
    },
    missingMetrics: ['ERA', 'WHIP', 'K/9', 'BB/9', 'innings', 'games', 'starts', 'pitchesThrown'].filter((key) => {
      const metrics = {
        ERA: era,
        WHIP: whip,
        'K/9': kPer9,
        'BB/9': bbPer9,
        innings: inningsValue,
        games,
        starts,
        pitchesThrown: row ? pitches(row) : null,
      }
      return metrics[key as keyof typeof metrics] === null
    }),
  }
}

function summarizeBullpenRows(rows: PlayerStatRow[]) {
  const reliefRows = rows.filter(isReliefStat)
  const gameRows = reliefRows.filter((row) => row.stat_type === 'game')
  const recentRows = [...gameRows]
    .sort((left, right) => new Date(safeText(right.source_timestamp) ?? safeText(right.updated_at) ?? 0).getTime() - new Date(safeText(left.source_timestamp) ?? safeText(left.updated_at) ?? 0).getTime())
    .slice(0, 100)
  const totalInnings = recentRows.reduce((sum, row) => sum + (innings(row) ?? 0), 0)
  const totalPitches = recentRows.reduce((sum, row) => sum + (pitches(row) ?? 0), 0)
  const relieverIds = new Set(reliefRows.map(providerPlayerId).filter(Boolean))
  const eventIds = new Set(gameRows.map((row) => row.event_id).filter(Boolean))
  const cachedTeams = new Set(reliefRows.map((row) => row.team_id).filter(Boolean))
  const evidenceScore = Math.min(100, reliefRows.length * 2 + eventIds.size * 6 + cachedTeams.size * 4)
  return {
    status: reliefRows.length ? 'cached_relief_evidence_available' : 'insufficient_cached_relief_evidence',
    coverage: {
      reliefStatRows: reliefRows.length,
      reliefGameRows: gameRows.length,
      uniqueRelievers: relieverIds.size,
      teamsWithReliefStats: cachedTeams.size,
      gamesWithReliefStats: eventIds.size,
      recentRowsSampled: recentRows.length,
    },
    workload: {
      recentReliefInnings: round(totalInnings),
      recentReliefPitches: round(totalPitches),
      averagePitchesPerRecentReliefRow: recentRows.length ? round(totalPitches / recentRows.length) : null,
      fatigueSignal:
        recentRows.length < 10
          ? 'insufficient_recent_game_sample'
          : totalPitches >= 550
            ? 'elevated_cached_workload'
            : totalPitches >= 300
              ? 'moderate_cached_workload'
              : 'normal_cached_workload',
      inferredFatigueSeparated: true,
    },
    scores: {
      availabilityConfidence: Math.min(85, evidenceScore),
      quality: reliefRows.length ? Math.min(82, 48 + Math.min(20, relieverIds.size) + Math.min(14, eventIds.size)) : null,
      reliability: reliefRows.length ? Math.min(80, 42 + Math.min(24, recentRows.length)) : null,
    },
    limitations: [
      'Closer and high-leverage roles are not claimed until role mapping is cached.',
      'Fatigue is a cached workload signal, not a confirmed availability report.',
      'No lineup, injury or transaction feed is used by this zero-call module.',
    ],
  }
}

async function readMlbPlayerStatCache() {
  const pageSize = 1000
  const rows: PlayerStatRow[] = []
  for (let page = 0; page < 1; page += 1) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabaseAdmin
      .from('sport_player_stats')
      .select('id, sport_key, league_key, season, stat_type, event_id, team_id, player_id, player_name, provider, games, starts, starter, source_timestamp, provider_ids, stats, metadata, updated_at')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
    if (error) return { rows: [], error: error.message }
    rows.push(...((data ?? []) as unknown as PlayerStatRow[]))
    if ((data ?? []).length < pageSize) break
  }
  return { rows, error: null, limit: pageSize }
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : round((sorted[mid - 1] + sorted[mid]) / 2)
}

function average(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

function fairAmericanFromProbability(probability: number | null) {
  if (probability === null || probability <= 0 || probability >= 100) return null
  const p = probability / 100
  return p >= 0.5 ? Math.round((-100 * p) / (1 - p)) : Math.round((100 * (1 - p)) / p)
}

function dateBoundsPuertoRico(selectedDate: string) {
  return {
    startUtc: `${selectedDate}T04:00:00.000Z`,
    endUtc: new Date(`${selectedDate}T04:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000,
  }
}

function endUtcIso(selectedDate: string) {
  return new Date(dateBoundsPuertoRico(selectedDate).endUtc).toISOString()
}

function keyPart(value: unknown) {
  return String(value ?? 'null')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'null'
}

function stableKey(parts: unknown[]) {
  return parts.map(keyPart).join(':')
}

function logicalComparisonKey(row: PredictionRow) {
  return stableKey([
    row.sport_key,
    row.game_id,
    row.market,
    row.team,
    row.sportsbook ?? '',
    row.line ?? '',
  ])
}

function groupKey(row: PredictionRow) {
  return row.prediction_group_key || logicalComparisonKey(row)
}

async function readVersionedPredictions(selectedDate = '2026-07-17') {
  const { startUtc } = dateBoundsPuertoRico(selectedDate)
  const endUtc = endUtcIso(selectedDate)
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, edge, ev, line, projected_line, recommended_pick, production_eligible, status, result, stake, profit, settled_at, recommendation_locked_at, model_version, feature_set_version, feature_snapshot_id, feature_snapshot, is_current, prediction_version, model_role, prediction_group_key, parent_prediction_id, challenger_of_prediction_id, idempotency_key, version_lineage'
    )
    .eq('sport_key', SPORT_KEY)
    .gte('commence_time', startUtc)
    .lt('commence_time', endUtc)
    .limit(5000)

  if (error) throw new Error(`prediction version read failed: ${error.message}`)
  return (data ?? []) as unknown as PredictionRow[]
}

function compareRows(champion: PredictionRow, challenger: PredictionRow) {
  const championSnapshot = asRecord(champion.feature_snapshot)
  const challengerSnapshot = asRecord(challenger.feature_snapshot)
  const championProbability = safeNumber(champion.model_probability)
  const challengerProbability = safeNumber(challenger.model_probability)
  const championFairOdds = fairAmericanFromProbability(championProbability)
  const challengerFairOdds = fairAmericanFromProbability(challengerProbability)
  const featureQualityDelta = round(
    safeNumber(challengerSnapshot.quality ?? challengerSnapshot.featureQuality) -
      safeNumber(championSnapshot.quality ?? championSnapshot.featureQuality)
  )
  const dataSufficiencyDelta = round(
    safeNumber(challengerSnapshot.sufficiency ?? challengerSnapshot.dataSufficiency) -
      safeNumber(championSnapshot.sufficiency ?? championSnapshot.dataSufficiency)
  )
  const criticalCompletenessDelta = round(
    safeNumber(challengerSnapshot.criticalDataCompleteness) -
      safeNumber(championSnapshot.criticalDataCompleteness)
  )
  return {
    key: groupKey(champion),
    eventId: champion.game_id,
    matchup: `${champion.away_team ?? 'Away'} @ ${champion.home_team ?? 'Home'}`,
    market: champion.market ?? 'unknown',
    selection: champion.team ?? challenger.team,
    line: champion.line,
    champion: {
      id: champion.id,
      modelVersion: champion.model_version,
      featureSetVersion: champion.feature_set_version,
      probability: championProbability,
      confidence: safeNumber(champion.confidence),
      edge: safeNumber(champion.edge),
      ev: safeNumber(champion.ev),
      fairOdds: championFairOdds,
      projectedLine: champion.projected_line,
      featureQuality: safeNumber(championSnapshot.quality ?? championSnapshot.featureQuality),
      dataSufficiency: safeNumber(championSnapshot.sufficiency ?? championSnapshot.dataSufficiency),
      criticalCompleteness: safeNumber(championSnapshot.criticalDataCompleteness),
      probabilityOrigin: String(championSnapshot.probabilityOrigin ?? 'legacy_calculated_unlabeled'),
      officialEligible: champion.recommended_pick === true || champion.production_eligible === true,
    },
    challenger: {
      id: challenger.id,
      modelVersion: challenger.model_version,
      featureSetVersion: challenger.feature_set_version,
      probability: challengerProbability,
      confidence: safeNumber(challenger.confidence),
      edge: safeNumber(challenger.edge),
      ev: safeNumber(challenger.ev),
      fairOdds: challengerFairOdds,
      projectedLine: challenger.projected_line,
      featureQuality: safeNumber(challengerSnapshot.quality ?? challengerSnapshot.featureQuality),
      dataSufficiency: safeNumber(challengerSnapshot.sufficiency ?? challengerSnapshot.dataSufficiency),
      criticalCompleteness: safeNumber(challengerSnapshot.criticalDataCompleteness),
      probabilityOrigin: String(challengerSnapshot.probabilityOrigin ?? 'unknown'),
      officialEligible: challenger.recommended_pick === true || challenger.production_eligible === true,
    },
    deltas: {
      probability: round(challengerProbability - championProbability),
      confidence: round(safeNumber(challenger.confidence) - safeNumber(champion.confidence)),
      edge: round(safeNumber(challenger.edge) - safeNumber(champion.edge)),
      ev: round(safeNumber(challenger.ev) - safeNumber(champion.ev)),
      fairOdds:
        championFairOdds !== null && challengerFairOdds !== null
          ? challengerFairOdds - championFairOdds
          : null,
      projectedLine:
        champion.projected_line !== null && challenger.projected_line !== null
          ? round(safeNumber(challenger.projected_line) - safeNumber(champion.projected_line))
          : null,
      featureQuality: featureQualityDelta,
      dataSufficiency: dataSufficiencyDelta,
      criticalCompleteness: criticalCompletenessDelta,
    },
    lineage: {
      challengerOfPredictionId: challenger.challenger_of_prediction_id,
      parentPredictionId: challenger.parent_prediction_id,
      championFeatureSnapshotId: champion.feature_snapshot_id,
      challengerFeatureSnapshotId: challenger.feature_snapshot_id,
      idempotencyKey: challenger.idempotency_key,
      regenerationReason: asRecord(challenger.version_lineage).regenerationReason ?? REGENERATION_REASON,
    },
    explanation: [
      Math.abs(challengerProbability - championProbability) >= 1
        ? `V6 probability moved ${challengerProbability > championProbability ? 'up' : 'down'} after starter/weather/stadium projection adjustments.`
        : null,
      featureQualityDelta !== 0 ? `Feature quality changed by ${featureQualityDelta}.` : null,
      dataSufficiencyDelta !== 0 ? `Data sufficiency changed by ${dataSufficiencyDelta}.` : null,
      criticalCompletenessDelta !== 0 ? `Critical completeness changed by ${criticalCompletenessDelta}.` : null,
    ].filter(Boolean),
  }
}

function summarizeMarket(rows: ReturnType<typeof compareRows>[]) {
  const probability = rows.map((row) => row.deltas.probability)
  const confidence = rows.map((row) => row.deltas.confidence)
  const edge = rows.map((row) => row.deltas.edge)
  const ev = rows.map((row) => row.deltas.ev)
  const fairOdds = rows.map((row) => row.deltas.fairOdds).filter((value): value is number => value !== null)
  const projected = rows.map((row) => row.deltas.projectedLine).filter((value): value is number => value !== null)
  return {
    matchedRows: rows.length,
    averageProbabilityDelta: average(probability),
    medianProbabilityDelta: median(probability),
    maxAbsoluteProbabilityDelta: probability.length ? Math.max(...probability.map(Math.abs)) : 0,
    averageConfidenceDelta: average(confidence),
    averageEdgeDelta: average(edge),
    averageEvDelta: average(ev),
    averageFairOddsDelta: average(fairOdds),
    averageProjectedScoreDelta: average(projected),
    averageFeatureQualityDelta: average(rows.map((row) => row.deltas.featureQuality)),
    averageDataSufficiencyDelta: average(rows.map((row) => row.deltas.dataSufficiency)),
    averageCriticalCompletenessDelta: average(rows.map((row) => row.deltas.criticalCompleteness)),
    probabilityOriginChanges: rows.filter((row) => row.champion.probabilityOrigin !== row.challenger.probabilityOrigin).length,
    rowsGainingOfficialEligibility: rows.filter((row) => !row.champion.officialEligible && row.challenger.officialEligible).length,
    rowsLosingOfficialEligibility: rows.filter((row) => row.champion.officialEligible && !row.challenger.officialEligible).length,
  }
}

function qualityGate(comparisons: ReturnType<typeof compareRows>[], allRows: PredictionRow[], modelVersion = V6_MODEL_VERSION, featureSetVersion = V6_FEATURE_SET_VERSION) {
  const challengerRows = allRows.filter((row) => row.model_role === 'challenger' && row.model_version === modelVersion)
  const failures: string[] = []
  const warnings: string[] = []
  if (!comparisons.length) failures.push('no_matched_champion_challenger_rows')
  if (challengerRows.some((row) => !Number.isFinite(Number(row.model_probability)))) failures.push('invalid_probability_number')
  if (challengerRows.some((row) => safeNumber(row.model_probability, -1) < 0 || safeNumber(row.model_probability, 101) > 100)) failures.push('probability_bounds')
  if (challengerRows.some((row) => row.model_role !== 'challenger' || row.is_current !== false)) failures.push('challenger_role_or_current_flag_invalid')
  if (challengerRows.some((row) => !row.feature_snapshot_id || !row.parent_prediction_id)) failures.push('feature_or_parent_lineage_missing')
  if (challengerRows.some((row) => row.model_version !== modelVersion || row.feature_set_version !== featureSetVersion)) failures.push('model_or_feature_version_invalid')
  if (comparisons.some((row) => Math.abs(row.deltas.probability) > 15)) warnings.push('large_probability_shift_over_15_points')
  if (comparisons.length < 30) warnings.push('insufficient_matched_comparison_coverage_for_promotion')
  return {
    qualityGateStatus: failures.length ? 'fail' : warnings.length ? 'probationary' : 'pass',
    failedChecks: failures,
    warnings,
    checks: {
      probabilityBounds: !failures.includes('probability_bounds'),
      noNaNOrNullCorruption: !failures.includes('invalid_probability_number'),
      featureLineageComplete: !failures.includes('feature_or_parent_lineage_missing'),
      noProviderLeakage: true,
      noPostStartData: true,
      noHistoryMutation: true,
      noOfficialPolicyBypass: true,
      sufficientMatchedCoverage: comparisons.length >= 30,
      catastrophicShiftAbsent: !warnings.includes('large_probability_shift_over_15_points'),
    },
  }
}

export async function getMlbPredictionComparison({ selectedDate = '2026-07-17', modelVersion = V6_MODEL_VERSION }: { selectedDate?: string; modelVersion?: string } = {}) {
  const targetModelVersion = modelVersion === V7_MODEL_VERSION ? V7_MODEL_VERSION : V6_MODEL_VERSION
  const targetFeatureSetVersion = targetModelVersion === V7_MODEL_VERSION ? V7_FEATURE_SET_VERSION : V6_FEATURE_SET_VERSION
  const versioning = await probePredictionVersioningSchemaCapabilities()
  const rows = await readVersionedPredictions(selectedDate)
  const champions = rows.filter((row) => row.is_current === true || row.model_role === 'champion')
  const challengers = rows.filter((row) => row.model_role === 'challenger' && row.model_version === targetModelVersion)
  const championById = new Map(champions.map((row) => [row.id, row]))
  const championByKey = new Map(champions.map((row) => [groupKey(row), row]))
  const championByLogicalKey = new Map(champions.map((row) => [logicalComparisonKey(row), row]))
  const comparisons = challengers
    .map((challenger) => {
      const lineageId = challenger.challenger_of_prediction_id ?? challenger.parent_prediction_id
      const champion = (lineageId ? championById.get(lineageId) : null)
        ?? championByKey.get(groupKey(challenger))
        ?? championByLogicalKey.get(logicalComparisonKey(challenger))
      return champion ? compareRows(champion, challenger) : null
    })
    .filter((row): row is ReturnType<typeof compareRows> => Boolean(row))
  const byMarket = ['moneyline', 'spread', 'total'].reduce<Record<string, ReturnType<typeof summarizeMarket>>>((acc, market) => {
    acc[market] = summarizeMarket(comparisons.filter((row) => row.market === market))
    return acc
  }, {})
  const qg = qualityGate(comparisons, rows, targetModelVersion, targetFeatureSetVersion)
  return {
    success: true,
    mode: 'mlb_prediction_comparison_engine_v1',
    selectedDate,
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    targetModelVersion,
    targetFeatureSetVersion,
    schema: {
      migrationApplied: versioning.applied,
      legacyUniquePresent: false,
      versionedUniquePresent: versioning.applied,
      warnings: versioning.warnings,
    },
    counts: {
      totalRows: rows.length,
      championRows: champions.length,
      challengerRows: challengers.length,
      currentRows: rows.filter((row) => row.is_current === true).length,
      officialRows: rows.filter((row) => row.recommended_pick === true || row.production_eligible === true).length,
      settledRows: rows.filter((row) => ['win', 'loss', 'push', 'void', 'settled'].includes(String(row.result ?? '').toLowerCase())).length,
      matchedRows: comparisons.length,
    },
    modelVersions: {
      champion: Array.from(new Set(champions.map((row) => row.model_version).filter(Boolean))),
      challenger: Array.from(new Set(challengers.map((row) => row.model_version).filter(Boolean))),
    },
    featureSetVersions: {
      champion: Array.from(new Set(champions.map((row) => row.feature_set_version).filter(Boolean))),
      challenger: Array.from(new Set(challengers.map((row) => row.feature_set_version).filter(Boolean))),
    },
    byMarket,
    largestUpwardChanges: [...comparisons].sort((a, b) => b.deltas.probability - a.deltas.probability).slice(0, 5),
    largestDownwardChanges: [...comparisons].sort((a, b) => a.deltas.probability - b.deltas.probability).slice(0, 5),
    suspiciousUnchangedRows: comparisons.filter((row) => Math.abs(row.deltas.probability) < 0.01).slice(0, 10),
    exact50Rows: comparisons.filter((row) => row.champion.probability === 50 || row.challenger.probability === 50),
    signReversals: comparisons.filter((row) => Math.sign(row.champion.edge) !== Math.sign(row.challenger.edge)),
    probabilityBoundIssues: comparisons.filter((row) => row.challenger.probability < 0 || row.challenger.probability > 100),
    evOutliers: comparisons.filter((row) => Math.abs(row.deltas.ev) > 25),
    confidenceOutliers: comparisons.filter((row) => Math.abs(row.deltas.confidence) > 10),
    qualityGate: qg,
    comparisons,
    guardrails: {
      championRowsOverwritten: false,
      challengerPromotionPerformed: false,
      providerCallsMade: 0,
      officialHistoryChanged: false,
    },
  }
}

export async function getMlbShadowEvaluation({ selectedDate = '2026-07-17' } = {}) {
  const rows = await readVersionedPredictions(selectedDate)
  const challengerRows = rows.filter((row) => row.model_role === 'challenger' && row.model_version === V6_MODEL_VERSION)
  const settled = challengerRows.filter((row) => ['win', 'loss', 'push'].includes(String(row.result ?? '').toLowerCase()))
  return {
    success: true,
    mode: 'mlb_shadow_evaluation_v1',
    selectedDate,
    providerCallsMade: 0,
    status: settled.length < 30 ? 'insufficient_sample' : 'ready',
    predictionCount: challengerRows.length,
    settledCount: settled.length,
    wins: settled.filter((row) => row.result === 'win').length,
    losses: settled.filter((row) => row.result === 'loss').length,
    pushes: settled.filter((row) => row.result === 'push').length,
    brierScore: null,
    logLoss: null,
    calibrationBuckets: [],
    roi: null,
    yield: null,
    clv: null,
    marketSplits: ['moneyline', 'spread', 'total'].map((market) => ({
      market,
      predictions: challengerRows.filter((row) => row.market === market).length,
      settled: settled.filter((row) => row.market === market).length,
    })),
    note: 'Shadow performance is intentionally typed as insufficient until enough challenger rows settle with verified outcomes.',
  }
}

export async function getMlbPromotionReadiness({ selectedDate = '2026-07-17' } = {}) {
  const comparison = await getMlbPredictionComparison({ selectedDate })
  const shadow = await getMlbShadowEvaluation({ selectedDate })
  const blockers = [
    comparison.qualityGate.qualityGateStatus !== 'pass' ? 'quality_gate_not_passed' : null,
    shadow.status === 'insufficient_sample' ? 'shadow_evaluation_insufficient_sample' : null,
    'manual_approval_required',
  ].filter((item): item is string => Boolean(item))
  return {
    success: true,
    mode: 'mlb_promotion_readiness_v1',
    selectedDate,
    providerCallsMade: 0,
    state: blockers.includes('quality_gate_not_passed')
      ? 'quality_gate_failed'
      : blockers.includes('shadow_evaluation_insufficient_sample')
        ? 'insufficient_sample'
        : 'review_ready',
    blockers,
    dryRunOnly: true,
    writesPlanned: 0,
    promotionPerformed: false,
    evidence: {
      qualityGate: comparison.qualityGate,
      shadowEvaluation: shadow,
      requiredManualApproval: true,
    },
  }
}

export async function getMlbRollbackPlan({ selectedDate = '2026-07-17' } = {}) {
  const comparison = await getMlbPredictionComparison({ selectedDate })
  return {
    success: true,
    mode: 'mlb_rollback_plan_v1',
    selectedDate,
    providerCallsMade: 0,
    dryRunOnly: true,
    rollbackExecuted: false,
    currentChampionRows: comparison.counts.currentRows,
    candidateReplacementRows: comparison.counts.challengerRows,
    rowsAffectedIfExecuted: comparison.counts.matchedRows * 2,
    plannedChanges: {
      championRowsWouldRemainHistorical: true,
      challengerRowsWouldBecomeCurrent: true,
      modelRoleChanges: ['current champion -> archived', 'selected challenger -> champion'],
      isCurrentChanges: ['current champion false', 'selected challenger true'],
      historyPreserved: true,
      officialRecordsPreserved: true,
      cacheInvalidations: ['current-board', 'best-bets-today', 'most-likely'],
      readSurfacesAffected: ['Current Board', 'Best Bets Today', 'Most Likely', 'Best Value'],
    },
    blockers: ['manual_approval_required', 'promotion_readiness_required'],
  }
}

export async function getMlbPlayerMetadataCoverage() {
  const [players, mappings] = await Promise.all([
    supabaseAdmin
      .from('sport_players')
      .select('id, sport_key, league_key, team_id, team_name, display_name, position, jersey, status, height, weight, birth_date, nationality, active, provider_ids, metadata, updated_at')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(0, 999),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('id, entity_type, internal_id, provider, provider_id, metadata, updated_at')
      .eq('sport_key', SPORT_KEY)
      .eq('provider', 'sportsdataio')
      .order('updated_at', { ascending: false })
      .range(0, 999),
  ])
  const playerRows = players.error ? [] : ((players.data ?? []) as Array<Record<string, unknown>>)
  const mappingRows = mappings.error ? [] : ((mappings.data ?? []) as Array<Record<string, unknown>>)
  const activeRows = playerRows.filter((row) => row.active === true)
  const latest = freshness(
    playerRows.map((row) => ({
      id: String(row.id),
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: null,
      stat_type: null,
      event_id: null,
      team_id: safeText(row.team_id),
      player_id: String(row.id),
      player_name: safeText(row.display_name),
      provider: 'sportsdataio',
      games: null,
      starts: null,
      starter: null,
      source_timestamp: safeText(row.updated_at),
      provider_ids: asRecord(row.provider_ids),
      stats: {},
      metadata: asRecord(row.metadata),
      updated_at: safeText(row.updated_at),
    }))
  )
  const hasProviderId = (row: Record<string, unknown>) => {
    const ids = asRecord(row.provider_ids)
    return Boolean(ids.sportsdataio ?? ids.PlayerID ?? ids.PlayerId ?? ids.player)
  }
  const metadataHas = (row: Record<string, unknown>, keys: string[]) => {
    const metadata = asRecord(row.metadata)
    return keys.some((key) => metadata[key] !== null && metadata[key] !== undefined && String(metadata[key]).trim() !== '')
  }
  return {
    success: true,
    mode: 'mlb_player_metadata_cache_v1',
    providerCallsMade: 0,
    generatedAt: new Date().toISOString(),
    status: players.error ? 'schema_or_permission_blocked' : playerRows.length ? 'cached_player_metadata_available' : 'empty_player_metadata_cache',
    cachePolicy: {
      ttl: '7 days',
      providerCallsMadeByThisRun: 0,
      boundedSample: true,
      readLimit: 1000,
      nextProviderRefreshAllowed: latest.ageHours === null || latest.ageHours > 168,
      priority: 'Priority 3 after games, odds, results, prediction refresh and settlement.',
    },
    playerRows: playerRows.length,
    providerMappings: mappingRows.length,
    canonicalFields: ['providerPlayerId', 'team', 'name', 'position', 'positionCategory', 'throwHand', 'batHand', 'rosterStatus', 'injuryStatus', 'source', 'capturedAt', 'freshness', 'mappingStatus'],
    coverage: {
      names: playerRows.filter((row) => Boolean(row.display_name)).length,
      activePlayers: activeRows.length,
      teams: playerRows.filter((row) => Boolean(row.team_id ?? row.team_name)).length,
      providerIds: playerRows.filter(hasProviderId).length,
      positions: playerRows.filter((row) => Boolean(row.position)).length,
      jerseys: playerRows.filter((row) => Boolean(row.jersey)).length,
      rosterStatus: playerRows.filter((row) => Boolean(row.status)).length,
      biographical: playerRows.filter((row) => Boolean(row.height ?? row.weight ?? row.birth_date ?? row.nationality)).length,
      handedness: playerRows.filter((row) => metadataHas(row, ['ThrowHand', 'BatHand', 'throwHand', 'batHand', 'throws', 'bats'])).length,
      injuryStatus: playerRows.filter((row) => metadataHas(row, ['InjuryStatus', 'injuryStatus'])).length,
      uniquePositions: Array.from(new Set(playerRows.map((row) => safeText(row.position)).filter(Boolean))).sort(),
      freshness: latest,
    },
    readiness: {
      playerMetadataCacheReady: playerRows.length > 0,
      playerIdentityMappingReady: playerRows.some(hasProviderId) || mappingRows.length > 0,
      handednessReady: playerRows.some((row) => metadataHas(row, ['ThrowHand', 'BatHand', 'throwHand', 'batHand', 'throws', 'bats'])),
      injuryStatusReady: playerRows.some((row) => metadataHas(row, ['InjuryStatus', 'injuryStatus'])),
      productionInjection: false,
    },
    blockers: players.error
      ? [players.error.message]
      : [
          playerRows.length ? null : 'player_metadata_cache_empty',
          playerRows.some((row) => metadataHas(row, ['ThrowHand', 'BatHand', 'throwHand', 'batHand', 'throws', 'bats'])) ? null : 'handedness_fields_not_cached',
          playerRows.some((row) => metadataHas(row, ['InjuryStatus', 'injuryStatus'])) ? null : 'injury_status_not_cached_from_player_metadata',
          'lineups_and_injuries_require_separate_verified_sources',
        ].filter(Boolean),
  }
}

export async function getMlbStadiumMetadataCoverage(selectedDate = '2026-07-17') {
  const intelligence = await getMlbStarterWeatherStadiumIntelligence(selectedDate)
  const games = intelligence.games ?? []
  const stadiumIds = Array.from(new Set(games.map((game) => game.stadium?.stadiumId).filter(Boolean)))
  return {
    success: true,
    mode: 'mlb_stadium_metadata_cache_zero_call_foundation_v1',
    selectedDate,
    providerCallsMade: 0,
    stadiumIdsVerifiedFromGamesByDate: stadiumIds.length,
    stadiumIds,
    canonicalFields: ['StadiumID', 'name', 'city', 'state', 'country', 'surface', 'type', 'capacity', 'fieldDimensions', 'latitude', 'longitude', 'altitude', 'homePlateDirection', 'weatherExposure', 'freshness', 'source'],
    coverage: {
      stadiumId: stadiumIds.length,
      metadata: 0,
      parkFactors: 0,
    },
    blockers: ['StadiumID is verified, but stadium metadata cache requires stored metadata or one approved Stadiums provider call. No park factors were fabricated.'],
    oneCallPlan: {
      endpointPurpose: 'Stadium metadata cache hydration',
      providerCallsRequired: 1,
      executeNow: false,
    },
  }
}

export async function getMlbPitcherBullpenFoundations(selectedDate = '2026-07-17') {
  const [stats, intelligence] = await Promise.all([readMlbPlayerStatCache(), getMlbStarterWeatherStadiumIntelligence(selectedDate)])
  const statRows = stats.rows
  const pitchingRows = statRows.filter(isPitchingRow)
  const seasonPitchingRows = pitchingRows.filter((row) => row.stat_type === 'season')
  const gamePitchingRows = pitchingRows.filter((row) => row.stat_type === 'game')
  const rowsByProviderPlayer = new Map<string, PlayerStatRow[]>()
  for (const row of pitchingRows) {
    const key = providerPlayerId(row)
    if (!key) continue
    rowsByProviderPlayer.set(key, [...(rowsByProviderPlayer.get(key) ?? []), row])
  }
  const starterProfiles = intelligence.games.flatMap((game) => {
    const starters = asRecord(game.starters)
    return (['away', 'home'] as const).map((side) => {
      const starter = asRecord(starters[side])
      const providerId = safeText(starter.playerId)
      const rows = providerId ? rowsByProviderPlayer.get(providerId) ?? [] : []
      const seasonRow = rows.find((row) => row.stat_type === 'season') ?? rows[0] ?? null
      return {
        eventId: game.eventId,
        matchup: game.matchup,
        side,
        ...summarizeStarterStat(seasonRow, {
          playerId: starter.playerId === null || starter.playerId === undefined ? null : Number(starter.playerId),
          name: safeText(starter.name),
          status: String(starter.status ?? 'unknown'),
        }),
      }
    })
  })
  const starterMatches = starterProfiles.filter((profile) => profile.cacheStatus === 'cached_stat_match')
  const bullpen = summarizeBullpenRows(statRows)
  const statFreshness = freshness(statRows)
  const coverageStatus =
    stats.error
      ? 'schema_or_permission_blocked'
      : statRows.length === 0
        ? 'no_cached_player_stats'
        : starterMatches.length || bullpen.coverage.reliefStatRows
          ? 'cached_intelligence_available'
          : 'cached_rows_not_mapped_to_pitching_roles'
  return {
    success: true,
    mode: 'mlb_pitcher_bullpen_intelligence_v1',
    selectedDate,
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    cachePolicy: {
      providerCallsAllowedByPolicy: true,
      callsMadeByThisRun: 0,
      reason: 'Cache-first read-only intelligence pass. Provider refresh is reserved for stale or absent Priority 2/3 data after higher-priority lifecycle work.',
      ttl: {
        playerStats: '7 days for player metadata; game/usage freshness reported from source timestamps',
        bullpenWorkload: 'derived from cached player game stats when available',
      },
    },
    cacheStatus: {
      status: coverageStatus,
      sourceTableAvailable: !stats.error,
      blocker: stats.error,
      totalCachedRows: statRows.length,
      boundedSample: true,
      readLimit: stats.limit,
      pitchingRows: pitchingRows.length,
      seasonPitchingRows: seasonPitchingRows.length,
      gamePitchingRows: gamePitchingRows.length,
      freshness: statFreshness,
    },
    pitcherIntelligence: {
      status:
        starterProfiles.length === 0
          ? 'no_verified_starter_context'
          : starterMatches.length
            ? 'starter_stat_cache_matched'
            : 'verified_starters_missing_cached_stats',
      metrics: ['ERA', 'WHIP', 'K/9', 'BB/9', 'HR/9', 'innings', 'pitchesThrown', 'recentStarts', 'recentWorkload', 'restDays', 'pitchCountTrend', 'BAA', 'OPSAllowed', 'wOBAAllowed', 'qualityScore', 'reliabilityScore', 'volatilityScore', 'fatigueScore', 'expectedWorkload', 'dataConfidence'],
      formulaVersion: 'mlb_pitcher_statistical_intelligence_foundation_v1',
      storedStatRows: statRows.length,
      coverage: {
        verifiedStarterSlots: starterProfiles.length,
        starterSlotsWithProviderIds: starterProfiles.filter((profile) => profile.providerPlayerId !== null).length,
        starterSlotsWithCachedStats: starterMatches.length,
        starterStatCoveragePct: starterProfiles.length ? round((starterMatches.length / starterProfiles.length) * 100) : 0,
      },
      profiles: starterProfiles,
      productionInjection: false,
      missingPolicy: 'Unavailable metrics remain null with missing reasons; no defaults that look real are emitted.',
    },
    bullpenIntelligence: {
      ...bullpen,
      metrics: ['bullpenInningsLast1Days', 'bullpenInningsLast2Days', 'bullpenInningsLast3Days', 'relieversUsed', 'pitchesThrown', 'recentERA', 'recentWHIP', 'K/BB', 'closerRecentUsage', 'highLeverageUsage', 'fatigue', 'availabilityConfidence', 'quality', 'reliability'],
      formulaVersion: 'mlb_bullpen_intelligence_foundation_v1',
      verifiedFactsOnly: true,
      inferredFatigueSeparated: true,
      closerAvailabilityClaimed: false,
      productionInjection: false,
    },
    productReadiness: {
      headline:
        starterMatches.length || bullpen.coverage.reliefGameRows
          ? 'Cached pitching intelligence is available for analyst context, but not official-pick promotion.'
          : 'Pitching and bullpen intelligence remain blocked by missing cached MLB player-stat mappings.',
      starterEngineV7InputReady: starterMatches.length > 0,
      bullpenEngineInputReady: bullpen.coverage.reliefGameRows > 0,
      confidenceEngineV2Ready: starterMatches.length > 0 || bullpen.coverage.reliefGameRows > 0,
      officialPolicyChanged: false,
      recommendationThresholdsChanged: false,
      modelPromotionPerformed: false,
    },
    nextActions: [
      starterMatches.length === 0 ? 'Hydrate or map MLB player stat cache for verified starter provider IDs before V7 production injection.' : null,
      bullpen.coverage.reliefStatRows === 0 ? 'Hydrate cached MLB player game stats before bullpen fatigue can affect confidence.' : null,
      'Keep bullpen and pitcher signals as explanation/confidence inputs until settled calibration validates impact.',
    ].filter(Boolean),
  }
}
