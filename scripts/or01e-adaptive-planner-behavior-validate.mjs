import fs from 'node:fs'

const checks = []
function read(path) {
  return fs.readFileSync(path, 'utf8')
}
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
}

const service = read('src/services/adaptive-refresh-orchestrator.service.ts')
const cronRoute = read('src/app/api/cron/operating-day/route.ts')
const traceRoute = read('src/app/api/operations/planner-trace/route.ts')
const schedulerConfig = read('src/config/mlb-operating-day-scheduler.ts')
const workflow = read('.github/workflows/production-operating-day.yml')
const certMd = read('docs/CERTIFICATION/OR_01E_ADAPTIVE_PLANNER_BEHAVIOR.md')
const certJson = JSON.parse(read('docs/CERTIFICATION/or-01e-adaptive-planner-behavior.json'))
const mcStatus = JSON.parse(read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json'))
const queue = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')

const requiredActions = [
  'status_refresh',
  'morning_sync',
  'midday_refresh',
  'pregame_refresh',
  'final_refresh',
  'sync_results',
  'settle',
  'learning',
  'performance',
  'prewarm',
  'no_action',
]

for (const action of requiredActions) {
  check(`action inventoried: ${action}`, service.includes(`actionKey: '${action}'`) && certMd.includes(action))
}

check('selection function remains explicit', service.includes('function executableActionFromStatus') && service.includes('priorityOrder'))
check('route loop max remains three', cronRoute.includes('step < 3') || (cronRoute.includes('maxActionsPerInvocation: 3') && cronRoute.includes('step < PLANNER_CONTINUITY_POLICY.maxActionsPerInvocation')))
check('route continuation remains bounded to certified actions', cronRoute.includes("['sync_results', 'settle'].includes(selectedAction)") || (cronRoute.includes("safeInternalContinuationActions: ['settle']") && cronRoute.includes('SECOND_PROVIDER_ACTION_REQUIRED')))
check('market refresh does not become unbounded continuation', service.includes('marketRefreshContinuationEligible: false'))
check('bounded continuation option has hard caps', service.includes('maxProviderActionsPerInvocation: 1') && service.includes('maxRepeatedSameAction: 0'))
check('starvation scenarios are modeled', service.includes('ADAPTIVE_PLANNER_STARVATION_SCENARIOS') && service.includes('historical recovery debt plus active stale slate'))
check('one-action policy classified', service.includes("classification: 'INTENTIONAL_BUT_INCOMPATIBLE_WITH_REQUIRED_CADENCE'"))
check('root cause classified as mixed scheduler and planner', service.includes("rootCauseClassification: 'MIXED_SCHEDULER_AND_PLANNER'"))
check('planner trace route exists', traceRoute.includes('getAdaptivePlannerTrace'))
check('planner trace route is protected by bearer header', traceRoute.includes("request.headers.get('authorization') === `Bearer ${secret}`"))
check('planner trace route does not accept query-string secret', !traceRoute.includes("searchParams.get('secret')"))
check('planner trace reads make zero provider calls', service.includes('providerCallsMade: 0') && certJson.readOnlyGuarantees.providerCallsMade === 0)
check('planner trace reads make zero mutations', service.includes('remoteMutationsMade: 0') && certJson.readOnlyGuarantees.remoteMutationsMade === 0)
check('scheduler cadence unchanged in config', schedulerConfig.includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'"))
check('scheduler cadence unchanged in workflow', workflow.includes('7-57/10 * * * *'))
check('provider budgets unchanged by OR-01E', certJson.behaviorChanges.providerBudgetChanged === false)
check('prediction behavior unchanged', certJson.behaviorChanges.predictionChanged === false)
check('settlement policy unchanged', certJson.behaviorChanges.settlementChanged === false)
check('mission control keeps MC-08H blocked', mcStatus.mc08h.status === 'PRODUCTION_READINESS_BLOCKED')
check('production pilot week remains not ready', mcStatus.productionPilotWeek.state === 'NOT_READY')
check('MC-03 remains not started', mcStatus.or01e.mc03 === 'NOT_STARTED')
check('queue records OR-01E finding', queue.includes('OR-01E') && queue.includes('MIXED_SCHEDULER_AND_PLANNER_DEFECT'))
check('certification JSON final classification present', certJson.finalClassification === 'MIXED_SCHEDULER_AND_PLANNER_DEFECT')

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'or01e_adaptive_planner_behavior_validate_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
}, null, 2))

if (failed.length) process.exit(1)
