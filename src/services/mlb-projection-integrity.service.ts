import 'server-only'

import { createHash } from 'crypto'

export type ProjectionUnit =
  | 'COUNT_PER_GAME'
  | 'SEASON_COUNT'
  | 'RATE_PER_9'
  | 'PERCENT_0_TO_1'
  | 'PERCENT_0_TO_100'
  | 'DECIMAL_RATE'
  | 'INNINGS_BASEBALL_NOTATION'
  | 'OUTS_COUNT'
  | 'PITCH_COUNT'
  | 'PROBABILITY'
  | 'UNKNOWN'

export type ProjectionOrigin = 'MODELLED' | 'PARTIAL_MODEL' | 'TEAM_SPECIFIC_BASELINE' | 'LEAGUE_BASELINE' | 'BLOCKED'
export type ProjectionValidity = 'VALID' | 'INVALID_INPUT' | 'INVALID_UNIT' | 'OUT_OF_RANGE' | 'MODEL_BLOCKED'
export type ProjectionRankTier = 'ELITE' | 'STRONG' | 'MODERATE' | 'LIMITED' | 'BLOCKED'
export type StarterStatus = 'CONFIRMED' | 'PROBABLE' | 'EXPECTED' | 'UNVERIFIED'
export type ParticipationStatus = 'CONFIRMED_STARTER' | 'PROBABLE_STARTER' | 'EXPECTED_PARTICIPANT' | 'PRELIMINARY_BATTER_PROJECTION' | 'LINEUP_VERIFIED_BATTER_PROJECTION' | 'UNVERIFIED'

export type ProjectionIntegrityInput = {
  projectionKey: string
  projectionFamily: string
  entityType: string
  entityId: string | null
  projectedValue: number | null
  unit: ProjectionUnit
  readiness: string
  confidence: number
  featureQuality: number
  dataSufficiency: number
  origin: ProjectionOrigin
  identityConfidence?: number | null
  eventIdentityConfidence?: number | null
  participationConfidence?: number | null
  historicalReliability?: number | null
  warnings?: string[]
}

export function stableProjectionId(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex').slice(0, 40)
}

export function roundProjection(value: number | null, unit: ProjectionUnit) {
  if (value === null || !Number.isFinite(value)) return null
  if (unit === 'PERCENT_0_TO_1' || unit === 'DECIMAL_RATE') return Math.round(value * 1000) / 1000
  if (unit === 'PERCENT_0_TO_100' || unit === 'PROBABILITY') return Math.round(value)
  if (unit === 'PITCH_COUNT' || unit === 'OUTS_COUNT') return Math.round(value * 10) / 10
  return Math.round(value * 100) / 100
}

export function baseballInningsNotationToOuts(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return { outs: null, valid: false, warning: 'missing_innings' }
  const text = String(value).trim()
  const [wholeRaw, fracRaw = '0'] = text.split('.')
  const whole = Number(wholeRaw)
  const frac = Number(fracRaw.slice(0, 1))
  if (!Number.isInteger(whole) || !Number.isInteger(frac) || frac < 0 || frac > 2) {
    return { outs: null, valid: false, warning: 'invalid_baseball_innings_notation' }
  }
  return { outs: whole * 3 + frac, valid: true, warning: null }
}

export function decimalInningsToOuts(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return value * 3
}

export function perNineToGameCount(ratePer9: number | null, projectedOuts: number | null) {
  if (ratePer9 === null || projectedOuts === null || !Number.isFinite(ratePer9) || !Number.isFinite(projectedOuts)) return null
  return (ratePer9 / 27) * projectedOuts
}

export function seasonCountToPerGame(value: number | null, games: number | null) {
  if (value === null || games === null || !Number.isFinite(value) || !Number.isFinite(games) || games <= 0) return null
  return value / games
}

function boundsFor(key: string, unit: ProjectionUnit) {
  if (key === 'pitcher_outs_recorded') return { min: 0, max: 27, warnMax: 24 }
  if (key === 'pitcher_strikeouts') return { min: 0, max: 20, warnMax: 14 }
  if (key === 'pitcher_hits_allowed') return { min: 0, max: 18, warnMax: 12 }
  if (key === 'pitcher_earned_runs') return { min: 0, max: 12, warnMax: 7 }
  if (key === 'pitcher_walks_allowed') return { min: 0, max: 10, warnMax: 6 }
  if (key === 'pitcher_pitch_count') return { min: 0, max: 130, warnMax: 110 }
  if (key === 'pitcher_whip') return { min: 0, max: 4, warnMax: 2.2 }
  if (key === 'pitcher_era') return { min: 0, max: 18, warnMax: 8 }
  if (key === 'pitcher_k_per_9') return { min: 0, max: 18, warnMax: 13 }
  if (key.includes('probability') || unit === 'PROBABILITY') return { min: 0, max: 100, warnMax: 85 }
  if (key.includes('percentage') && unit === 'PERCENT_0_TO_1') return { min: 0, max: 1, warnMax: 0.45 }
  if (key.includes('slugging')) return { min: 0, max: 1.2, warnMax: 0.7 }
  if (key.includes('team') || key.startsWith('projected_')) {
    if (key.includes('runs')) return { min: 0, max: 20, warnMax: 12 }
    if (key.includes('hits')) return { min: 0, max: 25, warnMax: 18 }
    if (key.includes('home_runs')) return { min: 0, max: 8, warnMax: 5 }
    if (key.includes('walks')) return { min: 0, max: 14, warnMax: 9 }
    if (key.includes('strikeouts')) return { min: 0, max: 22, warnMax: 16 }
    if (key.includes('total_bases')) return { min: 0, max: 40, warnMax: 28 }
  }
  if (key.startsWith('batter_')) {
    if (key.includes('ops') || key.includes('woba')) return { min: 0, max: 1.8, warnMax: 1.2 }
    return { min: 0, max: 8, warnMax: 5 }
  }
  return { min: 0, max: Number.POSITIVE_INFINITY, warnMax: Number.POSITIVE_INFINITY }
}

export function validateProjectionValue(input: ProjectionIntegrityInput) {
  const errors: string[] = []
  const warnings = [...(input.warnings ?? [])]
  if (input.origin === 'BLOCKED') errors.push('MODEL_BLOCKED')
  if ((input.entityType === 'pitcher' || input.entityType === 'player') && !input.entityId) errors.push('NULL_PLAYER_IDENTITY')
  if (input.projectedValue === null) errors.push('MISSING_PROJECTED_VALUE')
  if (input.unit === 'UNKNOWN') errors.push('UNKNOWN_UNIT')
  if (input.projectedValue !== null && !Number.isFinite(input.projectedValue)) errors.push('INVALID_NUMERIC_VALUE')
  if (input.origin === 'LEAGUE_BASELINE') warnings.push('LEAGUE_BASELINE_ONLY')

  if (input.projectedValue !== null && Number.isFinite(input.projectedValue)) {
    const bounds = boundsFor(input.projectionKey, input.unit)
    if (input.projectedValue < bounds.min || input.projectedValue > bounds.max) errors.push('OUT_OF_RANGE')
    else if (input.projectedValue > bounds.warnMax) warnings.push('PLAUSIBILITY_WARNING')
  }

  const status: ProjectionValidity =
    errors.includes('MODEL_BLOCKED') ? 'MODEL_BLOCKED' :
    errors.includes('UNKNOWN_UNIT') ? 'INVALID_UNIT' :
    errors.includes('OUT_OF_RANGE') ? 'OUT_OF_RANGE' :
    errors.length ? 'INVALID_INPUT' :
    'VALID'

  return { status, errors, warnings: Array.from(new Set(warnings)) }
}

function readinessScore(readiness: string) {
  if (readiness === 'READY') return 76
  if (readiness === 'LIMITED') return 54
  if (readiness === 'INSUFFICIENT_DATA') return 24
  return 0
}

export function rankProjection(input: ProjectionIntegrityInput & { validityStatus?: ProjectionValidity }) {
  const integrity = input.validityStatus ?? validateProjectionValue(input).status
  const reasons: string[] = []
  const warnings: string[] = []
  if (integrity !== 'VALID') {
    return {
      rankScore: 0,
      rankTier: 'BLOCKED' as ProjectionRankTier,
      rankReasons: ['Projection is blocked by identity, unit, plausibility or model-origin validation.'],
      rankWarnings: [integrity],
    }
  }
  let score =
    readinessScore(input.readiness) * 0.22 +
    input.confidence * 0.18 +
    input.dataSufficiency * 0.16 +
    input.featureQuality * 0.16 +
    (input.identityConfidence ?? 0) * 0.1 +
    (input.eventIdentityConfidence ?? 100) * 0.06 +
    (input.participationConfidence ?? 0) * 0.08 +
    (input.historicalReliability ?? 0) * 0.04

  if (input.origin === 'LEAGUE_BASELINE') {
    score = Math.min(score, 24)
    warnings.push('League-baseline output is not ranked as a top projection.')
  }
  if (input.origin === 'TEAM_SPECIFIC_BASELINE') score = Math.min(score, 58)
  if (input.origin === 'PARTIAL_MODEL') score = Math.min(score, 74)
  for (const warning of input.warnings ?? []) {
    score -= warning === 'PLAUSIBILITY_WARNING' ? 10 : 5
  }
  score = Math.round(Math.max(0, Math.min(100, score)))
  if (input.origin === 'MODELLED') reasons.push('Projection uses modelled entity-specific evidence.')
  if (input.origin === 'PARTIAL_MODEL') reasons.push('Projection uses partial entity-specific evidence with missing-data penalties.')
  if ((input.participationConfidence ?? 0) > 0) reasons.push('Participation or starter context is grounded.')
  if ((input.identityConfidence ?? 0) >= 80) reasons.push('Entity identity is resolved with provider-backed confidence.')

  const rankTier: ProjectionRankTier = score >= 85 ? 'ELITE' : score >= 72 ? 'STRONG' : score >= 55 ? 'MODERATE' : score > 0 ? 'LIMITED' : 'BLOCKED'
  return { rankScore: score, rankTier, rankReasons: reasons.length ? reasons : ['Projection has limited supporting evidence.'], rankWarnings: warnings }
}

export function validateMlbProjectionIntegrityFixtures() {
  const innings = baseballInningsNotationToOuts(5.2)
  const badOuts = validateProjectionValue({
    projectionKey: 'pitcher_outs_recorded',
    projectionFamily: 'mlb_pitcher_projection',
    entityType: 'pitcher',
    entityId: 'sportsdataio:1',
    projectedValue: 28,
    unit: 'OUTS_COUNT',
    readiness: 'LIMITED',
    confidence: 70,
    featureQuality: 70,
    dataSufficiency: 70,
    origin: 'PARTIAL_MODEL',
  })
  const missingK = perNineToGameCount(null, 18)
  const baselineRank = rankProjection({
    projectionKey: 'projected_runs',
    projectionFamily: 'mlb_team_projection',
    entityType: 'team',
    entityId: 'team-a',
    projectedValue: 4,
    unit: 'COUNT_PER_GAME',
    readiness: 'LIMITED',
    confidence: 50,
    featureQuality: 50,
    dataSufficiency: 50,
    origin: 'LEAGUE_BASELINE',
    identityConfidence: 100,
    participationConfidence: 100,
    validityStatus: 'VALID',
  })
  const checks = [
    ['5.2 innings equals 17 outs', innings.outs === 17],
    ['outs above 27 invalid', badOuts.status === 'OUT_OF_RANGE'],
    ['missing strikeouts do not become zero', missingK === null],
    ['league baseline cannot rank strongly', baselineRank.rankScore <= 24 && baselineRank.rankTier === 'LIMITED'],
    ['deterministic ids include entity', stableProjectionId(['a', 'entity-1']) !== stableProjectionId(['a', 'entity-2'])],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_projection_integrity_fixtures_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
