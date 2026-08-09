import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const requiredFiles = [
  'docs/ARCHITECTURE/HISTORICAL_CALIBRATION_REVIEW_V1.md',
  'docs/PRODUCTION_PILOT/HR_02_HISTORICAL_CALIBRATION_REVIEW.md',
  'docs/CERTIFICATION/hr-02-historical-calibration-review.json',
  'scripts/hr02-historical-calibration-review-validate.mjs',
]

const allowedDirty = [
  ...requiredFiles,
  'docs/PRODUCTION_PILOT/README.md',
  'docs/CERTIFICATION/README.md',
]

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const architecture = read('docs/ARCHITECTURE/HISTORICAL_CALIBRATION_REVIEW_V1.md')
const report = read('docs/PRODUCTION_PILOT/HR_02_HISTORICAL_CALIBRATION_REVIEW.md')
const cert = JSON.parse(read('docs/CERTIFICATION/hr-02-historical-calibration-review.json'))

check('Replay denominator matches HR-01', cert.dataset.replayEvents === 2430 && cert.dataset.replayPredictions === 7290)
check('Current Era unchanged', cert.safety.currentEraMutated === false)
check('Replay unchanged', cert.dataset.replayChanged === false && cert.safety.replayRowsMutated === false)
check('calibration buckets computed', Object.keys(cert.reliabilityBuckets.all).length >= 10)
check('market-specific reliability computed', cert.marketClassifications.moneyline.sample === 2430 && cert.marketClassifications.runLine.sample === 2430 && cert.marketClassifications.total.sample === 2430)
check('high-probability behavior analyzed', cert.highProbability.overconfidenceThreshold.includes('60-65'))
check('Run Line deep dive completed', cert.deepDives.runLine.minusOnePointFiveSample === 2430 && cert.deepDives.runLine.plusOnePointFiveSample === 0)
check('Moneyline deep dive completed', cert.deepDives.moneyline.middleBandsReliable === true)
check('Total deep dive completed', cert.deepDives.total.overOnlyLimitation === true)
check('chronological validation used', cert.chronologicalValidation.methodology === 'time_ordered_75_25_train_validation')
check('calibration methods compared', ['global', 'moneyline', 'runLine', 'total'].every((key) => cert.methodComparison[key]?.bestMethod))
check('out-of-sample evaluation performed', cert.methodComparison.runLine.brierAfter < cert.methodComparison.runLine.brierBefore)
check('global vs market-specific compared', cert.methodComparison.global.bestMethod === 'NO_CALIBRATION' && cert.methodComparison.moneyline.bestMethod === 'BETA_CALIBRATION')
check('raw probabilities preserved', cert.recommendedArchitecture.rawProbabilityPreserved === true && architecture.includes('rawProbability'))
check('no production calibration applied', cert.safety.productionCalibrationApplied === false)
check('Official Pick policy unchanged', cert.safety.officialPickPolicyChanged === false)
check('provider calls = 0', cert.safety.providerCalls === 0 && cert.safety.sportsDataIoCalls === 0 && cert.safety.theOddsApiCalls === 0)
check('ODDS-02A final request remains unused', cert.safety.odds02aFinalRequestConsumed === false && cert.remainingOdds02aRequests === 1)
check('production learning writes = 0', cert.safety.productionLearningWrites === 0)
check('no Current Era mutations', cert.safety.currentEraMutated === false)
check('calibration implementation recommended but HR-03 not started', cert.decision === 'CALIBRATION_IMPLEMENTATION_RECOMMENDED' && cert.safety.hr03Started === false)
check('documentation states analysis only', report.includes('No production calibration changes were made') && architecture.includes('does not alter production probabilities'))

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

const statusLines = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedDirty.includes(file))
check('only HR-02 certification files changed', unexpected.length === 0, unexpected.join(', '))

const failures = checks.filter((item) => !item.pass)
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)
}

if (failures.length) {
  console.error(`HR-02 validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('HR-02 validation passed')
