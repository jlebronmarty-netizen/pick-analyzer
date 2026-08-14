import fs from 'node:fs'

const certPath = 'docs/CERTIFICATION/nba-02b2-bulk-model-replay.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_02B2_BULK_MODEL_REPLAY.md'
const runnerPath = 'scripts/nba-02b2-bulk-model-replay.mjs'

const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const runner = fs.readFileSync(runnerPath, 'utf8')
const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('final status pass', cert.status === 'NBA_02B2_BULK_MODEL_REPLAY_PASS_READY_FOR_PRICE_AWARE_EVALUATION')
check('replay event universe exact', cert.preBulkInventory.replayReadyEvents === 3710)
check('prediction target volume reconciled', cert.preBulkInventory.expectedLogicalPredictions === 14840 && cert.completeness.plannedLogicalPredictions === 14840)
check('four supported markets exact', JSON.stringify(cert.markets.supported) === JSON.stringify(['moneyline', 'spread', 'total', 'first_half']))
check('canary rows reused', cert.persistence.canaryRowsReusedDuringBulk === 96 && cert.idempotency.canaryRowsReused === 96)
check('deterministic ids used', runner.includes('deterministicUuid') && runner.includes('idempotencyKey') && runner.includes('keyFor'))
check('duplicates zero', cert.completeness.duplicates === 0)
check('missing logical rows zero', cert.completeness.missing === 0)
check('replay origin exact', cert.versions.predictionOrigin === 'HISTORICAL_REPLAY_SHADOW' && cert.completeness.wrongOrigin === 0)
check('Current Era collisions zero', cert.completeness.wrongSport === 0 && cert.nullOddsAudit.replayRowsCurrentEraContaminated === 0 && cert.nbaCurrentEra.status === 'INACTIVE')
check('model-only null price honest', cert.nullOddsAudit.modelOnlyReplayRowsWithOddsNull > 0 && cert.markets.byMarket.first_half.oddsNull === cert.markets.byMarket.first_half.planned)
check('non-replay null odds zero', cert.nullOddsAudit.nonReplayRowsWithOddsNull === 0)
check('Current Era null odds zero', cert.nullOddsAudit.currentEraRowsWithOddsNull === 0)
check('Official null odds zero', cert.nullOddsAudit.officialPickRowsWithOddsNull === 0)
check('price-aware null odds zero', cert.nullOddsAudit.priceAwareReplayRowsWithOddsNull === 0)
check('feature identity exact', cert.completeness.wrongFeatureVersion === 0 && cert.versions.feature === 'nba_historical_pregame_feature_set_v1')
check('inference deterministic', cert.sanity.constantOutputDetected === false && cert.sanity.collapsedConfidenceDetected === false)
check('leakage guards preserved', cert.featureSafety.acceptedLeakageViolations === 0 && cert.featureSafety.finalResultUsedInInference === false)
check('current product visibility zero', cert.productIsolation.totalVisible === 0)
check('Current Era Performance delta zero', cert.currentEraPerformance.replayInducedDelta === 0)
check('settlement debt delta zero', cert.settlementDebt.replayInducedDelta === 0 && cert.settlementDebt.silentPendingDelta === 0)
check('production learning delta zero', cert.learning.productionLearningReplayInducedDelta === 0)
check('production calibration delta zero', cert.calibration.productionCalibrationReplayInducedDelta === 0)
check('Official Pick delta zero', cert.officialPicks.nbaOfficialPickDelta === 0 && cert.officialPicks.historicalReplayOfficialPicks === 0)
check('provider calls zero', cert.providers.ballDontLieHistoricalCalls === 0 && cert.providers.theOddsApiHistoricalCalls === 0 && cert.providers.sportsDataIoCalls === 0 && cert.providers.totalProviderCalls === 0)
check('NBA Current Era inactive', cert.nbaCurrentEra.status === 'INACTIVE' && cert.nbaCurrentEra.scheduler === 'INACTIVE')
check('manifest complete', cert.manifest.total === 14840 && cert.manifest.completed === 14840 && cert.manifest.plannedRemaining === 0 && cert.manifest.failed === 0 && cert.manifest.blocked === 0)
check('resume/idempotency PASS', cert.idempotency.fullLogicalDryRunNewNeeded === 0 && cert.idempotency.resumePass === true)
check('canary settlement preview unchanged', cert.settlementPreview.canary.checked === 96 && cert.settlementPreview.canary.wins === 52 && cert.settlementPreview.canary.losses === 44 && cert.settlementPreview.canary.pushes === 0 && cert.settlementPreview.canary.blocked === 0)
check('price-aware handoff quantified', cert.nba02b3Handoff.priceAwareEvents > 0 && cert.nba02b3Handoff.moneylineCandidates > 0 && cert.nba02b3Handoff.firstHalfCandidates === 0)
check('MLB regression PASS or final check recorded', ['PASS', 'HEALTHY', 'READ_ONLY_FINAL_CHECK_REQUIRED'].includes(cert.mlbParallelObservation.mlbHealth))
check('doc records pass and next phase', doc.includes('NBA-02B2') && doc.includes('NBA-02B3 price-aware historical evaluation'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_02b2_bulk_model_replay_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
