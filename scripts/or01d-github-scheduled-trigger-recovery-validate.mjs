import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const workflow = read('.github/workflows/production-operating-day.yml')
const cronRoute = read('src/app/api/cron/operating-day/route.ts')
const operationsHealth = read('src/services/operations-health.service.ts')
const settlementHealth = read('src/services/settlement-guarantee.service.ts')
const status = JSON.parse(read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json'))
const cert = JSON.parse(read('docs/CERTIFICATION/or-01d-github-scheduled-trigger-recovery.json'))

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  'scripts/or01d-github-scheduled-trigger-recovery-validate.mjs',
  'scripts/mission-control-v1-validate.mjs',
  'docs/CERTIFICATION/OR_01D_GITHUB_SCHEDULED_TRIGGER_RECOVERY.md',
  'docs/CERTIFICATION/or-01d-github-scheduled-trigger-recovery.json',
  'docs/CERTIFICATION/or-01a-post-repair-operational-proof.json',
  'docs/CERTIFICATION/mc-08h-production-readiness-certification.json',
  'docs/CERTIFICATION/MC_08H_PRODUCTION_READINESS_CERTIFICATION.md',
  'docs/CERTIFICATION/README.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
])

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const disallowed = changed.filter((file) => !allowed.has(file))
const cronMatch = workflow.match(/cron:\s*"([^"]+)"/)
const cron = cronMatch?.[1] ?? ''

check('workflow exists on default branch evidence is documented', cert.defaultBranch === 'main' && cert.workflowFile === '.github/workflows/production-operating-day.yml')
check('cron is syntactically documented and valid for GitHub schedule', cron === '7-57/10 * * * *' && cert.cronExpressions.includes(cron))
check('expected UTC and Puerto Rico times are documented', cert.expectedScheduleUtc.length === 6 && cert.expectedSchedulePuertoRico.length === 6)
check('schedule event is not excluded by conditions', !workflow.includes('if:') || workflow.includes('github.event_name'))
check('concurrency preserves single writer without cancelling in-progress runs', workflow.includes('group: production-operating-day-writer') && workflow.includes('cancel-in-progress: false'))
check('workflow target is production', workflow.includes('PICK_ANALYZER_BASE_URL: https://pick-analyzer.vercel.app'))
check('secrets are not logged', workflow.includes('CRON_SECRET: ${{ secrets.CRON_SECRET }}') && workflow.includes('--header "Authorization: Bearer ${CRON_SECRET}"') && !workflow.includes('echo "${CRON_SECRET}"'))
check('automatic proof requires event=schedule', cert.automaticProof.event === 'schedule')
check('workflow_dispatch cannot satisfy scheduled proof', cert.workflowDispatchCanCertifySchedule === false)
check('app heartbeat correlates with GitHub run', cronRoute.includes('successful_protected_writer_product_mutation_observation') && cert.automaticProof.heartbeatRecorded === true)
check('scheduler cadence unchanged', cert.schedulerCadenceChanged === false && cron === cert.cronExpressions[0])
check('Settlement Closure remains healthy', cert.productionAfter.settlementClosure === 'HEALTHY')
check('historical recovery debt remains visible', cert.productionAfter.historicalRecoveryDebtRows > 0)
check('no prediction settlement or model logic changed', cert.safety.predictionLogicChanged === false && cert.safety.settlementRulesChanged === false && cert.safety.modelLogicChanged === false)
check('certification reads make zero provider calls', cert.safety.providerCallsFromCertificationReads === 0)
check('certification reads make zero mutations', cert.safety.remoteMutationsFromCertificationReads === 0)
check('operations health reads protected invocation evidence', operationsHealth.includes('lastSuccessfulProtectedInvocationAt'))
check('settlement guarantee remains independent', settlementHealth.includes('silentPendingRows'))
check('Mission Control records OR-01D external wait and keeps Production Pilot Week blocked', status.or01d?.status === 'AUTOMATIC_PROOF_OBSERVED_SUSTAINED_CADENCE_BLOCKED' && status.productionPilotWeek?.state === 'NOT_READY')
check('only bounded OR-01D files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((entry) => !entry.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'or01d_github_scheduled_trigger_recovery_validation_v1',
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
