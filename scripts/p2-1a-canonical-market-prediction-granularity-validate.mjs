import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))

const writer = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')
const coverage = read('src/services/prediction-coverage.service.ts')
const performance = read('src/services/performance-scope-v2.service.ts')
const settlement = read('src/services/canonical-settlement-state.service.ts')
const cert = JSON.parse(read('docs/CERTIFICATION/p2-1a-canonical-market-granularity.json'))

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  'src/services/prediction-coverage.service.ts',
  'src/services/performance-scope-v2.service.ts',
  'src/services/canonical-settlement-state.service.ts',
  'docs/CERTIFICATION/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'docs/CERTIFICATION/p2-1a-canonical-market-granularity.json',
  'docs/OPERATIONAL_EXCELLENCE/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'docs/CERTIFICATION/README.md',
  'docs/MASTER_ROADMAP.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
  'src/app/api/performance/route.ts',
  'src/components/performance/PerformanceProductClient.tsx',
  'src/services/performance-product-contract.service.ts',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/CERTIFICATION/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'docs/CERTIFICATION/p2-2a-performance-presentation-consistency.json',
  'docs/OPERATIONAL_EXCELLENCE/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/provider-budget.service.ts',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'docs/CERTIFICATION/P2_2B_CURRENT_ERA_CLOSURE_INVESTIGATION.md',
  'docs/CERTIFICATION/p2-2b-current-era-closure-investigation.json',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('provider selections and model predictions are distinct', coverage.includes('providerSelectionsAvailable') && coverage.includes('canonicalMarketsExpected'))
check('eight games with three markets expect 24 predictions', cert.expectedCanonicalPredictionsForEightGameSlate === 24)
check('moneyline count is 8', cert.expectedByMarket.moneyline === 8)
check('run line count is 8', cert.expectedByMarket.spread === 8)
check('total count is 8', cert.expectedByMarket.total === 8)
check('each prediction identifies one selected outcome', writer.includes('selectedSelection: selectedContext') && writer.includes("canonicalPredictionGranularity: 'event_market_v1'"))
check('opposing selections remain contextual only', writer.includes('opposingSelection: opposingContext') && writer.includes("providerSelectionUniverse: 'contextual_only'"))
check('Performance cannot count both opposite sides', performance.includes("canonicalPredictionGranularity === 'event_market_v1'") && performance.includes('P2_1_SELECTION_LEVEL_PREVIEW_NOT_CANONICAL'))
check('settlement blocks selection preview rows', settlement.includes('isSelectionUniverseContext') && settlement.includes('P2_1_SELECTION_LEVEL_PREVIEW_NOT_CANONICAL'))
check('learning uses canonical settlement state', settlement.includes('learningIncluded') && settlement.includes('isSelectionUniverseContext'))
check('existing 48 rows are preserved and classified', writer.includes('P2_1_SELECTION_LEVEL_PREVIEW') && writer.includes('P2_1A_SELECTION_LEVEL_PREVIEW_SUPERSEDED'))
check('no retrospective canonical predictions after cutoff', writer.includes('classifyPredictionCutoff') && writer.includes('rejectedByCutoff'))
check('recommendation gates remain separate', writer.includes('evaluateRecommendationEligibility') && writer.includes('recommendationStatus: policy.status'))
check('model formulas remain unchanged', cert.guards.predictionFormulaChanged === false)
check('Official Pick policy remains unchanged', cert.guards.officialPickPolicyChanged === false)
check('active epoch remains Current V2', cert.activeEpoch === 'CURRENT_V2_PRODUCTION')
check('paused MC-08E work remains untouched', cert.pausedWork.mc08ePreserved === true)
check('P2.2 paused until correction certification', cert.p22Paused === true)
check('required docs exist', [
  'docs/CERTIFICATION/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
].every(exists))
check('only bounded P2.1A files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p2_1a_canonical_market_prediction_granularity_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
