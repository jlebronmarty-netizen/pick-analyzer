import { existsSync, readFileSync } from 'node:fs'

const checks = []

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function read(path) {
  return readFileSync(path, 'utf8')
}

const files = {
  config: 'src/config/odds-primary-authority.config.ts',
  service: 'src/services/odds-primary-authority.service.ts',
  route: 'src/app/api/operations/odds-primary-authority/route.ts',
  planner: 'src/services/event-refresh-planner.service.ts',
  acquisition: 'src/services/the-odds-api-current-odds-acquisition.service.ts',
  lineVersioning: 'src/services/market-line-versioning-contract.service.ts',
  architecture: 'docs/ARCHITECTURE/ODDS_PRIMARY_AUTHORITY_V1.md',
  pilot: 'docs/PRODUCTION_PILOT/ODDS_03_PRIMARY_CUTOVER.md',
  cert: 'docs/CERTIFICATION/odds-03-primary-cutover.json',
}

for (const file of Object.values(files)) check(`required file exists: ${file}`, existsSync(file))

const config = read(files.config)
const service = read(files.service)
const route = read(files.route)
const planner = read(files.planner)
const acquisition = read(files.acquisition)
const lineVersioning = read(files.lineVersioning)
const architecture = read(files.architecture)
const pilot = read(files.pilot)
const cert = JSON.parse(read(files.cert))
const combined = [config, service, route, planner, acquisition, lineVersioning, architecture, pilot, JSON.stringify(cert)].join('\n')

check('lifecycle-scoped mapping exists', service.includes('mapOddsApiEventToLifecycleEvent') && cert.lifecycleMapping.scope === 'sport_events lifecycle universe')
check('CIN @ WSH maps', cert.lifecycleMapping.cinAtWsh === 'MAPPED' && service.includes('Cincinnati Reds'))
check('TB @ SEA maps', cert.lifecycleMapping.tbAtSea === 'MAPPED' && service.includes('Tampa Bay Rays'))
check('ATH maps', cert.lifecycleMapping.athOak === 'MAPPED' && service.includes("oak: 'ATH'"))
check('ambiguous = 0', cert.lifecycleMapping.ambiguousEvents === 0 && service.includes('ambiguousCount'))
check('certified book set explicit', cert.certifiedBookSetV1.join(',') === 'FanDuel,DraftKings,BetMGM,Caesars' && config.includes('CERTIFIED_BOOK_SET_V1'))
check('all books and lines preserved', cert.marketEvidence.allBooksPreserved && cert.marketEvidence.allRunLineLinesPreserved && cert.marketEvidence.allTotalLinesPreserved)
check('exact-line identity enforced', cert.exactLineSafety === 'PASS' && service.includes('sameLine(selection.market') && architecture.includes('eventId + market + selection + line'))
check('no cross-line probability reuse', cert.crossLineProbabilityReuse === false && service.includes('crossLineSelectionAllowed: false'))
check('re-prediction executable', cert.reprediction.executable === true && service.includes("executionMode: 'EXECUTABLE_GATED'"))
check('re-prediction cutoff-safe', cert.reprediction.cutoffSafe === true && lineVersioning.includes('cutoffSafe'))
check('re-prediction deduplicated', cert.reprediction.deduplicated === true && service.includes('deduplicationKey'))
check('original predictions preserved', cert.reprediction.originalPredictionsPreserved === true && cert.reprediction.productionPredictionCreatedDuringCertification === false)
check('settlement line-specific', cert.settlementSafety.lineSpecificSettlement === true && lineVersioning.includes('lineSpecificTotalSettlement'))
check('recommendation exposure separated', cert.performanceExposurePolicy.predictionEvidenceSeparatedFromProductRecommendationExposure === true)
check('HR-03 remains shadow', cert.hr03.status === 'SHADOW_ONLY' && cert.hr03.productionProbabilityAuthorityChanged === false)
check('Official Pick thresholds unchanged', cert.safety.officialPickThresholdsChanged === false)
check('provider authority feature flag exists', config.includes('ODDS_PRIMARY_AUTHORITY_STAGE') && cert.rollback.configurationSwitch === 'ODDS_PRIMARY_AUTHORITY_STAGE')
check('dual-read exists', cert.authorityAfterLocalImplementation === 'STAGE_1_DUAL_READ' && config.includes('STAGE_1_DUAL_READ'))
check('fail-closed freshness policy', cert.failurePolicy.theOddsApiUnavailable === 'NO_FRESH_PRICE' && cert.freshnessAuthority.captureTimestampCanSubstitute === false)
check('SportsDataIO not cancelled', cert.sportsDataIoCancelled === false && cert.sportsDataIoDisabled === false)
check('provider budgets separate', cert.providerBudget.sportsDataIoPoolSeparate && cert.providerBudget.theOddsApiPoolSeparate)
check('scheduler integration bounded', cert.schedulerIntegration.existingProtectedEndpointUsed && cert.schedulerIntegration.competingSchedulerCreated === false && planner.includes('oddsPrimaryAuthority'))
check('rollback path exists', cert.rollback.rollbackRequiresCodeDeployment === false && config.includes('productAuthorityForStage'))
check('production promotion gates explicit', cert.promotion.productionPromotionAuthorized === false && cert.promotion.gate === 'HUMAN_APPROVAL_REQUIRED_AFTER_PRODUCTION_EVIDENCE')
check('The Odds API credential isolated', acquisition.includes('process.env.THE_ODDS_API_KEY') && !acquisition.includes('process.env.ODDS_API_KEY?.trim() ?? process.env.THE_ODDS_API_KEY'))
check('legacy ODDS_API_KEY preserved by policy', cert.credentialPolicy.legacyOddsApiKeyPreserved === true)
check('read-only status route exists', route.includes('getOddsPrimaryAuthorityRuntimeStatus') && route.includes('validateOddsPrimaryAuthorityFixtures'))
check('no provider calls during certification', cert.providerCallsDuringCertification === 0)
check('no database mutations during certification', cert.databaseMutationsDuringCertification === 0)
check('SportsDataIO remains product authority after local implementation', cert.productAuthorityAfterLocalImplementation === 'SPORTSDATAIO')
check('The Odds API not product promoted', cert.safety.odds03ProductionPromotionPerformed === false)
check('no forbidden next phase started', !cert.safety.sdioExit03Started && !cert.safety.hr04Started && !cert.safety.playerPropsStarted && !cert.safety.mc03Started)

const sensitivePatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /SPORTSDATAIO_MLB_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /apiKey=[A-Za-z0-9_-]+/i,
]
check('no secret values exposed', !sensitivePatterns.some((pattern) => pattern.test(combined)))

for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`)

const failed = checks.filter((item) => !item.pass)
const result = {
  success: failed.length === 0,
  mode: 'odds_03_primary_cutover_validation_v1',
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
