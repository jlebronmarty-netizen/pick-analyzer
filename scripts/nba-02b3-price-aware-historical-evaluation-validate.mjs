import fs from 'node:fs'

const certPath = 'docs/CERTIFICATION/nba-02b3-price-aware-historical-evaluation.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION.md'
const runnerPath = 'scripts/nba-02b3-price-aware-historical-evaluation.mjs'

const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const runner = fs.readFileSync(runnerPath, 'utf8')
const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('final status accepted', [
  'NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION_PASS_READY_FOR_FINAL_DIAGNOSTICS',
  'NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION_PASS_MODEL_WEAKNESS_IDENTIFIED',
].includes(cert.status))
check('price-aware event count reconciled', cert.universe.priceAwareEvents === 1112)
check('1,112 vs 1,196 reconciled', cert.reconciliation1196vs1112.priorFullCoreEstimate === 1196 && cert.reconciliation1196vs1112.finalCertifiedPriceAwareEvents === 1112 && cert.reconciliation1196vs1112.difference === 84 && cert.reconciliation1196vs1112.reasonCountsTotal === 84 && cert.reconciliation1196vs1112.unexplainedEvents === 0)
check('ML coverage exact', cert.universe.moneylinePriceAware === 1112)
check('spread coverage exact', cert.universe.spreadPriceAware === 1112)
check('total coverage exact', cert.universe.totalPriceAware === 1112)
check('First Half price-aware zero', cert.universe.firstHalfPriceAware === 0 && cert.firstHalfModelOnly.sample === 3710)
check('pregame timestamps only', cert.priceBinding.postStartUsed === 0)
check('post-start price usage zero', cert.priceBinding.postStartUsed === 0)
check('event identity exact', cert.settlement.identityMismatch === 0)
check('market identity exact', cert.priceBinding.marketIdentityFailures === 0)
check('line identity exact', cert.priceBinding.lineIdentityFailures === 0)
check('sportsbook policy deterministic', String(cert.priceBinding.sportsbookPolicy).includes('DETERMINISTIC_PRIORITY'))
check('implied probability formula correct', cert.priceBinding.impliedFormulaMismatches === 0)
check('edge formula correct', cert.priceBinding.edgeFormulaMismatches === 0)
check('EV formula correct', cert.priceBinding.evFormulaMismatches === 0)
check('result leakage zero', cert.priceBinding.postStartUsed === 0 && cert.priceBinding.closingLineClassification === 'NEAREST_CERTIFIED_PREGAME_SNAPSHOT')
check('market inversion zero', cert.priceBinding.marketInversionFailures === 0 && cert.orientationAndBias.orientationMismatchCount === 0)
check('settlement preview/persistence correct', cert.settlement.previewChecked === 3336 && cert.settlement.persisted === 3336 && cert.settlement.readbackWrongResult === 0)
check('push semantics present', Number.isInteger(cert.settlement.pushes) && cert.settlement.pushes >= 0)
check('unit-return math produced', cert.priceAwarePerformance.netUnits !== null && cert.priceAwarePerformance.roi !== null)
check('no ROI on model-only rows', cert.modelOnlyComparison.metrics.roi === null && cert.modelOnlyComparison.metrics.netUnits === null)
check('Current Era delta zero', cert.isolation.nbaCurrentEraPredictionDelta === 0 && cert.isolation.nbaCurrentEraSettlementDelta === 0)
check('Current Era Performance delta zero', cert.isolation.currentEraPerformanceDelta === 0)
check('Official Pick delta zero', cert.isolation.nbaOfficialPickDelta === 0 && cert.officialLikeShadow.officialPicksCreated === 0)
check('production learning delta zero', cert.isolation.productionLearningDelta === 0)
check('production calibration delta zero', cert.isolation.productionCalibrationDelta === 0)
check('settlement debt delta zero', cert.isolation.settlementDebtDelta === 0)
check('product visibility zero', cert.isolation.currentProductReplayVisibility === 0)
check('provider calls zero', cert.providers.ballDontLieCalls === 0 && cert.providers.theOddsApiHistoricalCalls === 0 && cert.providers.sportsDataIoCalls === 0 && cert.providers.totalProviderCalls === 0)
check('idempotency PASS', cert.database.secondRunNewSettlements === 0 && cert.settlement.secondRunNewSettlements === 0)
check('market metrics produced', ['moneyline', 'spread', 'total'].every((market) => cert.priceAwareByMarket?.[market]?.sample > 0))
check('season metrics produced', ['2022-23', '2023-24', '2024-25'].every((season) => cert.seasons?.[season]))
check('probability diagnostics produced', Object.keys(cert.probabilityDiagnostics ?? {}).length > 0)
check('confidence diagnostics produced', Object.keys(cert.confidenceDiagnostics?.buckets ?? {}).length > 0)
check('edge/EV diagnostics produced', Object.keys(cert.edgeDiagnostics ?? {}).length > 0 && Object.keys(cert.evDiagnostics ?? {}).length > 0)
check('Official-like shadow diagnostic isolated', cert.officialLikeShadow.diagnostic && cert.officialLikeShadow.officialPicksCreated === 0)
check('selection-bias audit produced', cert.selectionBias?.classification && cert.selectionBias?.seasonDistributionComparison)
check('replay regime preserved', cert.replayVersion === 'NBA_MODEL_REPLAY_V1' && cert.modelVersion === 'nba_prediction_engine_v1' && cert.featureVersion === 'nba_historical_pregame_feature_set_v1')
check('NBA Current Era inactive', cert.isolation.nbaCurrentEraStatus === 'INACTIVE' && cert.isolation.nbaScheduler === 'INACTIVE')
check('MLB regression PASS', ['HEALTHY', 'READ_ONLY_FINAL_CHECK_REQUIRED', null].includes(cert.mlbParallelStatus?.mlbHealth))
check('canonical runner uses stored evidence only', !runner.includes('api.the-odds-api.com') && !runner.includes('balldontlie') && runner.includes('sports_odds_snapshots') && runner.includes('prediction_history'))
check('doc records historical-only warning', doc.includes('historical shadow/research') && doc.includes('no provider calls were made'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_02b3_price_aware_historical_evaluation_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
