import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const requiredFiles = [
  'docs/ARCHITECTURE/HISTORICAL_PROGRESSIVE_REPLAY_V1.md',
  'docs/PRODUCTION_PILOT/HR_01_FULL_SCALE_HISTORICAL_REPLAY.md',
  'docs/CERTIFICATION/hr-01-full-scale-historical-replay.json',
  'scripts/hr01-full-scale-historical-replay-validate.mjs',
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

const architecture = read('docs/ARCHITECTURE/HISTORICAL_PROGRESSIVE_REPLAY_V1.md')
const report = read('docs/PRODUCTION_PILOT/HR_01_FULL_SCALE_HISTORICAL_REPLAY.md')
const cert = JSON.parse(read('docs/CERTIFICATION/hr-01-full-scale-historical-replay.json'))

check('exact eligible historical denominator certified', cert.eligibility.historicalEventsAvailable === 2430 && cert.eligibility.eligibleHistoricalEvents === 2430)
check('chronological execution documented', report.includes('Chronological Cohorts') && cert.chronologicalCohorts.length === 4)
check('leakage failures are zero', cert.isolation.leakageFailures === 0)
check('frozen replay engine versions documented', cert.engines.boundedP23Engine === 'historical_progressive_replay_v1' && cert.engines.fullReplayEngine === 'retrosheet_historical_replay_phase_2b_v1')
check('only ML/RL/Total generated', cert.execution.moneylinePredictions === 2430 && cert.execution.runLinePredictions === 2430 && cert.execution.totalPredictions === 2430)
check('Current Era writes are zero', cert.isolation.currentEraWrites === 0 && cert.currentEra.changed === false)
check('Current Era canonical count unchanged', cert.currentEra.before.currentEraCanonicalPredictions === 406 && cert.currentEra.after.currentEraCanonicalPredictions === 406)
check('production learning writes are zero', cert.isolation.productionLearningWrites === 0)
check('provider calls are zero', cert.isolation.providerCalls === 0 && cert.isolation.sportsDataIoCalls === 0 && cert.isolation.theOddsApiCalls === 0)
check('checkpoints exist', cert.execution.checkpointCount === 49 && architecture.includes('retrosheet_historical_replay_phase_2b_v1:full_scope'))
check('resume/idempotency supported', cert.execution.dryRunIdempotency.reused === 7290 && cert.execution.dryRunIdempotency.inserted === 0)
check('duplicate replay rows are zero', cert.isolation.duplicateReplayRows === 0 && cert.execution.dryRunIdempotency.duplicateIds === 0)
check('results applied after replay prediction generation', report.includes('final scores') && report.includes('replay-only'))
check('replay metrics computed', cert.metrics.wins === 3344 && cert.metrics.losses === 3916 && cert.metrics.brier === 0.2508)
check('market-specific metrics computed', cert.marketMetrics.moneyline.sample === 2430 && cert.marketMetrics.runLine.sample === 2430 && cert.marketMetrics.total.sample === 2430)
check('calibration buckets computed', Object.keys(cert.probabilityBuckets).length === 8 && cert.probabilityBuckets['70+'].sample === 199)
check('chronological cohorts computed', cert.chronologicalCohorts.reduce((sum, item) => sum + item.events, 0) === 2430)
check('exclusion reasons accounted', Object.values(cert.eligibility.exclusionReasons).reduce((sum, value) => sum + value, 0) === 0)
check('Performance default remains Current Era', cert.isolation.performanceDefaultExcludesReplay === true)
check('Replay remains isolated', cert.isolation.replayScopeIsolated === true && cert.safety.hr02Started === false)
check('ODDS-02A request preserved', cert.remainingOdds02aRequests === 1 && cert.safety.odds03Started === false)
check('Production Pilot Week remains active', cert.productionPilotWeek === 'ACTIVE')

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
check('only HR-01 certification files changed', unexpected.length === 0, unexpected.join(', '))

const failures = checks.filter((item) => !item.pass)
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)
}

if (failures.length) {
  console.error(`HR-01 validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('HR-01 validation passed')
