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

check('ODDS-02A classification is wait for useful shadow window', cert.finalClassification === 'ODDS_02A_WAIT_FOR_USEFUL_SHADOW_WINDOW')
check('ODDS-02 baseline preserved as production shadow certified', cert.odds02Baseline.classification === 'ODDS_02_PRODUCTION_SHADOW_CERTIFIED')
check('SportsDataIO remains production authority', cert.productionIsolation.sportsDataIoRemainsProductionAuthority === true)
check('The Odds API remains shadow only', cert.productionIsolation.theOddsApiRemainsShadowOnly === true)
check('prior 24-event denominator preserved', cert.priorProductionShadowEvidence.eventsReturned === 24)
check('prior expected-mappable denominator exists', cert.priorProductionShadowEvidence.expectedMappable === 1)
check('raw 1/24 is not used as reliability rate', cert.mappingContract.rawReturnedCoverageMustNotBeUsedAsReliabilityRate === true)
check('expected-mappable mapping rate is cutover metric', cert.mappingContract.expectedMappableCoverageIsCutoverMetric === true)
check('prior expected-mappable mapping rate is 100 percent', cert.priorProductionShadowEvidence.expectedMappableMappingRate === 1)
check('prior unmapped aggregate classifications account for 24 events', Object.values(cert.priorUnmappedClassificationCounts).reduce((sum, value) => sum + value, 0) === 24)
check('raw payload retention gap is documented', cert.priorProductionShadowEvidence.sourcePayloadPersisted === false && report.includes('PRIOR_RAW_EVENT_PAYLOAD_NOT_PERSISTED'))
check('provider event identity documented', report.includes('normalized home/away teams') && report.includes('15-minute start-time tolerance'))
check('team aliases audited', Array.isArray(cert.mappingContract.teamAliasesAudited) && cert.mappingContract.teamAliasesAudited.includes('CHW') && cert.mappingContract.teamAliasesAudited.includes('WSH'))
check('start-time tolerance audited', cert.mappingContract.startTimeToleranceMinutes === 15)
check('timezone/date behavior audited by gate evidence', report.includes('Current Board') && report.includes('operating'))
check('ambiguous automatic mappings remain disallowed', cert.mappingContract.ambiguousAutomaticMappingsAllowed === false)
check('no mapping repair performed without proven defect', cert.rootCause.mappingDefectProven === false && cert.rootCause.mappingRepairPerformed === false)
check('final provider request was not consumed', cert.finalShadowRequest.consumed === false)
check('maximum additional provider requests remains one', cert.requestAccounting.remainingAuthorizedRequests === 1 && cert.requestAccounting.maximumAdditionalRequests === 1)
check('cumulative ODDS requests stay under cap', cert.requestAccounting.cumulativeRequestsUsed <= cert.requestAccounting.maximumCumulativeRequests)
check('cumulative ODDS credits stay at prior count', cert.requestAccounting.cumulativeCreditsUsed === 6)
check('exact-line identity required', report.includes('exact event') && report.includes('exact market') && report.includes('exact selection') && report.includes('exact line'))
check('moneyline coverage measured or gated', cert.finalShadowRequest.moneylineCoverage === null && report.includes('Moneyline'))
check('run line coverage measured or gated', cert.finalShadowRequest.runLineCoverage === null && report.includes('Run line'))
check('total coverage measured or gated', cert.finalShadowRequest.totalCoverage === null && report.includes('Total'))
check('bookmaker identity preserved', report.includes('FanDuel') && report.includes('DraftKings') && report.includes('BetMGM') && report.includes('Caesars'))
check('best fresh price excludes stale evidence by policy', report.includes('BEST_FRESH_WITH_USER_BOOK_PREFERENCE'))
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
