import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import {
  NFL_FROZEN_RUNTIME_ARTIFACT_PATH,
  loadNflFrozenRuntimeArtifact,
  scoreCurrentNflGame,
} from '../src/services/nfl-frozen-runtime-model.service.ts'

const CERT_PATH = 'docs/CERTIFICATION/nfl-04r1-frozen-model-artifact.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NFL_04R1_FROZEN_MODEL_ARTIFACT.md'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function check(name, condition) {
  if (!condition) failures.push(name)
}

function expectThrow(name, fn, expected) {
  try {
    fn()
    failures.push(`${name}:NO_THROW`)
  } catch (error) {
    if (!String(error?.message ?? '').includes(expected)) failures.push(`${name}:${error?.message ?? 'UNKNOWN'}`)
  }
}

const failures = []
const cert = readJson(CERT_PATH)
const artifact = readJson(NFL_FROZEN_RUNTIME_ARTIFACT_PATH)
const doc = readFileSync(DOC_PATH, 'utf8')
const service = readFileSync('src/services/nfl-frozen-runtime-model.service.ts', 'utf8')

check('certified status', cert.status === 'NFL_04R1_FROZEN_MODEL_ARTIFACT_MATERIALIZED_CERTIFIED')
check('artifact exists', existsSync(NFL_FROZEN_RUNTIME_ARTIFACT_PATH))
check('source commit provenance', cert.sourceCertificationCommit === 'c20831a9c33f6e36a71c78c5083b89c96f04d394')
check('exact parameters recoverable', cert.nfl03ArtifactRecoveryAudit.exactCertifiedParametersRecoverable === true)
check('deterministic rematerialization classified', cert.nfl03ArtifactRecoveryAudit.recoveryMethod === 'DETERMINISTIC_RE_MATERIALIZATION_FROM_CERTIFIED_NFL_03_PIPELINE')
check('feature count 86', artifact.featureManifest.length === 86 && cert.featureManifest.featureCount === 86)
check('coefficient counts match', artifact.moneylineModel.coefficients.length === 86 && artifact.scoreModels.homeScore.coefficients.length === 86 && artifact.scoreModels.awayScore.coefficients.length === 86)
check('platt one coefficient', artifact.calibration.coefficients.length === 1 && artifact.calibration.fitSeason === '2024')
check('runtime artifact digest present', typeof artifact.digests.runtimeArtifactDigest === 'string' && artifact.digests.runtimeArtifactDigest.length === 64)
check('full parity rows', cert.fullDatasetParity.rows === 1311 && artifact.parityRows.length === 1311)
check('full parity exact', cert.fullDatasetParity.maxCalibratedProbabilityDelta <= 1e-10 && cert.fullDatasetParity.maxExpectedHomePointsDelta <= 1e-10)
check('validation metrics reproduce', cert.certifiedMetricReproduction.validation2024.accuracy === 65.07 && cert.certifiedMetricReproduction.validation2024.brier === 0.2216)
check('holdout metrics reproduce', cert.certifiedMetricReproduction.holdout2025.accuracy === 59.93 && cert.certifiedMetricReproduction.holdout2025.brier === 0.2329)
check('holdout score reproduces', cert.certifiedMetricReproduction.holdout2025.score.totalMae === 10.97 && cert.certifiedMetricReproduction.holdout2025.score.marginMae === 10.74)
check('holdout integrity', cert.holdoutIntegrity.fitOn2025 === false && cert.holdoutIntegrity.tunedFrom2026 === false)
check('leakage zero', cert.leakageRevalidation.violations === 0 && cert.leakageRevalidation.futureGameLeakage === 0)
check('residual prepared no tuning', cert.residualArtifactPreparation.marginResidualRows === 544 && cert.residualArtifactPreparation.selectedResidualModel === null)
check('zero provider calls', cert.providerCalls.ballDontLie === 0 && cert.providerCalls.theOddsApi === 0 && cert.providerCalls.sportsDataIo === 0)
check('zero db mutations', cert.dbMutations === 0)
check('isolation rows unchanged', cert.isolation.existingNflPredictionRows === 966 && cert.isolation.existingOfficialPickRows === 8 && cert.isolation.predictionHistoryMutations === 0)
check('mlb nba isolated', cert.isolation.mlbRuntimeChanged === false && cert.isolation.nbaRuntimeChanged === false)
check('docs mention no providers', doc.includes('Provider calls: 0') && doc.includes('Production database mutations: 0'))
check('service has no provider/db coupling', !service.includes('supabaseAdmin') && !service.includes('fetch(') && service.includes('scoreCurrentNflGame'))

const loaded = loadNflFrozenRuntimeArtifact()
const sample = artifact.parityRows[0]
const scored = scoreCurrentNflGame(sample.features, loaded)
check('runtime score finite', Number.isFinite(scored.homeWinProbability) && Number.isFinite(scored.expectedHomePoints))
check('probability complements', Math.abs(scored.homeWinProbability + scored.awayWinProbability - 1) <= 1e-12)

const tmpPath = join('.tmp', 'nfl-04r1-corrupted-artifact.json')
mkdirSync('.tmp', { recursive: true })
writeFileSync(tmpPath, JSON.stringify({ ...artifact, featureVersion: 'wrong' }))
expectThrow('feature version fail closed', () => loadNflFrozenRuntimeArtifact(tmpPath), 'NFL_FEATURE_VERSION_MISMATCH')
writeFileSync(tmpPath, JSON.stringify({ ...artifact, digests: { ...artifact.digests, runtimeArtifactDigest: '0'.repeat(64) } }))
expectThrow('checksum fail closed', () => loadNflFrozenRuntimeArtifact(tmpPath), 'NFL_ARTIFACT_CHECKSUM_MISMATCH')
writeFileSync(tmpPath, JSON.stringify({ ...artifact, moneylineModel: { ...artifact.moneylineModel, coefficients: artifact.moneylineModel.coefficients.slice(1) } }))
expectThrow('coefficient count fail closed', () => loadNflFrozenRuntimeArtifact(tmpPath), 'NFL_MONEYLINE_COEFFICIENTS_COUNT_MISMATCH')
unlinkSync(tmpPath)
expectThrow('missing feature fail closed', () => scoreCurrentNflGame({}, loaded), 'NFL_FEATURE_MISSING')

if (failures.length) {
  console.error(JSON.stringify({
    status: 'NFL_04R1_FROZEN_MODEL_ARTIFACT_VALIDATION_BLOCKED',
    failures,
    providerCalls: 0,
    dbMutations: 0,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'NFL_04R1_FROZEN_MODEL_ARTIFACT_MATERIALIZED_CERTIFIED',
  artifact: NFL_FROZEN_RUNTIME_ARTIFACT_PATH,
  rows: cert.fullDatasetParity.rows,
  maxDelta: cert.fullDatasetParity.maxCalibratedProbabilityDelta,
  providerCalls: 0,
  dbMutations: 0,
}, null, 2))
