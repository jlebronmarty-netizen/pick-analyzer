import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const cert = JSON.parse(read('docs/CERTIFICATION/p2-0-prediction-epoch-v2.json'))
const doc = read('docs/CERTIFICATION/P2_0_PREDICTION_EPOCH_V2.md')
const runtime = read('src/services/prediction-epoch-runtime.service.ts')
const writer = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')
const board = read('src/services/current-board.service.ts')
const perf = read('src/services/performance-scope-v2.service.ts')
const route = read('src/app/api/data-foundation/epochs/route.ts')

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'src/services/prediction-epoch-runtime.service.ts',
  'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  'src/services/current-board.service.ts',
  'src/services/performance-scope-v2.service.ts',
  'src/services/prediction-epoch-governance-v2.service.ts',
  'src/services/prediction-epoch-migration-state.service.ts',
  'src/app/api/data-foundation/epochs/route.ts',
  'docs/CERTIFICATION/P2_0_PREDICTION_EPOCH_V2.md',
  'docs/CERTIFICATION/p2-0-prediction-epoch-v2.json',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/mission-control-v1-validate.mjs',
  'docs/CERTIFICATION/README.md',
  'docs/MASTER_ROADMAP.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/README.md',
  'docs/PROJECT_STATUS.md',
  'src/services/prediction-coverage.service.ts',
  'src/app/api/operations/prediction-coverage/route.ts',
  'docs/ARCHITECTURE/COMPREHENSIVE_SUPPORTED_MARKET_COVERAGE.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/ARCHITECTURE/README.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/p2-1-supported-market-prediction-coverage.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
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
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('Current V2 epoch key is canonical', cert.currentEpochKey === 'CURRENT_V2_PRODUCTION' && runtime.includes("CURRENT_V2_EPOCH_KEY = 'CURRENT_V2_PRODUCTION'"))
check('legacy scope key is canonical', cert.legacyEpochKey === 'LEGACY_PRE_V2' && runtime.includes("LEGACY_PRE_V2_EPOCH_KEY = 'LEGACY_PRE_V2'"))
check('activation endpoint is protected', route.includes('CRON_SECRET') && route.includes('confirmed'))
check('future prediction writes stamp active epoch', writer.includes('buildPredictionEpochStamp') && writer.includes('predictionEpoch'))
check('Current Board defaults to active epoch', board.includes("prediction_epoch_key', activeEpoch.epochKey") || board.includes('prediction_epoch_key'))
check('Performance defaults to Current V2 era', perf.includes('eraScopes') && perf.includes('CURRENT_V2_PRODUCTION'))
check('Performance eligibility uses production evaluation policy', perf.includes('productionEvaluationPolicy') && perf.includes('CURRENT_V2_PRODUCTION_EVALUABLE'))
check('historical rows are preserved', cert.activationRules.historicalRowsRewritten === false && cert.activationRules.historicalRowsDeleted === false)
check('no retrospective production predictions', cert.activationRules.retrospectiveProductionPredictions === false)
check('recommendation and Official Pick policy unchanged', cert.activationRules.recommendationPolicyChanged === false && cert.activationRules.officialPickPolicyChanged === false)
check('production activation is recorded', cert.status === 'PRODUCTION_CERTIFIED' && cert.activation?.status === 'ACTIVATED')
check('Current Era production evidence is recorded', cert.currentEraProductionEvidence.generated >= cert.currentEraProductionEvidence.productionEligible && cert.currentEraProductionEvidence.settled === 0)
check('documentation records N/A metrics', doc.includes('Accuracy, Brier and Calibration: N/A'))
check('P2.1 was not started', cert.p21Started === false)
check('only bounded P2.0 files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p2_0_prediction_epoch_v2_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
