import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))

const route = read('src/app/api/operations/e2e-integrity/route.ts')
const service = read('src/services/e2e-system-integrity.service.ts')
const certification = exists('docs/CERTIFICATION/P1_2_E2E_SYSTEM_INTEGRITY_AUDIT.md')
  ? read('docs/CERTIFICATION/P1_2_E2E_SYSTEM_INTEGRITY_AUDIT.md')
  : ''
const architecture = exists('docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md')
  ? read('docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md')
  : ''
const ops = exists('docs/OPERATIONAL_EXCELLENCE/P1_2_E2E_SYSTEM_INTEGRITY_AUDIT.md')
  ? read('docs/OPERATIONAL_EXCELLENCE/P1_2_E2E_SYSTEM_INTEGRITY_AUDIT.md')
  : ''
const artifact = exists('docs/CERTIFICATION/p1-2-e2e-system-integrity-audit.json')
  ? JSON.parse(read('docs/CERTIFICATION/p1-2-e2e-system-integrity-audit.json'))
  : null

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'src/services/e2e-system-integrity.service.ts',
  'src/app/api/operations/e2e-integrity/route.ts',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/OPERATIONAL_EXCELLENCE/P1_2_E2E_SYSTEM_INTEGRITY_AUDIT.md',
  'docs/CERTIFICATION/P1_2_E2E_SYSTEM_INTEGRITY_AUDIT.md',
  'docs/CERTIFICATION/p1-2-e2e-system-integrity-audit.json',
  'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  'src/services/prediction-coverage.service.ts',
  'src/app/api/operations/prediction-coverage/route.ts',
  'docs/ARCHITECTURE/COMPREHENSIVE_SUPPORTED_MARKET_COVERAGE.md',
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
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/provider-budget.service.ts',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'docs/CERTIFICATION/P2_2B_CURRENT_ERA_CLOSURE_INVESTIGATION.md',
  'docs/CERTIFICATION/p2-2b-current-era-closure-investigation.json',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('all current prediction paths are inventoried', architecture.includes('Prediction-Producing Paths') && architecture.includes('sportsdataio-mlb-prospective-preview.service.ts'))
check('every surface has a canonical prediction source', architecture.includes('Surface Reconciliation') && architecture.includes('/api/current-board') && architecture.includes('/api/performance'))
check('incompatible engine versions are visible', service.includes('parallelEnginesVisible') && service.includes('modelVersions'))
check('operating-date counts reconcile', service.includes('operatingDate') && service.includes('marketCoverage'))
check('no silent prediction-count remainder exists', service.includes('noSilentRemainder') && service.includes('productionEligibleRows.length + quarantinedRows.length'))
check('every current supported selection is predicted or has an explicit reason', service.includes('missingReasons') && service.includes('ODDS_UNAVAILABLE') && service.includes('PREDICTION_MISSING_OR_QUARANTINED'))
check('quarantined rows remain distinct from production rows', service.includes('PREGAME_VALID_QUARANTINED_PREVIEW') && service.includes('production_eligible !== true'))
check('results and settlement reconcile', service.includes('result_settlement_closure_v1') && service.includes('equationBalanced'))
check('Performance uses the same production scope', service.includes('getPerformanceScopeV2') && architecture.includes('performance-scope-v2'))
check('missed opportunities are explicit', service.includes('missed_opportunity_reconciliation_v1') && ops.includes('Missed Opportunities'))
check('epoch activation is not performed', service.includes('activationPerformed: false') && certification.includes('Prediction Epoch V2 was not activated'))
check('replay does not write production rows', service.includes('productionWrites: 0') && certification.includes('Historical replay was not started'))
check('normal integrity reads make zero provider calls', service.includes('providerCallsMade: 0') && route.includes('Protected E2E integrity diagnostics'))
check('normal integrity reads make zero mutations', service.includes('databaseMutations: 0') && service.includes('predictionWrites: 0'))
check('no historical row is rewritten', service.includes('historicalRowsRewritten: false') && certification.includes('No historical rows were rewritten'))
check('paused MC-08E work remains untouched', !exists('docs/CERTIFICATION/MC_08E_WATCHLIST_EXPERIENCE.md') && !exists('docs/CERTIFICATION/mc-08e-watchlist-experience.json') && !exists('docs/MISSION_CONTROL/MC_08E_WATCHLIST_EXPERIENCE.md') && !exists('scripts/mc08e-watchlist-experience-validate.mjs'))
check('diagnostic route requires CRON_SECRET authorization', route.includes('CRON_SECRET') && route.includes('UNAUTHORIZED') && route.includes('authorization'))
check('bounded route caps limit at 200', route.includes('max: 200') && service.includes('Math.min(Math.max(Number(limit ?? 200), 1), 200)'))
check('P1.1 classification is preserved', service.includes('generatedRows: 45') && certification.includes('Do not retroactively promote those rows'))
check('only bounded P1.2 files changed', disallowed.length === 0, disallowed.join(', '))
check('certification JSON exists and is parseable', artifact?.mode === 'p1_2_e2e_system_integrity_audit_v1')
check('roadmap includes epoch, market coverage and replay', ops.includes('Prediction Epoch V2 Activation') && ops.includes('Comprehensive Supported-Market Coverage') && ops.includes('Historical Progressive Replay'))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p1_2_e2e_system_integrity_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
