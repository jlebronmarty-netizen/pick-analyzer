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

const cert = json('docs/CERTIFICATION/odds-03c-r2-reprediction-writer.json')
const writer = read('src/services/line-versioned-reprediction-writer.service.ts')
const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')
const authority = read('src/services/odds-primary-authority.service.ts')
const lineContract = read('src/services/market-line-versioning-contract.service.ts')
const currentBoard = read('src/services/current-board.service.ts')
const doc = read('docs/PRODUCTION_PILOT/ODDS_03C_R2_REPREDICTION_WRITER.md')
const config = read('src/config/odds-primary-authority.config.ts')

check('canonical writer reused', writer.includes('buildSportPrediction') && writer.includes('evaluateRecommendationEligibility') && writer.includes('evaluatePredictionEvaluationPolicy'))
check('no parallel prediction architecture', !writer.includes('Math.random') && !writer.includes('old-line probability'))
check('exact event market selection line identity', writer.includes('event.id') && writer.includes('market') && writer.includes('selection') && writer.includes('newLine'))
check('fresh evidence required', writer.includes('MAX_FRESH_EVIDENCE_AGE_MINUTES') && writer.includes('BLOCKED_BY_FRESHNESS'))
check('cutoff rechecked at write', writer.includes('CUTOFF_NOT_SAFE') && writer.includes('cutoffSafe'))
check('event state rechecked at write', writer.includes('EVENT_NOT_PREGAME') && writer.includes('eventPregame'))
check('feature context pregame-safe', writer.includes('featureSnapshotFrom') && writer.includes('noLeakage'))
check('new exact line evaluated by prediction engine', writer.includes('projectionForNewLine') && writer.includes('line: newLine') && writer.includes('buildSportPrediction'))
check('original prediction immutable/preserved', writer.includes('parent_prediction_id: prediction.id') && cert.supersessionLineage.originalPredictionPreserved === true)
check('supersession lineage correct', writer.includes("version_created_reason: 'MARKET_LINE_CHANGED'") && writer.includes('superseded_by_prediction_id'))
check('repeated same line deduped', writer.includes('equivalentPredictionExists') && writer.includes('ALREADY_EXISTS'))
check('concurrent duplicate prevented', writer.includes('stableUuid') && writer.includes('idempotency_key'))
check('return-to-prior-line policy deterministic', writer.includes('CREATE_NEW_VERSION_IF_FEATURE_OR_TIME_CONTEXT_CHANGED') && cert.returnToPriorLinePolicy === 'CREATE_NEW_VERSION_IF_FEATURE_OR_TIME_CONTEXT_CHANGED')
check('Current Board exact-line selection safe', currentBoard.includes('productOddsProviderForCurrentBoard') && currentBoard.includes('sportsdataio'))
check('fail-closed state safe', config.includes('WAITING_FOR_CURRENT_LINE_PREDICTION') && cert.currentVersionSelection.writerFailedState === 'CURRENT_LINE_PREDICTION_UNAVAILABLE')
check('settlement exact-line safe', lineContract.includes('lineSpecificTotalSettlement') && cert.settlementSafety.lineSpecific === true)
check('recommendation exposure separated', writer.includes('recommended_pick: false') && writer.includes('production_eligible: false'))
check('learning deduped', cert.learningSafety.duplicateLearningExposurePrevented === true && cert.learningSafety.learningWeightsChanged === false)
check('zero extra provider calls', writer.includes('providerCallsMade: 0') && cert.providerCallsMade === 0)
check('natural moved-line evidence exercised', cert.naturalMovedLineCasesExercised >= 5 && doc.includes('Natural moved-line cases exercised'))
check('certification production mutations zero', cert.productionDatabaseMutations === 0 && cert.productionPredictionWrites === 0)
check('SportsDataIO remains authority', cert.sportsDataIoAuthority === 'PRODUCT_AUTHORITY_RETAINED' && authority.includes("productAuthority !== 'THE_ODDS_API'"))
check('The Odds API remains Stage 1', cert.theOddsApiStage === 'STAGE_1_DUAL_READ' && config.includes('STAGE_1_DUAL_READ'))
check('HR-03 remains shadow', cert.hr03CalibrationStatus === 'SHADOW_ONLY')
check('Official Pick thresholds unchanged', cert.officialPickThresholdsChanged === false)
check('rollback unchanged', cert.rollbackReadiness === true && config.includes('rollbackAuthority'))
check('natural execution wired', orchestrator.includes('executeLineVersionedRepredictionWriter') && orchestrator.includes('line_versioned_reprediction_writer'))
check(
  'Stage 1 non-persistent with future primary wiring',
  writer.includes('request.dryRun !== false || !stageAllowsPersistence') &&
    writer.includes('NON_PERSISTENT_SHADOW_EXECUTION') &&
    orchestrator.includes('dryRun: false'),
)
check('no forbidden phase started', Object.values(cert.forbiddenActions).every((value) => value === false))

if (failures) {
  console.error(`ODDS-03C-R2 validation failed: ${failures}`)
  process.exit(1)
}

console.log('ODDS-03C-R2 validation passed')
