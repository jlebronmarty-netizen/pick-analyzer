import fs from 'fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

const cert = json('docs/CERTIFICATION/mlb-final-calibration-bootstrap-reachability.json')
const pilotDoc = read('docs/PRODUCTION_PILOT/MLB_FINAL_CALIBRATION_BOOTSTRAP_REACHABILITY.md')
const calibrationService = read('src/services/model-calibration.service.ts')
const recommendationPolicy = read('src/services/recommendation-eligibility-policy.service.ts')
const productionGate = read('src/services/production-data-gate.service.ts')
const prospectivePreview = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')
const repredictionWriter = read('src/services/line-versioned-reprediction-writer.service.ts')
const oddsAcquisition = read('src/services/the-odds-api-current-odds-acquisition.service.ts')
const currentBoard = read('src/services/current-board.service.ts')
const shadowCalibration = read('src/services/mlb-calibration-shadow-v1.service.ts')

const failures = []
function check(name, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`)
  if (!condition) failures.push(name)
}

check('status requires human certification', cert.status === 'MLB_CALIBRATION_BOOTSTRAP_HUMAN_CERTIFICATION_REQUIRED')
check('production commit recorded', cert.productionCommitObserved === '034073d7bd7aace9543b448d58be4a95675238c2')
check('SportsDataIO independence stays certified', cert.providerIndependence.sportsDataIoProviderIndependenceCertified === true && cert.providerIndependence.sportsDataIoRoutineCallsReopened === false)
check('calibration endpoint remains zero sample', cert.calibrationEndpoint.settledRows === 0 && cert.calibrationEndpoint.recommendedSettledRows === 0)
check('Performance sample remains separate from legacy calibration sample', cert.performanceEvidence.settledCanonicalRows > 0 && cert.databaseEvidence.legacyCalibrationEligibleRows === 0)
check('modern Performance policy source documented', cert.performanceEvidence.currentV2EligibilityUses === 'feature_snapshot.productionEvaluationPolicy.production_evaluable')
check('legacy calibration contract requires production eligible', calibrationService.includes(".eq('production_eligible', true)") && cert.runtimeContracts.calibrationAggregateRequiresProductionEligible === true)
check('legacy calibration buckets require recommended pick', calibrationService.includes('recommended_pick === true') && cert.runtimeContracts.calibrationAggregateRequiresRecommendedPickForBuckets === true)
check('automatic production approval remains off', recommendationPolicy.includes('automaticProductionApproval: false') && cert.runtimeContracts.automaticProductionApproval === false)
check('calibration thresholds unchanged', recommendationPolicy.includes('minimumCalibrationSample: 250') && recommendationPolicy.includes('maximumCalibrationError: 8') && cert.runtimeContracts.minimumCalibrationSample === 250 && cert.runtimeContracts.maximumCalibrationError === 8)
check('Official confidence threshold unchanged', recommendationPolicy.includes('minimumOfficialConfidence: 65') && cert.runtimeContracts.minimumOfficialConfidence === 65)
check('production gate still requires production_eligible true', productionGate.includes('production_eligible=true') && productionGate.includes('production_eligible is not true'))
check('prospective preview writer remains non-production', prospectivePreview.includes('production_eligible: false') && prospectivePreview.includes("validation_status: 'quarantined'") && cert.writerTrace.prospectivePreviewWriterProductionEligible === false)
check('line-versioned writer remains non-production evidence', repredictionWriter.includes('production_eligible: false') && repredictionWriter.includes('recommended_pick: false') && cert.writerTrace.lineVersionedRepredictionWriterProductionEligible === false)
check('Stage 3 odds evidence can be product authoritative without promoting prediction rows', oddsAcquisition.includes("odds_classification: productPriceAuthority ? 'product_primary_pregame' : 'shadow_pregame'") && oddsAcquisition.includes('production_eligible: productPriceAuthority ? true') && cert.writerTrace.theOddsApiStage3OddsSnapshotsDoNotPromotePredictionRows === true)
check('Current Board quarantine remains tied to production_eligible', currentBoard.includes('quarantined: row.production_eligible !== true') && currentBoard.includes('productionEligible: row.production_eligible === true'))
check('historical replay remains shadow only', shadowCalibration.includes('shadowOnly: true') && cert.historicalReplay.shadowOnly === true && cert.historicalReplay.productionCalibrationEligible === 0)
check('no automatic transition documented', cert.transition.automaticTransitionExists === false && cert.transition.pathReachableInCurrentRuntimeWithoutAuthorization === false)
check('human artifact named', cert.transition.requiredHumanArtifact === 'MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_AUTHORIZATION' && pilotDoc.includes('MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_AUTHORIZATION'))
check('path is reachable only after authorization', cert.transition.pathReachableAfterAuthorization === true && pilotDoc.includes('future prediction -> production writer sets `production_eligible=true`'))
check('no manual promotion or quarantine clear', cert.transition.manualQuarantineClearAuthorized === false && cert.transition.productionPromotionPerformed === false)
check('certification reads used no provider calls or mutations', cert.safety.providerCallsFromCertificationReads === 0 && cert.safety.databaseMutationsFromCertificationReads === 0)
check('threshold and policy safety preserved', cert.safety.calibrationThresholdsChanged === false && cert.safety.confidenceThresholdChanged === false && cert.safety.officialPickPolicyChanged === false)
check('replay contamination prohibited', cert.safety.replayAddedToCurrentEraPerformance === false && cert.safety.replayAddedToProductionCalibration === false)
check('final freeze decision blocks freeze on human bootstrap certification', cert.mlbFinalFreezeDecision === 'MLB_FINAL_FREEZE_NOT_READY_CALIBRATION_BOOTSTRAP_HUMAN_CERTIFICATION_REQUIRED')

if (failures.length) {
  console.error(`\n${failures.length} validation check(s) failed:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nmlb_final_calibration_bootstrap_reachability_validate_v1 PASS')
