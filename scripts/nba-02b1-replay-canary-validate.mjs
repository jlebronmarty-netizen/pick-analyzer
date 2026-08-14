import fs from 'node:fs'

const certPath = 'docs/CERTIFICATION/nba-02b1-replay-canary.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_02B1_REPLAY_CANARY.md'
const servicePath = 'src/services/nba-replay-canary.service.ts'
const runnerPath = 'scripts/nba-02b1-replay-canary.mjs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const cert = JSON.parse(read(certPath))
const doc = read(docPath)
const service = read(servicePath)
const runner = read(runnerPath)
const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('final status is persisted-isolated canary', cert.status === 'NBA_02B1_REPLAY_CANARY_PERSISTED_ISOLATED')
check('canary game count bounded', cert.canary.games > 0 && cert.canary.games <= 36)
check('prediction count bounded', cert.predictions.planned > 0 && cert.predictions.planned <= 144)
check('deterministic selection recorded', cert.canary.deterministicSelection === true && cert.canary.selectionRule.includes('before outcome evaluation'))
check('all three seasons represented', cert.canary.bySeason['2022-23'] === 8 && cert.canary.bySeason['2023-24'] === 8 && cert.canary.bySeason['2024-25'] === 8)
check('price-aware games represented', cert.canary.priceAwareGames === 8)
check('model-only games represented', cert.canary.modelOnlyGames === 16)
check('feature as-of safety passed', cert.featureSafety.featureAsOfNotBeforeStartViolations === 0)
check('model identity exact', cert.versions.model === 'nba_prediction_engine_v1')
check('feature identity exact', cert.versions.feature === 'nba_historical_pregame_feature_set_v1')
check('replay version exact', cert.versions.replay === 'NBA_MODEL_REPLAY_V1')
check('supported markets exact', cert.predictions.moneyline === 24 && cert.predictions.spread === 24 && cert.predictions.total === 24 && cert.predictions.firstHalf === 24)
check('replay regime isolated', cert.versions.regime === 'NBA_HISTORICAL_REPLAY_SHADOW')
check('Current Era writes zero', cert.regimeIsolation.nbaCurrentEraPredictionsCreated === 0 && cert.databaseMutations.currentEraMutations === 0)
check('Official Pick writes zero', cert.regimeIsolation.nbaOfficialPicksCreated === 0 && cert.databaseMutations.officialPickMutations === 0)
check('production learning writes zero', cert.regimeIsolation.nbaCurrentEraLearningWrites === 0 && cert.databaseMutations.productionLearningMutations === 0)
check('production calibration writes zero', cert.regimeIsolation.nbaCurrentEraCalibrationWrites === 0 && cert.databaseMutations.productionCalibrationMutations === 0)
check('historical prices pregame only', cert.priceAware.historicalPriceRowsUsed === 24 && cert.priceAware.postStartPriceRowsUsed === 0)
check('moneyline binding valid', cert.priceAware.moneyline === 8 && cert.priceAware.moneylineBindingFailures === 0)
check('spread line binding valid', cert.priceAware.spread === 8 && cert.priceAware.spreadBindingFailures === 0)
check('total line binding valid', cert.priceAware.total === 8 && cert.priceAware.totalBindingFailures === 0)
check('First Half price fabrication zero', cert.priceAware.firstHalf === 0 && cert.priceAware.expectedFirstHalf === 0)
check('value formulas recompute on representative rows', cert.representativePriceAudit.every((row) => row.recomputedEdgeMatch === true && row.recomputedEvMatch === true))
check('model-only rows have no fabricated price value', cert.predictions.modelOnly === 72 && cert.priceAware.missingPrice === 48)
check('model-only replay permits unavailable odds', cert.oddsNullabilityContract.modelOnlyReplayMayLackOdds === true && cert.predictions.modelOnlyNullOdds === 72)
check('price-aware replay requires odds', cert.oddsNullabilityContract.priceAwareReplayRequiresOdds === true && cert.predictions.priceAwareNullOdds === 0)
check('Current Era requires odds', cert.oddsNullabilityContract.currentEraRequiresOdds === true)
check('Official Pick requires odds', cert.oddsNullabilityContract.officialPickRequiresOdds === true)
check('null odds value math unavailable', cert.oddsNullabilityContract.valueMathNullSafety.impliedProbabilityNullWhenOddsNull === true && cert.oddsNullabilityContract.valueMathNullSafety.edgeNullWhenOddsNull === true && cert.oddsNullabilityContract.valueMathNullSafety.evNullWhenOddsNull === true)
check('no fabricated model-only odds', cert.oddsNullabilityContract.valueMathNullSafety.noFakeOdds === true)
check('96 row contract passes', cert.oddsNullabilityContract.dryRun.wouldInsert === 96 && cert.oddsNullabilityContract.dryRun.wouldFail === 0)
check('target isolation passed', cert.featureSafety.acceptedLeakageViolations === 0)
check('settlement preview passed', cert.settlementPreview.checked === 96 && cert.settlementPreview.blocked === 0 && cert.settlementPreview.identityMismatches === 0)
check('settlement remains preview only', cert.settlementWrites.previewOnly === true && cert.settlementWrites.replaySettlementRowsWritten === 0)
check('product contamination zero', Object.values(cert.currentProductContamination).every((value) => value === 0))
check('performance delta zero', cert.isolationDeltas.replayInducedCurrentEraDelta === 0)
check('settlement debt delta zero', cert.isolationDeltas.replayInducedSettlementDebtDelta === 0)
check('duplicate logical predictions zero', cert.predictions.duplicateLogicalPredictions === 0)
check('idempotency rerun simulated pass', cert.idempotency.secondRunPredictionsInserted === 0 && cert.idempotency.secondRunPredictionsReused === cert.predictions.planned)
check('provider calls zero', cert.providers.ballDontLieCalls === 0 && cert.providers.theOddsApiHistoricalCalls === 0 && cert.providers.sportsDataIoCalls === 0)
check('database mutations bounded to replay prediction canary', cert.databaseMutations.tablesMutated.every((value) => value === 'prediction_history') && cert.databaseMutations.currentEraMutations === 0 && cert.databaseMutations.officialPickMutations === 0 && cert.databaseMutations.productionLearningMutations === 0 && cert.databaseMutations.productionCalibrationMutations === 0 && cert.databaseMutations.mlbMutationsFromNbaCanary === 0)
check('bulk estimate generated', cert.bulkEstimate.expectedFullModelReplayPredictions === 14840 && cert.bulkEstimate.estimatedDbWriteChunks > 0)
check('NBA Current Era inactive', cert.operations.nbaCurrentEraStatus === 'INACTIVE' && cert.operations.nbaSchedulerStatus === 'INACTIVE')
check('schema blocker resolved', cert.schemaIsolation.selectable === true && cert.schemaIsolation.error === null)
check('service exposes deterministic idempotency', service.includes('buildNba02b1PredictionIdempotencyKey') && service.includes('NBA_02B1_REPLAY_VERSION'))
check('runner performs no provider calls', !runner.includes('api.the-odds-api.com') && !runner.includes('api.balldontlie.io') && !runner.includes('sportsdata.io'))
check('doc records persisted-isolated canary', doc.includes('NBA_02B1_REPLAY_CANARY_PERSISTED_ISOLATED') && doc.includes('Replay origin readback count: 96'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_02b1_replay_canary_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
