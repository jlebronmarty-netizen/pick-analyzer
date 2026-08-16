import fs from 'node:fs'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

const {
  NBA_SHADOW_SCHEDULER_CONTINUOUS_DAILY_NEW_ROW_CAP,
  NBA_SHADOW_SCHEDULER_CONTINUOUS_DAILY_PROVIDER_CALL_CAP,
  NBA_SHADOW_SCHEDULER_CONTINUOUS_ENABLED_ENV,
  NBA_SHADOW_SCHEDULER_CONTINUOUS_EVENT_MARKET_ROW_CAP,
  NBA_SHADOW_SCHEDULER_CONTINUOUS_EVENT_ROW_CAP,
  NBA_SHADOW_SCHEDULER_CONTINUOUS_PENDING_SOFT_PAUSE,
  NBA_SHADOW_SCHEDULER_CONTINUOUS_RUN_PURPOSE,
  NBA_SHADOW_SCHEDULER_PENDING_GUARD,
  NBA_SHADOW_SCHEDULER_PER_RUN_CAP,
  runNbaShadowSchedulerPrecheckFixtures,
} = await import('../src/services/nba-current-era-shadow-scheduler.service.ts')

const service = fs.readFileSync('src/services/nba-current-era-shadow-scheduler.service.ts', 'utf8')
const cert = JSON.parse(fs.readFileSync('docs/CERTIFICATION/nba-03a-continuous-shadow-operating-policy.json', 'utf8'))
const doc = fs.readFileSync('docs/PRODUCTION_PILOT/NBA_03A_CONTINUOUS_SHADOW_OPERATING_POLICY.md', 'utf8')
const fixtures = runNbaShadowSchedulerPrecheckFixtures()

const checks = []
function check(name, pass) {
  checks.push({ name, pass: Boolean(pass) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification status ready for publication', cert.status === 'NBA_03A_CONTINUOUS_SHADOW_OPERATING_POLICY_CERTIFIED_READY_FOR_PUBLICATION')
check('continuous mode has explicit env', NBA_SHADOW_SCHEDULER_CONTINUOUS_ENABLED_ENV === 'NBA_CURRENT_ERA_SHADOW_CONTINUOUS_ENABLED')
check('continuous run purpose explicit', NBA_SHADOW_SCHEDULER_CONTINUOUS_RUN_PURPOSE === 'CONTINUOUS_SHADOW_EVIDENCE_RUN')
check('repaired flag separated from continuous', cert.policy.repairedVerificationEnvIsNotContinuous === true && !service.includes('NBA_CURRENT_ERA_SHADOW_REPAIRED_VERIFICATION_ENABLED=true enables continuous'))
check('continuous default off fixture remains review required', fixtures.results.repairedVerificationComplete.finalClassification === 'SCHEDULER_PRECHECK_REVIEW_REQUIRED')
check('continuous explicit flag reaches ready', fixtures.results.continuousReady.finalClassification === 'SCHEDULER_PRECHECK_READY' && fixtures.results.continuousReady.continuousReady === true)
check('daily cap no-ops before provider', fixtures.results.continuousDailyCap.finalClassification === 'SCHEDULER_PRECHECK_CONTINUOUS_GUARD' && fixtures.results.continuousDailyCap.continuousGuardReason === 'CONTINUOUS_DAILY_ROW_CAP')
check('soft pending pause no-ops before provider', fixtures.results.continuousSoftPause.finalClassification === 'SCHEDULER_PRECHECK_CONTINUOUS_GUARD' && fixtures.results.continuousSoftPause.continuousGuardReason === 'CONTINUOUS_PENDING_SOFT_PAUSE')
check('daily provider cap no-ops before provider', fixtures.results.continuousProviderCap.finalClassification === 'SCHEDULER_PRECHECK_CONTINUOUS_GUARD' && fixtures.results.continuousProviderCap.continuousGuardReason === 'CONTINUOUS_DAILY_PROVIDER_CALL_CAP')
check('per-run cap preserved', NBA_SHADOW_SCHEDULER_PER_RUN_CAP === 3 && cert.policy.perRunCap === 3)
check('daily new row cap conservative', NBA_SHADOW_SCHEDULER_CONTINUOUS_DAILY_NEW_ROW_CAP === 3 && cert.policy.dailyNewRowCap === 3)
check('daily provider cap conservative', NBA_SHADOW_SCHEDULER_CONTINUOUS_DAILY_PROVIDER_CALL_CAP === 2 && cert.policy.dailyProviderCallCap === 2)
check('pending hard guard preserved', NBA_SHADOW_SCHEDULER_PENDING_GUARD === 75 && cert.policy.pendingHardGuard === 75)
check('soft pause below hard guard', NBA_SHADOW_SCHEDULER_CONTINUOUS_PENDING_SOFT_PAUSE === 60 && cert.policy.pendingSoftPause < cert.policy.pendingHardGuard)
check('event caps present', NBA_SHADOW_SCHEDULER_CONTINUOUS_EVENT_ROW_CAP === 6 && NBA_SHADOW_SCHEDULER_CONTINUOUS_EVENT_MARKET_ROW_CAP === 3)
const runStart = service.indexOf('export async function runNbaCurrentEraShadowSchedulerCanary')
const runBody = service.slice(runStart)
check('continuous guard happens before provider budget', runBody.indexOf('continuousGuard(canaryState, counts, continuousReady)') < runBody.indexOf('authorizeNbaShadowSchedulerProviderBudget()'))
check('continuous filters event concentration before selection', service.includes('NBA_SHADOW_SCHEDULER_CONTINUOUS_EVENT_ROW_CAP') && service.includes('NBA_SHADOW_SCHEDULER_CONTINUOUS_EVENT_MARKET_ROW_CAP'))
check('cron cadence unchanged', cert.policy.schedulerWakeupCadenceChanged === false && doc.includes('*/30 * * * *'))
check('provider cost projection bounded', cert.simulation.proposedPolicy.providerCallsPerDay === 2 && cert.simulation.proposedPolicy.sevenDays.providerCalls === 14)
check('naive unrestricted risk documented', cert.simulation.naiveThirtyMinuteThreeRowsPerRun.providerCallsPerDay === 96)
check('isolation remains absolute', cert.isolation.officialPickDelta === 0 && cert.isolation.productVisibilityDelta === 0 && cert.isolation.historicalReplayDelta === 0 && cert.isolation.mlbMutationDelta === 0)
check('review made zero provider calls', cert.accounting.providerCallsFromReview === 0)
check('review made zero database mutations', cert.accounting.databaseMutationsFromReview === 0)
check('performance remains insufficient sample', cert.performanceReadiness === 'INSUFFICIENT_CURRENT_ERA_SETTLED_SAMPLE')
check('activation not automatic', cert.continuousShadowActivationReady === false)

const failed = checks.filter((item) => !item.pass)
if (failed.length) {
  console.error(`\nnba_03a_continuous_shadow_operating_policy_validate_v1 FAIL ${checks.length - failed.length}/${checks.length}`)
  process.exit(1)
}

console.log(`\nnba_03a_continuous_shadow_operating_policy_validate_v1 PASS ${checks.length}/${checks.length}`)
