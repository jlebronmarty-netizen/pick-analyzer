import { existsSync, readFileSync } from 'node:fs'

const checks = []

function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const files = {
  orchestrator: 'src/services/adaptive-refresh-orchestrator.service.ts',
  planner: 'src/services/event-refresh-planner.service.ts',
  acquisition: 'src/services/the-odds-api-current-odds-acquisition.service.ts',
  currentBoard: 'src/services/current-board.service.ts',
  authority: 'src/services/odds-primary-authority.service.ts',
  architecture: 'docs/ARCHITECTURE/ODDS_PRIMARY_AUTHORITY_V1.md',
  pilot: 'docs/PRODUCTION_PILOT/ODDS_03A_NATURAL_DUAL_READ_PROOF.md',
  cert: 'docs/CERTIFICATION/odds-03a-natural-dual-read-proof.json',
}

for (const file of Object.values(files)) check(`required file exists: ${file}`, existsSync(file))

const orchestrator = read(files.orchestrator)
const planner = read(files.planner)
const acquisition = read(files.acquisition)
const currentBoard = read(files.currentBoard)
const authority = read(files.authority)
const architecture = read(files.architecture)
const pilot = read(files.pilot)
const cert = JSON.parse(read(files.cert))
const combined = [
  orchestrator,
  planner,
  acquisition,
  currentBoard,
  authority,
  architecture,
  pilot,
  JSON.stringify(cert),
].join('\n')

check('orchestrator imports dual-read acquisition', orchestrator.includes('executeTheOddsApiMlbDualReadAcquisition'))
check('orchestrator executes dual-read after canonical acquisition', orchestrator.indexOf('executeCanonicalMlbMarketAcquisition') < orchestrator.indexOf('executeTheOddsApiMlbDualReadAcquisition'))
check('executed steps include The Odds API', orchestrator.includes("provider: 'the-odds-api'") && orchestrator.includes('odds03a_shadow_dual_read_market_refresh'))
check('provider calls include both providers', orchestrator.includes('totalProviderCallsMade') && orchestrator.includes('theOddsApiProviderCalls'))
check('planner authorizes Stage 1 shadow execution', planner.includes('DUAL_READ_ACTIVE_SHADOW_ACQUISITION_PRODUCT_AUTHORITY_REMAINS_SPORTSDATAIO') && planner.includes('activeExecutionAuthorized: oddsAuthority.stage ==='))
check('dual-read is one MLB league-wide odds request', acquisition.includes("fetchProviderJson(state, 'odds03a_mlb_dual_read'") && acquisition.includes("maxCalls: 1"))
check('dual-read uses isolated credential only', acquisition.includes('process.env.THE_ODDS_API_KEY') && !acquisition.includes('process.env.ODDS_API_KEY'))
check('dual-read maps provider events to canonical lifecycle events', acquisition.includes('mapOddsApiEventToLifecycleEvent') && acquisition.includes('canonicalEventId'))
check('dual-read stores shadow-only metadata', acquisition.includes('SHADOW_NON_AUTHORITATIVE') && acquisition.includes('productPriceAuthority: false') && acquisition.includes('production_eligible: false'))
check('dual-read records provider accounting', acquisition.includes("job_type: 'odds03a_natural_dual_read_v1'") && acquisition.includes('externalCallsUsed') && acquisition.includes('providerCreditsConsumed'))
check('Current Board filters product odds provider', currentBoard.includes('productOddsProviderForCurrentBoard') && currentBoard.includes(".eq('provider', productOddsProvider)"))
check('SportsDataIO remains Stage 1 product authority', cert.productAuthority === 'SPORTSDATAIO' && cert.repair.sportsDataIoProductAuthorityPreserved === true)
check('legacy ODDS_API_KEY preserved', cert.repair.legacyOddsApiKeyPreserved === true)
check('no product promotion performed', cert.safety.odds03PromotionPerformed === false)
check('no forbidden phase started', !cert.safety.hr04Started && !cert.safety.playerPropsStarted && !cert.safety.mc03Started)
check('validation makes zero provider calls', cert.localValidation.providerCallsMade === 0)
check('validation makes zero database mutations', cert.localValidation.databaseMutationsMade === 0)
check('architecture documents natural scheduler chain', architecture.includes('SportsDataIO canonical acquisition -> The Odds API shadow dual-read'))
check('production proof still waits for natural scheduler', cert.productionProof.requiredAfterDeployment === true && cert.productionProof.naturalSchedulerExecutionObserved === false)

const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /SPORTSDATAIO_MLB_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /apiKey=[A-Za-z0-9_-]+/i,
]
check('no secret values exposed', !sensitivePatterns.some((pattern) => pattern.test(combined)))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}`)

const failed = checks.filter((item) => !item.pass)
const result = {
  success: failed.length === 0,
  mode: 'odds_03a_natural_dual_read_validation_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
  providerCallsMade: 0,
  databaseMutationsMade: 0,
  finalClassification: cert.finalClassification,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
