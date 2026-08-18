import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export const NFL_FROZEN_RUNTIME_ARTIFACT_PATH = 'artifacts/nfl/nfl-03-frozen-runtime-model.json'
export const NFL_FROZEN_RUNTIME_ARTIFACT_SCHEMA_VERSION = 'nfl_frozen_runtime_model_artifact_v1'
export const NFL_FROZEN_RUNTIME_MODEL_VERSION = 'nfl_ml_score_baseline_v1'
export const NFL_FROZEN_RUNTIME_FEATURE_VERSION = 'nfl_temporal_pregame_feature_set_v1'
export const NFL_FROZEN_RUNTIME_CALIBRATION_VERSION = 'nfl_ml_score_baseline_platt_2024_v1'

type FeatureDefinition = {
  index: number
  name: string
  mean: number
  std: number
}

type LinearModel = {
  intercept: number
  coefficients: number[]
}

export type NflFrozenRuntimeArtifact = {
  schemaVersion: string
  sport: 'americanfootball_nfl'
  modelVersion: string
  featureVersion: string
  calibrationVersion: string
  featureManifest: FeatureDefinition[]
  moneylineModel: LinearModel
  calibration: LinearModel
  scoreModels: {
    homeScore: LinearModel
    awayScore: LinearModel
  }
  digests: {
    runtimeArtifactDigest: string
  }
}

export type NflFrozenRuntimeScore = {
  modelVersion: string
  featureVersion: string
  calibrationVersion: string
  rawHomeWinProbability: number
  homeWinProbability: number
  awayWinProbability: number
  expectedHomePoints: number
  expectedAwayPoints: number
  expectedMargin: number
  expectedTotal: number
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function assertFiniteArray(name: string, values: unknown[], expectedLength: number) {
  if (!Array.isArray(values) || values.length !== expectedLength) {
    throw new Error(`${name}_COUNT_MISMATCH`)
  }
  for (const value of values) {
    if (!Number.isFinite(Number(value))) throw new Error(`${name}_INVALID_NUMBER`)
  }
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))))
}

function logit(probability: number) {
  const p = Math.max(0.001, Math.min(0.999, probability))
  return Math.log(p / (1 - p))
}

function dot(intercept: number, coefficients: number[], values: number[]) {
  return intercept + values.reduce((sum, value, index) => sum + value * coefficients[index]!, 0)
}

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function validateArtifact(artifact: NflFrozenRuntimeArtifact) {
  if (artifact.schemaVersion !== NFL_FROZEN_RUNTIME_ARTIFACT_SCHEMA_VERSION) throw new Error('NFL_ARTIFACT_SCHEMA_VERSION_MISMATCH')
  if (artifact.sport !== 'americanfootball_nfl') throw new Error('NFL_ARTIFACT_SPORT_MISMATCH')
  if (artifact.modelVersion !== NFL_FROZEN_RUNTIME_MODEL_VERSION) throw new Error('NFL_MODEL_VERSION_MISMATCH')
  if (artifact.featureVersion !== NFL_FROZEN_RUNTIME_FEATURE_VERSION) throw new Error('NFL_FEATURE_VERSION_MISMATCH')
  if (artifact.calibrationVersion !== NFL_FROZEN_RUNTIME_CALIBRATION_VERSION) throw new Error('NFL_CALIBRATION_VERSION_MISMATCH')
  if (!Array.isArray(artifact.featureManifest) || artifact.featureManifest.length !== 86) throw new Error('NFL_FEATURE_COUNT_MISMATCH')

  artifact.featureManifest.forEach((feature, index) => {
    if (feature.index !== index) throw new Error('NFL_FEATURE_ORDER_MISMATCH')
    if (!feature.name) throw new Error('NFL_FEATURE_NAME_MISSING')
    if (!Number.isFinite(feature.mean) || !Number.isFinite(feature.std) || feature.std === 0) {
      throw new Error('NFL_FEATURE_SCALING_INVALID')
    }
  })

  assertFiniteArray('NFL_MONEYLINE_COEFFICIENTS', artifact.moneylineModel.coefficients, artifact.featureManifest.length)
  assertFiniteArray('NFL_HOME_SCORE_COEFFICIENTS', artifact.scoreModels.homeScore.coefficients, artifact.featureManifest.length)
  assertFiniteArray('NFL_AWAY_SCORE_COEFFICIENTS', artifact.scoreModels.awayScore.coefficients, artifact.featureManifest.length)
  assertFiniteArray('NFL_PLATT_COEFFICIENTS', artifact.calibration.coefficients, 1)
  for (const [name, value] of [
    ['NFL_MONEYLINE_INTERCEPT', artifact.moneylineModel.intercept],
    ['NFL_HOME_SCORE_INTERCEPT', artifact.scoreModels.homeScore.intercept],
    ['NFL_AWAY_SCORE_INTERCEPT', artifact.scoreModels.awayScore.intercept],
    ['NFL_PLATT_INTERCEPT', artifact.calibration.intercept],
  ] as const) {
    if (!Number.isFinite(value)) throw new Error(`${name}_INVALID_NUMBER`)
  }

  const expectedDigest = digest({
    featureManifest: artifact.featureManifest,
    preprocessing: {
      means: artifact.featureManifest.map((feature) => feature.mean),
      standardDeviations: artifact.featureManifest.map((feature) => feature.std),
    },
    moneyline: { intercept: artifact.moneylineModel.intercept, coefficients: artifact.moneylineModel.coefficients },
    calibration: { intercept: artifact.calibration.intercept, coefficients: artifact.calibration.coefficients },
    homeScore: { intercept: artifact.scoreModels.homeScore.intercept, coefficients: artifact.scoreModels.homeScore.coefficients },
    awayScore: { intercept: artifact.scoreModels.awayScore.intercept, coefficients: artifact.scoreModels.awayScore.coefficients },
    outputDigest: asObject(artifact.digests).predictionArtifactDigest,
  })
  if (artifact.digests.runtimeArtifactDigest !== expectedDigest) throw new Error('NFL_ARTIFACT_CHECKSUM_MISMATCH')
}

export function loadNflFrozenRuntimeArtifact(path = NFL_FROZEN_RUNTIME_ARTIFACT_PATH): NflFrozenRuntimeArtifact {
  const resolved = join(process.cwd(), path)
  if (!existsSync(resolved)) throw new Error('NFL_FROZEN_ARTIFACT_MISSING')
  const parsed = JSON.parse(readFileSync(resolved, 'utf8')) as NflFrozenRuntimeArtifact
  validateArtifact(parsed)
  return parsed
}

export function scoreCurrentNflGame(
  features: Record<string, number | null | undefined>,
  artifact = loadNflFrozenRuntimeArtifact()
): NflFrozenRuntimeScore {
  validateArtifact(artifact)
  const values = artifact.featureManifest.map((feature) => {
    if (!Object.prototype.hasOwnProperty.call(features, feature.name)) throw new Error(`NFL_FEATURE_MISSING:${feature.name}`)
    const value = finiteNumber(features[feature.name] ?? 0)
    if (value === null) throw new Error(`NFL_FEATURE_INVALID:${feature.name}`)
    return (value - feature.mean) / feature.std
  })

  const rawHomeWinProbability = sigmoid(dot(artifact.moneylineModel.intercept, artifact.moneylineModel.coefficients, values))
  const homeWinProbability = sigmoid(
    artifact.calibration.intercept + logit(rawHomeWinProbability) * artifact.calibration.coefficients[0]!
  )
  const awayWinProbability = 1 - homeWinProbability
  const expectedHomePoints = dot(artifact.scoreModels.homeScore.intercept, artifact.scoreModels.homeScore.coefficients, values)
  const expectedAwayPoints = dot(artifact.scoreModels.awayScore.intercept, artifact.scoreModels.awayScore.coefficients, values)

  return {
    modelVersion: artifact.modelVersion,
    featureVersion: artifact.featureVersion,
    calibrationVersion: artifact.calibrationVersion,
    rawHomeWinProbability,
    homeWinProbability,
    awayWinProbability,
    expectedHomePoints,
    expectedAwayPoints,
    expectedMargin: expectedHomePoints - expectedAwayPoints,
    expectedTotal: expectedHomePoints + expectedAwayPoints,
  }
}
