import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const workflow = read('.github/workflows/production-operating-day.yml')
const route = read('src/app/api/cron/operating-day/route.ts')
const operationsHealth = read('src/services/operations-health.service.ts')
const schedulerConfig = read('src/config/mlb-operating-day-scheduler.ts')
const cert = read('docs/CERTIFICATION/OR_01B_SCHEDULER_WORKFLOW_LEDGER_RECONCILIATION.md')
const json = JSON.parse(read('docs/CERTIFICATION/or-01b-scheduler-workflow-ledger-reconciliation.json'))
const status = read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  '.github/workflows/production-operating-day.yml',
  'src/app/api/cron/operating-day/route.ts',
  'src/app/api/operations/planner-trace/route.ts',
  'src/services/operations-health.service.ts',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'scripts/or01b-scheduler-workflow-ledger-reconcile-validate.mjs',
  'scripts/or01c-settlement-closure-product-readiness-validate.mjs',
  'scripts/or01d-github-scheduled-trigger-recovery-validate.mjs',
  'scripts/or01e-adaptive-planner-behavior-validate.mjs',
  'scripts/or01f-bounded-planner-continuity-validate.mjs',
  'docs/CERTIFICATION/OR_01B_SCHEDULER_WORKFLOW_LEDGER_RECONCILIATION.md',
  'docs/CERTIFICATION/or-01b-scheduler-workflow-ledger-reconciliation.json',
  'docs/OPERATIONAL_EXCELLENCE/OR_01B_SCHEDULER_WORKFLOW_LEDGER_RECONCILIATION.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/CERTIFICATION/README.md',
  'docs/CERTIFICATION/OR_01E_ADAPTIVE_PLANNER_BEHAVIOR.md',
  'docs/CERTIFICATION/or-01e-adaptive-planner-behavior.json',
  'docs/CERTIFICATION/OR_01F_BOUNDED_PLANNER_CONTINUITY.md',
  'docs/CERTIFICATION/or-01f-bounded-planner-continuity.json',
  'docs/ARCHITECTURE/BOUNDED_PLANNER_CONTINUITY_V1.md',
  'docs/OPERATIONAL_EXCELLENCE/OR_01F_BOUNDED_PLANNER_CONTINUITY.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'vercel.json',
  'src/services/mission-control.service.ts',
  'scripts/mission-control-v1-validate.mjs',
  'scripts/or01h-primary-scheduler-architecture-validate.mjs',
  'scripts/or02-primary-scheduler-migration-vercel-cron-validate.mjs',
  'docs/CERTIFICATION/OR_02_PRIMARY_SCHEDULER_MIGRATION_VERCEL_CRON.md',
  'docs/CERTIFICATION/or-02-primary-scheduler-migration-vercel-cron.json',
])

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const disallowed = changed.filter((file) => !allowed.has(file))

check('workflow uses canonical production URL', workflow.includes('PICK_ANALYZER_BASE_URL: https://pick-analyzer.vercel.app'))
check('workflow keeps protected secret header without logging secret', workflow.includes('CRON_SECRET: ${{ secrets.CRON_SECRET }}') && workflow.includes('--header "Authorization: Bearer ${CRON_SECRET}"') && !workflow.includes('echo "${CRON_SECRET}"'))
check('workflow fails on HTTP failure', workflow.includes('if [ "${status_code}" -lt 200 ] || [ "${status_code}" -ge 300 ]; then') && workflow.includes('exit 1'))
check('workflow parses JSON response body', workflow.includes('JSON.parse(text)') && workflow.includes('Operating-day response was not valid JSON'))
check('workflow fails on success false', workflow.includes('if (body.success !== true)') && workflow.includes('Operating-day response success was not true'))
check('workflow rejects failure statuses even when HTTP is 2xx', workflow.includes("'MISSED_REFRESH'") && workflow.includes("failedStatuses.has(String(body.status ?? ''))"))
check('workflow requires request ID', workflow.includes('if (!body.requestId)'))
check('workflow requires app invocation ID', workflow.includes('const appInvocationId') && workflow.includes('adaptive executionRunId'))
check('workflow requires selectedAction field', workflow.includes("hasOwnProperty.call(body, 'selectedAction')"))
check('workflow requires heartbeat for no-write success', workflow.includes('writes === 0 && !heartbeat') && workflow.includes('scheduler heartbeat evidence'))
check('route records heartbeat for live no-write protected writer', route.includes('successful_protected_writer_no_product_mutation_observation') && route.includes('protectedInvocationRecorded: true'))
check('route includes correlation ID in heartbeat metadata', route.includes('appInvocationId: String(lastStep.executionRunId') && route.includes('workflowSuccessRequiresInvocationEvidence: true'))
check('route normalizes live no-product heartbeat to successful health status', route.includes("['SKIPPED', 'NOT_DUE', 'SUCCESS_NO_CHANGE'].includes") && route.includes("status: heartbeatStatus"))
check('route dry-run heartbeat remains supported', route.includes('successful_protected_dry_run_observation'))
check('operations health counts protected heartbeat evidence as successful invocation', operationsHealth.includes('successfulSchedulerHeartbeat') && operationsHealth.includes('metadata.protectedInvocationRecorded === true') && operationsHealth.includes('metadata.heartbeatUpdatesHealthMarker === true'))
check('scheduler cadence unchanged', schedulerConfig.includes("export const MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'") || workflow.includes('7-57/10 * * * *'))
check('concurrency remains single writer/fallback', (workflow.includes('group: production-operating-day-writer') || workflow.includes('group: production-operating-day-fallback')) && workflow.includes('cancel-in-progress: false'))
check('OR-01B certification records root cause', cert.includes('transport-level workflow success was not reconciled to app-side scheduler health evidence'))
check('OR-01B JSON records zero validation provider calls', json.providerCallsMadeByValidation === 0 && json.remoteMutationsMadeByValidation === 0)
check('Mission Control records OR-01B state', status.includes('"or01b"') && (status.includes('WORKFLOW_LEDGER_RECONCILIATION_REPAIR_DEPLOYMENT_REQUIRED') || status.includes('WORKFLOW_LEDGER_RECONCILIATION_CERTIFIED')))
check('only bounded OR-01B files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((entry) => !entry.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'or01b_scheduler_workflow_ledger_reconcile_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
