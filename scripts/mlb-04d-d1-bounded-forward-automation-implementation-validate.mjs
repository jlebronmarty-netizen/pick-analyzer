import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-d1-forward-automation-planner.service.ts'
const PREP_SERVICE_PATH = 'src/services/mlb-04d-forward-automation-prep.service.ts'
const PACKAGE_A_SERVICE_PATH = 'src/services/mlb-04d-internal-context-expansion.service.ts'
const SNAPSHOT_SERVICE_PATH = 'src/services/mlb-04b-research-snapshot-runtime.service.ts'
const SCORECARD_SERVICE_PATH = 'src/services/mlb-04c-chat-method-research-scorecard.service.ts'
const MIGRATION_PATH = 'supabase/migrations/202608230001_mlb_forward_research_ledger_v1.sql'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d1-bounded-forward-automation-implementation.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_D1_BOUNDED_FORWARD_AUTOMATION_IMPLEMENTATION.md'
const VERCEL_PATH = 'vercel.json'

const {
  MLB_04D_D1_CLASSIFICATION,
  auditMlb04dD1ForwardAutomationImplementation,
  buildMlb04dD1ForwardLedgerLogicalIdentity,
  getMlb04dD1CohortMetricContract,
  getMlb04dD1ForwardLedgerMigrationState,
  getMlb04dD1ForwardLedgerRuntimeContract,
  runMlb04dD1FailureIsolationFixture,
  runMlb04dD1FixturePlanner,
  runMlb04dD1IdempotencyFixture,
} = await import('../src/services/mlb-04d-d1-forward-automation-planner.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const prepService = fs.readFileSync(PREP_SERVICE_PATH, 'utf8')
const packageAService = fs.readFileSync(PACKAGE_A_SERVICE_PATH, 'utf8')
const snapshotService = fs.readFileSync(SNAPSHOT_SERVICE_PATH, 'utf8')
const scorecardService = fs.readFileSync(SCORECARD_SERVICE_PATH, 'utf8')
const migration = fs.readFileSync(MIGRATION_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const vercel = fs.readFileSync(VERCEL_PATH, 'utf8')

const audit = auditMlb04dD1ForwardAutomationImplementation()
const dryRun = runMlb04dD1FixturePlanner('DRY_RUN')
const preview = runMlb04dD1FixturePlanner('PREVIEW')
const execute = runMlb04dD1FixturePlanner('EXECUTE')
const idempotency = runMlb04dD1IdempotencyFixture()
const failure = runMlb04dD1FailureIsolationFixture()
const ledgerContract = getMlb04dD1ForwardLedgerRuntimeContract()
const migrationState = getMlb04dD1ForwardLedgerMigrationState()
const cohorts = getMlb04dD1CohortMetricContract()
const exactLineIdentity = buildMlb04dD1ForwardLedgerLogicalIdentity({
  eventId: 'event-1',
  snapshotId: 'snapshot-1',
  snapshotType: 'FINAL_PREGAME',
  market: 'total',
  selection: 'Under',
  line: 8.5,
  sportsbook: 'FanDuel',
})

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('classification', audit.classification === MLB_04D_D1_CLASSIFICATION && cert.classification === MLB_04D_D1_CLASSIFICATION)
check('package d baseline', audit.baseline.forwardResearchStateMachineReady === true && audit.baseline.queueBasedPolicyPreserved === true && prepService.includes('MLB_04D_D_FORWARD_AUTOMATION_PREP_CERTIFIED'))
check('automation not activated', audit.guards.activeCronAdded === false && audit.guards.schedulerActivation === false && cert.automationActivated === false)
check('vercel cron unchanged', vercel.includes('/api/cron/operating-day') && !vercel.includes('mlb-forward-research'))
check('package a compatible', audit.packageAIntegration.compatible === true && packageAService.includes('MLB_04D_A_INTERNAL_CONTEXT_EXPANSION_CERTIFIED'))
check('planner modes', dryRun.execution.dryRunDefault === true && preview.execution.dryRunDefault === true && execute.execution.executeBlockedReason === 'EXECUTE_UNAVAILABLE_IN_MLB_04D_D1_DEFAULT_OFF_PHASE')
check('kill switches default false', cert.killSwitches.defaultEnabled === false && cert.killSwitches.names.every((name) => service.includes(name)))
check('morning planner', dryRun.summary.morning_eligible >= 1 && dryRun.events.some((event) => event.morning.action === 'WOULD_INSERT'))
check('final planner', dryRun.summary.final_eligible >= 1 && dryRun.events.some((event) => event.finalPregame.action === 'WOULD_INSERT'))
check('queue ordering', dryRun.queuePolicy === 'QUEUE_BASED' && dryRun.events.every((event, index) => event.queuePosition === index + 1))
check('snapshot identity reuses mlb04b', service.includes('buildMlb04bDeterministicSnapshotKey') && snapshotService.includes('buildMlb04bDeterministicSnapshotKey'))
check('snapshot identity states', dryRun.events.some((event) => event.finalPregame.action === 'REUSE_NO_OP') && failure.duplicateIdentityBlocksOnlyAffectedEvent)
check('scorecard planner', dryRun.events.some((event) => event.scorecard.action === 'READY') && dryRun.events.every((event) => event.scorecard.probabilityOutput === false))
check('frozen v2 scorecard consumer preserved', scorecardService.includes('MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2') && service.includes('MLB_04C_R4_SCORECARD_VERSION'))
check('package a context components', ['STARTER_EDGE', 'OFFENSE_EDGE', 'BULLPEN_EDGE', 'LINEUP_EDGE', 'SPLIT_EDGE', 'CONTEXT_EDGE', 'MARKET_VALUE'].every((key) => service.includes(key)))
check('missing not zero', Object.values(ledgerContract.component_values).every((value) => value === null))
check('projected lineup not confirmed', doc.includes('Projected lineup must not become confirmed') || service.includes('LINEUP_EDGE'))
check('park identity not context edge', doc.includes('Park identity') && doc.includes('CONTEXT_EDGE'))
check('ledger runtime contract', cert.forwardLedger.runtimeContractReady === true && Object.keys(ledgerContract).includes('observation_id') && Object.keys(ledgerContract).includes('chat_directional_result'))
check('ledger exact-line identity', exactLineIdentity.includes('|8.5|') && exactLineIdentity.includes('|total|'))
check('ledger migration ready not applied', migrationState.ready === true && migrationState.applied === false && cert.forwardLedger.migrationApplied === false)
check('ledger migration additive table', migration.includes('create table if not exists public.mlb_forward_research_ledger') && migration.includes('enable row level security'))
check('ledger migration service role only', migration.includes('to service_role') && migration.includes('revoke all') && !migration.includes('to authenticated'))
check('no learning calibration trigger', !/create\s+trigger/i.test(migration) && cert.forwardLedger.learningCalibrationTriggers === false)
check('result authority stored only', audit.resultAuthority.sourceTables.includes('game_results') && audit.resultAuthority.providerCalls === 0)
check('result evaluation planner', dryRun.events.every((event) => event.resultEvaluation.ready === false || event.resultEvaluation.rawBrier !== null))
check('cohort metrics', JSON.stringify(cohorts.checkpoints) === JSON.stringify([5, 10, 25, 50, 100]) && cohorts.segments.includes('scorecard_version'))
check('no accuracy claim', cohorts.accuracyClaimReady === false && cohorts.eightyPercentClaimForbidden === true && doc.includes('must not be called accuracy'))
check('observation freeze', audit.observationFreeze.observation1 === 'UNCHANGED' && audit.observationFreeze.noRetrospectiveEnrichment === true)
check('idempotency', idempotency.identicalLogicalPlan === true && idempotency.duplicateSnapshots === 0 && idempotency.duplicateLedgers === 0)
check('failure isolation', failure.oneBadEventDoesNotFailAll === true && failure.duplicateIdentityBlocksOnlyAffectedEvent === true && failure.temporalViolationBlocksAffectedEvent === true)
check('observability fields', ['run_id', 'mode', 'started_at', 'completed_at', 'events_scanned', 'provider_calls', 'db_mutations', 'duration_ms'].every((field) => Object.keys(dryRun.summary).includes(field)))
check('security', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, doc, JSON.stringify(cert), migration].join('\n')))
check('package b c compatibility', audit.packageBCCompatibility.weatherInjuries.includes('no provider') && audit.packageBCCompatibility.propsNrfiYrfi.includes('no activation'))
check('provider calls zero', audit.guards.providerCallsMade === 0 && dryRun.providerCallsMade === 0)
check('db mutations zero', audit.guards.productionDatabaseMutations === 0 && dryRun.productionDatabaseMutations === 0)
check('all write counters zero', Object.values(dryRun.writeCounters).every((value) => value === 0) && Object.values(cert.safetyCounters).every((value) => value === 0))
check('raw calibration product isolation', audit.guards.rawModelChanged === false && audit.guards.calibrationChanged === false && audit.guards.productOfficialPickChanged === false)
check('learning settlement isolation', audit.guards.learningSettlementChanged === false)
check('sportsdataio exclusion', audit.guards.sportsDataIoExcluded === true && !service.includes('sportsdataio'))
check('nfl nba isolation', audit.guards.nflIsolation === true && audit.guards.nbaIsolation === true)
check('no route handler added', !service.includes('export async function GET') && !service.includes('export async function POST'))
check('no provider fetch in d1 service', !/fetch\s*\(/.test(service) && !/axios\./.test(service))
check('no write query in d1 service', !/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/.test(service))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d1_bounded_forward_automation_implementation_validate',
  classification: MLB_04D_D1_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  dryRunSummary: dryRun.summary,
  readiness: audit.readiness,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
