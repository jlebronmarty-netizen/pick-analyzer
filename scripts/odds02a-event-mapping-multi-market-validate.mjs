import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const requiredFiles = [
  'docs/PRODUCTION_PILOT/ODDS_02A_EVENT_MAPPING_MULTI_MARKET_CERTIFICATION.md',
  'docs/CERTIFICATION/odds-02a-event-mapping-multi-market.json',
  'scripts/odds02a-event-mapping-multi-market-validate.mjs',
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

const report = read('docs/PRODUCTION_PILOT/ODDS_02A_EVENT_MAPPING_MULTI_MARKET_CERTIFICATION.md')
const cert = JSON.parse(read('docs/CERTIFICATION/odds-02a-event-mapping-multi-market.json'))

check('ODDS-02A classification records final incomplete capture', cert.finalClassification === 'ODDS_02A_FINAL_REQUEST_CONSUMED_CERTIFICATION_INCOMPLETE')
check('ODDS-02 baseline preserved as production shadow certified', cert.odds02Baseline.classification === 'ODDS_02_PRODUCTION_SHADOW_CERTIFIED')
check('SportsDataIO remains production authority', cert.productionIsolation.sportsDataIoRemainsProductionAuthority === true)
check('The Odds API remains shadow only', cert.productionIsolation.theOddsApiRemainsShadowOnly === true)
check('useful slate gate passed before final request', cert.currentSlateGate.expectedMappableCurrentEvents >= cert.currentSlateGate.minimumUsefulExpectedMappableEvents)
check('final provider request was consumed', cert.finalShadowRequest.consumed === true && cert.currentSlateGate.finalRequestConsumed === true)
check('protected route returned HTTP 200', cert.protectedRequest.httpStatus === 200)
check('payload capture failure documented', cert.protectedRequest.payloadCaptured === false && cert.protectedRequest.captureFailure === 'PAYLOAD_NOT_CAPTURED_FLAT_ENVELOPE_MISMATCH')
check('repository apiOk contract documented', report.includes('apiOk') && report.includes('top level'))
check('remaining authorized provider requests is zero', cert.requestAccounting.remainingAuthorizedRequests === 0 && cert.requestAccounting.maximumAdditionalRequests === 0)
check('cumulative ODDS requests stay under cap', cert.requestAccounting.cumulativeRequestsUsed <= cert.requestAccounting.maximumCumulativeRequests)
check('ODDS request budget exhausted', cert.requestAccounting.cumulativeRequestsUsed === 3 && cert.requestAccounting.maximumCumulativeRequests === 3)
check('no fourth request authorized', cert.requestAccounting.fourthRequestAuthorized === false)
check('moneyline coverage not fabricated', cert.finalShadowRequest.moneylineCoverage === null)
check('run line coverage not fabricated', cert.finalShadowRequest.runLineCoverage === null)
check('total coverage not fabricated', cert.finalShadowRequest.totalCoverage === null)
check('freshness comparison not fabricated', cert.finalShadowRequest.freshnessComparisonCaptured === false)
check('price comparison not fabricated', cert.finalShadowRequest.priceComparisonCaptured === false)
check('model value comparison not fabricated', cert.finalShadowRequest.modelValueComparisonCaptured === false)
check('model probabilities unchanged', cert.productionIsolation.predictionProbabilityChanged === false)
check('Official Pick policy unchanged', cert.productionIsolation.officialPickPolicyChanged === false)
check('settlement unchanged', cert.productionIsolation.settlementChanged === false)
check('learning unchanged', cert.productionIsolation.learningChanged === false)
check('Performance unchanged', cert.productionIsolation.performanceChanged === false)
check('scheduler cadence unchanged', cert.productionIsolation.schedulerCadenceChanged === false)
check('provider budget unchanged', cert.productionIsolation.providerBudgetChanged === false)
check('shadow isolation preserved', cert.productionIsolation.currentBoardProductionPriceChanged === false)
check('certification reads produce zero provider calls', cert.certificationReads.providerCallsMade === 0)
check('certification reads produce zero production mutations', cert.certificationReads.databaseMutationsMade === 0)
check('post-request dry-run remained read-only', cert.postRequestReadOnlyEvidence.shadowDryRun.providerCallsMade === 0 && cert.postRequestReadOnlyEvidence.shadowDryRun.productionCurrentBoardChanged === false)
check('Production Pilot Week remains active', cert.productionPilotWeek === 'ACTIVE' && cert.postRequestReadOnlyEvidence.missionControl.status === 'PRODUCTION_PILOT_WEEK_ACTIVE')
check('cutover is rejected from incomplete evidence', cert.cutoverDecision === 'DO_NOT_CUTOVER' && cert.odds03Recommended === false)
check('capture defect classified as critical', cert.criticalFindings.includes('CERTIFICATION_CLIENT_RESPONSE_CAPTURE_DEFECT'))
check('ODDS-03 not started', cert.productionIsolation.odds03Started === false)
check('Historical Replay, Player Props and MC-03 not started', cert.productionIsolation.historicalReplayStarted === false && cert.productionIsolation.playerPropsStarted === false && cert.productionIsolation.mc03Started === false)

const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  new RegExp(`api${'Key'}=[A-Za-z0-9_-]+`, 'i'),
]

for (const file of requiredFiles) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !sensitivePatterns.some((pattern) => pattern.test(text)))
}

const statusLines = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedDirty.includes(file))
check('only ODDS-02A certification files changed', unexpected.length === 0, unexpected.join(', '))

const failures = checks.filter((item) => !item.pass)
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)
}

if (failures.length) {
  console.error(`ODDS-02A validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02A validation passed')
