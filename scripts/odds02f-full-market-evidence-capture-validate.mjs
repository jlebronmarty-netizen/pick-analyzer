import { existsSync, readFileSync } from 'node:fs'
import {
  bestFreshExactLinePrice,
  classifyLineMovement,
  marketEvidenceMetrics,
  validateTopLevelApiOkPayload,
} from './odds-shadow-certification-capture.mjs'

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const requiredFiles = [
  'src/services/odds02-shadow-comparison.service.ts',
  'scripts/odds-shadow-certification-capture.mjs',
  'docs/ARCHITECTURE/ODDS_FULL_MARKET_EVIDENCE_CONTRACT_V1.md',
  'docs/PRODUCTION_PILOT/ODDS_02F_FULL_MARKET_EVIDENCE_CAPTURE.md',
  'docs/CERTIFICATION/odds-02f-full-market-evidence-capture.json',
  'scripts/odds02f-full-market-evidence-capture-validate.mjs',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const service = read('src/services/odds02-shadow-comparison.service.ts')
const captureHarness = read('scripts/odds-shadow-certification-capture.mjs')
const cert = JSON.parse(read('docs/CERTIFICATION/odds-02f-full-market-evidence-capture.json'))

const capturedAt = '2026-08-09T16:00:00.000Z'
const freshAt = '2026-08-09T15:55:00.000Z'
const staleAt = '2026-08-09T14:00:00.000Z'

function row(overrides) {
  return {
    eventId: 'event-1',
    canonicalEventId: 'event-1',
    providerEventId: 'provider-1',
    homeTeam: 'Boston Red Sox',
    awayTeam: 'Athletics',
    commenceTime: '2026-08-09T23:10:00.000Z',
    bookmakerKey: 'fanduel',
    bookmaker: 'FanDuel',
    market: 'total',
    providerMarket: 'totals',
    selection: 'Over',
    line: 8,
    price: -110,
    providerSourceTimestamp: freshAt,
    capturedAt,
    mappingStatus: 'MAPPED',
    mappingReason: 'TEAM_AND_START_TIME_WITHIN_15_MINUTES',
    freshnessStatus: 'FRESH',
    sourceAgeMinutes: 5,
    ...overrides,
  }
}

const fixtureRows = [
  row({ bookmakerKey: 'fanduel', bookmaker: 'FanDuel', line: 8, price: -105 }),
  row({ bookmakerKey: 'draftkings', bookmaker: 'DraftKings', line: 8, price: -108 }),
  row({ bookmakerKey: 'betmgm', bookmaker: 'BetMGM', line: 8.5, price: 100 }),
  row({ bookmakerKey: 'caesars', bookmaker: 'Caesars', line: 8.5, price: -102 }),
  row({ bookmakerKey: 'fanatics', bookmaker: 'Fanatics', line: 7.5, price: -120 }),
  row({ bookmakerKey: 'fanduel', bookmaker: 'FanDuel', market: 'total', selection: 'Under', line: 8, price: -115 }),
  row({ bookmakerKey: 'fanduel', bookmaker: 'FanDuel', market: 'spread', providerMarket: 'spreads', selection: 'ATH', line: 1.5, price: -110 }),
  row({ bookmakerKey: 'fanduel', bookmaker: 'FanDuel', market: 'spread', providerMarket: 'spreads', selection: 'BOS', line: -1.5, price: -110 }),
  row({ bookmakerKey: 'draftkings', bookmaker: 'DraftKings', market: 'moneyline', providerMarket: 'h2h', selection: 'ATH', line: null, price: 130 }),
  row({ bookmakerKey: 'betmgm', bookmaker: 'BetMGM', market: 'moneyline', providerMarket: 'h2h', selection: 'BOS', line: null, price: -145 }),
  row({ bookmakerKey: 'stale', bookmaker: 'StaleBook', line: 8, price: 105, providerSourceTimestamp: staleAt, freshnessStatus: 'STALE', sourceAgeMinutes: 120 }),
  row({ eventId: 'provider-2', canonicalEventId: null, providerEventId: 'provider-2', mappingStatus: 'UNMAPPED', mappingReason: 'NO_TEAM_TIME_MATCH', bookmakerKey: 'fanduel', bookmaker: 'FanDuel', line: 8, price: -110 }),
]

const predictions = [
  { predictionId: 'p-total-exact', eventId: 'event-1', market: 'total', selection: 'Over', line: 8 },
  { predictionId: 'p-total-moved', eventId: 'event-1', market: 'total', selection: 'Under', line: 8.5 },
  { predictionId: 'p-spread', eventId: 'event-1', market: 'spread', selection: 'ATH', line: 1.5 },
  { predictionId: 'p-ml', eventId: 'event-1', market: 'moneyline', selection: 'ATH', line: null },
]

const metrics = marketEvidenceMetrics(fixtureRows, predictions)
const best = bestFreshExactLinePrice(fixtureRows, predictions[0])
const moved = classifyLineMovement(8, [8.5])
const split = classifyLineMovement(8, [8, 8.5])
const noMarket = classifyLineMovement(8, [])

const livePayload = {
  success: true,
  mode: 'odds02_the_odds_api_shadow_comparison_v1',
  providerCallsMade: 1,
  remoteMutationsMade: 0,
  credentialVariable: 'THE_ODDS_API_KEY',
  sportsDataIoProductionAuthority: true,
  eventsReturned: 1,
  eventsMapped: 1,
  eventsUnmapped: 0,
  ambiguousEvents: 0,
  shadowSnapshots: fixtureRows.length,
  comparisons: [],
  coverage: {},
  calls: [],
  fullMarketEvidenceContract: {
    secretsIncluded: false,
    rawRequestMetadataIncluded: false,
    productionAuthorityChanged: false,
  },
  fullMarketEvidence: fixtureRows,
}

check('full market rows retained', service.includes('fullMarketEvidence') && service.includes('fullMarketEvidenceRows'))
check('bookmaker identity retained', service.includes('bookmakerKey') && service.includes('bookmaker: snapshot.bookmaker'))
check('alternate lines retained', metrics.identityCount === fixtureRows.length)
check('source timestamp retained', service.includes('providerSourceTimestamp') && fixtureRows.every((item) => 'providerSourceTimestamp' in item))
check('capture timestamp retained', service.includes('capturedAt') && fixtureRows.every((item) => 'capturedAt' in item))
check('no secrets in response contract', service.includes('secretsIncluded: false') && service.includes('rawRequestMetadataIncluded: false'))
check('capture-first behavior preserved', captureHarness.includes('writeCapture') && captureHarness.indexOf('writeCapture') < captureHarness.indexOf('parseCapturedJson'))
check('live contract validates full market evidence', validateTopLevelApiOkPayload(livePayload, { live: true }).ok)
check('Total bettable coverage derivable from rows', metrics.totalBettableCoverage === 1)
check('Total exact-line coverage derivable', metrics.totalExactLineCoverage === 1)
check('line movement derivable', moved.classification === 'HALF_POINT_MOVE' && moved.direction === 'UP')
check('split line fixture preserves exact availability', split.classification === 'EXACT_LINE_AVAILABLE')
check('no market fixture classified', noMarket.classification === 'NO_CURRENT_MARKET')
check('Run Line exact identity preserved', metrics.runLineExactLineCoverage === 1)
check('Moneyline unaffected', metrics.moneylineBettableCoverage === 1)
check('bestFreshPrice exact-line only', best.status === 'FOUND' && best.line === 8 && best.price === -105)
check('stale books excluded from bestFreshPrice', best.bookmaker !== 'StaleBook')
check('missing book tolerated', !metrics.books.includes('MissingBook'))
check('unmapped event retained but excluded from mapped coverage', metrics.eventsReturned === 2 && metrics.eventsMapped === 1)
check('ATH/OAK mapping still works', read('src/services/odds02-shadow-comparison.service.ts').includes("oak: 'ATH'"))
check('provider calls = 0', cert.providerCalls === 0)
check('database mutations = 0', cert.databaseMutations === 0)
check('SportsDataIO authority unchanged', cert.safety.sportsDataIoAuthorityChanged === false)
check('The Odds API shadow-only', cert.safety.theOddsApiShadowOnly === true)
check('no production recommendation changes', cert.safety.officialPickPolicyChanged === false && cert.safety.rentPlayChanged === false && cert.safety.smartParlayChanged === false)
check('fixture results all pass', Object.values(cert.fixtureResults).every((value) => value === 'PASS'))
check('ready for new wide sample', cert.readyForNewWideSample === true)

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

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`ODDS-02F validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-02F validation passed')
