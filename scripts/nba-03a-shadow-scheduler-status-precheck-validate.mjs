import fs from 'node:fs'

const servicePath = 'src/services/nba-current-era-shadow-scheduler.service.ts'
const routePath = 'src/app/api/cron/nba-current-era-shadow/route.ts'
const providerBudgetPath = 'src/services/provider-budget.service.ts'
const certPath = 'docs/CERTIFICATION/nba-03a-shadow-scheduler-status-precheck.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_SHADOW_SCHEDULER_STATUS_PRECHECK.md'

const service = fs.readFileSync(servicePath, 'utf8')
const route = fs.readFileSync(routePath, 'utf8')
const providerBudget = fs.readFileSync(providerBudgetPath, 'utf8')
const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fixture-service-role-key'

const { runNbaShadowSchedulerPrecheckFixtures } = await import('../src/services/nba-current-era-shadow-scheduler.service.ts')
const fixtures = runNbaShadowSchedulerPrecheckFixtures()

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
const precheckStart = service.indexOf('export async function getNbaCurrentEraShadowSchedulerPrecheckStatus')
const executionStart = service.indexOf('async function startAuditJob', precheckStart)
const precheckBody = service.slice(precheckStart, executionStart)

check('certification status ready', cert.status === 'NBA_03A_SHADOW_SCHEDULER_STATUS_PRECHECK_CERTIFIED_READY_FOR_PUBLICATION')
check('existing protected route reused', cert.route.path === '/api/cron/nba-current-era-shadow' && route.includes('status ===') && route.includes('mode ==='))
check('route remains CRON_SECRET protected', route.includes('process.env.CRON_SECRET') && route.includes('UNAUTHORIZED'))
check('unauthenticated status request rejected by route auth', cert.testMatrix.unauthenticated === 'UNAUTHORIZED' && cert.route.unauthenticatedStatus === 401)
check('status precheck service exported', service.includes('getNbaCurrentEraShadowSchedulerPrecheckStatus'))
check('status modes call precheck before execution', route.indexOf('getNbaCurrentEraShadowSchedulerPrecheckStatus') < route.indexOf('runNbaCurrentEraShadowSchedulerCanary()'))
check('precheck does not call provider budget checker', !precheckBody.includes('checkProviderBudget('))
check('precheck does not call current NBA sync', !precheckBody.includes('syncNbaOdds('))
check('precheck does not call Safe Canary writer', !precheckBody.includes('runNbaCurrentEraShadowCanary('))
check('precheck does not start audit job', !precheckBody.includes('startAuditJob('))
check('precheck does not finish audit job', !precheckBody.includes('finishAuditJob('))
check('precheck does not acquire scheduler lock', !precheckBody.includes('claimProviderActionLock('))
check('read-only lock inspection primitive exists', providerBudget.includes('getProviderActionLockStatus') && precheckBody.includes('getProviderActionLockStatus'))
check('disabled fixture classification', result('disabled')?.finalClassification === 'SCHEDULER_PRECHECK_DISABLED')
check('enabled fixture classification', result('ready')?.finalClassification === 'SCHEDULER_PRECHECK_READY')
check('review required fixture classification', result('reviewRequired')?.finalClassification === 'SCHEDULER_PRECHECK_REVIEW_REQUIRED')
check('hard limit run fixture classification', result('hardLimitRuns')?.finalClassification === 'SCHEDULER_PRECHECK_HARD_LIMIT')
check('hard limit row fixture classification', result('hardLimitRows')?.finalClassification === 'SCHEDULER_PRECHECK_HARD_LIMIT')
check('pending guard fixture classification', result('pendingGuard')?.finalClassification === 'SCHEDULER_PRECHECK_PENDING_GUARD')
check('active lock fixture classification', result('lockActive')?.finalClassification === 'SCHEDULER_PRECHECK_LOCK_ACTIVE')
check('repeated status request no counter changes', JSON.stringify(result('ready')) === JSON.stringify(result('repeated')))
check('provider spy zero', Object.values(fixtures.results).every((item) => item.providerCalls === 0))
check('prediction persistence spy zero', Object.values(fixtures.results).every((item) => item.predictionWrites === 0))
check('current data sync spy zero', Object.values(fixtures.results).every((item) => item.currentDataSyncInvocations === 0))
check('run counter mutation zero', Object.values(fixtures.results).every((item) => item.runCounterMutations === 0))
check('audit job writes zero', Object.values(fixtures.results).every((item) => item.auditJobWrites === 0))
check('lock acquisitions zero', Object.values(fixtures.results).every((item) => item.schedulerLockAcquisitions === 0))
check('required payload fields documented', cert.fields.includes('schedulerEnabled') && cert.fields.includes('completedCanaryRuns') && cert.fields.includes('activeSchedulerLock'))
check('provider budget bounds preserved', cert.providerBudget.maxCallsPerRun === 2 && cert.providerBudget.maxCallsPerHour === 4 && cert.providerBudget.maxCallsPerDay === 48)
check('canary bounds preserved', cert.canaryBounds.perRunWriteCap === 3 && cert.canaryBounds.reviewAfterRuns === 2 && cert.canaryBounds.pendingGuardLimit === 75)
check('cron still not activated', !JSON.stringify(vercel).includes('nba-current-era-shadow') && cert.cronState === 'NBA_SHADOW_CRON_NOT_ADDED')
check('documentation states zero side effects', doc.includes('Zero-Side-Effect Contract') && doc.includes('scheduler lock acquisitions'))
check('status precheck ready true', cert.statusPrecheckReady === true)

console.log(`\nnba_03a_shadow_scheduler_status_precheck_validate_v1 ${failures.length ? 'FAIL' : 'PASS'} ${checks - failures.length}/${checks}`)

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2))
  process.exit(1)
}
