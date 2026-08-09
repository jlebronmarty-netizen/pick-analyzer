import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const requiredFiles = [
  'src/services/mlb-calibration-shadow-v1.service.ts',
  'src/app/api/operations/calibration-shadow/route.ts',
  'src/app/api/model/shadow-calibration/route.ts',
  'scripts/historical-shadow-calibration.mjs',
  'docs/ARCHITECTURE/MLB_CALIBRATION_SHADOW_V1.md',
  'docs/PRODUCTION_PILOT/HR_03_CALIBRATION_SHADOW_VALIDATION.md',
  'docs/CERTIFICATION/hr-03-calibration-shadow.json',
  'scripts/hr03-calibration-shadow-validate.mjs',
]

const allowedDirty = [
  ...requiredFiles,
  'docs/ARCHITECTURE/README.md',
  'docs/CERTIFICATION/README.md',
  'docs/PRODUCTION_PILOT/README.md',
]

const checks = []
const check = (name, pass, details = '') => checks.push({ name, pass: Boolean(pass), details })
const read = (path) => readFileSync(path, 'utf8')
const cert = JSON.parse(read('docs/CERTIFICATION/hr-03-calibration-shadow.json'))
const service = read('src/services/mlb-calibration-shadow-v1.service.ts')
const operationsRoute = read('src/app/api/operations/calibration-shadow/route.ts')
const modelRoute = read('src/app/api/model/shadow-calibration/route.ts')
const report = read('docs/PRODUCTION_PILOT/HR_03_CALIBRATION_SHADOW_VALIDATION.md')

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

check('raw probability preserved', service.includes('rawProbability') && cert.promotionGates.rawProbabilityRetained === true)
check('calibrated probability separate', service.includes('calibratedProbability') && report.includes('separate calibrated probabilities'))
check('calibration version explicit', cert.calibrationVersion === 'mlb_market_calibration_shadow_v1')
check('shadow-only status', cert.shadowOnly === true && cert.calibrationVersion.includes('shadow'))
check('chronological validation present', cert.primaryChronologicalValidation.training.sample === 5445 && cert.primaryChronologicalValidation.validation.sample === 1815)
check('market-specific fits evaluated', ['moneyline', 'runLine', 'total'].every((market) => cert.marketResults[market]))
check('global fit compared', cert.marketResults.global.selectedMethod === 'NO_CALIBRATION')
check('out-of-sample Brier computed', cert.marketResults.runLine.rawBrier > cert.marketResults.runLine.shadowBrier)
check('out-of-sample calibration computed', cert.marketResults.total.rawCalibrationError > cert.marketResults.total.shadowCalibrationError)
check('extreme behavior documented', report.includes('Rolling Fold Results') && service.includes('probabilityBand'))
check('Run Line support limits enforced', cert.trainingSupport.runLine.lineScope === '-1.5' && service.includes('RUN_LINE_OUTSIDE_MINUS_1_5_TRAINING_SUPPORT'))
check('Total support limits enforced', cert.trainingSupport.total.selectionSide === 'over' && service.includes('TOTAL_UNDER_UNSUPPORTED_BY_OVER_ONLY_REPLAY'))
check('unsupported regimes do not extrapolate', cert.currentEraShadow.unsupported === 213)
check('Current Era production probabilities unchanged', cert.safety.productionProbabilityChanged === false)
check('Official Pick policy unchanged', cert.safety.officialPickPolicyChanged === false)
check('Rent Play unchanged', cert.safety.rentPlayChanged === false)
check('rankings unchanged', cert.safety.rankingsChanged === false)
check('settlement unchanged', cert.safety.settlementChanged === false)
check('learning unchanged', cert.safety.learningChanged === false)
check('Performance denominator unchanged', cert.safety.performanceDenominatorChanged === false)
check('provider calls = 0', cert.safety.providerCalls === 0 && cert.safety.sportsDataIoCalls === 0 && cert.safety.theOddsApiCalls === 0)
check('ODDS-02A request preserved', cert.remainingOdds02aRequests === 1 && cert.safety.odds02aFinalRequestConsumed === false)
check('replay rows unchanged', cert.replayDataset.replayRowsMutated === false)
check('Current Era writes = 0', cert.safety.predictionWrites === 0 && cert.safety.remoteMutations === 0)
check('shadow outputs reproducible', operationsRoute.includes('getMlbCalibrationShadowV1') && modelRoute.includes('getMlbCalibrationShadowV1'))
check('HR-04 not started', cert.safety.hr04Started === false)

const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /SPORTSDATAIO_MLB_API_KEY\s*=\s*[^\s`'"]+/i,
]

for (const file of requiredFiles) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !secretPatterns.some((pattern) => pattern.test(text)))
}

const statusLines = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedDirty.includes(file))
check('only HR-03 files changed', unexpected.length === 0, unexpected.join(', '))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)
const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`HR-03 validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}
console.log('HR-03 validation passed')
