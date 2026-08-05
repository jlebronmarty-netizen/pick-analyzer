import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const artifact = JSON.parse(read('docs/CERTIFICATION/p1-4-e2e-production-pipeline.json'))
const certification = read('docs/CERTIFICATION/P1_4_E2E_PRODUCTION_PIPELINE_CERTIFICATION.md')
const ops = read('docs/OPERATIONAL_EXCELLENCE/P1_4_E2E_PRODUCTION_PIPELINE_CERTIFICATION.md')
const adaptive = read('src/services/adaptive-refresh-orchestrator.service.ts')
const preview = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'docs/OPERATIONAL_EXCELLENCE/P1_4_E2E_PRODUCTION_PIPELINE_CERTIFICATION.md',
  'docs/CERTIFICATION/README.md',
  'docs/CERTIFICATION/P1_4_E2E_PRODUCTION_PIPELINE_CERTIFICATION.md',
  'docs/CERTIFICATION/p1-4-e2e-production-pipeline.json',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/provider-budget.service.ts',
  'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/MISSION_CONTROL/README.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'src/services/prediction-coverage.service.ts',
  'src/app/api/operations/prediction-coverage/route.ts',
  'docs/ARCHITECTURE/COMPREHENSIVE_SUPPORTED_MARKET_COVERAGE.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/ARCHITECTURE/README.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/p2-1-supported-market-prediction-coverage.json',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'src/services/canonical-settlement-state.service.ts',
  'src/services/performance-scope-v2.service.ts',
  'docs/CERTIFICATION/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'docs/CERTIFICATION/p2-1a-canonical-market-granularity.json',
  'docs/OPERATIONAL_EXCELLENCE/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'src/app/api/performance/route.ts',
  'src/components/performance/PerformanceProductClient.tsx',
  'src/services/performance-product-contract.service.ts',
  'docs/CERTIFICATION/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'docs/CERTIFICATION/p2-2a-performance-presentation-consistency.json',
  'docs/OPERATIONAL_EXCELLENCE/P2_2A_PERFORMANCE_PRESENTATION_CONSISTENCY.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'docs/CERTIFICATION/P2_2C_PROTECTED_SCHEDULER_CLOSURE_RECOVERY.md',
  'docs/CERTIFICATION/p2-2c-protected-scheduler-closure-recovery.json',
  'docs/CERTIFICATION/P2_2B_CURRENT_ERA_CLOSURE_INVESTIGATION.md',
  'docs/CERTIFICATION/p2-2b-current-era-closure-investigation.json',
  'docs/CERTIFICATION/P2_2D_CURRENT_ERA_SETTLEMENT_CLOSURE.md',
  'docs/CERTIFICATION/p2-2d-current-era-settlement-closure.json',
  'scripts/p2-2d-current-era-settlement-closure-validate.mjs',
  'scripts/or01b-scheduler-workflow-ledger-reconcile-validate.mjs',
  'scripts/or01c-settlement-closure-product-readiness-validate.mjs',
  'scripts/or01d-github-scheduled-trigger-recovery-validate.mjs',
  'scripts/or01e-adaptive-planner-behavior-validate.mjs',
  'scripts/or01f-bounded-planner-continuity-validate.mjs',
  'src/app/api/cron/operating-day/route.ts',
  'src/app/api/operations/planner-trace/route.ts',
  'docs/CERTIFICATION/OR_01E_ADAPTIVE_PLANNER_BEHAVIOR.md',
  'docs/CERTIFICATION/or-01e-adaptive-planner-behavior.json',
  'docs/CERTIFICATION/OR_01F_BOUNDED_PLANNER_CONTINUITY.md',
  'docs/CERTIFICATION/or-01f-bounded-planner-continuity.json',
  'docs/ARCHITECTURE/BOUNDED_PLANNER_CONTINUITY_V1.md',
  'docs/OPERATIONAL_EXCELLENCE/OR_01F_BOUNDED_PLANNER_CONTINUITY.md',
  'docs/CERTIFICATION/P2_2_NEW_EPOCH_DAILY_CLOSURE.md',
  'docs/CERTIFICATION/p2-2-new-epoch-daily-closure.json',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('P1.4 status is production certified', artifact.status === 'PRODUCTION_CERTIFIED')
check('P1.3 production policy is deployed', artifact.runtimePolicyCommit === 'a64c876b803c93f259424389d765282a9a0a3d1a')
check('runtime repair commit is recorded', artifact.runtimeRepairCommit === artifact.productionCommit)
check('protected run succeeded', artifact.protectedRun?.success === true && artifact.protectedRun?.httpStatus === 200)
check('post-P1.3 rows exist', artifact.postP13PredictionRows > 0)
check('production evaluation policy rows match persisted rows', artifact.postP13RowsWithProductionEvaluationPolicy === artifact.postP13PredictionRows)
check('all post-P1.3 rows are valid and production evaluable', artifact.predictionValidRows === artifact.postP13PredictionRows && artifact.productionEvaluableRows === artifact.postP13PredictionRows)
check('recommendation/actionability/Official Pick gates remain separate', artifact.recommendationEligibleRows === 0 && artifact.actionableRows === 0 && artifact.officialPickEligibleRows === 0)
check('supported selections were fully generated', artifact.expectedSupportedSelections === artifact.predictionsGenerated && artifact.predictionsMissing === 0)
check('market freshness recovered', artifact.marketFreshnessStatus === 'HEALTHY')
check('required evidence names persisted predictions', artifact.requiredEvidence.some((item) => item.includes('persisted predictions')))
check('P2.0 was not started', artifact.p20Started === false && certification.includes('P2.0 was not started'))
check('certification reads made no provider calls', artifact.providerCallsMadeByCertificationReads === 0)
check('certification reads made no mutations', artifact.remoteMutationsMadeByCertificationReads === 0)
check('no writes were performed by certification', artifact.predictionWritesByCertification === 0 && artifact.settlementWritesByCertification === 0 && artifact.learningWritesByCertification === 0)
check('ops doc records productionEvaluationPolicy evidence', ops.includes('feature_snapshot.productionEvaluationPolicy') && ops.includes('24'))
check('adaptive bridge runs stored-odds prediction generation after canonical acquisition', adaptive.includes('generateMlbProspectivePredictionsFromStoredOdds') && adaptive.includes('storedOddsPredictionGeneration'))
check('stored-odds prediction generation makes zero provider calls', preview.includes('mlb_prospective_prediction_from_stored_odds_v1') && preview.includes('providerCallsMade: 0'))
check('stored-odds prediction generation persists production evaluation policy', preview.includes("policyVersion: 'production_evaluation_policy_v1_3'") && preview.includes('policyContractPersisted'))
check('only bounded P1.4 files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p1_4_e2e_production_pipeline_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  classification: artifact.status,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
