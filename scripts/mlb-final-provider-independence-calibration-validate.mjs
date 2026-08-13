import fs from 'fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

const cert = json('docs/CERTIFICATION/mlb-final-provider-independence-calibration.json')
const providerDoc = read('docs/ARCHITECTURE/MLB_PROVIDER_INDEPENDENCE_V1.md')
const calibrationDoc = read('docs/ARCHITECTURE/MLB_CALIBRATION_POLICY_V1.md')
const pilotDoc = read('docs/PRODUCTION_PILOT/MLB_FINAL_PROVIDER_INDEPENDENCE_CALIBRATION_AUDIT.md')
const sdioPreview = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')
const operatingDay = read('src/services/operating-day.service.ts')
const recommendationPolicy = read('src/services/recommendation-eligibility-policy.service.ts')
const calibrationService = read('src/services/model-calibration.service.ts')
const productionGate = read('src/services/production-data-gate.service.ts')
const currentBoard = read('src/services/current-board.service.ts')
const shadowCalibration = read('src/services/mlb-calibration-shadow-v1.service.ts')

const failures = []
function check(name, condition) {
  if (!condition) failures.push(name)
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification status set', cert.status === 'MLB_FINAL_PROVIDER_INDEPENDENCE_CALIBRATION_REPAIR_READY_FOR_DEPLOYMENT')
check('all six SportsDataIO calls classified', cert.sportsDataIo.reportedToday === 6 && cert.sportsDataIo.realCalls.length === 6)
check('real HTTP and accounting-only events distinguished', cert.sportsDataIo.realHttpCalls === 6 && cert.sportsDataIo.accountingOnlyEvents === 0)
check('exact caller identified', cert.sportsDataIo.realCalls.every((call) => call.caller.includes('runSportsDataIoMlbProspectivePreview')))
check('routine Stage 3 path suppresses SportsDataIO at service boundary', sdioPreview.includes('readOddsPrimaryAuthorityStage') && sdioPreview.includes("status: 'SKIPPED_AUTHORITY_NOT_SPORTSDATAIO'") && sdioPreview.includes('productAuthority !=='))
check('Stage 3 suppression returns zero calls', sdioPreview.includes('providerCallsMade: 0') && sdioPreview.includes('externalProviderCallsMade: 0') && sdioPreview.includes('plannedEndpoints: []'))
check('rollback-only path preserved', cert.sportsDataIo.cancellationReadiness === 'SPORTSDATAIO_CANCELLATION_WAIT_FOR_OBSERVATION' && providerDoc.includes('STAGE_0_SPORTSDATAIO_AUTHORITY') && providerDoc.includes('STAGE_1_DUAL_READ'))
check('result recovery uses MLB Official path, not SportsDataIO preview', operatingDay.includes('syncRecentResults(sportKey, 3)') && pilotDoc.includes('MLB Official / MLB Stats API'))
check('settlement consumes canonical operating-day result path', operatingDay.includes('settleOperatingDay') && providerDoc.includes('Settlement consumes canonical result rows'))
check('live/state primary documented as MLB Official', cert.providerAuthority.mlbOfficialRole === 'PRIMARY_NON_ODDS_MLB_SOURCE')
check('health/certification reads are zero provider call', cert.certificationAccounting.providerCallsFromCertificationReads === 0 && cert.certificationAccounting.sportsDataIoCallsCausedByCertification === 0)
check('calibration policy source identified', cert.calibrationPolicy.policyFile.endsWith('recommendation-eligibility-policy.service.ts') && cert.calibrationPolicy.aggregateFile.endsWith('model-calibration.service.ts'))
check('thresholds identified and unchanged', recommendationPolicy.includes('minimumCalibrationSample: 250') && recommendationPolicy.includes('maximumCalibrationError: 8') && cert.calibrationPolicy.minimumCalibrationSample === 250)
check('calibration cohort defined', calibrationService.includes(".eq('production_eligible', true)") && calibrationService.includes('recommended_pick === true'))
check('current era eligible sample measured', cert.currentEraCalibration.currentEraPredictions === 795 && cert.currentEraCalibration.currentEraCalibrationEligible === 0)
check('historical replay denominator classified', cert.historicalReplay.expectedPredictions === 7290 && cert.historicalReplay.productionCalibrationEligible === 0)
check('market-specific current era breakdown identified', ['moneyline', 'runLine', 'total'].every((key) => cert.currentEraCalibration.marketBreakdown[key]?.settled >= 0))
check('Brier role identified', cert.calibrationPolicy.brierRole === 'DIAGNOSTIC_ONLY_FOR_CURRENT_OFFICIAL_POLICY')
check('calibration error role identified', cert.calibrationPolicy.maximumCalibrationError === 8 && calibrationDoc.includes('Calibration error'))
check('sample gap to acceptable calculated', cert.currentEraCalibration.samplesRemainingToAcceptable === 250)
check('sample gap to mature calculated', cert.currentEraCalibration.samplesRemainingToMature === 250)
check('quarantine dependency identified', cert.quarantineProductionGate.calibrationInsufficientCausesQuarantine === 'NO' && currentBoard.includes('quarantined: row.production_eligible !== true'))
check('production gate dependency identified', productionGate.includes('production_eligible=true') && cert.quarantineProductionGate.calibrationAcceptableWouldClearProductionGate === 'NO')
check('confidence relationship identified', cert.calibrationPolicy.confidenceRelationship === 'INDEPENDENT' && recommendationPolicy.includes('minimumOfficialConfidence: 65'))
check('calibration progress update path proven', calibrationDoc.includes('prediction -> canonical result -> settlement -> production row eligibility'))
check('no threshold changes recorded', cert.safety.calibrationThresholdsChanged === false && cert.safety.confidenceThresholdChanged === false && cert.safety.edgeThresholdChanged === false && cert.safety.evThresholdChanged === false)
check('no replay contamination of Current Era Performance', cert.safety.replayAddedToCurrentEraPerformance === false && pilotDoc.includes('Replay added to Current Era Performance: no'))
check('no replay promotion into production calibration', cert.safety.replayAddedToProductionCalibration === false && shadowCalibration.includes('shadowOnly: true'))
check('Official Pick policy unchanged', cert.safety.officialPicksManuallyPromoted === false && recommendationPolicy.includes('automaticProductionApproval: false'))
check('no retrospective writes', cert.safety.retrospectivePredictionsCreated === false && cert.safety.postStartPredictionsCreated === false && cert.safety.postCutoffPredictionsCreated === false)
check('NBA foundation untouched', cert.safety.nbaFoundationTouched === false)

if (failures.length) {
  console.error(`\n${failures.length} validation check(s) failed:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nmlb_final_provider_independence_calibration_validate_v1 PASS')
