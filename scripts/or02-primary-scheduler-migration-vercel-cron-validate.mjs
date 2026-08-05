import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const json = (path) => JSON.parse(read(path))
const checks = []
const check = (name, passed, detail = '') => checks.push({ name, passed: Boolean(passed), detail })

const cert = json('docs/CERTIFICATION/or-02-primary-scheduler-migration-vercel-cron.json')
const vercel = json('vercel.json')
const cronRoute = read('src/app/api/cron/operating-day/route.ts')
const workflow = read('.github/workflows/production-operating-day.yml')
const adaptive = read('src/services/adaptive-refresh-orchestrator.service.ts')
const health = read('src/services/operations-health.service.ts')
const mission = read('src/services/mission-control.service.ts')
const status = json('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')

check('Vercel Pro approval is recorded', cert.humanDecision.vercelProActive === true && cert.humanDecision.vercelCronPrimaryApproved === true)
check('vercel.json registers primary cron', Array.isArray(vercel.crons) && vercel.crons.some((cron) => cron.path === '/api/cron/operating-day' && cron.schedule === '7-57/10 * * * *'))
check('GET maps to Vercel primary', cronRoute.includes("request.method === 'GET' ? VERCEL_PRIMARY_SOURCE : GITHUB_FALLBACK_SOURCE"))
check('POST/GitHub maps to fallback', cronRoute.includes('GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK') && workflow.includes('scheduler=github-fallback'))
check('same protected endpoint is retained', cronRoute.includes("route: '/api/cron/operating-day'") && workflow.includes('/api/cron/operating-day?dryRun=${DRY_RUN}&scheduler=github-fallback'))
check('fallback primary lease exists', cronRoute.includes('recentPrimarySchedulerLease') && cronRoute.includes('PRIMARY_RECENT_SUCCESS_LEASE'))
check('fallback skip has zero provider calls and zero mutations', cronRoute.includes('fallbackSkipProviderCalls') || (cronRoute.includes('providerCallsMade: 0') && cronRoute.includes('remoteMutationsMade: 0')))
check('planner continuity policy remains capped', cronRoute.includes('maxActionsPerInvocation: 3') && cronRoute.includes('maxProviderActionsPerInvocation: 1'))
check('provider action lock remains active', cronRoute.includes('provider_action_lock') && adaptive.includes('claimProviderActionLock(lockKey'))
check('adaptive status reports primary/fallback crons', adaptive.includes("owner: 'vercel_cron_primary'") && adaptive.includes("owner: 'github_actions_fallback'"))
check('operations health reports primary/fallback source', health.includes("primaryScheduler: 'VERCEL_OPERATING_DAY_CRON_PRIMARY'") && health.includes('lastVercelPrimarySuccessAt'))
check('Mission Control maps OR-02 metadata', mission.includes("id === 'OR-02'") && mission.includes('Migrate primary protected operating-day scheduling to Vercel Cron'))
check('Mission Control status is OR-02 gated or OR-02A follow-up gated', (status.currentMission?.id === 'OR-02' && status.status === 'OR_02_EXTERNAL_WAIT_VERCEL_PRIMARY_SUSTAINED_PROOF') || (status.currentMission?.id === 'OR-02A' && status.status === 'OR_02A_DEPLOYMENT_PENDING_MARKET_REFRESH_PROOF'))
check('required production proof remains incomplete before observation', cert.requiredProductionProof.threeConsecutiveVercelAutomaticExecutions === false)
check('prediction and policy safety recorded', cert.safety.predictionChanged === false && cert.safety.officialPickPolicyChanged === false && cert.safety.kellyChanged === false)
check('settlement learning and provider budgets unchanged', cert.safety.settlementChanged === false && cert.safety.learningChanged === false && cert.safety.providerBudgetChanged === false)
check('local server smoke not run', cert.safety.localServerSmokeRun === false)
check('Production Pilot Week not ready before proof', cert.requiredProductionProof.productionPilotWeekReady === false)

const failedChecks = checks.filter((item) => !item.passed)

console.log(JSON.stringify({
  success: failedChecks.length === 0,
  mode: 'or02_primary_scheduler_migration_vercel_cron_validate_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

if (failedChecks.length > 0) process.exit(1)
