import 'server-only'

import calibrationArtifact from '../../artifacts/mlb/mlb-03-market-calibration-v1.json'

export type MlbShadowMarket = 'moneyline' | 'run_line' | 'total'

export type MlbCalibrationStatus =
  | 'CALIBRATED'
  | 'NOT_AVAILABLE'
  | 'UNSUPPORTED_MARKET'
  | 'INVALID_PROBABILITY'

type CalibrationBucket = {
  min: number
  max: number
  value: number
  sample: number
}

type CalibrationMap = {
  market: MlbShadowMarket
  method: string
  minBucketSample: number
  fallback: {
    method: string
    intercept: number
    slope: number
  }
  buckets: CalibrationBucket[]
}

function clampProbability(value: number) {
  return Math.min(0.99, Math.max(0.01, value))
}

function logit(value: number) {
  const p = clampProbability(value)
  return Math.log(p / (1 - p))
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value)
    return 1 / (1 + z)
  }
  const z = Math.exp(value)
  return z / (1 + z)
}

export function normalizeMlbShadowMarket(value: unknown): MlbShadowMarket | null {
  const market = String(value ?? '').toLowerCase()
  if (market.includes('moneyline') || market === 'h2h') return 'moneyline'
  if (market.includes('run_line') || market.includes('spread')) return 'run_line'
  if (market.includes('total')) return 'total'
  return null
}

export function calibrateMlbShadowProbability({
  rawProbability,
  market,
}: {
  rawProbability: number | null | undefined
  market: string | MlbShadowMarket | null | undefined
}) {
  const normalizedMarket = normalizeMlbShadowMarket(market)
  if (!normalizedMarket) {
    return {
      rawModelProbability: rawProbability ?? null,
      calibratedProbability: null,
      calibrationVersion: calibrationArtifact.artifactVersion,
      calibrationMethod: 'NONE',
      calibrationStatus: 'UNSUPPORTED_MARKET' as MlbCalibrationStatus,
    }
  }

  const raw = Number(rawProbability)
  if (!Number.isFinite(raw) || raw <= 0 || raw >= 1) {
    return {
      rawModelProbability: rawProbability ?? null,
      calibratedProbability: null,
      calibrationVersion: calibrationArtifact.artifactVersion,
      calibrationMethod: 'NONE',
      calibrationStatus: 'INVALID_PROBABILITY' as MlbCalibrationStatus,
    }
  }

  const maps = calibrationArtifact.markets as Record<string, CalibrationMap>
  const map = maps[normalizedMarket]
  if (!map) {
    return {
      rawModelProbability: raw,
      calibratedProbability: null,
      calibrationVersion: calibrationArtifact.artifactVersion,
      calibrationMethod: 'NONE',
      calibrationStatus: 'NOT_AVAILABLE' as MlbCalibrationStatus,
    }
  }

  const bucket = map.buckets.find((entry) => raw >= entry.min && raw < entry.max)
  const calibrated =
    bucket && bucket.sample >= map.minBucketSample
      ? bucket.value
      : sigmoid(map.fallback.intercept + map.fallback.slope * logit(raw))

  return {
    rawModelProbability: raw,
    calibratedProbability: clampProbability(calibrated),
    calibrationVersion: calibrationArtifact.artifactVersion,
    calibrationMethod: bucket && bucket.sample >= map.minBucketSample ? map.method : map.fallback.method,
    calibrationStatus: 'CALIBRATED' as MlbCalibrationStatus,
  }
}

export function buildMlbCalibratedShadowIdentity({
  sport,
  eventId,
  market,
  selection,
  line,
  sportsbook,
  snapshotType,
}: {
  sport: string
  eventId: string
  market: string
  selection: string
  line: string | number | null | undefined
  sportsbook: string
  snapshotType: string
}) {
  return [
    sport,
    eventId,
    normalizeMlbShadowMarket(market) ?? market,
    selection.trim().toLowerCase().replace(/\s+/g, '_'),
    line ?? 'null',
    sportsbook.trim().toLowerCase().replace(/\s+/g, '_'),
    'CURRENT_ERA_SHADOW',
    calibrationArtifact.shadowModelVersion,
    calibrationArtifact.artifactVersion,
    snapshotType,
  ].join('|')
}

export function getMlbCalibratedShadowArtifactSummary() {
  return {
    artifactVersion: calibrationArtifact.artifactVersion,
    sourceModelVersion: calibrationArtifact.sourceModelVersion,
    shadowModelVersion: calibrationArtifact.shadowModelVersion,
    method: calibrationArtifact.method,
    markets: Object.keys(calibrationArtifact.markets),
    productionModelChanged: false,
    officialPickChanged: false,
  }
}
