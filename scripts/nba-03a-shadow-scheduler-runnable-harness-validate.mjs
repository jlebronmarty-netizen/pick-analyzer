import fs from 'node:fs'

const servicePath = 'src/services/nba-current-era-shadow-scheduler.service.ts'
const routePath = 'src/app/api/cron/nba-current-era-shadow/route.ts'
const certPath = 'docs/CERTIFICATION/nba-03a-shadow-scheduler-runnable-harness.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_SHADOW_SCHEDULER_RUNNABLE_HARNESS.md'

const service = fs.readFileSync(servicePath, 'utf8')
const route = fs.readFileSync(routePath, 'utf8')
const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fixture-service-role-key'

const { runNbaShadowSchedulerHarnessFixtures } = await import('../src/services/nba-current-era-shadow-scheduler.service.ts')
const fixtures = runNbaShadowSchedulerHarnessFixtures()

let checks = 0
const failures = []

function check(name, condition) {
  checks += 1
  if (condition) console.log(`PASS ${name}`)
  else {
    console.error(`FAIL ${name}`)
    failures.push(name)
  }
}

const result = (name) => fixtures.results[name]

check('certification status ready', cert.status === 'NBA_03A_SHADOW_SCHEDULER_RUNNABLE_HARNESS_CERTIFIED_READY_FOR_ACTIVATION_CANARY')
check('route exists and is documented', cert.route.path === '/api/cron/nba-current-era-shadow' && route.includes("'/api/cron/nba-current-era-shadow'"))
check('route uses canonical CRON_SECRET auth', route.includes('process.env.CRON_SECRET') && route.includes('authorization') && route.includes('Bearer'))
check('route supports GET and POST', route.includes('export async function GET') && route.includes('export async function POST'))
check('unauthorized request rejected in fixtures', result('unauthorized')?.classification === 'UNAUTHORIZED_REJECTED' && result('unauthorized')?.httpStatus === 401)
check('scheduler enable flag consumed by runtime', service.includes('NBA_SHADOW_SCHEDULER_ENABLED_ENV') && service.includes('schedulerEnabled()'))
check('disabled default no-op before provider', result('disabled')?.classification === 'SCHEDULER_DISABLED_NO_OP' && result('disabled')?.providerCalls === 0 && result('disabled')?.writes === 0)
check('vercel cron not activated', !JSON.stringify(vercel).includes('nba-current-era-shadow') && cert.scheduler.cronDeclaration === 'DEFERRED')
check('single future authority documented', cert.scheduler.authority === 'Vercel Cron future primary' && !fs.existsSync('.github/workflows/nba-current-era-shadow.yml'))
check('lock key exact', service.includes("NBA_SHADOW_SCHEDULER_LOCK_KEY = 'nba_current_era_shadow_scheduler'") && cert.scheduler.lockKey === 'nba_current_era_shadow_scheduler')
check('lock conflict no provider and no writes', result('lockConflict')?.classification === 'LOCK_CONFLICT_NO_OP' && result('lockConflict')?.providerCalls === 0 && result('lockConflict')?.writes === 0)
check('canary review boundary implemented', cert.bounds.reviewAfterRuns === 2 && result('afterRunTwo')?.classification === 'CANARY_REVIEW_REQUIRED_NO_OP')
check('hard max runs implemented', cert.bounds.hardMaxRuns === 4 && result('hardLimitRuns')?.classification === 'CANARY_HARD_LIMIT_REACHED_NO_OP')
check('total row cap implemented', cert.bounds.totalRowCap === 12 && result('hardLimitRows')?.classification === 'CANARY_HARD_LIMIT_REACHED_NO_OP')
check('pending guard implemented', cert.bounds.pendingGuard === 75 && result('pendingGuard')?.classification === 'PENDING_GUARD_NO_OP')
check('provider budget run cap exact', cert.providerBudget.maxProviderCallsPerRun === 2 && fixtures.providerCallsPerRun === 2)
check('provider budget hourly/daily exact', cert.providerBudget.maxProviderCallsPerHour === 4 && cert.providerBudget.maxProviderCallsPerDay === 48)
check('SportsDataIO and historical calls zero', cert.providerBudget.sportsDataIoCalls === 0 && cert.providerBudget.historicalProviderCalls === 0)
check('budget exceeded fails before provider', result('budgetExceeded')?.classification === 'PROVIDER_BUDGET_NO_OP' && result('budgetExceeded')?.providerCalls === 0)
check('no events clean no-op', result('noEvents')?.classification === 'NO_CURRENT_EVENT_NO_OP' && result('noEvents')?.providerCalls === 0)
check('no eligible clean no-op', result('noEligible')?.classification === 'NO_ELIGIBLE_CANDIDATE_NO_OP' && result('noEligible')?.writes === 0)
check('valid over cap max three', result('validOverCap')?.classification === 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_SUCCESS' && result('validOverCap')?.writes === 3)
check('repeated identical evidence dedupes', result('repeatedEvidence')?.classification === 'NO_ELIGIBLE_CANDIDATE_NO_OP' && result('repeatedEvidence')?.writes === 0)
check('run one accounting increments', result('runOne')?.completedRunsAfter === 1 && result('runOne')?.writes === 3)
check('run two enters review required after success', result('runTwo')?.completedRunsAfter === 2 && result('runTwo')?.reviewRequiredAfter === true)
check('provider failure blocked', result('providerFailure')?.classification === 'PROVIDER_FAILURE_BLOCKED' && result('providerFailure')?.writes === 0)
check('persistence failure blocked', result('persistenceFailure')?.classification === 'PERSISTENCE_FAILURE_BLOCKED' && result('persistenceFailure')?.writes === 0)
check('uses bounded NBA odds sync', service.includes('syncNbaOdds') && service.includes("mode: 'live'"))
check('uses Safe Canary dry-run', service.includes("runNbaCurrentEraShadowCanary({ mode: 'dry-run'"))
check('uses cross-event policy V1 selector', service.includes('selectNbaCurrentEraShadowAccumulationBatch') && cert.scheduler.policyVersion === 'NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1')
check('uses write-one deterministic persistence only', service.includes("mode: 'write-one'") && !service.includes("mode: 'write'"))
check('sports_sync_jobs audit persistence used', service.includes("from('sports_sync_jobs')") && cert.scheduler.jobType === 'nba_current_era_shadow_scheduler_canary_v1')
check('no settlement in scheduler route', !service.includes('settleNba') && !route.includes('settle'))
check('Official Pick isolation zero', cert.isolation.officialPickDelta === 0 && result('validOverCap')?.isolation.officialPickDelta === 0)
check('product visibility isolation zero', cert.isolation.productVisibilityDelta === 0 && result('validOverCap')?.isolation.productVisibilityDelta === 0)
check('learning calibration isolation zero', cert.isolation.learningDelta === 0 && cert.isolation.calibrationDelta === 0)
check('Historical Replay isolation zero', cert.isolation.historicalReplayDelta === 0 && result('validOverCap')?.isolation.historicalReplayDelta === 0)
check('MLB isolation zero', cert.isolation.mlbMutationDelta === 0 && result('validOverCap')?.isolation.mlbMutationDelta === 0)
check('production activation not performed', cert.schedulerActivated === false && cert.cronActivated === false && cert.productionCurrentEraWrites === 0)
check('production calls and mutations zero', cert.providerCalls === 0 && cert.databaseMutations === 0)
check('documentation records no activation', doc.includes('does not activate the scheduler') && doc.includes('Cron declaration: deferred'))
check('activation ready true', cert.activationCanaryReady === true)

console.log(`\nnba_03a_shadow_scheduler_runnable_harness_validate_v1 ${failures.length ? 'FAIL' : 'PASS'} ${checks - failures.length}/${checks}`)

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2))
  process.exit(1)
}
