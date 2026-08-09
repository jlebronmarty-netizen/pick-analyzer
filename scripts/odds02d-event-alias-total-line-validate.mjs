import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const requiredFiles = [
  'src/services/odds02-shadow-comparison.service.ts',
  'docs/PRODUCTION_PILOT/ODDS_02D_EVENT_ALIAS_TOTAL_LINE_RECONCILIATION.md',
  'docs/CERTIFICATION/odds-02d-event-alias-total-line.json',
  'scripts/odds02d-event-alias-total-line-validate.mjs',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const service = read('src/services/odds02-shadow-comparison.service.ts')
const report = read('docs/PRODUCTION_PILOT/ODDS_02D_EVENT_ALIAS_TOTAL_LINE_RECONCILIATION.md')
const cert = JSON.parse(read('docs/CERTIFICATION/odds-02d-event-alias-total-line.json'))
const odds02c = JSON.parse(read('docs/CERTIFICATION/odds-02c-wide-sample-shadow.json'))

check('captured ODDS-02C payload reused', cert.capturedOdds02cPayloadReused === true && existsSync(cert.capturePath))
check('provider calls are zero', cert.providerCalls === 0)
check('database mutations are zero', cert.databaseMutations === 0)
check('ATH/OAK deterministic alias repair present', service.includes("oaklandathletics: 'ATH'") && service.includes("athletics: 'ATH'") && service.includes("oak: 'ATH'"))
check('crosswalk convention is aligned', read('src/services/the-odds-api-event-crosswalk.service.ts').includes("oak: 'ATH'"))
check('mapping before preserved', cert.athOak.mappingBefore.mapped === 13 && cert.athOak.mappingBefore.ambiguous === 0)
check('mapping after reaches 14/14', cert.athOak.mappingAfter.mapped === 14 && cert.athOak.mappingAfter.mappingRate === 1)
check('ambiguous mapping remains zero', cert.athOak.mappingAfter.ambiguous === 0)
check('any-total coverage separated from exact-line coverage', cert.totalCoverage.bettableTotalCoverageLowerBound > cert.totalCoverage.exactLineTotalCoverage)
check('total mismatch contract limitation documented', cert.totalCoverage.rootCause === 'RESPONSE_CONTRACT_LIMITATION_FOR_NON_EXACT_TOTAL_LINES')
check('every total mismatch classified without fabricating moved lines', cert.totalCoverage.classifications.PROVIDER_TOTAL_PRESENT_EXACT_LINE_UNKNOWN === 12 && cert.totalCoverage.classifications.HALF_POINT_MOVED === 0)
check('no cross-line probability reuse', cert.lineMovementPolicy.crossLineProbabilityReuseAllowed === false)
check('synthetic odds not introduced', !report.includes('synthetic odds') && cert.lineMovementPolicy.lineAdjustmentModelImplemented === false)
check('production recommendation policies unchanged', cert.productionIsolation.officialPickPolicyChanged === false && cert.productionIsolation.rentPlayPolicyChanged === false)
check('settlement unchanged', cert.productionIsolation.settlementChanged === false)
check('learning unchanged', cert.productionIsolation.learningChanged === false)
check('HR-03 unchanged', cert.productionIsolation.hr03Changed === false)
check('ODDS-03 not started', cert.productionIsolation.odds03Started === false)
check('moneyline coverage recomputed', cert.marketCoverage.moneyline.bettable === 14 && cert.marketCoverage.moneyline.exactLine === 14)
check('run line coverage recomputed', cert.marketCoverage.runLine.bettable === 14 && cert.marketCoverage.runLine.exactLine === 14)
check('total coverage root cause does not falsely blame provider', cert.theOddsApiOddsReplacementReadiness === 'MORE_ODDS_REPAIR_REQUIRED')
check('ODDS-02C source preserved', odds02c.finalClassification === 'ODDS_02C_WIDE_SAMPLE_CAPTURED_DO_NOT_CUTOVER')

const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /apiKey=[A-Za-z0-9_-]+/i,
]

for (const file of requiredFiles) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !sensitivePatterns.some((pattern) => pattern.test(text)))
}

const statusLines = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowedDirty = new Set(requiredFiles)
const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedDirty.has(file))
check('only ODDS-02D files changed', unexpected.length === 0, unexpected.join(', '))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`ODDS-02D validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02D validation passed')
