import fs from 'node:fs'

const certPath = 'docs/CERTIFICATION/nba-02b1-r5-replay-canary-persistence.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_02B1_R5_REPLAY_CANARY_PERSISTENCE.md'
const canaryPath = 'docs/CERTIFICATION/nba-02b1-replay-canary.json'

const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const canary = JSON.parse(fs.readFileSync(canaryPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('R5 final status pass', cert.status === 'NBA_02B1_R5_REPLAY_CANARY_PERSISTENCE_PASS_READY_FOR_BULK')
check('production commit exact', cert.productionCommit === 'a6dde36a2aa03cd5155de7bcfc7b249514f66ffa')
check('schema prevalidation passed 96 rows', cert.schemaPrevalidation.schemaValidRows === 96 && cert.schemaPrevalidation.schemaInvalidRows === 0)
check('no remaining schema blockers', cert.schemaPrevalidation.remainingNotNullBlockers === 0 && cert.schemaPrevalidation.remainingCheckConstraintBlockers === 0)
check('canary game and prediction counts exact', cert.canary.games === 24 && cert.canary.predictionsPlanned === 96)
check('canary seasons exact', cert.canary.bySeason['2022-23'] === 8 && cert.canary.bySeason['2023-24'] === 8 && cert.canary.bySeason['2024-25'] === 8)
check('market counts exact', cert.canary.moneyline === 24 && cert.canary.spread === 24 && cert.canary.total === 24 && cert.canary.firstHalf === 24)
check('first persistence run inserted 96', cert.firstRun.inserted === 96 && cert.firstRun.failed === 0 && cert.firstRun.writeChunks === 4)
check('second persistence run idempotent', cert.secondRun.newLogicalPredictions === 0 && cert.secondRun.reused === 96 && cert.secondRun.duplicateLogicalPredictions === 0)
check('readback complete', cert.readback.replayRowsExpected === 96 && cert.readback.replayRowsFound === 96 && cert.readback.missingRows === 0)
check('readback identity isolated', cert.readback.wrongOrigin === 0 && cert.readback.wrongSport === 0 && cert.readback.wrongModelVersion === 0 && cert.readback.wrongFeatureVersion === 0 && cert.readback.currentEraIdentityCollisions === 0)
check('model-only null odds exact', cert.canary.modelOnlyRows === 72 && cert.nullOddsSafety.modelOnlyValueMathMismatches === 0 && cert.nullOddsSafety.nullOddsReplayShadowRows === 72)
check('non-replay null odds zero', cert.nullOddsSafety.nullOddsNonReplayRows === 0 && cert.nullOddsSafety.nullOddsCurrentEraRows === 0 && cert.nullOddsSafety.nullOddsOfficialPickRows === 0)
check('price-aware readback exact', cert.priceAwareReadback.rows === 24 && cert.priceAwareReadback.nullOdds === 0 && cert.priceAwareReadback.postStartPrices === 0 && cert.priceAwareReadback.identityMismatches === 0)
check('settlement preview deterministic', cert.settlementPreview.checked === 96 && cert.settlementPreview.wins === 52 && cert.settlementPreview.losses === 44 && cert.settlementPreview.pushes === 0 && cert.settlementPreview.blocked === 0)
check('settlement remains preview only', cert.isolation.replaySettlementWrites === 0)
check('current era isolated', cert.isolation.nbaCurrentEraDelta === 0 && cert.isolation.nbaCurrentEraStatus === 'INACTIVE')
check('official picks isolated', cert.isolation.officialPickDelta === 0)
check('learning and calibration isolated', cert.isolation.productionLearningDelta === 0 && cert.isolation.productionCalibrationDelta === 0)
check('performance and settlement debt isolated', cert.isolation.currentEraPerformanceDelta === 0 && cert.isolation.settlementDebtDelta === 0)
check('product surfaces isolated', cert.isolation.productSurfaceReplayVisibility === 0)
check('provider calls zero', cert.providers.ballDontLieCalls === 0 && cert.providers.theOddsApiHistoricalCalls === 0 && cert.providers.sportsDataIoCalls === 0)
check('database mutations bounded to replay prediction inserts', cert.databaseMutations.replayPredictionInserts === 96 && cert.databaseMutations.currentEraMutations === 0 && cert.databaseMutations.officialPickMutations === 0 && cert.databaseMutations.productionLearningMutations === 0 && cert.databaseMutations.productionCalibrationMutations === 0 && cert.databaseMutations.mlbMutationsFromNbaWork === 0)
check('operations health preserved', cert.health.scheduler === 'HEALTHY' && cert.health.providerBudget === 'HEALTHY' && cert.health.settlement === 'HEALTHY' && cert.health.marketFreshness === 'HEALTHY' && cert.health.operations === 'HEALTHY')
check('bulk recommendation gated', cert.bulkModelReplayAuthorizationRecommended === true && cert.nextRecommendedPhase === 'NBA-02B2_BULK_MODEL_REPLAY')
check('current canary artifact persisted isolated', canary.status === 'NBA_02B1_REPLAY_CANARY_PERSISTED_ISOLATED' && canary.persistenceDecision.readbackCount === 96 && canary.oddsNullabilityContract.migrationRequired === false)
check('doc records no bulk start', doc.includes('NBA-02B2 bulk model replay is ready for explicit authorization') && doc.includes('It was not started'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_02b1_r5_replay_canary_persistence_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
