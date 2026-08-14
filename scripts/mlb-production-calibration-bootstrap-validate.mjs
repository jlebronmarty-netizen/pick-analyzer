import fs from 'fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

const cert = json('docs/CERTIFICATION/mlb-production-calibration-bootstrap.json')
const doc = read('docs/PRODUCTION_PILOT/MLB_PRODUCTION_CALIBRATION_BOOTSTRAP.md')
const bootstrap = read('src/services/mlb-production-calibration-bootstrap.service.ts')
const calibration = read('src/services/model-calibration.service.ts')
const previewWriter = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')
const repredictionWriter = read('src/services/line-versioned-reprediction-writer.service.ts')
const recommendationPolicy = read('src/services/recommendation-eligibility-policy.service.ts')
const currentBoard = read('src/services/current-board.service.ts')
const marketSuite = read('src/services/market-opportunity-suite.service.ts')

const failures = []
function check(name, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`)
  if (!condition) failures.push(name)
}

check('cert status ready for deployment', cert.status === 'MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_REPAIR_READY_FOR_DEPLOYMENT')
check('recommended_pick is documented as overloaded', cert.legacyFlags.recommendedPickOverloaded === true && doc.includes('recommended_pick` is an overloaded legacy flag'))
check('production_eligible is documented as overloaded', cert.legacyFlags.productionEligibleOverloaded === true && doc.includes('production_eligible` is also overloaded'))
check('no DB migration required', cert.calibrationContract.dbMigrationRequired === false && cert.files.dbMigrationFilesCreated === false)
check('bootstrap metadata service exists', bootstrap.includes('MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1') && bootstrap.includes('PRODUCTION_CALIBRATION_PROBATION'))
check('bootstrap keeps recommendation flags false', bootstrap.includes('probationaryRowsSetRecommendedPick: false') && bootstrap.includes('probationaryRowsSetProductionEligible: false') && bootstrap.includes('officialPickPromoted: false'))
check('bootstrap requires future cutoff/start safety', bootstrap.includes('PREDICTION_AFTER_CUTOFF') && bootstrap.includes('PREDICTION_AFTER_START') && bootstrap.includes('ODDS_AFTER_CUTOFF'))
check('bootstrap requires feature and odds lineage', bootstrap.includes('MISSING_FEATURE_SNAPSHOT') && bootstrap.includes('MISSING_ODDS_SNAPSHOT'))
check('bootstrap excludes non-production data defects', bootstrap.includes('TRIAL_ROW') && bootstrap.includes('SCRAMBLED_ROW') && bootstrap.includes('NOT_PRODUCTION_EVALUABLE_POLICY'))
check('prospective writer persists bootstrap marker but not legacy recommendation flags', previewWriter.includes('productionCalibrationBootstrap') && previewWriter.includes('production_eligible: false') && previewWriter.includes('recommended_pick: false'))
check('line-versioned writer persists bootstrap marker but not legacy recommendation flags', repredictionWriter.includes('productionCalibrationBootstrap') && repredictionWriter.includes('production_eligible: false') && repredictionWriter.includes('recommended_pick: false'))
check('calibration endpoint preserves legacy query', calibration.includes(".eq('production_eligible', true)") && calibration.includes('legacyRecommendedRows'))
check('calibration endpoint adds explicit bootstrap cohort', calibration.includes("contains('feature_snapshot'") && calibration.includes('hasProductionCalibrationBootstrapEligibility') && calibration.includes('probationaryCalibrationRows'))
check('calibration sample separates cohorts', calibration.includes('legacyProductionGateRows') && calibration.includes('calibrationCohortRows') && calibration.includes('legacyRecommendedCalibrationRows'))
check('official pick thresholds unchanged', recommendationPolicy.includes('minimumOfficialConfidence: 65') && recommendationPolicy.includes('minimumOfficialEdge: 5') && recommendationPolicy.includes('minimumOfficialEv: 5'))
check('calibration threshold unchanged', recommendationPolicy.includes('minimumCalibrationSample: 250') && cert.calibrationContract.requiredSamples === 250)
check('Current Board still treats production_eligible as official eligibility only', currentBoard.includes("officialEligibility: row.production_eligible === true ? 'OFFICIAL_ELIGIBLE_CANDIDATE' : 'NOT_OFFICIALLY_ELIGIBLE'"))
check('Most Likely remains probability-first Current Board surface', marketSuite.includes('return right.probability - left.probability') && marketSuite.includes('Most Likely ranks binary outcome probability'))
check('HOU provider identity classified as legacy mapping only', cert.providerIdentity.sportsdataioIdentityMeaning === 'LEGACY_MAPPING_IDENTITY' && cert.providerIdentity.houProviderEvidence === 'the-odds-api')
check('HOU classified model-only excluded correctly', cert.finalHouClassification === 'HOU_MODEL_ONLY_EXCLUDED_CORRECTLY' && cert.hou.qualifiedRentPlay === false)
check('59/42 reconciliation explained by superseded rows', cert.universeReconciliation.currentBoardPredictionsEvaluated === 59 && cert.universeReconciliation.currentBoardRowsReturned === 42 && cert.universeReconciliation.excludedReasonCounts.SUPERSEDED === 17 && cert.universeReconciliation.unexplained === 0)
check('safety accounting zero provider calls and mutations', cert.safety.providerCallsFromCertificationReads === 0 && cert.safety.databaseMutationsFromCertification === 0)
check('no retrospective changes', cert.bootstrap.existingRowsModified === 0 && cert.bootstrap.historicalReplayModified === 0 && cert.safety.retrospectiveCalibrationReclassification === 0)
check('final freeze waits for deployment proof', cert.finalMlbFreezeDecision === 'MLB_FINAL_FREEZE_WAIT_BOOTSTRAP_DEPLOYMENT')

if (failures.length) {
  console.error(`\n${failures.length} validation check(s) failed:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nmlb_production_calibration_bootstrap_validate_v1 PASS')

