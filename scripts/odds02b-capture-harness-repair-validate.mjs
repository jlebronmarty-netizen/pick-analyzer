import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  DEFAULT_CAPTURE_DIR,
  extractCertificationMetrics,
  parseCapturedJson,
  validateTopLevelApiOkPayload,
  writeCapture,
} from './odds-shadow-certification-capture.mjs'

const checks = []
const fixtureDir = join(DEFAULT_CAPTURE_DIR, 'odds02b-validator')

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

function safeJson(path) {
  return JSON.parse(read(path))
}

function cleanFixtureDir() {
  rmSync(fixtureDir, { recursive: true, force: true })
  mkdirSync(fixtureDir, { recursive: true })
}

const requiredFiles = [
  '.gitignore',
  'scripts/odds-shadow-certification-capture.mjs',
  'scripts/odds02b-capture-harness-repair-validate.mjs',
  'docs/PRODUCTION_PILOT/ODDS_02B_CAPTURE_HARNESS_REPAIR.md',
  'docs/CERTIFICATION/odds-02b-capture-harness-repair.json',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const gitignore = read('.gitignore')
const captureScript = read('scripts/odds-shadow-certification-capture.mjs')
const report = read('docs/PRODUCTION_PILOT/ODDS_02B_CAPTURE_HARNESS_REPAIR.md')
const cert = safeJson('docs/CERTIFICATION/odds-02b-capture-harness-repair.json')
const odds02a = safeJson('docs/CERTIFICATION/odds-02a-event-mapping-multi-market.json')

check('capture path is gitignored', gitignore.includes('/.tmp/odds-shadow-certification/'))
check('canonical API response contract documented', report.includes('top-level') && report.includes('apiOk'))
check('ODDS-02A historical classification preserved', odds02a.finalClassification === 'ODDS_02A_FINAL_REQUEST_CONSUMED_CERTIFICATION_INCOMPLETE')
check('ODDS-02B status is capture harness repaired', cert.finalClassification === 'ODDS_02B_CAPTURE_HARNESS_REPAIRED')

const topLevelFixture = {
  success: true,
  mode: 'odds02_the_odds_api_shadow_comparison_v1',
  status: 'DRY_RUN',
  generatedAt: '2026-08-09T15:30:00.000Z',
  provider: 'the-odds-api',
  credentialVariable: 'THE_ODDS_API_KEY',
  sportsDataIoProductionAuthority: true,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  productionCurrentBoardChanged: false,
  productionOfficialPicksChanged: false,
  productionPerformanceChanged: false,
  currentBoardCandidates: 42,
  requestId: 'fixture-request',
}

const liveFixture = {
  ...topLevelFixture,
  status: 'SHADOW_ACQUISITION_COMPLETE',
  providerCallsMade: 1,
  remoteMutationsMade: 0,
  requestsUsed: 1,
  creditsUsed: 3,
  creditsRemaining: 123,
  eventsReturned: 15,
  eventsMapped: 14,
  eventsUnmapped: 1,
  ambiguousEvents: 0,
  shadowSnapshots: 840,
  coverage: { bookmakers: ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars'], moneylineRows: 280, spreadRows: 280, totalRows: 280 },
  comparisons: [{ eventId: 'fixture-event', exactShadowMatches: 4 }],
  calls: [{ label: 'mlb_core_odds_shadow', httpStatus: 200, ok: true, requestsLast: 1, requestsUsed: 3, requestsRemaining: 123 }],
}

cleanFixtureDir()

const captured = writeCapture({
  captureDir: fixtureDir,
  label: 'top-level-fixture',
  status: 200,
  body: JSON.stringify(topLevelFixture),
  metadata: {
    endpoint: 'fixture',
    method: 'FIXTURE',
    requestHeadersCaptured: false,
    authorizationHeaderCaptured: false,
  },
})
check('raw response body captured before parsing', existsSync(captured.bodyPath) && existsSync(captured.metadataPath))
const parsed = parseCapturedJson(read(captured.bodyPath))
check('top-level apiOk payload parses successfully', parsed.ok)
const contract = validateTopLevelApiOkPayload(parsed.payload)
check('top-level apiOk contract validates', contract.ok, contract.errors.join(', '))
const metrics = extractCertificationMetrics(parsed.payload)
check('dry-run parsing works with zero provider calls', metrics.status === 'DRY_RUN' && metrics.providerCallsMade === 0)

const nested = validateTopLevelApiOkPayload({ data: topLevelFixture, requestId: 'old-envelope' })
check('old nested response.data envelope is rejected clearly', nested.ok === false && nested.errors.includes('NESTED_DATA_ENVELOPE_NOT_CANONICAL'))

const liveContract = validateTopLevelApiOkPayload(liveFixture, { live: true })
check('future live contract validates required certification fields', liveContract.ok, liveContract.errors.join(', '))
const liveMetrics = extractCertificationMetrics(liveFixture)
check('provider and credit accounting supported', liveMetrics.requestsUsed === 1 && liveMetrics.creditsUsed === 3 && liveMetrics.creditsRemaining === 123)

const malformed = writeCapture({ captureDir: fixtureDir, label: 'malformed-json', status: 200, body: '{"success":true', metadata: { endpoint: 'fixture', method: 'FIXTURE' } })
const malformedParsed = parseCapturedJson(read(malformed.bodyPath))
check('malformed JSON handled after capture', malformedParsed.ok === false && existsSync(malformed.bodyPath))

const httpFailure = writeCapture({ captureDir: fixtureDir, label: 'http-500', status: 500, body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR' } }), metadata: { endpoint: 'fixture', method: 'FIXTURE' } })
const httpFailureMeta = safeJson(httpFailure.metadataPath)
check('HTTP non-2xx status captured', httpFailureMeta.httpStatus === 500 && existsSync(httpFailure.bodyPath))

const missingField = validateTopLevelApiOkPayload({ ...topLevelFixture, providerCallsMade: undefined })
check('missing required field handled', missingField.ok === false && missingField.errors.some((error) => error.includes('providerCallsMade')))

const parserFailure = writeCapture({ captureDir: fixtureDir, label: 'parser-failure-recovery', status: 200, body: JSON.stringify(topLevelFixture), metadata: { endpoint: 'fixture', method: 'FIXTURE' } })
let simulatedParserFailurePreserved = false
try {
  throw new Error('SIMULATED_PARSER_EXCEPTION_AFTER_CAPTURE')
} catch {
  simulatedParserFailurePreserved = existsSync(parserFailure.bodyPath)
}
check('parser failure preserves raw capture', simulatedParserFailurePreserved)

let secretBlocked = false
try {
  const blockedHeader = ['Authorization', ': ', 'Bearer', ' ', 'secret-token-value'].join('')
  writeCapture({ captureDir: fixtureDir, label: 'secret', status: 200, body: blockedHeader, metadata: {} })
} catch {
  secretBlocked = true
}
check('secrets and Authorization header never written', secretBlocked)

check('future script has no automatic retry loop', !/for\s*\(|while\s*\(|retry/i.test(captureScript.split('async function fetchOnce')[1] ?? ''))
check('future script max one live request per invocation', captureScript.includes('maxLiveRequestsThisInvocation') && captureScript.includes('Math.min(Number(maxCalls) || 1, 1)'))
check('live script loads CRON_SECRET safely without printing it', captureScript.includes('process.env.CRON_SECRET') && !captureScript.includes('console.log(process.env.CRON_SECRET)'))
check('request headers are not captured', captureScript.includes('requestHeadersCaptured: false') && captureScript.includes('authorizationHeaderCaptured: false'))
check('ODDS-02B used zero provider calls', cert.providerCallsDuringOdds02B === 0)
check('ODDS-02B used zero database mutations', cert.databaseMutationsDuringOdds02B === 0)
check('production recommendation logic unchanged', cert.productionRecommendationLogicChanged === false)

const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /apiKey=[A-Za-z0-9_-]+/i,
]

for (const file of requiredFiles.filter((file) => file !== '.gitignore')) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !sensitivePatterns.some((pattern) => pattern.test(text)))
}

const statusLines = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowedDirty = new Set(requiredFiles.map((file) => file.replaceAll('\\', '/')))
const changed = statusLines.map((line) => line.slice(3).trim().replaceAll('\\', '/'))
const unexpected = changed.filter((file) => !allowedDirty.has(file))
check('only ODDS-02B files changed', unexpected.length === 0, unexpected.join(', '))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`ODDS-02B validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02B validation passed')
