import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const json = (path) => JSON.parse(read(path))
const exists = (path) => fs.existsSync(path)
const checks = []
const check = (name, passed, detail = '') => {
  checks.push({ name, passed: Boolean(passed), detail })
}

const cert = json('docs/CERTIFICATION/or-01h-primary-scheduler-architecture.json')
const or02 = exists('docs/CERTIFICATION/or-02-primary-scheduler-migration-vercel-cron.json')
  ? json('docs/CERTIFICATION/or-02-primary-scheduler-migration-vercel-cron.json')
  : null
const or02SupersedesDisabledCron =
  or02?.humanDecision?.vercelProActive === true &&
  or02?.humanDecision?.vercelCronPrimaryApproved === true &&
  or02?.architecture?.primaryScheduler === 'VERCEL_OPERATING_DAY_CRON_PRIMARY'
const md = read('docs/CERTIFICATION/OR_01H_PRIMARY_SCHEDULER_ARCHITECTURE.md')
const vercel = json('vercel.json')
const writer = read('.github/workflows/production-operating-day.yml')
const heartbeat = read('.github/workflows/production-operating-day-heartbeat.yml')
const manual = read('.github/workflows/operating-day-refresh.yml')
const schedulerConfig = read('src/config/mlb-operating-day-scheduler.ts')
const missionControlService = read('src/services/mission-control.service.ts')

check('OR-01H certification JSON exists', exists('docs/CERTIFICATION/or-01h-primary-scheduler-architecture.json'))
check('OR-01H certification markdown exists', exists('docs/CERTIFICATION/OR_01H_PRIMARY_SCHEDULER_ARCHITECTURE.md'))
check('final classification requires human scheduler architecture decision', cert.finalClassification === 'HUMAN_SCHEDULER_ARCHITECTURE_DECISION_REQUIRED')
check('primary scheduler was not activated without plan proof', cert.decision.primarySchedulerActivated === false)
check('Vercel cron remains disabled unless OR-02 supersedes OR-01H', (Array.isArray(vercel.crons) && vercel.crons.length === 0) || or02SupersedesDisabledCron)
check('cert records Vercel cron disabled', cert.vercelAudit.vercelCronCurrentlyEnabledInRepository === false)
check('cert records missing plan evidence', cert.vercelAudit.planEvidenceAvailable === false)
check('cert blocks Vercel primary until dashboard proof', cert.vercelAudit.decision === 'DO_NOT_ACTIVATE_VERCEL_PRIMARY_WITHOUT_DASHBOARD_PLAN_PROOF')
check('required cadence remains 10 minutes', cert.decision.requiredCadenceMinutes === 10)
check('scheduler config write cadence remains 10 minutes', schedulerConfig.includes('MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES = 10') && schedulerConfig.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES = 10'))
check('GitHub writer/fallback cadence unchanged', writer.includes('7-57/10 * * * *') && (writer.includes('production-operating-day-writer') || writer.includes('production-operating-day-fallback')))
check('GitHub writer/fallback calls protected endpoint', writer.includes('/api/cron/operating-day?dryRun=${DRY_RUN}') && writer.includes('Authorization: Bearer ${CRON_SECRET}'))
check('GitHub writer validates app-side invocation evidence', writer.includes('appInvocationId') && writer.includes('schedulerHeartbeat'))
check('GitHub heartbeat remains observer cadence', heartbeat.includes('3,33 * * * *') && heartbeat.includes('/api/cron/operating-day?dryRun=true'))
check('manual workflow has no schedule trigger', manual.includes('workflow_dispatch') && !manual.includes('schedule:'))
check('manual runs do not satisfy sustained proof', cert.decision.manualCountsAsSustainedProof === false && md.includes('manual') && md.includes('do not prove three consecutive automatic primary executions'))
check('three automatic primary runs are required', cert.decision.requiredPrimaryAutomaticRuns === 3)
check('GitHub latest runs are schedule successes but not sustained proof', cert.githubAudit.latestRuns.length >= 2 && cert.githubAudit.threeConsecutiveAutomaticPrimaryRunsAtCadence === false)
check('fallback cannot blindly run alongside healthy primary', cert.fallbackContract.blindParallelWritersAllowed === false)
check('fallback uses same endpoint and secret', cert.fallbackContract.sameProtectedEndpointRequired === true && cert.fallbackContract.sameSecretRequired === true)
check('provider budget unchanged', cert.safety.providerBudgetChanged === false)
check('workflow cadence unchanged', cert.safety.workflowCadenceChanged === false)
check('no paid service activated', cert.safety.paidServiceActivated === false)
check('no prediction or Official Pick changes', cert.safety.predictionChanged === false && cert.safety.officialPickPolicyChanged === false)
check('no settlement or learning changes', cert.safety.settlementChanged === false && cert.safety.learningChanged === false)
check('no provider calls introduced', cert.safety.providerCallsIntroduced === 0)
check('no remote mutations introduced', cert.safety.remoteMutationsIntroduced === 0)
check('production commit evidence is current', cert.productionCommitObserved === cert.startingCommit)
check('system version provider calls are zero', cert.productionEvidence.systemVersion.providerCallsMade === 0)
check('scheduler health and market freshness are separate', cert.productionEvidence.operationsHealth.schedulerCadenceStatus === 'HEALTHY' && cert.productionEvidence.operationsHealth.marketFreshnessStatus === 'CRITICAL')
check('required user action is explicit', cert.requiredUserAction.length >= 6 && cert.requiredUserAction.some((item) => item.includes('Verify Vercel team/project plan')))
check('Mission Control runtime overlay maps OR-01H/OR-02 metadata', missionControlService.includes('Operations Architecture') && missionControlService.includes('human_vercel_plan_and_cron_settings_check_required') && (!or02SupersedesDisabledCron || missionControlService.includes("id === 'OR-02'")))
check('Production Pilot Week not started', cert.safety.productionPilotWeekStarted === false)
check('MC-03 not started', cert.safety.mc03Started === false)
check('local server smoke was not run', cert.safety.localServerSmokeRun === false)

const failed = checks.filter((item) => !item.passed)

console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'or01h_primary_scheduler_architecture_validate_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

if (failed.length > 0) process.exit(1)
