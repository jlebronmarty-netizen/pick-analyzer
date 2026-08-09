import { existsSync, readFileSync } from 'node:fs'

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const requiredFiles = [
  'src/services/market-line-versioning-contract.service.ts',
  'src/services/odds02-shadow-comparison.service.ts',
  'scripts/odds-shadow-certification-capture.mjs',
  'docs/ARCHITECTURE/ODDS_PRIMARY_CUTOVER_READINESS_V1.md',
  'docs/PRODUCTION_PILOT/ODDS_03R_CUTOVER_READINESS_REVIEW.md',
  'docs/CERTIFICATION/odds-03r-cutover-readiness.json',
  'scripts/odds03r-cutover-readiness-validate.mjs',
]

for (const file of requiredFiles) check(`required file exists: ${file}`, existsSync(file))

const cert = JSON.parse(read('docs/CERTIFICATION/odds-03r-cutover-readiness.json'))
const architecture = read('docs/ARCHITECTURE/ODDS_PRIMARY_CUTOVER_READINESS_V1.md')
const report = read('docs/PRODUCTION_PILOT/ODDS_03R_CUTOVER_READINESS_REVIEW.md')
const lineService = read('src/services/market-line-versioning-contract.service.ts')
const shadowService = read('src/services/odds02-shadow-comparison.service.ts')
const captureHarness = read('scripts/odds-shadow-certification-capture.mjs')

check('ODDS-02G evidence reconciled', cert.odds02gReconstruction.returnedEvents === 15 && cert.odds02gReconstruction.fullMarketRows === 966 && cert.odds02gReconstruction.mappedRows === 852)
check('CIN @ WSH classified', cert.unmappedEvents.cinAtWsh.rootCause === 'CURRENT_BOARD_SCOPE_MAPPING_DEFECT')
check('TB @ SEA classified', cert.unmappedEvents.tbAtSea.rootCause === 'CURRENT_BOARD_SCOPE_MAPPING_DEFECT')
check('expected-mappable denominator correct', cert.offlineMapping.currentBoardExpectedMappable === 13 && cert.offlineMapping.currentBoardMapped === 13)
check('ambiguous mappings = 0', cert.offlineMapping.ambiguousEvents === 0)
check('Total moved-line evidence reconciled', cert.totalLineMovement.correctedExactLineCount === 10 && cert.totalLineMovement.correctedMovedLineCount === 3)
check('exact-line probability/price identity enforced', architecture.includes('eventId + market + selection + normalized line'))
check('re-prediction execution readiness classified', cert.repredictionContract.status === 'DESIGNED_BUT_NOT_EXECUTABLE' && cert.repredictionContract.productionExecutable === false)
check('no cross-line reuse', report.includes('Total 8.0 probability to Total 8.5 price') || architecture.includes('Total 8.0 probability to Total 8.5 price'))
check('bookmaker production set proposed', cert.certifiedBookSetV1.join(',') === 'FanDuel,DraftKings,BetMGM,Caesars')
check('freshness authority uses source timestamp', cert.freshnessAuthority.authorityTimestamp === 'THE_ODDS_API_SOURCE_TIMESTAMP' && cert.freshnessAuthority.captureTimestampCanSubstitute === false)
check('provider failure behavior defined', cert.providerFailurePolicy.sportsDataIoFallback === 'FALLBACK_CONTEXT_ONLY' && cert.providerFailurePolicy.rateLimited === 'NO_FRESH_PRICE')
check('budget economics calculated', cert.pollingEconomics.tenGameSlate.credits30Day === 3330 && cert.pollingEconomics.fifteenGameSlate.credits30Day === 3330)
check('multiple-line prediction settlement policy defined', cert.settlementPerformanceLearningPolicy.settlement === 'LINE_SPECIFIC')
check('recommendation exposure separated from prediction evidence', cert.settlementPerformanceLearningPolicy.performance === 'RECOMMENDATION_EXPOSURE_AWARE')
check('HR-03 remains shadow', cert.safety.hr03CalibrationShadowOnly === true)
check('Official Pick thresholds unchanged', cert.safety.officialPickThresholdsChanged === false)
check('provider calls = 0', cert.providerCalls.theOddsApi === 0 && cert.providerCalls.sportsDataIo === 0 && cert.providerCalls.otherExternalProviders === 0)
check('production authority unchanged', cert.safety.sportsDataIoProductionAuthorityChanged === false && cert.safety.theOddsApiShadowOnly === true)
check('database mutations = 0', cert.databaseMutations === 0)
check('cutover not performed', cert.safety.odds03Performed === false)
check('SportsDataIO not cancelled', cert.safety.sportsDataIoCancelled === false)
check('ODDS-03R decision is bounded-repair ready', cert.cutoverDecision === 'CUTOVER_READY_AFTER_BOUNDED_REPAIR')

check('market-line helper normalizes total lines only', lineService.includes("market === 'total' ? Math.abs(value) : value"))
check('shadow service compares market-aware lines', shadowService.includes('sameMarketLine(snapshot.market, snapshot.line, line)'))
check('capture harness compares market-aware lines', captureHarness.includes('sameMarketLine(row.market, row.line, prediction.line)'))
check('capture harness import guard is robust', captureHarness.includes("const invokedScript = process.argv[1] ?? ''"))
check('re-prediction remains dry-run only in code', lineService.includes("mode: 'DRY_RUN_ONLY'") && lineService.includes('productionPredictionCreated: false'))

const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /apiKey=[A-Za-z0-9_-]+/i,
]
const trackedTexts = requiredFiles.map((file) => read(file)).join('\n')
check('no secret values exposed', !sensitivePatterns.some((pattern) => pattern.test(trackedTexts)))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failures = checks.filter((item) => !item.pass)
if (failures.length) {
  console.error(`ODDS-03R validation failed: ${failures.length} failure(s)`)
  process.exit(1)
}

console.log('ODDS-03R validation passed')
