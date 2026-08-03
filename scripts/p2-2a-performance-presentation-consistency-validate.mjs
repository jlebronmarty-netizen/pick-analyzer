import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))

const scope = read('src/services/performance-scope-v2.service.ts')
const route = read('src/app/api/performance/route.ts')
const contract = read('src/services/performance-product-contract.service.ts')
const client = read('src/components/performance/PerformanceProductClient.tsx')
const cert = JSON.parse(read('docs/CERTIFICATION/p2-2a-performance-presentation-consistency.json'))

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'src/services/performance-scope-v2.service.ts',
  'src/app/api/performance/route.ts',
  'src/services/performance-product-contract.service.ts',
  'src/components/performance/PerformanceProductClient.tsx',
  'docs/OPERATIONAL_EXCELLENCE/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'docs/CERTIFICATION/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'docs/CERTIFICATION/p2-2a-performance-presentation-consistency.json',
  'docs/CERTIFICATION/README.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('Current Era does not label 51 as canonical predictions', !client.includes('Generated {item.generated') && client.includes('Total Analyzed'))
check('canonical prediction count is 24', cert.expectedCurrentEra.canonicalPredictionRows === 24)
check('non-production analysis count is 27', cert.expectedCurrentEra.nonProductionAnalysisRows === 27)
check('total analyzed count is 51', cert.expectedCurrentEra.totalAnalyzedRows === 51)
check('24 + 27 = 51', cert.expectedCurrentEra.canonicalPredictionRows + cert.expectedCurrentEra.nonProductionAnalysisRows === cert.expectedCurrentEra.totalAnalyzedRows)
check('Prediction History remains 24 canonical rows', client.includes('Canonical Prediction History') && client.includes('Current Era predictions') && cert.expectedCurrentEra.predictionHistoryRows === 24)
check('non-production rows remain excluded from canonical Performance', scope.includes('nonProductionAnalysisRows') && scope.includes('P2_1_SELECTION_LEVEL_PREVIEW_NOT_CANONICAL'))
check('settled remains 0 until valid results exist', cert.expectedCurrentEra.settledCanonicalRows === 0 && route.includes('settledCanonicalRows'))
check('recommendation eligible remains 0', cert.expectedCurrentEra.recommendationEligibleRows === 0 && route.includes('recommendationEligibleRows'))
check('readiness is explicitly pipeline readiness', client.includes('Pipeline Readiness') && client.includes('not model accuracy'))
check('readiness is not presented as model accuracy', client.includes('does not mean the model has demonstrated current-era accuracy'))
check('Trust and Accuracy remain N/A with zero settled sample', cert.expectedCurrentEra.trust === null && cert.expectedCurrentEra.accuracy === null)
check('Historical Era remains excluded from Current Era defaults', scope.includes("defaultEra: activeEpoch ? 'CURRENT_V2_PRODUCTION'") && client.includes('Historical evidence remains separate'))
check('no prediction rows are mutated', cert.guards.predictionRowsMutated === false && !/\.from\('prediction_history'\)\.update/.test(scope + route + contract + client))
check('no settlement or learning behavior changes', cert.guards.settlementChanged === false && cert.guards.learningChanged === false)
check('no provider calls occur from read certification', cert.guards.providerCallsFromReadCertification === 0)
check('paused MC-08E work remains untouched', cert.guards.mc08ePreserved === true)
check('API exposes additive presentation contract', route.includes('performancePresentation') && contract.includes('performance_presentation_metrics_v1'))
check('model maturity does not call all 51 production predictions', contract.includes('canonical Current Era predictions') && contract.includes('non-production analysis rows'))
check('required docs exist', [
  'docs/OPERATIONAL_EXCELLENCE/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'docs/CERTIFICATION/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
].every(exists))
check('only bounded P2.2A files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p2_2a_performance_presentation_consistency_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
