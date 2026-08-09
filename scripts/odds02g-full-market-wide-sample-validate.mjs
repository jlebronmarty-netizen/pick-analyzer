import { existsSync, readFileSync } from 'node:fs'
import { validateTopLevelApiOkPayload } from './odds-shadow-certification-capture.mjs'

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const requiredFiles = [
  'docs/PRODUCTION_PILOT/ODDS_02G_FULL_MARKET_WIDE_SAMPLE.md',
  'docs/CERTIFICATION/odds-02g-full-market-wide-sample.json',
  'scripts/odds02g-full-market-wide-sample-validate.mjs',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const cert = JSON.parse(read('docs/CERTIFICATION/odds-02g-full-market-wide-sample.json'))
const report = read('docs/PRODUCTION_PILOT/ODDS_02G_FULL_MARKET_WIDE_SAMPLE.md')
const captureExists = cert.capturePath && existsSync(cert.capturePath)
const payload = captureExists ? JSON.parse(read(cert.capturePath)) : null

check('status is ODDS-02G wide sample captured', cert.status === 'ODDS_02G_WIDE_SAMPLE_CAPTURED_MORE_SHADOW_EVIDENCE_REQUIRED')
check('ODDS-02F production commit was baseline', cert.startingCommit === '6104dc3e9b73ec528d1aa0faef6f5f1885f6276a')
check('useful slate gate passed', cert.usefulSlateGate.status === 'PASS' && cert.usefulSlateGate.currentBoardUniqueEventIds >= 5)
check('exactly one authorized request consumed', cert.requestAccounting.requestsAuthorized === 1 && cert.requestAccounting.requestsConsumed === 1)
check('provider calls for live capture = 1', cert.requestAccounting.phaseProviderCallsMade === 1)
check('database mutations = 0', cert.requestAccounting.remoteMutationsMade === 0 && cert.requestAccounting.productionMutationsMade === 0)
check('capture path exists locally', captureExists)

if (payload) {
  const contract = validateTopLevelApiOkPayload(payload, { live: true })
  const rows = Array.isArray(payload.fullMarketEvidence) ? payload.fullMarketEvidence : []
  const mapped = rows.filter((row) => row.mappingStatus === 'MAPPED' && row.canonicalEventId)
  const hasCoreBook = (book) => mapped.some((row) => row.bookmaker === book)
  const uniqueEventsForMarket = (market) => new Set(mapped.filter((row) => row.market === market).map((row) => row.canonicalEventId)).size

  check('captured payload satisfies top-level live contract', contract.ok, contract.errors?.join('; ') ?? '')
  check('capture used shadow credential only', payload.credentialVariable === 'THE_ODDS_API_KEY')
  check('production authority unchanged in payload', payload.sportsDataIoProductionAuthority === true)
  check('provider calls in payload = 1', payload.providerCallsMade === 1)
  check('no production mutations in payload', payload.remoteMutationsMade === 0 && payload.productionMutationsMade === 0)
  check('full-market evidence rows retained', rows.length === cert.capture.fullMarketEvidenceRows && rows.length >= 900)
  check('mapped rows retained', mapped.length === cert.capture.mappedRows && mapped.length >= 800)
  check('mapping clean for expected events', cert.capture.eventsMapped === 13 && cert.capture.ambiguousEvents === 0)
  check('unmapped provider events documented', cert.capture.eventsUnmapped === 2 && cert.capture.unmappedEvents.length === 2)
  check('moneyline coverage = 100%', cert.marketCoverage.moneyline.bettableEvents === 13 && uniqueEventsForMarket('moneyline') === 13)
  check('run line coverage = 100%', cert.marketCoverage.runLine.bettableEvents === 13 && uniqueEventsForMarket('spread') === 13)
  check('total bettable coverage = 100%', cert.marketCoverage.total.bettableEvents === 13 && uniqueEventsForMarket('total') === 13)
  check('total exact-line coverage remains separated from bettable coverage', cert.marketCoverage.total.exactLinePredictions === 2 && cert.marketCoverage.total.movedLinePredictions === 11)
  check('core books observed', ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars'].every(hasCoreBook))
  check('The Odds API evidence materially fresher', cert.freshness.theOddsApiEvidenceAgeMinutes < cert.freshness.sportsDataIoSourceAgeMinutes)
  check('all mapped shadow rows fresh', cert.freshness.theOddsApiRows.fresh === cert.capture.mappedRows && cert.freshness.theOddsApiRows.stale === 0)
  check('stale evidence not actionable', cert.safety.staleEvidenceActionable === false)
  check('production Current Board unchanged', payload.productionCurrentBoardChanged === false && cert.safety.productionCurrentBoardChanged === false)
  check('production Official Picks unchanged', payload.productionOfficialPicksChanged === false && cert.safety.productionOfficialPicksChanged === false)
  check('production Performance unchanged', payload.productionPerformanceChanged === false && cert.safety.productionPerformanceChanged === false)
}

check('SportsDataIO remains production authority', cert.safety.sportsDataIoAuthorityChanged === false)
check('The Odds API remains shadow-only', cert.safety.theOddsApiShadowOnly === true)
check('no ODDS-03 cutover', cert.safety.odds03Started === false && report.includes('No ODDS-03 cutover was performed'))
check('no cross-line probability reuse implied', report.includes('line movement') && report.includes('exact-line'))
check('cutover decision requires more evidence', cert.cutoverDecision === 'MORE_SHADOW_EVIDENCE_REQUIRED')
check('Production Pilot remains active in report scope', report.includes('Production Pilot') || cert.finalClassification.includes('ODDS_02G'))

const trackedTexts = requiredFiles.map((file) => read(file)).join('\n')
const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /apiKey=[A-Za-z0-9_-]+/i,
]
check('no secret values exposed in ODDS-02G artifacts', !sensitivePatterns.some((pattern) => pattern.test(trackedTexts)))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`ODDS-02G validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02G validation passed')
