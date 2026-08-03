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
  'docs/CERTIFICATION/P1_4_E2E_PRODUCTION_PIPELINE_CERTIFICATION.md',
  'docs/CERTIFICATION/p1-4-e2e-production-pipeline.json',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/MISSION_CONTROL/README.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('P1.4 status is external wait not false pass', artifact.status === 'EXTERNAL_WAIT')
check('P1.3 production policy is deployed', artifact.runtimePolicyCommit === 'a64c876b803c93f259424389d765282a9a0a3d1a')
check('post-P1.3 rows are absent', artifact.postP13PredictionRows === 0)
check('production evaluation policy rows are absent', artifact.postP13RowsWithProductionEvaluationPolicy === 0)
check('eligible slate exists but needs execution', artifact.eligibleFutureMlbEvents > 0 && artifact.currentDayMlbEventsNeedingRefresh > 0)
check('scheduler wait is explicit', artifact.schedulerCadenceStatus === 'CRITICAL' && artifact.missedSchedulerIntervals > 0)
check('market freshness wait is explicit', artifact.marketFreshnessStatus === 'CRITICAL')
check('required evidence names persisted predictions', artifact.requiredEvidence.some((item) => item.includes('persisted predictions')))
check('P2.0 was not started', artifact.p20Started === false && certification.includes('P2.0 was not started'))
check('certification reads made no provider calls', artifact.providerCallsMadeByCertificationReads === 0)
check('certification reads made no mutations', artifact.remoteMutationsMadeByCertificationReads === 0)
check('no writes were performed by certification', artifact.predictionWritesByCertification === 0 && artifact.settlementWritesByCertification === 0 && artifact.learningWritesByCertification === 0)
check('ops doc records missing productionEvaluationPolicy evidence', ops.includes('feature_snapshot.productionEvaluationPolicy'))
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
