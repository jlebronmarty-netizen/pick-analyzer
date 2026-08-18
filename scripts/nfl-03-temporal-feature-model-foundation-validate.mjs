import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function read(path) {
  return readFileSync(path, 'utf8')
}

function check(name, condition) {
  if (!condition) failures.push(name)
}

const failures = []
const result = spawnSync('node', ['scripts/nfl-03-temporal-feature-model-foundation.mjs'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout)
}

const live = JSON.parse(result.stdout)
const cert = JSON.parse(read('docs/CERTIFICATION/nfl-03-temporal-feature-model-foundation.json'))
const doc = read('docs/PRODUCTION_PILOT/NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION.md')
const script = read('scripts/nfl-03-temporal-feature-model-foundation.mjs')

check('status certified', cert.status === 'NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION_CERTIFIED')
check('live deterministic digest matches cert', live.reproducibility.predictionDigest === cert.reproducibility.predictionDigest)
check('existing engine classified preview', cert.existingNflEngineAudit.currentClassification === 'PREVIEW')
check('chronological split preserved', cert.split.train.join(',') === '2021,2022,2023' && cert.split.validationCalibration[0] === '2024' && cert.split.holdout[0] === '2025')
check('eligible rows present', cert.rowCounts.train > 0 && cert.rowCounts.validation > 0 && cert.rowCounts.holdout > 0)
check('minimum history selected', cert.minimumHistoryPolicy.selectedMinimumPriorGamesPerTeam === 3)
check('no leakage violations', cert.leakageAudit.violations === 0 && cert.leakageAudit.futureGameLeakage === 0 && cert.leakageAudit.sameGameStatLeakage === 0)
check('season stats and standings blocked', cert.temporalDatasetContract.seasonStatsPregameSafe === false && cert.temporalDatasetContract.standingsPregameSafe === false)
check('roster blocked historically', cert.temporalDatasetContract.rosterHistoricalReplayEligible === false)
check('no fabricated spread total', cert.labels.spread.includes('no fabricated spread') && cert.labels.total.includes('no fabricated total'))
check('score model metrics computed', Number.isFinite(cert.holdout2025.score.totalMae) && Number.isFinite(cert.holdout2025.score.marginMae))
check('calibration evaluated', cert.validation2024.raw.brier !== null && cert.validation2024.calibrated.brier !== null)
check('holdout opened after freeze', cert.frozenModelSelection.modelFrozenBefore2025 === true)
check('historical predictions offline only', cert.historicalPredictionArtifact.persistedToProductionDb === false)
check('market adapter exact line boundary', cert.currentMarketAdapterContract.spread.includes('real exact line') && cert.currentMarketAdapterContract.total.includes('real exact total'))
check('existing prediction rows isolated', cert.existingNflPredictionRowsAudit.mutated === false && cert.existingNflPredictionRowsAudit.productionRowsObservedAfterNfl02 === 966)
check('zero provider calls', cert.safety.providerCalls.ballDontLie === 0 && cert.safety.providerCalls.theOddsApi === 0 && cert.safety.providerCalls.sportsDataIo === 0)
check('zero production db mutations', cert.safety.productionDbMutations === 0)
check('mlb nba isolated', cert.safety.mlbRuntimeChanged === false && cert.safety.nbaRuntimeChanged === false)
check('nfl04 readiness true', cert.readiness.nfl04CurrentEraShadowReady === true)
check('docs updated', doc.includes('source_event.start_time < target_event.start_time') && doc.includes('NFL-04_CURRENT_ERA_SHADOW_AND_CURRENT_MARKET_INTEGRATION'))
check('no provider imports', !script.includes('fetch(') && !script.includes('createClient'))

if (failures.length) {
  console.error(JSON.stringify({
    status: 'NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION_BLOCKED',
    failures,
    providerCalls: 0,
    productionDbMutations: 0,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION_CERTIFIED',
  rows: cert.rowCounts,
  validation2024: cert.validation2024.calibrated,
  holdout2025: cert.holdout2025,
  providerCalls: 0,
  productionDbMutations: 0,
}, null, 2))
