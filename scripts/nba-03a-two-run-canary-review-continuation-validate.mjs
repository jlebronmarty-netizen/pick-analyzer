import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fixture-service-role-key'

const servicePath = 'src/services/nba-current-era-shadow-scheduler.service.ts'
const certPath = 'docs/CERTIFICATION/nba-03a-two-run-canary-review-continuation.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_TWO_RUN_CANARY_REVIEW_CONTINUATION.md'

const service = fs.readFileSync(servicePath, 'utf8')
const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')

const {
  NBA_SHADOW_SCHEDULER_REPAIRED_VERIFICATION_ENABLED_ENV,
  NBA_SHADOW_SCHEDULER_REPAIRED_VERIFICATION_RUN_PURPOSE,
  NBA_SHADOW_SCHEDULER_REPAIRED_VERIFICATION_RUN_LIMIT,
  runNbaShadowSchedulerPrecheckFixtures,
  simulateNbaShadowSchedulerBatchPersistence,
} = await import('../src/services/nba-current-era-shadow-scheduler.service.ts')

const fixtures = runNbaShadowSchedulerPrecheckFixtures()
const reviewRequired = fixtures.results.reviewRequired
const continuationReady = fixtures.results.repairedVerificationReady
const continuationComplete = fixtures.results.repairedVerificationComplete
const oneVerificationRun = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A', 'B', 'C'],
  outcomes: ['CREATED', 'ALREADY_EXISTS', 'CREATED'],
  completedRuns: 2,
  totalInsertedRows: 6,
})

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification ready for publication', cert.status === 'NBA_03A_REPAIRED_RUNTIME_VERIFICATION_CONTINUATION_CERTIFIED_READY_FOR_PUBLICATION')
check('existing two-run evidence accepted', cert.existingTwoRunCanary.operationallyValid === true && cert.existingTwoRunCanary.completedRuns === 2 && cert.existingTwoRunCanary.insertedRows === 6)
check('repaired runtime verification required', cert.repairedRuntimeVerificationRequired === true)
check('continuation env constant exists', NBA_SHADOW_SCHEDULER_REPAIRED_VERIFICATION_ENABLED_ENV === 'NBA_CURRENT_ERA_SHADOW_REPAIRED_VERIFICATION_ENABLED')
check('continuation run purpose constant exists', NBA_SHADOW_SCHEDULER_REPAIRED_VERIFICATION_RUN_PURPOSE === 'REPAIRED_RUNTIME_VERIFICATION_RUN')
check('continuation run limit exactly one', NBA_SHADOW_SCHEDULER_REPAIRED_VERIFICATION_RUN_LIMIT === 1 && cert.continuation.maxSuccessfulRuns === 1)
check('review required by default after two runs', reviewRequired.finalClassification === 'SCHEDULER_PRECHECK_REVIEW_REQUIRED' && reviewRequired.reviewRequired === true)
check('explicit continuation flag can reopen one run', continuationReady.finalClassification === 'SCHEDULER_PRECHECK_READY' && continuationReady.reviewRequired === false && continuationReady.repairedVerificationReady === true)
check('after one repaired verification run review returns', continuationComplete.finalClassification === 'SCHEDULER_PRECHECK_REVIEW_REQUIRED' && continuationComplete.reviewRequired === true)
check('original canary history retained', cert.continuation.preservesOriginalCanaryHistory === true && cert.continuation.resetsCurrentEraRows === false)
check('no deletion or audit rewrite', cert.continuation.rewritesHistoricalAuditRows === false && !service.includes('.delete('))
check('run purpose is persisted to audit metadata', service.includes('runPurpose') && service.includes('repairedVerificationRunsBefore'))
check('one verification run remains bounded to three selected candidates', oneVerificationRun.selectedCount === 3 && oneVerificationRun.persistenceAttempts === 3 && oneVerificationRun.inserted === 2 && oneVerificationRun.reused === 1)
check('no continuous scheduler activation', cert.continuousShadowSchedulerReady === false && doc.includes('does not activate continuous scheduling'))
check('provider budget unchanged', cert.bounds.maxTheOddsApiCalls === 2 && cert.bounds.sportsDataIoCalls === 0 && cert.bounds.historicalOddsCalls === 0)
check('isolation preserved', cert.isolation.officialPickDelta === 0 && cert.isolation.productVisibilityDelta === 0 && cert.isolation.historicalReplayDelta === 0 && cert.isolation.mlbMutationDelta === 0)
check('certification made zero provider calls and DB mutations', cert.accounting.providerCallsFromCertification === 0 && cert.accounting.productionDatabaseMutations === 0)

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_03a_two_run_canary_review_continuation_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
