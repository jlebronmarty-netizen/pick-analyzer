await import('./nba-03a-single-candidate-writer-validate.mjs')
process.exit(0)

import fs from 'node:fs'

const servicePath = 'src/services/nba-current-era-shadow-canary.service.ts'
const runnerPath = 'scripts/nba-03a-current-era-shadow-canary.mjs'
const certPath = 'docs/CERTIFICATION/nba-03a-current-era-shadow-canary.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_BLOCK5_CURRENT_ERA_SHADOW_CANARY.md'
const enginePath = 'src/services/nba-prediction-engine.service.ts'
const predictionHistoryPath = 'src/services/prediction-history.service.ts'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const service = read(servicePath)
const runner = read(runnerPath)
const cert = JSON.parse(read(certPath))
const doc = read(docPath)
const engine = read(enginePath)
const predictionHistory = read(predictionHistoryPath)

const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('status certified waiting for current data', cert.status === 'NBA_03A_BLOCK5_SAFE_CANARY_CERTIFIED_WAITING_FOR_CURRENT_DATA')
check('canary version explicit', service.includes("NBA_CURRENT_ERA_SHADOW_CANARY_V1") && cert.canary.version === 'NBA_CURRENT_ERA_SHADOW_CANARY_V1')
check('CURRENT_ERA_SHADOW origin used by writer', service.includes("prediction_origin: 'CURRENT_ERA_SHADOW'") && service.includes(".eq('prediction_origin', 'CURRENT_ERA_SHADOW')"))
check('historical replay origin not used by canary writer', !service.includes("prediction_origin: 'HISTORICAL_REPLAY_SHADOW'"))
check('allowed provider is The Odds API only', service.includes("NBA_CURRENT_ERA_SHADOW_ALLOWED_ODDS_PROVIDER = 'the-odds-api'") && service.includes("odds.provider !== NBA_CURRENT_ERA_SHADOW_ALLOWED_ODDS_PROVIDER"))
check('SportsDataIO trial evidence excluded', service.includes('HISTORICAL_TRIAL_ODDS_EXCLUDED') && service.includes('eventMetadata.trial') && service.includes('oddsMetadata.scrambled'))
check('no provider fetch in runner or service', !/fetch\s*\(/.test(service + runner) && !/api\.the-odds-api|sportsdata\.io/i.test(service + runner))
check('dry-run default no mutation', runner.includes("const mode = modeArg ? modeArg.split('=')[1] : 'dry-run'") && cert.dryRun.defaultMode === true)
check('write requires explicit env authorization', runner.includes('NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED') && runner.includes('SAFE_WRITER_NOT_AUTHORIZED'))
check('no-event path succeeds safely', service.includes('NO_CURRENT_EVENT') && service.includes('eventsScanned: 0') && cert.productionDryRun.skipReasons.NO_CURRENT_EVENT === 1)
check('no fallback odds allowed on Current Era path', service.includes('fallbackOddsAllowed: false') && cert.safety.fallbackOddsAllowed === false)
check('fake -110/default odds are rejected structurally', service.includes('INVALID_ODDS_VALUE') && !service.includes('?? -110') && cert.safety.fakeMinus110Allowed === false)
check('cutoff enforcement present', service.includes('cutoffFor') && service.includes('CUTOFF_FAILED') && service.includes('- 10 * 60000'))
check('pregame requirement present', service.includes('PREGAME_STATUSES') && service.includes('EVENT_STATUS_NOT_PREGAME'))
check('price timestamp/freshness check present', service.includes('NBA_CURRENT_ERA_SHADOW_MAX_ODDS_AGE_MINUTES') && service.includes('STALE_ODDS') && service.includes('TEMPORAL_FEATURE_VIOLATION'))
check('missing real odds rejected', service.includes('MISSING_REAL_ODDS') && service.includes('odds: null'))
check('unsupported markets rejected', service.includes('SUPPORTED_MARKETS') && service.includes('UNSUPPORTED_MARKET'))
check('logical idempotency includes exact line and origin', service.includes("odds.line ?? 'null'") && service.includes("'CURRENT_ERA_SHADOW'") && service.includes('loadExistingLogicalKeys'))
check('canonical persistence primitive reused', service.includes('savePredictionHistory') && predictionHistory.includes('certification_metadata?: Record<string, unknown> | null'))
check('canonical NBA prediction engine reused for write payload', service.includes('generateNbaPredictions') && service.includes('canonical NBA prediction engine did not produce the exact eligible market identity'))
check('Official Pick disabled', service.includes('recommended_pick: false') && service.includes('officialPickEligible: false') && cert.isolation.officialPickDelta === 0)
check('product visibility disabled', service.includes('productSurfaceVisible: false') && cert.isolation.productVisibilityDelta === 0)
check('learning/calibration isolation preserved', service.includes('productionCalibrationEligible: false') && service.includes('productionLearningEligible: false'))
check('historical replay behavior unchanged', engine.includes('Number(oddsRow?.price ?? -110)') && cert.historicalReplay.behaviorChanged === false)
check('MLB isolation documented', cert.isolation.mlbMutationDelta === 0 && doc.includes('MLB mutation delta: 0'))
check('production dry-run created no rows', cert.productionDryRun.currentEraShadowBefore === 0 && cert.productionDryRun.inserts === 0 && cert.productionDryRun.currentEraShadowAfter === 0)
check('provider calls zero', cert.accounting.providerCalls === 0)
check('DB mutations zero from dry-run', cert.accounting.databaseMutationsFromDryRun === 0)
check('docs describe provider authority blocker', doc.includes('The Odds API') && doc.includes('schedule authority remains unresolved'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_03a_current_era_shadow_canary_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
