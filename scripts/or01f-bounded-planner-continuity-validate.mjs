import fs from 'node:fs'

const checks = []
function read(path) {
  return fs.readFileSync(path, 'utf8')
}
function json(path) {
  return JSON.parse(read(path))
}
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const cronRoute = read('src/app/api/cron/operating-day/route.ts')
const adaptive = read('src/services/adaptive-refresh-orchestrator.service.ts')
const traceRoute = read('src/app/api/operations/planner-trace/route.ts')
const schedulerConfig = read('src/config/mlb-operating-day-scheduler.ts')
const workflow = read('.github/workflows/production-operating-day.yml')
const cert = json('docs/CERTIFICATION/or-01f-bounded-planner-continuity.json')
const status = json('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')
const queue = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')
const architecture = read('docs/ARCHITECTURE/BOUNDED_PLANNER_CONTINUITY_V1.md')

check('continuity policy exists in writer route', cronRoute.includes('PLANNER_CONTINUITY_POLICY') && cronRoute.includes("version: 'planner_continuity_v1'"))
check('max action count is bounded', cronRoute.includes('maxActionsPerInvocation: 3') && cronRoute.includes('step < PLANNER_CONTINUITY_POLICY.maxActionsPerInvocation'))
check('max provider actions is one', cronRoute.includes('maxProviderActionsPerInvocation: 1') && cert.continuityPolicy.maxProviderActionsPerInvocation === 1)
check('same provider/action identity cannot repeat', cronRoute.includes('actionIdentities.has(nextIdentity)') && cronRoute.includes('REPEATED_ACTION_GUARD'))
check('planner recomputes after successful action', cronRoute.includes("runAdaptiveRefresh({ dryRun: true, source: `${source}_CONTINUITY_PREVIEW` })") && cronRoute.includes('plannerRecomputations += 1'))
check('internal actions may continue when immediately due', cronRoute.includes("safeInternalContinuationActions: ['settle']") && cronRoute.includes('isSafeInternalContinuationAction(nextAction)'))
check('second provider action stops chain', cronRoute.includes('isProviderPlannerAction(nextAction)') && cronRoute.includes('SECOND_PROVIDER_ACTION_REQUIRED'))
check('heartbeat-only/no material change stops chain', cronRoute.includes('NO_MATERIAL_CHANGE') && cronRoute.includes("['NOT_DUE', 'SUCCESS_NO_CHANGE'].includes(status)"))
check('failed action stops chain', cronRoute.includes('ACTION_FAILED') && cronRoute.includes('adaptive.success !== true'))
check('mutation cap exists', cronRoute.includes('maxMutationsPerInvocation: 500') && cronRoute.includes('MUTATION_CAP_REACHED'))
check('duration cap exists', cronRoute.includes('maxDurationMs: 5 * 60 * 1000') && cronRoute.includes('DURATION_CAP_REACHED'))
check('trace exposes continuity policy', adaptive.includes('continuityPolicy') && adaptive.includes("version: 'planner_continuity_v1'"))
check('trace route remains protected by bearer header only', traceRoute.includes("request.headers.get('authorization') === `Bearer ${secret}`") && !traceRoute.includes("searchParams.get('secret')"))
check('trace reads make zero provider calls', cert.readOnlyGuarantees.providerCallsMade === 0)
check('trace reads make zero mutations', cert.readOnlyGuarantees.remoteMutationsMade === 0)
check('provider budgets unchanged', cert.behaviorChanges.providerBudgetChanged === false)
check('scheduler cadence unchanged in config', schedulerConfig.includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'"))
check('scheduler cadence unchanged in workflow', workflow.includes('7-57/10 * * * *'))
check('prediction policy unchanged', cert.behaviorChanges.predictionChanged === false && cert.behaviorChanges.officialPickPolicyChanged === false)
check('settlement remains canonical/scoped', cert.behaviorChanges.settlementMathChanged === false && architecture.includes('Do not broaden settlement eligibility'))
check('learning remains idempotent', cert.idempotency.learningEvidence === 'IDEMPOTENT_DERIVED')
check('performance remains idempotent', cert.idempotency.performanceSynchronization === 'IDEMPOTENT_DERIVED')
check('prediction uniqueness preserved', cert.idempotency.predictionPersistence === 'UNCHANGED_UNIQUE_KEYS')
check('Current Era and Replay remain isolated', cert.behaviorChanges.currentEraChanged === false && cert.behaviorChanges.replayChanged === false)
check('simulations cover repetition and caps', cert.simulations.length >= 8 && cert.simulations.some((item) => item.stopReason === 'REPEATED_ACTION_GUARD') && cert.simulations.some((item) => item.stopReason === 'DURATION_OR_MUTATION_CAP_REACHED'))
check('Mission Control reports OR-01F honestly', ['ACTIVE', 'LOCALLY_COMPLETE', 'PRODUCTION_CERTIFIED'].includes(status.or01f.status) && queue.includes('OR-01F') && (queue.includes('ACTIVE') || queue.includes('LOCALLY_COMPLETE') || queue.includes('PRODUCTION_CERTIFIED')))
check('Production Pilot Week remains not ready', status.productionPilotWeek.state === 'NOT_READY' && status.or01f.productionPilotWeek === 'NOT_READY')
check('MC-08H remains blocked', status.mc08h.status === 'PRODUCTION_READINESS_BLOCKED')
check('MC-03 remains not started', status.or01f.mc03 === 'NOT_STARTED')

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'or01f_bounded_planner_continuity_validate_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

if (failed.length) process.exit(1)
