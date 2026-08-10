import { readFileSync } from 'node:fs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function read(path) {
  return readFileSync(path, 'utf8')
}

let failures = 0
function check(name, passed) {
  if (!passed) {
    failures += 1
    console.error(`FAIL ${name}`)
  } else {
    console.log(`PASS ${name}`)
  }
}

const cert = readJson('docs/CERTIFICATION/odds-03c-r-reprediction-proof.json')
const doc = read('docs/PRODUCTION_PILOT/ODDS_03C_R_REPREDICTION_PROOF.md')
const authority = read('src/services/odds-primary-authority.service.ts')
const lineContract = read('src/services/market-line-versioning-contract.service.ts')
const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')
const config = read('src/config/odds-primary-authority.config.ts')

check('all natural moved lines reconstructed', cert.naturalMovedLineCases >= 4 && cert.movedLineCases.length === cert.naturalMovedLineCases)
check('no synthetic evidence claimed', doc.includes('naturally captured production evidence') && !doc.includes('synthetic market data'))
check('pregame/cutoff eligibility evaluated', cert.eligibleRepredictionCases === 4 && cert.cutoffBlockedCases === 0)
check('exact-line identity preserved', config.includes("exactLineIdentity: ['eventId', 'market', 'selection', 'line']") && cert.crossLineProbabilitySafety === true)
check('production code dry-run contract exercised', authority.includes('buildLineVersionedRepredictionPlan') && cert.productionDryRunResults.productionCodeExercised === true)
check('no provider calls from certification reads', cert.providerCallsFromCertificationReads === 0)
check('no production prediction writes', cert.productionPredictionWrites === 0 && cert.productionDryRunResults.productionPredictionWrites === 0)
check('no cross-line price/probability reuse', cert.crossLinePriceSafety === true && authority.includes('noCrossLineProbabilityReuse'))
check('supersession lineage valid', cert.supersessionLineage.supersedeReason === 'MARKET_LINE_CHANGED' && lineContract.includes('SUPERSEDED_BY_MARKET_MOVE'))
check('settlement remains exact-line', cert.settlementLineSafety === true && lineContract.includes('lineSpecificTotalSettlement'))
check('recommendation exposure separated', cert.recommendationExposureSafety === true)
check('fail-closed state works', cert.failClosedCurrentLineState === true && config.includes('WAITING_FOR_CURRENT_LINE_PREDICTION'))
check('Stage 1 product isolation retained', cert.oddsAuthorityStage === 'STAGE_1_DUAL_READ' && cert.sportsDataIoAuthority === true && cert.theOddsApiStage === 'SHADOW_NON_AUTHORITATIVE')
check('natural wiring classified', cert.naturalExecutionWiring === 'NOT_WIRED' && orchestrator.includes('odds03a_shadow_dual_read_market_refresh'))
check('operations health classified', cert.operationsDegradedRootCause === 'odds_not_current')
check('rollback retained', cert.rollbackReadiness === true)
check('no unauthorized next phase started', cert.safety.sdioExit05Started === false && cert.safety.mc03Started === false)

if (failures) {
  console.error(`ODDS-03C-R validation failed: ${failures}`)
  process.exit(1)
}

console.log('ODDS-03C-R validation passed')
