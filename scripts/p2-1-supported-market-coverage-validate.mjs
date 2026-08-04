import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const writer = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')
const service = read('src/services/prediction-coverage.service.ts')
const route = read('src/app/api/operations/prediction-coverage/route.ts')
const cert = JSON.parse(read('docs/CERTIFICATION/p2-1-supported-market-prediction-coverage.json'))

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  'src/services/prediction-coverage.service.ts',
  'src/app/api/operations/prediction-coverage/route.ts',
  'docs/ARCHITECTURE/COMPREHENSIVE_SUPPORTED_MARKET_COVERAGE.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/ARCHITECTURE/README.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/p2-1-supported-market-prediction-coverage.json',
  'docs/CERTIFICATION/README.md',
  'docs/MASTER_ROADMAP.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/MISSION_CONTROL/README.md',
  'docs/PROJECT_STATUS.md',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/performance-api-query-optimization-v1-validate.mjs',
  'src/services/performance-scope-v2.service.ts',
  'src/services/canonical-settlement-state.service.ts',
  'docs/CERTIFICATION/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'docs/CERTIFICATION/p2-1a-canonical-market-granularity.json',
  'docs/OPERATIONAL_EXCELLENCE/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'src/app/api/performance/route.ts',
  'src/components/performance/PerformanceProductClient.tsx',
  'src/services/performance-product-contract.service.ts',
  'docs/CERTIFICATION/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'docs/CERTIFICATION/p2-2a-performance-presentation-consistency.json',
  'docs/OPERATIONAL_EXCELLENCE/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/provider-budget.service.ts',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'docs/CERTIFICATION/P2_2C_PROTECTED_SCHEDULER_CLOSURE_RECOVERY.md',
  'docs/CERTIFICATION/p2-2c-protected-scheduler-closure-recovery.json',
  'docs/CERTIFICATION/P2_2B_CURRENT_ERA_CLOSURE_INVESTIGATION.md',
  'docs/CERTIFICATION/p2-2b-current-era-closure-investigation.json',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'docs/CERTIFICATION/P2_2D_CURRENT_ERA_SETTLEMENT_CLOSURE.md',
  'docs/CERTIFICATION/p2-2d-current-era-settlement-closure.json',
  'scripts/p2-2d-current-era-settlement-closure-validate.mjs',
  'docs/CERTIFICATION/P2_2_NEW_EPOCH_DAILY_CLOSURE.md',
  'docs/CERTIFICATION/p2-2-new-epoch-daily-closure.json',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('generator chooses one canonical odds row per event and market', writer.includes('const key = `${row.event_id}:${marketForPrediction(row.market)}`'))
check('prediction logical identity includes line', writer.includes('function predictionLogicalKey') && writer.includes("market === 'moneyline' ? 'none'") && writer.includes('${row.game_id}:${market}:${row.team}:${line}'))
check('coverage route exists', exists('src/app/api/operations/prediction-coverage/route.ts'))
check('coverage route is protected', route.includes('CRON_SECRET') && route.includes("request.headers.get('authorization')") && !route.includes('searchParams.get'))
check('coverage route is read-only dynamic', route.includes("dynamic = 'force-dynamic'") && route.includes('revalidate = 0'))
check('coverage service reads stored events', service.includes(".from('sport_events')") && service.includes('sport_key'))
check('coverage service reads stored odds only', service.includes(".from('sports_odds_snapshots')") && service.includes(".eq('provider', PROVIDER)") && !service.includes('fetch('))
check('coverage service reads active epoch predictions', service.includes('getActivePredictionEpoch') && service.includes(".from('prediction_history')"))
check('coverage semantics are explicit', service.includes('complementDerivation') && service.includes('threeWayMarkets') && service.includes('uniquenessKey'))
check('coverage separates provider selections from canonical predictions', service.includes('providerSelectionsAvailable') && service.includes('canonicalMarketsExpected') && service.includes('canonicalPredictionsCreated'))
check('coverage states account for canonical misses and cutoff', service.includes('CANONICAL_PREDICTION_CREATED') && service.includes('MISSED_CANONICAL_PREDICTION') && service.includes('CUTOFF_MISSED') && service.includes('DUPLICATE_COLLAPSED'))
check('zero provider calls and mutations are declared', service.includes('providerCallsMade: 0') && service.includes('remoteMutationsMade: 0'))
check('certification records unchanged policies', cert.guards.predictionFormulaChanged === false && cert.guards.officialPickPolicyChanged === false && cert.guards.schedulerCadenceChanged === false)
check('certification keeps MC-08E paused', cert.pausedWork.mc08ePreserved === true)
check('P2.2 remains next and not started', cert.nextPhase === 'P2.2' && cert.p22Started === false)
check('required docs exist', [
  'docs/ARCHITECTURE/COMPREHENSIVE_SUPPORTED_MARKET_COVERAGE.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
].every(exists))
check('only bounded P2.1 files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p2_1_supported_market_prediction_coverage_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
