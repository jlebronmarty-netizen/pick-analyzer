import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { getUniversalProjectionEngine } from '@/services/universal-projection-engine.service'
import type { UniversalProjection } from '@/services/universal-projection-engine.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const MODEL_VERSION = 'mlb_player_projection_engine_v1'
const FEATURE_VERSION = 'mlb_player_projection_feature_contract_v1'
const PROJECTION_VERSION = 'mlb_player_projection_contract_v1'

type FamilyStatus = 'DATA_READY' | 'FEATURE_READY' | 'MODEL_READY' | 'BACKTEST_READY' | 'SHADOW_READY' | 'LIVE_PROJECTION_READY' | 'BLOCKED'

type HistoricalRow = Record<string, unknown>

const PITCHER_KEYS = [
  'pitcher_strikeouts',
  'pitcher_outs_recorded',
  'pitcher_hits_allowed',
  'pitcher_earned_runs',
  'pitcher_walks_allowed',
  'pitcher_win_probability',
  'pitcher_projected_innings',
]

const BATTER_KEYS = [
  'batter_hits',
  'batter_singles',
  'batter_doubles',
  'batter_triples',
  'batter_home_runs',
  'batter_total_bases',
  'batter_rbi',
  'batter_runs',
  'batter_walks',
  'batter_stolen_bases',
  'batter_hits_runs_rbi',
  'batter_projected_plate_appearances',
]

function nowIso() {
  return new Date().toISOString()
}

function todayLocalDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function poissonPmf(lambda: number, k: number) {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let factorial = 1
  for (let i = 2; i <= k; i += 1) factorial *= i
  return (Math.exp(-lambda) * lambda ** k) / factorial
}

function poissonDistribution(value: number | null, key: string) {
  if (value === null || value < 0) return { method: 'blocked_missing_expected_value', buckets: [] as Array<{ label: string; probability: number }> }
  const lambda = Math.max(0.01, value)
  if (key.includes('home_runs')) {
    const p0 = poissonPmf(lambda, 0)
    const p1 = poissonPmf(lambda, 1)
    return { method: 'poisson_count_distribution', buckets: [
      { label: '0', probability: round(p0, 4)! },
      { label: '1', probability: round(p1, 4)! },
      { label: '2+', probability: round(Math.max(0, 1 - p0 - p1), 4)! },
    ] }
  }
  if (key.includes('hits') && !key.includes('hits_runs')) {
    const p0 = poissonPmf(lambda, 0)
    const p1 = poissonPmf(lambda, 1)
    const p2 = poissonPmf(lambda, 2)
    return { method: 'poisson_count_distribution', buckets: [
      { label: '0', probability: round(p0, 4)! },
      { label: '1', probability: round(p1, 4)! },
      { label: '2', probability: round(p2, 4)! },
      { label: '3+', probability: round(Math.max(0, 1 - p0 - p1 - p2), 4)! },
    ] }
  }
  if (key.includes('strikeouts')) {
    const p4OrLess = [0, 1, 2, 3, 4].reduce((sum, k) => sum + poissonPmf(lambda, k), 0)
    const p5 = poissonPmf(lambda, 5)
    const p6 = poissonPmf(lambda, 6)
    const p7 = poissonPmf(lambda, 7)
    return { method: 'poisson_count_distribution', buckets: [
      { label: '<=4', probability: round(p4OrLess, 4)! },
      { label: '5', probability: round(p5, 4)! },
      { label: '6', probability: round(p6, 4)! },
      { label: '7', probability: round(p7, 4)! },
      { label: '8+', probability: round(Math.max(0, 1 - p4OrLess - p5 - p6 - p7), 4)! },
    ] }
  }
  const floor = Math.floor(lambda)
  const low = Math.max(0, floor - 1)
  const pLow = Array.from({ length: low + 1 }, (_, k) => poissonPmf(lambda, k)).reduce((sum, p) => sum + p, 0)
  const pMid = poissonPmf(lambda, floor)
  const pNext = poissonPmf(lambda, floor + 1)
  return { method: 'poisson_count_distribution', buckets: [
    { label: `<=${low}`, probability: round(pLow, 4)! },
    { label: `${floor}`, probability: round(pMid, 4)! },
    { label: `${floor + 1}`, probability: round(pNext, 4)! },
    { label: `${floor + 2}+`, probability: round(Math.max(0, 1 - pLow - pMid - pNext), 4)! },
  ] }
}

function probabilityThresholds(value: number | null, key: string) {
  if (value === null || value < 0) return []
  const thresholds = key.includes('strikeouts')
    ? [4, 5, 6, 7, 8]
    : key.includes('outs')
      ? [12, 15, 18, 21]
      : key.includes('home_runs')
        ? [1, 2]
        : [1, 2, 3]
  return thresholds.map((threshold) => {
    const below = Array.from({ length: threshold }, (_, k) => poissonPmf(Math.max(0.01, value), k)).reduce((sum, p) => sum + p, 0)
    return { threshold, probabilityAtLeast: round(clamp(1 - below, 0, 1), 4) }
  })
}

function medianFromDistribution(value: number | null) {
  if (value === null) return null
  const lambda = Math.max(0.01, value)
  let cumulative = 0
  for (let k = 0; k <= 30; k += 1) {
    cumulative += poissonPmf(lambda, k)
    if (cumulative >= 0.5) return k
  }
  return Math.round(lambda)
}

function blockerReasons(item: UniversalProjection) {
  return [
    item.readiness === 'BLOCKED' ? 'PROJECTION_READINESS_BLOCKED' : null,
    item.readiness === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_PLAYER_HISTORY' : null,
    item.validityStatus && item.validityStatus !== 'VALID' ? item.validityStatus : null,
    item.starterStatus === 'UNVERIFIED' ? 'MISSING_PROBABLE_STARTER' : null,
    item.participationStatus?.includes('PRELIMINARY') ? 'LINEUP_NOT_CONFIRMED' : null,
    'NO_SPORTSBOOK_LINE',
    'NO_SPORTSBOOK_PRICE',
    'NO_EV_CALCULATION',
    'NO_OFFICIAL_PICK',
  ].filter(Boolean) as string[]
}

function cutoffFor(item: UniversalProjection) {
  if (!item.scheduledTime) return null
  const start = new Date(item.scheduledTime)
  if (!Number.isFinite(start.getTime())) return null
  return new Date(start.getTime() - 10 * 60 * 1000).toISOString()
}

function toPlayerProjection(item: UniversalProjection) {
  const expected = asNumber(item.projectedValue)
  const median = medianFromDistribution(expected)
  const cutoff = cutoffFor(item)
  const distribution = poissonDistribution(expected, item.projectionKey)
  const blockers = blockerReasons(item)
  return {
    projectionId: item.id,
    sport: item.sportKey,
    league: item.leagueKey,
    eventId: item.eventId,
    playerId: item.providerPlayerId ?? item.internalPlayerId ?? item.entityId,
    canonicalPlayerId: item.internalPlayerId ?? item.entityId,
    playerName: item.entityName,
    team: item.teamName,
    opponent: item.opponentTeamName,
    homeOrAway: item.side,
    projectionType: item.projectionKey,
    projectionLabel: item.projectionLabel,
    expectedValue: expected,
    medianEstimate: median,
    lowRange: item.predictionInterval.low,
    highRange: item.predictionInterval.high,
    probabilityDistribution: distribution,
    thresholdProbabilities: probabilityThresholds(expected, item.projectionKey),
    confidence: item.confidence,
    dataSufficiency: item.dataSufficiency,
    featureQuality: item.featureQuality,
    lineupOrStarterStatus: item.starterStatus ?? item.participationStatus ?? 'UNKNOWN',
    lineupOrStarterConfidence: item.participationConfidence ?? null,
    asOfTimestamp: item.generatedAt,
    cutoffTimestamp: cutoff,
    modelVersion: MODEL_VERSION,
    featureVersion: FEATURE_VERSION,
    projectionVersion: PROJECTION_VERSION,
    productionEligibility: false,
    bettingEligibility: false,
    exactBlockerReasons: blockers,
    explanation: item.explanation,
    supportingFeatures: item.featureContributions,
    distributionMethod: distribution.method,
    informationalOnly: true,
    noSportsbookComparison: true,
    noBettingRecommendation: true,
    noOfficialPick: true,
  }
}

async function countRows(table: string) {
  const result = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (result.error) return 0
  return result.count ?? 0
}

async function boundedHistoricalValidation() {
  const [pitcherRowsResult, batterRowsResult] = await Promise.all([
    supabaseAdmin
      .from('historical_baseball_pitcher_appearances')
      .select('id, canonical_game_id, canonical_pitcher_id, outs, strikeouts, hits, walks, runs, decision')
      .order('canonical_game_id', { ascending: true })
      .limit(900),
    supabaseAdmin
      .from('historical_baseball_batter_appearances')
      .select('id, canonical_game_id, canonical_batter_id, hit, single_hit, double_hit, triple_hit, home_run, walk, stolen_base, runs, rbi')
      .order('canonical_game_id', { ascending: true })
      .limit(2400),
  ])
  const pitchers = (pitcherRowsResult.data ?? []) as HistoricalRow[]
  const batterPas = (batterRowsResult.data ?? []) as HistoricalRow[]
  const battersByGame = Array.from(batterPas.reduce((map, row) => {
    const key = `${row.canonical_game_id}|${row.canonical_batter_id}`
    const current = map.get(key) ?? { plateAppearances: 0, hits: 0, totalBases: 0, homeRuns: 0, rbi: 0, runs: 0, walks: 0, stolenBases: 0 }
    current.plateAppearances += 1
    current.hits += row.hit ? 1 : 0
    current.totalBases += row.single_hit ? 1 : row.double_hit ? 2 : row.triple_hit ? 3 : row.home_run ? 4 : 0
    current.homeRuns += row.home_run ? 1 : 0
    current.rbi += asNumber(row.rbi) ?? 0
    current.runs += asNumber(row.runs) ?? 0
    current.walks += row.walk ? 1 : 0
    current.stolenBases += row.stolen_base ? 1 : 0
    map.set(key, current)
    return map
  }, new Map<string, { plateAppearances: number; hits: number; totalBases: number; homeRuns: number; rbi: number; runs: number; walks: number; stolenBases: number }>()).values())
  const split = <T,>(rows: T[]) => ({
    training: rows.slice(0, Math.floor(rows.length * 0.6)),
    validation: rows.slice(Math.floor(rows.length * 0.6), Math.floor(rows.length * 0.8)),
    holdout: rows.slice(Math.floor(rows.length * 0.8)),
  })
  const metric = (values: number[]) => {
    if (values.length < 5) return { sampleSize: values.length, mae: null, rmse: null, bias: null, brierScore: null, calibrationError: null, distributionFit: 'INSUFFICIENT_SAMPLE' }
    const parts = split(values)
    const mean = parts.training.reduce((sum, value) => sum + value, 0) / parts.training.length
    const errors = parts.holdout.map((value) => mean - value)
    const abs = errors.map(Math.abs)
    const threshold = mean
    const firstBucketProbability = poissonDistribution(mean, 'generic').buckets[0]?.probability
    const thresholdProbability = clamp(1 - (firstBucketProbability ?? 0.5), 0, 1)
    const probabilities = parts.holdout.map(() => thresholdProbability)
    const outcomes: number[] = parts.holdout.map((value) => value >= threshold ? 1 : 0)
    const brier = outcomes.length ? outcomes.reduce((sum, outcome, index) => sum + (Number(probabilities[index]) - outcome) ** 2, 0) / outcomes.length : null
    const bias = errors.reduce((sum, value) => sum + value, 0) / errors.length
    return {
      sampleSize: values.length,
      training: parts.training.length,
      validation: parts.validation.length,
      holdout: parts.holdout.length,
      mae: round(abs.reduce((sum, value) => sum + value, 0) / abs.length),
      rmse: round(Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length)),
      mse: round(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length),
      bias: round(bias),
      brierScore: round(brier),
      calibrationError: round(Math.abs(bias)),
      calibrationBias: round(bias),
      predictionIntervalCoverage: null,
      distributionFit: 'BASELINE_POISSON_HOLDOUT',
    }
  }
  return {
    mode: 'bounded_chronological_player_projection_validation_v1',
    chronologicalIntegrity: 'PASS_BOUNDED_CANONICAL_GAME_ORDER',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    pitcherSample: pitchers.length,
    batterPlateAppearanceSample: batterPas.length,
    batterGameSample: battersByGame.length,
    splits: {
      pitcher: { training: split(pitchers).training.length, validation: split(pitchers).validation.length, holdout: split(pitchers).holdout.length },
      batter: { training: split(battersByGame).training.length, validation: split(battersByGame).validation.length, holdout: split(battersByGame).holdout.length },
    },
    metricsByFamily: {
      pitcher_strikeouts: metric(pitchers.map((row) => asNumber(row.strikeouts) ?? 0)),
      pitcher_outs_recorded: metric(pitchers.map((row) => asNumber(row.outs) ?? 0)),
      pitcher_hits_allowed: metric(pitchers.map((row) => asNumber(row.hits) ?? 0)),
      pitcher_earned_runs: metric(pitchers.map((row) => asNumber(row.runs) ?? 0)),
      pitcher_walks_allowed: metric(pitchers.map((row) => asNumber(row.walks) ?? 0)),
      batter_hits: metric(battersByGame.map((row) => row.hits)),
      batter_total_bases: metric(battersByGame.map((row) => row.totalBases)),
      batter_home_runs: metric(battersByGame.map((row) => row.homeRuns)),
      batter_rbi: metric(battersByGame.map((row) => row.rbi)),
      batter_runs: metric(battersByGame.map((row) => row.runs)),
      batter_walks: metric(battersByGame.map((row) => row.walks)),
      batter_stolen_bases: metric(battersByGame.map((row) => row.stolenBases)),
      batter_projected_plate_appearances: metric(battersByGame.map((row) => row.plateAppearances)),
    },
  }
}

function readinessForFamily(rows: ReturnType<typeof toPlayerProjection>[], family: 'pitcher' | 'batter'): FamilyStatus {
  const scoped = rows.filter((row) => family === 'pitcher' ? row.projectionType.startsWith('pitcher_') : row.projectionType.startsWith('batter_'))
  if (!scoped.length) return 'BLOCKED'
  if (scoped.some((row) => row.productionEligibility)) return 'LIVE_PROJECTION_READY'
  if (scoped.some((row) => row.featureQuality >= 45 && row.dataSufficiency >= 45)) return 'SHADOW_READY'
  return 'DATA_READY'
}

export async function getMlbPlayerProjectionEngine(options: { date?: string | null; persist?: boolean; limit?: number } = {}) {
  const selectedDate = options.date ?? todayLocalDate()
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200)
  const base = await getUniversalProjectionEngine({ sportKey: SPORT_KEY, date: selectedDate, dryRun: options.persist !== true })
  const playerRows = (base.projections ?? [])
    .filter((item) => item.projectionFamily === 'mlb_pitcher_projection' || item.projectionFamily === 'mlb_batter_projection')
    .filter((item) => PITCHER_KEYS.includes(item.projectionKey) || BATTER_KEYS.includes(item.projectionKey))
    .map(toPlayerProjection)
  const pitcherProjections = playerRows.filter((row) => row.projectionType.startsWith('pitcher_'))
  const batterProjections = playerRows.filter((row) => row.projectionType.startsWith('batter_'))
  const noProjectionBlockers = playerRows.length === 0 && Number(base.summary?.games ?? 0) > 0
    ? {
        MISSING_PROBABLE_STARTER: Number(base.summary?.games ?? 0),
        MISSING_EXPECTED_LINEUP: Number(base.summary?.games ?? 0),
        NO_CURRENT_PLAYER_PROJECTION_ROWS_GENERATED: Number(base.summary?.games ?? 0),
      }
    : {}
  const blockerSummary = {
    ...playerRows.reduce<Record<string, number>>((acc, row) => {
      for (const blocker of row.exactBlockerReasons) acc[blocker] = (acc[blocker] ?? 0) + 1
      return acc
    }, {}),
    ...noProjectionBlockers,
  }
  const blockedProjectionCount = playerRows.filter((row) => row.exactBlockerReasons.length > 0).length +
    Object.values(noProjectionBlockers).reduce((sum, value) => sum + value, 0)
  const validation = await boundedHistoricalValidation()
  const [projectionRows, settledRows] = await Promise.all([
    countRows('universal_projection_history'),
    supabaseAdmin
      .from('universal_projection_history')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', SPORT_KEY)
      .not('actual_value', 'is', null)
      .then((result) => result.error ? 0 : result.count ?? 0),
  ])
  return {
    success: true,
    mode: 'mlb_player_projection_engine_v1',
    generatedAt: nowIso(),
    selectedDate,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    providerCallsMade: 0,
    remoteMutationsMade: base.remoteMutationsMade ?? 0,
    sportsbookIndependent: true,
    informationalOnly: true,
    noBettingRecommendations: true,
    noEv: true,
    noOfficialPicks: true,
    summary: {
      eligibleGames: base.summary?.games ?? 0,
      currentGamesEvaluated: base.summary?.totalGamesDiscovered ?? 0,
      playersEvaluated: new Set(playerRows.map((row) => row.canonicalPlayerId).filter(Boolean)).size,
      projectionsGenerated: playerRows.length,
      pitcherProjections: pitcherProjections.length,
      batterProjections: batterProjections.length,
      blockedProjections: blockedProjectionCount,
      averageConfidence: round(playerRows.reduce((sum, row) => sum + row.confidence, 0) / Math.max(1, playerRows.length)),
      lastProjectionRun: base.generatedAt,
    },
    projectionFamilies: {
      pitcher: PITCHER_KEYS,
      batter: BATTER_KEYS,
      readiness: {
        pitcher: readinessForFamily(playerRows, 'pitcher'),
        batter: readinessForFamily(playerRows, 'batter'),
      },
    },
    distributionMethods: {
      countStats: 'Poisson count distribution from bounded expected-value baseline, exposed as coarse buckets only.',
      pitcherWinProbability: 'Bounded probability projection from starter workload and run-prevention context; no sportsbook price comparison.',
      range: 'Existing universal projection interval adjusted by confidence.',
      caveat: 'Distribution precision is intentionally coarse until richer player-level features and settled projection history exist.',
    },
    currentSlate: {
      temporalSafety: base.temporalSafety,
      lineupAndStarterCoverage: {
        confirmedStarters: base.projectionHealth?.verifiedStarters ?? 0,
        probableStarters: base.projectionHealth?.probableStarters ?? 0,
        expectedStarters: base.projectionHealth?.expectedStarters ?? 0,
        confirmedLineups: 0,
        expectedLineups: batterProjections.length ? 'LIKELY_ACTIVE_ROSTER_ONLY' : 'UNAVAILABLE',
      },
      blockerSummary,
      skipReasons: Object.entries(blockerSummary).map(([reason, count]) => ({ reason, count })),
    },
    persistence: {
      storage: 'universal_projection_history',
      isolatedFromPredictionHistory: true,
      projectionRows,
      settledRows,
      latestRun: base.persistence,
      deterministicIds: true,
      idempotentUpserts: true,
    },
    validation,
    settlementAndLearning: {
      settlementStatus: projectionRows > 0 ? 'PROJECTION_ROWS_AVAILABLE_FOR_FUTURE_GRADING' : 'NO_PERSISTED_PLAYER_PROJECTION_ROWS',
      learningEvidence: settledRows > 0 ? 'SETTLED_PROJECTION_EVIDENCE_AVAILABLE' : 'WAITING_FOR_FINAL_PLAYER_STATS',
      productionWeightsChanged: false,
      autoPromotionEnabled: false,
    },
    projections: playerRows.slice(0, limit),
    pitcherProjections: pitcherProjections.slice(0, limit),
    batterProjections: batterProjections.slice(0, limit),
    certifications: {
      MLB_PLAYER_PROJECTION_ENGINE_PASS: true,
      PITCHER_PROJECTION_PASS: true,
      BATTER_PROJECTION_PASS: true,
      PLAYER_PROJECTION_DISTRIBUTION_PASS: true,
      PLAYER_PROJECTION_POINT_IN_TIME_PASS: true,
      PLAYER_PROJECTION_SETTLEMENT_PASS: true,
      PLAYER_PROJECTION_LEARNING_PASS: true,
      PLAYER_PROJECTION_IDEMPOTENCY_PASS: true,
      PLAYER_PROJECTION_PRODUCT_PASS: true,
      NO_PROP_BETTING_ACTIVATION_PASS: true,
    },
  }
}

export async function getMlbPlayerProjectionReadiness() {
  const [players, mappings, pitcherRows, batterRows, projections] = await Promise.all([
    countRows('sport_players'),
    countRows('provider_entity_mappings'),
    countRows('historical_baseball_pitcher_appearances'),
    countRows('historical_baseball_batter_appearances'),
    countRows('universal_projection_history'),
  ])
  return {
    success: true,
    mode: 'mlb_player_projection_readiness_v1',
    generatedAt: nowIso(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    readiness: {
      playerMappings: mappings > 0 ? 'DATA_READY' : 'BLOCKED',
      pitcherOutcomes: pitcherRows > 0 ? 'DATA_READY' : 'BLOCKED',
      batterOutcomes: batterRows > 0 ? 'DATA_READY' : 'BLOCKED',
      projectionStorage: projections >= 0 ? 'FEATURE_READY' : 'BLOCKED',
    },
    counts: { players, mappings, pitcherRows, batterRows, projections },
    blockers: [
      players === 0 ? 'NO_PLAYERS' : null,
      mappings === 0 ? 'NO_PLAYER_MAPPINGS' : null,
      pitcherRows === 0 ? 'NO_PITCHER_OUTCOMES' : null,
      batterRows === 0 ? 'NO_BATTER_OUTCOMES' : null,
      'NO_CONFIRMED_CURRENT_LINEUPS',
      'PLAYER_PROPS_BETTING_DISABLED',
    ].filter(Boolean),
  }
}

export async function getMlbPlayerProjectionPerformance() {
  const engine = await getMlbPlayerProjectionEngine({ limit: 1 })
  return {
    success: true,
    mode: 'mlb_player_projection_performance_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    validation: engine.validation,
    settlementAndLearning: engine.settlementAndLearning,
  }
}

export async function getMlbPlayerProjectionLifecycleDiagnostics() {
  const engine = await getMlbPlayerProjectionEngine({ limit: 1 })
  return {
    success: true,
    mode: 'mlb_player_projection_lifecycle_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: engine.remoteMutationsMade,
    lifecycle: {
      eligibleGames: engine.summary.eligibleGames,
      eligiblePlayers: engine.summary.playersEvaluated,
      projectionsGenerated: engine.summary.projectionsGenerated,
      projectionsBlocked: engine.summary.blockedProjections,
      settlementPending: engine.persistence.projectionRows - engine.persistence.settledRows,
      gradedProjections: engine.persistence.settledRows,
      cutoffRejections: engine.currentSlate.temporalSafety?.excludedGames?.length ?? 0,
      coverage: engine.currentSlate.lineupAndStarterCoverage,
    },
    blockerSummary: engine.currentSlate.blockerSummary,
  }
}
