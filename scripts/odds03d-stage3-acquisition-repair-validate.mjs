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

const cert = json('docs/CERTIFICATION/odds-03d-stage3-acquisition-repair.json')
const acquisition = read('src/services/the-odds-api-current-odds-acquisition.service.ts')
const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')
const writer = read('src/services/line-versioned-reprediction-writer.service.ts')
const authority = read('src/services/odds-primary-authority.service.ts')
const config = read('src/config/odds-primary-authority.config.ts')
const doc = read('docs/PRODUCTION_PILOT/ODDS_03D_STAGE3_ACQUISITION_REPAIR.md')
const architecture = read('docs/ARCHITECTURE/ODDS_PRIMARY_AUTHORITY_V1.md')

check('rollback to Stage 1 certified', cert.rollback.certified === true && cert.rollback.stage === 'STAGE_1_DUAL_READ')
check('Stage 1 natural acquisition resumes as shadow semantics', acquisition.includes("'odds03a_natural_dual_read_v1'") && acquisition.includes("'SHADOW_NON_AUTHORITATIVE'"))
check('Stage 3 root cause identified', cert.rootCause === 'STAGE_3_AUTHORITY_NOT_WIRED_TO_ACQUISITION' && doc.includes('STAGE_3_AUTHORITY_NOT_WIRED_TO_ACQUISITION'))
check('Stage 3 acquisition now executable', acquisition.includes("authority.stage === 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT'") && !acquisition.includes('SKIPPED_STAGE_NOT_DUAL_READ'))
check('Stage 1 shadow semantics preserved', acquisition.includes('productPriceAuthority: productPrimary') && acquisition.includes('shadowOnly: !productPrimary'))
check('Stage 3 product-primary semantics preserved', acquisition.includes("'PRODUCT_AUTHORITATIVE'") && acquisition.includes("'product_primary_pregame'"))
check('one The Odds API request max per eligible dedupe window', acquisition.includes('maxCalls: 1') && acquisition.includes('tenMinuteDedupeWindow'))
check('no per-event/provider fanout', !acquisition.includes('for (const selectedId') && cert.repair.perEventFanout === false && cert.repair.perBookFanout === false)
check('provider accounting separate', acquisition.includes("'odds03d_stage3_product_primary_v1'") && acquisition.includes('stageSemantics') && cert.repair.providerAccountingSeparated === true)
check('R2 writer Stage 1 non-persistent', writer.includes('request.dryRun !== false || !stageAllowsPersistence') && writer.includes('NON_PERSISTENT_SHADOW_EXECUTION'))
check('R2 writer Stage 3 persistent-capable', writer.includes("authority.productAuthority === 'THE_ODDS_API'") && writer.includes('PERSISTENT_PRIMARY_WRITER'))
check('exact-line safety preserved', config.includes('exactLineIdentity') && cert.repair.exactLineSafetyPreserved === true)
check('fail-closed behavior preserved', config.includes('WAIT_FOR_REFRESH') && config.includes('NO_FRESH_EXACT_LINE_PRICE') && cert.repair.failClosedPreserved === true)
check('SportsDataIO rollback retained', authority.includes('sportsDataIoRetainedForRollback: true') && cert.stageMatrix.STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT.sportsDataIoRole === 'ROLLBACK_CONTEXT_ONLY')
check('Official Pick thresholds unchanged', cert.guardrails.officialPickThresholdsChanged === false)
check('HR-03 remains shadow', cert.guardrails.hr03CalibrationStatus === 'SHADOW_ONLY')
check('settlement unchanged', cert.guardrails.settlementChanged === false)
check('provider calls from certification reads zero', cert.rollback.providerCallsFromCertificationReads === 0)
check('production DB mutations from certification reads zero', cert.rollback.databaseMutationsFromCertificationReads === 0)
check('orchestrator still uses shared acquisition path', orchestrator.includes('executeTheOddsApiMlbDualReadAcquisition') && orchestrator.includes('executeLineVersionedRepredictionWriter'))
check('architecture documents Stage 3 repair', architecture.includes('odds03d_stage3_product_primary_v1') && architecture.includes('Stage 3 path no longer relies on a Stage 1-only guard'))
check('no unauthorized promotion in certification', cert.guardrails.stage3RePromoted === false && cert.guardrails.sportsDataIoDisabled === false && cert.guardrails.mlbDataSourceModeChanged === false)

if (failures) {
  console.error(`ODDS-03D Stage 3 acquisition repair validation failed: ${failures}`)
  process.exit(1)
}

console.log('ODDS-03D Stage 3 acquisition repair validation passed')
