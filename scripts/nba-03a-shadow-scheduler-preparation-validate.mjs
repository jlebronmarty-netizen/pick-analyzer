import fs from 'node:fs'

const servicePath = 'src/services/nba-shadow-scheduler-preparation.service.ts'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_SHADOW_SCHEDULER_PREPARATION.md'
const certPath = 'docs/CERTIFICATION/nba-03a-shadow-scheduler-preparation.json'
const activationCertPath = 'docs/CERTIFICATION/nba-03a-shadow-scheduler-activation-cron.json'
const vercelPath = 'vercel.json'

const service = fs.readFileSync(servicePath, 'utf8')
const doc = fs.readFileSync(docPath, 'utf8')
const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const activationCert = fs.existsSync(activationCertPath) ? JSON.parse(fs.readFileSync(activationCertPath, 'utf8')) : null
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'))
const nbaCron = (vercel.crons ?? []).find((cron) => cron.path === '/api/cron/nba-current-era-shadow')
const activationCronCertified =
  activationCert?.status === 'NBA_03A_SHADOW_SCHEDULER_CRON_ACTIVATION_CERTIFIED_FOR_CANARY' &&
  activationCert?.cron?.path === '/api/cron/nba-current-era-shadow' &&
  activationCert?.cron?.schedule === '*/30 * * * *' &&
  activationCert?.activationLimits?.naturalCompletedRunsBeforeReview === 2 &&
  activationCert?.activationLimits?.hardMaximumRuns === 4 &&
  activationCert?.activationLimits?.maxNewRowsPerRun === 3 &&
  activationCert?.activationLimits?.maxNewRowsAcrossCanary === 12 &&
  activationCert?.activationLimits?.pendingGuard === 75
const { runNbaShadowSchedulerPreparationFixtures } = await import('../src/services/nba-shadow-scheduler-preparation.service.ts')
const fixture = runNbaShadowSchedulerPreparationFixtures()
const byName = Object.fromEntries(fixture.results.map((item) => [item.name, item.result]))

const checks = []
function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification status ready for activation review', cert.status === 'NBA_03A_SHADOW_SCHEDULER_PREPARATION_CERTIFIED_READY_FOR_ACTIVATION_REVIEW')
check('scheduler activated false', cert.schedulerActivated === false)
check('production writes zero', cert.productionCurrentEraWrites === 0)
check('provider calls zero in preparation', cert.providerCalls === 0)
check('database mutations zero in preparation', cert.databaseMutations === 0)
check('mode is NBA current era shadow', cert.scheduler.mode === 'NBA_CURRENT_ERA_SHADOW' && service.includes("NBA_SHADOW_SCHEDULER_MODE = 'NBA_CURRENT_ERA_SHADOW'"))
check('default enabled false', cert.scheduler.enabledByDefault === false && service.includes('defaultEnabled: false'))
check('kill switch env documented', cert.scheduler.enableFlag === 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED' && doc.includes('NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED'))
check('Vercel cron state is phase-aware', (Array.isArray(vercel.crons) && vercel.crons.length === 1 && vercel.crons[0].path === '/api/cron/operating-day') || (nbaCron?.schedule === '*/30 * * * *' && activationCronCertified))
check('proposed cron documented or activation certified', cert.scheduler.proposedCron === '*/30 * * * *' && (!nbaCron || activationCronCertified))
check('provider budget per run bounded at 2', cert.providerBudget.maxProviderCallsPerRun === 2)
check('sportsdataio remains zero', cert.providerBudget.sportsDataIoCalls === 0)
check('historical calls remain zero', cert.providerBudget.historicalProviderCalls === 0)
check('initial scheduler cap is below manual cap', cert.caps.initialPerRunWriteCap === 5 && cert.caps.initialPerRunWriteCap < cert.caps.manualCertificationBatchCap)
check('scheduler disabled no-op makes zero calls', byName['scheduler disabled']?.outcome === 'DISABLED_NO_OP' && byName['scheduler disabled']?.providerCalls === 0)
check('lock conflict no-op makes zero calls', byName['lock conflict']?.outcome === 'LOCK_CONFLICT_NO_OP' && byName['lock conflict']?.providerCalls === 0)
check('budget exhausted blocks before provider', byName['provider budget exhausted']?.outcome === 'PROVIDER_BUDGET_EXHAUSTED_NO_OP' && byName['provider budget exhausted']?.providerCalls === 0)
check('no events suppresses provider calls', byName['no current events']?.outcome === 'NO_CURRENT_EVENTS_NO_OP' && byName['no current events']?.providerCalls === 0)
check('stale odds no-op writes zero', byName['current events but stale odds']?.outcome === 'STALE_ODDS_NO_OP' && byName['current events but stale odds']?.simulatedInserts === 0)
check('provider failure fails closed', byName['provider failure']?.outcome === 'PROVIDER_FAILURE_FAIL_CLOSED' && byName['provider failure']?.simulatedInserts === 0)
check('valid candidates respect cap', byName['valid candidates']?.outcome === 'SIMULATED_BATCH_READY' && byName['valid candidates']?.simulatedInserts === cert.caps.initialPerRunWriteCap)
check('already persisted no-op inserts zero', byName['all selected already persisted']?.outcome === 'ALL_CANDIDATES_ALREADY_PERSISTED_NO_OP' && byName['all selected already persisted']?.simulatedInserts === 0)
check('batch write simulated does not exceed cap', byName['batch write simulated']?.simulatedInserts <= cert.caps.initialPerRunWriteCap)
check('deterministic rerun stable', fixture.deterministicRerun === true && cert.fixtures.deterministicRerun === true)
check('Official Pick isolation zero', Object.values(fixture.results[0].result.isolation).every((value) => value === 0) && cert.isolation.officialPickDelta === 0)
check('learning calibration isolation zero', cert.isolation.learningDelta === 0 && cert.isolation.calibrationDelta === 0)
check('MLB isolation zero', cert.isolation.mlbMutationDelta === 0)
check('performance readiness insufficient sample', cert.currentState.performanceReadiness === 'INSUFFICIENT_CURRENT_ERA_SETTLED_SAMPLE' && doc.includes('INSUFFICIENT_CURRENT_ERA_SETTLED_SAMPLE'))
check('activation requires explicit authorization', cert.activationGate.includes('explicit user authorization') && doc.includes('explicit user authorization'))
check('no production route added by service', !service.includes('NextRequest') && !service.includes('apiOk('))

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.error(`\nnba_03a_shadow_scheduler_preparation_validate_v1 FAIL ${checks.length - failed.length}/${checks.length}`)
  process.exit(1)
}

console.log(`\nnba_03a_shadow_scheduler_preparation_validate_v1 PASS ${checks.length}/${checks.length}`)
