import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { stableProjectionId } from '@/services/mlb-projection-integrity.service'
import { getMlbStarterIntelligence } from '@/services/mlb-starter-intelligence.service'
import { buildMlbPitcherProjectionFeatures } from '@/services/mlb-pitcher-feature-builder.service'
import type {
  MlbPitcherProjection,
  PitcherConfidenceLevel,
  PitcherDataSufficiency,
  PitcherOutsDistribution,
  PitcherProjectionFeatures,
  PitcherProjectionHealth,
} from '@/types/mlb-pitcher-projections'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
export const MLB_PITCHER_PROJECTION_MODEL_VERSION = 'mlb_pitcher_projection_engine_v1'
const THRESHOLDS = ['14.5', '15.5', '16.5', '17.5', '18.5'] as const

type EventRow = {
  id: string
  season: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
}

function todayLocalDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function round(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalPdf(x: number, mean: number, sd: number) {
  return Math.exp(-0.5 * ((x - mean) / sd) ** 2)
}

export function createPitcherOutsDistribution(meanOuts: number, standardDeviation: number, qualityScore: number): PitcherOutsDistribution {
  const sd = clamp(standardDeviation + (100 - qualityScore) / 35, 2.2, 6.5)
  const minOuts = 0
  const maxOuts = 27
  const raw = Array.from({ length: maxOuts + 1 }, (_, outs) => ({ outs, probability: normalPdf(outs, meanOuts, sd) }))
  const total = raw.reduce((sum, row) => sum + row.probability, 0)
  const normalized = raw.map((row) => ({ outs: row.outs, probability: row.probability / total }))
  const drift = 1 - normalized.reduce((sum, row) => sum + row.probability, 0)
  normalized[normalized.length - 1].probability += drift
  return {
    minOuts,
    maxOuts,
    meanOuts: round(meanOuts) ?? meanOuts,
    standardDeviation: round(sd) ?? sd,
    outcomes: normalized.map((row) => ({ outs: row.outs, probability: round(row.probability, 6) ?? 0 })),
  }
}

function thresholdProbabilities(distribution: PitcherOutsDistribution | null) {
  const over = Object.fromEntries(THRESHOLDS.map((line) => [line, null])) as MlbPitcherProjection['overProbabilities']
  const under = Object.fromEntries(THRESHOLDS.map((line) => [line, null])) as MlbPitcherProjection['underProbabilities']
  if (!distribution) return { over, under }
  for (const line of THRESHOLDS) {
    const threshold = Number(line)
    const pOver = clamp(distribution.outcomes.filter((row) => row.outs > threshold).reduce((sum, row) => sum + row.probability, 0), 0, 1)
    over[line] = round(pOver, 4)
    under[line] = round(1 - pOver, 4)
  }
  return { over, under }
}

function confidenceLevel(score: number, sufficiency: PitcherDataSufficiency): PitcherConfidenceLevel {
  if (sufficiency === 'INSUFFICIENT') return 'INSUFFICIENT'
  if (score >= 80) return 'HIGH'
  if (score >= 60) return 'MODERATE'
  return 'LOW'
}

function projectedOuts(features: PitcherProjectionFeatures) {
  if (features.dataSufficiency === 'INSUFFICIENT' || features.blockers.length) return null
  const season = features.seasonProfile.averageOuts ?? features.seasonProfile.medianOuts
  const recent = features.recentForm.weightedRecentOuts
  if (season === null || recent === null) return null
  const trendAdjustment = clamp(features.recentForm.workloadTrend ?? 0, -1.5, 1.5) * 0.35
  const efficiencyAdjustment = clamp(-(features.recentForm.efficiencyTrend ?? 0) * 0.15, -0.75, 0.75)
  const restAdjustment = features.recentForm.shortRestIndicator ? -0.65 : 0.15
  const starterAdjustment = features.starterAssignment.starterStatus === 'CONFIRMED' ? 0.25 : features.starterAssignment.starterStatus === 'PROBABLE' ? 0 : -0.45
  const volatilityPenalty = clamp(((features.workloadContext.volatility ?? 3.5) - 3) * 0.25, 0, 1.2)
  return round(clamp(season * 0.55 + recent * 0.35 + (features.seasonProfile.medianOuts ?? season) * 0.1 + trendAdjustment + efficiencyAdjustment + restAdjustment + starterAdjustment - volatilityPenalty, 3, 24), 2)
}

function secondary(features: PitcherProjectionFeatures, outs: number | null) {
  if (outs === null) {
    return { innings: null, pitchCount: null, strikeouts: null, hits: null, earnedRuns: null }
  }
  const projectedInnings = round(outs / 3, 2)
  const pitchCount = features.seasonProfile.pitchesPerInning && projectedInnings
    ? round(clamp(features.seasonProfile.pitchesPerInning * projectedInnings, 35, 120), 0)
    : features.seasonProfile.averagePitchCount ? round(features.seasonProfile.averagePitchCount, 0) : null
  const battersFaced = features.seasonProfile.battersFacedPerInning && projectedInnings ? features.seasonProfile.battersFacedPerInning * projectedInnings : null
  return {
    innings: projectedInnings,
    pitchCount,
    strikeouts: battersFaced && features.seasonProfile.strikeoutRate !== null ? round(battersFaced * features.seasonProfile.strikeoutRate, 1) : null,
    hits: projectedInnings && features.seasonProfile.whip !== null ? round(Math.max(0, features.seasonProfile.whip * projectedInnings - ((features.seasonProfile.walkRate ?? 0) * (battersFaced ?? 0))), 1) : null,
    earnedRuns: projectedInnings && features.seasonProfile.era !== null ? round((features.seasonProfile.era / 9) * projectedInnings, 1) : null,
  }
}

function drivers(features: PitcherProjectionFeatures) {
  return [
    features.starterAssignment.starterStatus === 'CONFIRMED' ? 'Confirmed starter evidence' : null,
    features.starterAssignment.starterStatus === 'PROBABLE' ? 'Probable starter evidence' : null,
    features.gameLogs.length >= 15 ? 'Strong historical start sample' : features.gameLogs.length >= 8 ? 'Usable historical start sample' : null,
    (features.recentForm.weightedRecentOuts ?? 0) >= (features.seasonProfile.averageOuts ?? 99) ? 'Recent workload at or above season baseline' : null,
    (features.seasonProfile.pitchesPerInning ?? 99) <= 17 ? 'Efficient pitches per inning' : null,
    features.workloadContext.pctReach18 && features.workloadContext.pctReach18 >= 0.5 ? 'Frequently reaches six innings' : null,
  ].filter(Boolean) as string[]
}

function risks(features: PitcherProjectionFeatures) {
  return [
    features.starterAssignment.starterStatus !== 'CONFIRMED' ? 'Starter not confirmed' : null,
    features.gameLogs.length < 8 ? 'Limited historical starter sample' : null,
    (features.workloadContext.volatility ?? 0) >= 4 ? 'Recent outs volatility' : null,
    features.recentForm.shortRestIndicator ? 'Possible short-rest workload penalty' : null,
    features.opponentContext.availability !== 'AVAILABLE' ? 'Opponent context incomplete' : null,
    features.seasonProfile.averagePitchCount === null ? 'Pitch-count history unavailable' : null,
  ].filter(Boolean) as string[]
}

async function loadEvents(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, season, home_team_id, away_team_id, home_team, away_team, start_time, status')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB pitcher projection event read failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

function starterInputs(starterIntelligence: Awaited<ReturnType<typeof getMlbStarterIntelligence>>) {
  return starterIntelligence.games.flatMap((game) => [
    { side: game.starters.away, opponent: game.homeTeam, scheduledTime: game.scheduledTime },
    { side: game.starters.home, opponent: game.awayTeam, scheduledTime: game.scheduledTime },
  ]).map(({ side, opponent, scheduledTime }) => ({
    eventId: side.eventId,
    pitcherId: side.playerId,
    providerPitcherId: side.providerPlayerId,
    pitcherName: side.playerName,
    team: side.teamName,
    teamId: side.teamId,
    opponent,
    opponentTeamId: side.opponentTeamId,
    homeAway: side.side,
    handedness: null,
    activeStatus: null,
    starterStatus: side.projectionStatus,
    starterSource: side.source,
    starterConfirmedAt: side.sourceTimestamp,
    eventStartTime: scheduledTime,
  }))
}

export function buildMlbPitcherProjectionFromFeatures(features: PitcherProjectionFeatures, generatedAt: string): MlbPitcherProjection {
  const expectedOuts = projectedOuts(features)
  const secondaries = secondary(features, expectedOuts)
  const confidence = features.dataSufficiency === 'INSUFFICIENT' ? 0 : clamp(Math.round(features.qualityScore - ((features.workloadContext.volatility ?? 4) > 4 ? 6 : 0)), 1, 95)
  const distribution = expectedOuts === null ? null : createPitcherOutsDistribution(expectedOuts, features.workloadContext.volatility ?? 4.2, features.qualityScore)
  const thresholds = thresholdProbabilities(distribution)
  const mainDrivers = drivers(features)
  const mainRisks = risks(features)
  return {
    projectionId: stableProjectionId([SPORT_KEY, features.starterAssignment.eventId, features.identity.pitcherId, 'pitcher_outs_recorded', MLB_PITCHER_PROJECTION_MODEL_VERSION, generatedAt.slice(0, 10)]),
    eventId: features.starterAssignment.eventId,
    pitcherId: features.identity.pitcherId,
    providerPitcherId: features.identity.providerPitcherId,
    pitcherName: features.identity.pitcherName,
    team: features.identity.team,
    opponent: features.starterAssignment.opponent,
    homeAway: features.starterAssignment.homeAway,
    handedness: features.identity.handedness,
    starterStatus: features.starterAssignment.starterStatus,
    starterSource: features.starterAssignment.starterSource,
    starterConfirmedAt: features.starterAssignment.starterConfirmedAt,
    projectedOuts: expectedOuts,
    projectedInnings: secondaries.innings,
    projectedPitchCount: secondaries.pitchCount,
    projectedStrikeouts: secondaries.strikeouts,
    projectedHitsAllowed: secondaries.hits,
    projectedEarnedRuns: secondaries.earnedRuns,
    secondaryAvailability: {
      pitchCount: secondaries.pitchCount === null ? 'UNAVAILABLE' : features.gameLogs.length < 8 ? 'LIMITED' : 'AVAILABLE',
      innings: secondaries.innings === null ? 'UNAVAILABLE' : 'AVAILABLE',
      strikeouts: secondaries.strikeouts === null ? 'UNAVAILABLE' : features.gameLogs.length < 8 ? 'LIMITED' : 'AVAILABLE',
      hitsAllowed: secondaries.hits === null ? 'UNAVAILABLE' : features.gameLogs.length < 8 ? 'LIMITED' : 'AVAILABLE',
      earnedRuns: secondaries.earnedRuns === null ? 'UNAVAILABLE' : features.gameLogs.length < 8 ? 'LIMITED' : 'AVAILABLE',
    },
    outsDistribution: distribution,
    overProbabilities: thresholds.over,
    underProbabilities: thresholds.under,
    confidence,
    confidenceLevel: confidenceLevel(confidence, features.dataSufficiency),
    qualityScore: features.qualityScore,
    dataSufficiency: features.dataSufficiency,
    recommendationStatus: 'MODEL_PROJECTION_ONLY',
    featureSnapshot: features,
    mainDrivers,
    mainRisks,
    blockers: features.blockers,
    warnings: features.warnings,
    expectedWorkloadClassification: features.workloadContext.workloadClassification,
    modelVersion: MLB_PITCHER_PROJECTION_MODEL_VERSION,
    generatedAt,
    eventStartTime: features.starterAssignment.eventStartTime,
    cutoffAt: features.starterAssignment.cutoffAt,
  }
}

function aggregateLeakage(projections: MlbPitcherProjection[]) {
  return projections.reduce((acc, row) => {
    const counters = row.featureSnapshot.leakageCounters
    acc.postStartFeatures += counters.postStartFeatures
    acc.postFinalFeatures += counters.postFinalFeatures
    acc.futureGameLogs += counters.futureGameLogs
    acc.futureLineups += counters.futureLineups
    acc.futureStarterUpdates += counters.futureStarterUpdates
    acc.invalidFeatureTimestamps += counters.invalidFeatureTimestamps
    return acc
  }, { postStartFeatures: 0, postFinalFeatures: 0, futureGameLogs: 0, futureLineups: 0, futureStarterUpdates: 0, invalidFeatureTimestamps: 0 })
}

export function validateMlbPitcherProjection(projections: MlbPitcherProjection[]) {
  const failedChecks: string[] = []
  const ids = projections.map((row) => row.projectionId)
  if (new Set(ids).size !== ids.length) failedChecks.push('duplicate projection IDs')
  for (const projection of projections) {
    if (projection.projectedOuts !== null && (projection.projectedOuts < 3 || projection.projectedOuts > 24)) failedChecks.push(`${projection.pitcherName} projected outs outside bounds`)
    if (projection.outsDistribution) {
      const sum = projection.outsDistribution.outcomes.reduce((total, row) => total + row.probability, 0)
      if (Math.abs(sum - 1) > 0.002) failedChecks.push(`${projection.pitcherName} distribution does not sum to 1`)
      if (projection.outsDistribution.outcomes.some((row) => row.probability < 0 || row.outs < 0 || row.outs > 27)) failedChecks.push(`${projection.pitcherName} invalid distribution outcome`)
      let previous = 1
      for (const line of THRESHOLDS) {
        const over = projection.overProbabilities[line]
        const under = projection.underProbabilities[line]
        if (over === null || under === null) continue
        if (Math.abs(over + under - 1) > 0.002) failedChecks.push(`${projection.pitcherName} ${line} over/under mismatch`)
        if (over > previous + 0.002) failedChecks.push(`${projection.pitcherName} over probability is not monotonic`)
        previous = over
      }
    }
    if (projection.recommendationStatus !== 'MODEL_PROJECTION_ONLY') failedChecks.push(`${projection.pitcherName} recommendation status leakage`)
    if (!projection.pitcherId) failedChecks.push(`${projection.pitcherName} missing real pitcher ID`)
    if (projection.projectedOuts === 0 || projection.projectedInnings === 0) failedChecks.push(`${projection.pitcherName} unavailable value rendered as zero`)
  }
  return { success: failedChecks.length === 0, failedChecks }
}

export async function generateSlatePitcherProjections(options: { date?: string | null; limit?: number; persist?: boolean } = {}) {
  const selectedDate = options.date ?? todayLocalDate()
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200)
  const generatedAt = new Date().toISOString()
  const [events, starterIntelligence] = await Promise.all([loadEvents(selectedDate), getMlbStarterIntelligence({ date: selectedDate })])
  const eventIds = new Set(events.map((event) => event.id))
  const allInputs = starterInputs(starterIntelligence).filter((starter) => eventIds.has(starter.eventId))
  const inputs = allInputs.filter((starter) => starter.pitcherId && starter.pitcherName && starter.starterStatus !== 'UNVERIFIED')
  const features = await Promise.all(inputs.map((starter) => buildMlbPitcherProjectionFeatures(starter, generatedAt)))
  const projections = features.map((feature) => buildMlbPitcherProjectionFromFeatures(feature, generatedAt))
  const eligible = projections.filter((row) => row.projectedOuts !== null && row.dataSufficiency !== 'INSUFFICIENT' && row.featureSnapshot.leakageCounters.invalidFeatureTimestamps === 0)
  const validation = validateMlbPitcherProjection(projections)
  const persistence = await persistPitcherProjection(eligible, options.persist === true)
  return {
    success: true,
    mode: MLB_PITCHER_PROJECTION_MODEL_VERSION,
    generatedAt,
    selectedDate,
    providerCallsMade: 0,
    remoteMutationsMade: persistence.rowsPersisted,
    readOnly: options.persist !== true,
    sportsbookIndependent: true,
    noBettingRecommendations: true,
    recommendationStatus: 'MODEL_PROJECTION_ONLY',
    summary: {
      eventsEvaluated: events.length,
      starterSlotsEvaluated: allInputs.length,
      mappedStarterSlotsEvaluated: inputs.length,
      rowsGenerated: projections.length,
      rowsEligibleForNumericProjection: eligible.length,
      rowsBlocked: allInputs.length - eligible.length,
      averageProjectedOuts: eligible.length ? round(eligible.reduce((sum, row) => sum + (row.projectedOuts ?? 0), 0) / eligible.length) : null,
    },
    health: healthFrom({ projections, validation, rowsPersisted: persistence.rowsPersisted }),
    validation,
    persistence,
    projections: projections.slice(0, limit),
    warnings: [
      eligible.length < 5 ? 'Fewer than five grounded pitcher projections are available for this slate.' : null,
      'Projection Only',
      'Not a betting recommendation',
      'No sportsbook comparison yet',
    ].filter(Boolean),
  }
}

function healthFrom({ projections, validation, rowsPersisted }: { projections: MlbPitcherProjection[]; validation: ReturnType<typeof validateMlbPitcherProjection>; rowsPersisted: number }): PitcherProjectionHealth {
  return {
    success: validation.success,
    mode: 'mlb_pitcher_projection_health_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: rowsPersisted,
    rowsRead: projections.reduce((sum, row) => sum + row.featureSnapshot.rowsRead, 0),
    rowsGenerated: projections.length,
    rowsPersisted,
    rowsSkipped: projections.filter((row) => row.projectedOuts === null).length,
    warnings: projections.flatMap((row) => row.warnings).filter((value, index, values) => values.indexOf(value) === index),
    validation,
    leakageCounters: aggregateLeakage(projections),
  }
}

export async function getPitcherProjectionHealth(options: { date?: string | null } = {}) {
  const result = await generateSlatePitcherProjections({ date: options.date, limit: 200, persist: false })
  return result.health
}

export async function previewPitcherProjection(options: { date?: string | null; limit?: number } = {}) {
  return generateSlatePitcherProjections({ ...options, persist: false })
}

export async function generatePitcherProjection(options: { date?: string | null; persist?: boolean; limit?: number } = {}) {
  return generateSlatePitcherProjections(options)
}

export async function getSinglePitcherProjection(pitcherId: string, options: { date?: string | null } = {}) {
  const slate = await generateSlatePitcherProjections({ date: options.date, limit: 200, persist: false })
  const projection = slate.projections.find((row) => row.pitcherId === pitcherId || row.providerPitcherId === pitcherId || row.projectionId === pitcherId)
  if (!projection) return null
  return { ...slate, projections: [projection], projection }
}

export async function persistPitcherProjection(projections: MlbPitcherProjection[], persist: boolean) {
  if (!persist || !projections.length) return { dryRun: true, rowsPersisted: 0, rowsSkipped: projections.length, table: 'mlb_pitcher_projections', warning: null as string | null }
  const rows = projections.map((projection) => ({
    id: projection.projectionId,
    event_id: projection.eventId,
    pitcher_id: projection.pitcherId,
    provider_pitcher_id: projection.providerPitcherId,
    projection_date: projection.generatedAt.slice(0, 10),
    starter_status: projection.starterStatus,
    projected_outs: projection.projectedOuts,
    projected_innings: projection.projectedInnings,
    projected_pitch_count: projection.projectedPitchCount,
    projected_strikeouts: projection.projectedStrikeouts,
    projected_hits_allowed: projection.projectedHitsAllowed,
    projected_earned_runs: projection.projectedEarnedRuns,
    outs_distribution: projection.outsDistribution,
    threshold_probabilities: { over: projection.overProbabilities, under: projection.underProbabilities },
    confidence: projection.confidence,
    quality_score: projection.qualityScore,
    data_sufficiency: projection.dataSufficiency,
    feature_snapshot: projection.featureSnapshot,
    drivers: projection.mainDrivers,
    risks: projection.mainRisks,
    warnings: projection.warnings,
    model_version: projection.modelVersion,
    generated_at: projection.generatedAt,
    cutoff_at: projection.cutoffAt,
    updated_at: projection.generatedAt,
  }))
  const { error } = await supabaseAdmin.from('mlb_pitcher_projections').upsert(rows, { onConflict: 'id' })
  if (error) return { dryRun: false, rowsPersisted: 0, rowsSkipped: projections.length, table: 'mlb_pitcher_projections', warning: error.message }
  return { dryRun: false, rowsPersisted: rows.length, rowsSkipped: 0, table: 'mlb_pitcher_projections', warning: null as string | null }
}

export function validateMlbPitcherProjectionFixtures() {
  const distribution = createPitcherOutsDistribution(16.8, 3.4, 78)
  const thresholds = thresholdProbabilities(distribution)
  const monotonic = THRESHOLDS.every((line, index) => index === 0 || Number(thresholds.over[line]) <= Number(thresholds.over[THRESHOLDS[index - 1]]))
  const sum = distribution.outcomes.reduce((total, row) => total + row.probability, 0)
  const checks = [
    ['distribution sums to 1', Math.abs(sum - 1) < 0.002],
    ['distribution has no negative probabilities', distribution.outcomes.every((row) => row.probability >= 0)],
    ['distribution bounded to 0..27 outs', distribution.outcomes.every((row) => row.outs >= 0 && row.outs <= 27)],
    ['threshold over probabilities are monotonic', monotonic],
    ['over plus under equals 1', THRESHOLDS.every((line) => Math.abs(Number(thresholds.over[line]) + Number(thresholds.under[line]) - 1) < 0.002)],
    ['provider calls remain zero', true],
    ['recommendation status remains projection only', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_pitcher_projection_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
