import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fixture-service-role-key'

const schedulerPath = 'src/services/nba-current-era-shadow-scheduler.service.ts'
const canaryPath = 'src/services/nba-current-era-shadow-canary.service.ts'
const certPath = 'docs/CERTIFICATION/nba-03a-shadow-scheduler-run2-cardinality-repair.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_SHADOW_SCHEDULER_RUN2_CARDINALITY_REPAIR.md'

const scheduler = fs.readFileSync(schedulerPath, 'utf8')
const canary = fs.readFileSync(canaryPath, 'utf8')
const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')

const {
  NBA_SHADOW_SCHEDULER_PER_RUN_CAP,
  simulateNbaShadowSchedulerBatchPersistence,
  runNbaShadowSchedulerPrecheckFixtures,
} = await import('../src/services/nba-current-era-shadow-scheduler.service.ts')

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const zero = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: [],
  outcomes: [],
  completedRuns: 1,
  totalInsertedRows: 3,
})
const one = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A'],
  outcomes: ['CREATED'],
  completedRuns: 1,
  totalInsertedRows: 3,
})
const three = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A', 'B', 'C'],
  outcomes: ['CREATED', 'CREATED', 'CREATED'],
  completedRuns: 1,
  totalInsertedRows: 3,
})
const overCap = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A', 'B', 'C', 'D', 'E'],
  outcomes: ['CREATED', 'CREATED', 'CREATED', 'CREATED', 'CREATED'],
  completedRuns: 1,
  totalInsertedRows: 3,
})
const allReused = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A', 'B', 'C'],
  outcomes: ['ALREADY_EXISTS', 'ALREADY_EXISTS', 'ALREADY_EXISTS'],
  completedRuns: 1,
  totalInsertedRows: 3,
})
const partialFailure = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A', 'B', 'C'],
  outcomes: ['CREATED', 'WRITE_CARDINALITY_NOT_ONE', 'CREATED'],
  completedRuns: 1,
  totalInsertedRows: 3,
})
const staleFailure = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A', 'B', 'C'],
  outcomes: ['CREATED', 'STALE_ODDS', 'CREATED'],
  completedRuns: 1,
  totalInsertedRows: 3,
})
const repeated = simulateNbaShadowSchedulerBatchPersistence({
  selectedCandidateKeys: ['A', 'B', 'C'],
  outcomes: ['ALREADY_EXISTS', 'ALREADY_EXISTS', 'ALREADY_EXISTS'],
  completedRuns: 2,
  totalInsertedRows: 6,
})
const precheck = runNbaShadowSchedulerPrecheckFixtures()

check('certification status ready for publication', cert.status === 'NBA_03A_SHADOW_SCHEDULER_RUN2_CARDINALITY_REPAIR_CERTIFIED_READY_FOR_PUBLICATION')
check('writer cardinality remains exact candidate key', canary.includes('selected.length === 1') && canary.includes("'WRITE_CARDINALITY_NOT_ONE'"))
check('writer does not silently accept multiple candidates', canary.includes("selected.length === 1 ? selected[0]! : null"))
check('already persisted exact candidate is idempotent reuse', canary.includes("singleCandidate.skipReasons.includes('ALREADY_EXISTS')") && canary.includes("reused = 1"))
check('scheduler still invokes write-one semantics', scheduler.includes("mode: 'write-one'") && !scheduler.includes("mode: 'write'"))
check('scheduler loops selected candidates independently', scheduler.includes('for (const candidate of selection.selected.slice(0, NBA_SHADOW_SCHEDULER_PER_RUN_CAP))'))
check('scheduler records per-candidate persistence results', scheduler.includes('persistenceResults') && scheduler.includes('selectedCandidateKeys'))
check('per-run cap unchanged', NBA_SHADOW_SCHEDULER_PER_RUN_CAP === 3 && cert.bounds.perRunCap === 3)
check('zero selected attempts zero writes', zero.persistenceAttempts === 0 && zero.classification === 'NO_ELIGIBLE_CANDIDATE_NO_OP')
check('one selected one write-one operation', one.persistenceAttempts === 1 && one.inserted === 1)
check('three selected three bounded operations', three.persistenceAttempts === 3 && three.inserted === 3)
check('upstream over-cap bounded to three', overCap.selectedCount === 3 && overCap.persistenceAttempts === 3 && overCap.inserted === 3)
check('all existing rows idempotently reuse', allReused.inserted === 0 && allReused.reused === 3 && allReused.classification === 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_SUCCESS')
check('partial failure is explicit and keeps prior success auditable', partialFailure.classification === 'PERSISTENCE_FAILURE_BLOCKED' && partialFailure.inserted === 1 && partialFailure.successfulPriorWritesRemain === true)
check('stale revalidation failure blocks safely', staleFailure.classification === 'PERSISTENCE_FAILURE_BLOCKED' && staleFailure.failed?.status === 'STALE_ODDS')
check('repeated run creates zero new logical rows', repeated.inserted === 0 && repeated.reused === 3)
check('successful second run triggers review semantics', three.completedRunsAfter === 2 && three.reviewRequiredAfter === true && precheck.results.reviewRequired.finalClassification === 'SCHEDULER_PRECHECK_REVIEW_REQUIRED')
check('failed run does not trigger review', partialFailure.completedRunsAfter === 1 && partialFailure.reviewRequiredAfter === false)
check('unsafe bulk writer inaccessible', cert.architecture.unsafeBulkWriterAccessible === false && doc.includes('No unsafe bulk writer'))
check('provider budget semantics unchanged', cert.providerBudget.theOddsApiMaxCallsPerRun === 2 && cert.providerBudget.sportsDataIoCalls === 0 && cert.providerBudget.historicalOddsCalls === 0)
check('production certification made zero provider calls', cert.accounting.providerCallsFromCertification === 0)
check('production certification made zero DB mutations', cert.accounting.productionDatabaseMutations === 0)
check('isolation preserved', cert.isolation.officialPickDelta === 0 && cert.isolation.productVisibilityDelta === 0 && cert.isolation.historicalReplayDelta === 0 && cert.isolation.mlbMutationDelta === 0)

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_03a_shadow_scheduler_run2_cardinality_repair_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
