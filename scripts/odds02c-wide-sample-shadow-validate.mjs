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
  'docs/PRODUCTION_PILOT/ODDS_02C_WIDE_SAMPLE_SHADOW_CERTIFICATION.md',
  'docs/CERTIFICATION/odds-02c-wide-sample-shadow.json',
  'scripts/odds02c-wide-sample-shadow-validate.mjs',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const report = read('docs/PRODUCTION_PILOT/ODDS_02C_WIDE_SAMPLE_SHADOW_CERTIFICATION.md')
const cert = JSON.parse(read('docs/CERTIFICATION/odds-02c-wide-sample-shadow.json'))
const odds02b = JSON.parse(read('docs/CERTIFICATION/odds-02b-capture-harness-repair.json'))
const odds02a = JSON.parse(read('docs/CERTIFICATION/odds-02a-event-mapping-multi-market.json'))
const gitignore = read('.gitignore')

check('ODDS-02C request budget exactly one', cert.requestAccounting.odds02cAuthorizedRequests === 1)
check('request consumed at most once', cert.requestAccounting.requestConsumed === true && cert.requestAccounting.remainingOdds02cRequests === 0)
check('capture harness is ODDS-02B repaired harness', cert.captureHarness === 'scripts/odds-shadow-certification-capture.mjs' && odds02b.finalClassification === 'ODDS_02B_CAPTURE_HARNESS_REPAIRED')
check('capture path gitignored', cert.captureDirectoryGitignored === true && gitignore.includes('/.tmp/odds-shadow-certification/'))
check('raw payload is not committed', cert.rawPayloadCommitted === false)
check('secrets absent from capture', cert.secretsCaptured === false && cert.authorizationHeaderCaptured === false)
check('ODDS-02A historical incomplete status preserved', odds02a.finalClassification === 'ODDS_02A_FINAL_REQUEST_CONSUMED_CERTIFICATION_INCOMPLETE')
check('expected-mappable denominator used', cert.mapping.expectedMappableCurrentEvents === cert.usefulSlateGate.expectedMappableCurrentEvents)
check('ambiguous mappings counted', typeof cert.mapping.ambiguousEvents === 'number' && cert.mapping.ambiguousEvents === 0)
check('moneyline coverage measured', cert.marketCoverage.moneyline.expected === 14 && cert.marketCoverage.moneyline.available === 13)
check('exact-line run line coverage measured', cert.marketCoverage.runLine.expected === 14 && cert.marketCoverage.runLine.available === 13)
check('exact-line total coverage measured', cert.marketCoverage.total.expected === 14 && cert.marketCoverage.total.available === 2)
check('bookmaker identity preserved', cert.bookmakerCoverage.observedBooks.includes('FanDuel') && cert.bookmakerCoverage.observedBooks.includes('DraftKings') && cert.bookmakerCoverage.observedBooks.includes('BetMGM') && cert.bookmakerCoverage.observedBooks.includes('Caesars'))
check('freshness measured using source time', cert.freshness.sportsDataIoLatestSourceTime.includes('T') && cert.freshness.theOddsApiLatestEvidenceTime.includes('T'))
check('bestFreshPrice uses fresh evidence only', report.includes('best fresh') && cert.freshness.theOddsApi.stale === 0)
check('production pricing unchanged', cert.productionIsolation.currentBoardProductionPriceChanged === false)
check('Official Picks unchanged', cert.productionIsolation.officialPickPolicyChanged === false && cert.officialPicks.changed === false)
check('model probability unchanged', cert.productionIsolation.probabilityChanged === false)
check('settlement unchanged', cert.productionIsolation.settlementChanged === false)
check('learning unchanged', cert.productionIsolation.learningChanged === false)
check('Performance unchanged', cert.productionIsolation.performanceChanged === false)
check('HR-03 unchanged', cert.productionIsolation.hr03Changed === false)
check('scheduler cadence unchanged', cert.productionIsolation.schedulerCadenceChanged === false)
check('no automatic provider retry', cert.requestAccounting.automaticRetry === false)
check('production mutations zero', cert.productionMutations === 0)
check('cutover rejected due identity and total coverage gaps', cert.cutoverDecision === 'DO_NOT_CUTOVER' && cert.odds03Recommended === false)
check('ODDS provider replacement signal is moderate', cert.oddsProviderReplacementSignal === 'MODERATE')
check('ATH/OAK mapping defect documented', cert.highFindings.includes('ATH_OAK_TEAM_ALIAS_MAPPING_DEFECT') && report.includes('ATH @ BOS'))
check('total exact-line coverage gap documented', cert.mediumFindings.includes('TOTAL_EXACT_LINE_COVERAGE_LOW'))

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
check('only ODDS-02C certification files changed', unexpected.length === 0, unexpected.join(', '))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`ODDS-02C validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02C validation passed')
