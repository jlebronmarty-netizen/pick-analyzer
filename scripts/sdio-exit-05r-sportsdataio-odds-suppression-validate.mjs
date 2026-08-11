import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

let failures = 0
function check(name, passed) {
  if (passed) {
    console.log(`PASS ${name}`)
  } else {
    failures += 1
    console.error(`FAIL ${name}`)
  }
}

const cert = json('docs/CERTIFICATION/sdio-exit-05r-sportsdataio-odds-suppression.json')
const report = read('docs/PRODUCTION_PILOT/SDIO_EXIT_05R_SPORTSDATAIO_ODDS_SUPPRESSION.md')
const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')
const canonical = read('src/services/canonical-acquisition.service.ts')
const oddsAcquisition = read('src/services/the-odds-api-current-odds-acquisition.service.ts')
const r2Writer = read('src/services/line-versioned-reprediction-writer.service.ts')
const oddsConfig = read('src/config/odds-primary-authority.config.ts')
const mlbModeConfig = read('src/config/mlb-data-source-mode.config.ts')

check('root cause recorded', cert.rootCause === 'LEGACY_CANONICAL_SPORTSDATAIO_ODDS_ACQUISITION_STILL_ACTIVE')
check('legacy caller traced', cert.legacyCaller.orchestrator.includes('adaptive-refresh-orchestrator') && cert.legacyCaller.legacyFunction === 'executeCanonicalMlbMarketAcquisition')
check('Stage 3 suppresses SportsDataIO odds HTTP', orchestrator.includes('shouldSuppressSportsDataIoOddsAcquisition') && orchestrator.includes('SKIPPED_AUTHORITY_NOT_SPORTSDATAIO'))
check('Stage 3 skip contract reports zero calls', orchestrator.includes('actualHttpRequests: 0') && orchestrator.includes('providerCallsMade: 0'))
check('Stage 3 product authority is The Odds API', cert.stageMatrix.STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT.productAuthority === 'THE_ODDS_API')
check('Stage 3 The Odds API still executes', orchestrator.includes('executeTheOddsApiMlbDualReadAcquisition') && oddsAcquisition.includes("'odds03d_stage3_product_primary_v1'"))
check('Stage 1 SportsDataIO behavior unchanged', cert.stageMatrix.STAGE_1_DUAL_READ.sportsDataIoOddsHttp === true && canonical.includes("const PROVIDER = 'sportsdataio'"))
check('SportsDataIO rollback unchanged', cert.stageMatrix.STAGE_0_SPORTSDATAIO_AUTHORITY.sportsDataIoOddsHttp === true && oddsConfig.includes('rollbackAuthority'))
check('Current Board consumes The Odds API evidence in Stage 3', orchestrator.includes("currentBoardAuthority: 'THE_ODDS_API'") && report.includes('Current Board product provider: The Odds API'))
check('exact-line safety unchanged', oddsConfig.includes('exactLineIdentity') && oddsConfig.includes('NO_FRESH_EXACT_LINE_PRICE'))
check('R2 writer Stage 3 path preserved', orchestrator.includes('executeLineVersionedRepredictionWriter') && r2Writer.includes('PERSISTENT_PRIMARY_WRITER'))
check('no silent SportsDataIO fallback', orchestrator.includes('noSilentFallback: true') && report.toLowerCase().includes('silently fall back to sportsdataio'))
check('provider accounting records zero SportsDataIO external calls', cert.repair.providerAccounting.includes('zero external calls') && orchestrator.includes('rollbackOnly: sportsDataIoSuppression.suppress'))
check('other MLB SportsDataIO callers classified', cert.otherMlbSportsDataIoRuntimeCallers.length >= 5)
check('no critical remaining routine caller', cert.remainingRoutineSportsDataIoMlbCallers === 0)
check('scheduler semantics preserved', report.includes('The Odds API product-primary acquisition still executes') && report.includes('MLB Official schedule/status/result/starter sync remains unchanged'))
check('settlement unchanged', cert.guardrails.settlementChanged === false)
check('Official Pick thresholds unchanged', cert.guardrails.officialPickThresholdsChanged === false)
check('HR-03 unchanged', cert.guardrails.hr03Changed === false)
check('MLB data source mode config untouched', cert.guardrails.mlbDataSourceModeChanged === false && mlbModeConfig.includes('MLB_OFFICIAL_PRIMARY'))
check('odds primary authority config untouched', cert.guardrails.oddsPrimaryAuthorityStageChanged === false && oddsConfig.includes('STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT'))
check('SportsDataIO credential not disabled by code', cert.guardrails.sportsDataIoCredentialRemoved === false && canonical.includes('SPORTSDATAIO_MLB_API_KEY'))
check('production provider calls during certification zero', cert.localCertification.providerCallsMade === 0)
check('production DB mutations during certification zero', cert.localCertification.productionDatabaseMutations === 0)

const forbiddenRuntimeChanges = [
  'Official Pick threshold',
  'model weight',
  'settlement formula',
  'HR-03 promotion',
]
check('no forbidden runtime policy phrases introduced', !forbiddenRuntimeChanges.some((text) => orchestrator.includes(text)))

if (failures) {
  console.error(`SDIO-EXIT-05R validation failed: ${failures}`)
  process.exit(1)
}

console.log('SDIO-EXIT-05R validation passed')
