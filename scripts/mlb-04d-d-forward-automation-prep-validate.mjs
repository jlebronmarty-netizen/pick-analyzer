import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-forward-automation-prep.service.ts'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-d-forward-automation-prep.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_D_FORWARD_AUTOMATION_PREP.md'
const VERCEL_PATH = 'vercel.json'
const SCORECARD_SERVICE = 'src/services/mlb-04c-chat-method-research-scorecard.service.ts'
const SNAPSHOT_SERVICE = 'src/services/mlb-04b-research-snapshot-runtime.service.ts'

const {
  MLB_04D_D_CLASSIFICATION,
  buildMlb04dForwardResearchLedgerIdentity,
  getMlb04dForwardAutomationContract,
  getMlb04dSchedulerInventory,
  runMlb04dForwardAutomationFixture,
  runMlb04dRepeatedPassFixture,
  gradeMlb04dMarketResult,
  evaluateMlb04dResearchResult,
} = await import('../src/services/mlb-04d-forward-automation-prep.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const vercel = fs.readFileSync(VERCEL_PATH, 'utf8')
const scorecardService = fs.readFileSync(SCORECARD_SERVICE, 'utf8')
const snapshotService = fs.readFileSync(SNAPSHOT_SERVICE, 'utf8')

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const contract = getMlb04dForwardAutomationContract()
const inventory = getMlb04dSchedulerInventory()
const fixture = runMlb04dForwardAutomationFixture()
const repeated = runMlb04dRepeatedPassFixture()
const totalWin = gradeMlb04dMarketResult({
  market: 'total',
  selection: 'Under',
  line: 8.5,
  homeTeam: 'Fixture Home',
  awayTeam: 'Fixture Away',
  homeScore: 3,
  awayScore: 4,
})
const metrics = evaluateMlb04dResearchResult({
  marketResult: totalWin,
  odds: -110,
  rawProbability: 0.54,
  calibratedProbability: 0.56,
  chatMethodScore: 0.2,
})
const identity = buildMlb04dForwardResearchLedgerIdentity({
  sport: 'baseball_mlb',
  eventId: 'event-1',
  snapshotType: 'FINAL_PREGAME',
  snapshotId: 'snapshot-1',
  market: 'total',
  selection: 'Under',
  line: 8.5,
  sportsbook: 'FanDuel',
})

check('classification', cert.classification === MLB_04D_D_CLASSIFICATION && fixture.classification === MLB_04D_D_CLASSIFICATION)
check('active cron not added', contract.activeCronRegistered === false && contract.autonomousExecutionEnabled === false)
check('vercel cron unchanged', vercel.includes('/api/cron/operating-day') && vercel.includes('/api/cron/nba-current-era-shadow') && !vercel.includes('mlb-forward-research'))
check('scheduler inventory complete', inventory.length >= 7 && inventory.some((row) => row.job === 'vercel_operating_day_primary') && inventory.every((row) => row.providerUsage))
check('lifecycle states complete', contract.lifecycleStates.includes('MORNING_CAPTURED') && contract.lifecycleStates.includes('RESEARCH_EVALUATED'))
check('fail closed states complete', contract.failClosedStates.includes('SCORECARD_NOT_PAIRABLE') && contract.failClosedStates.includes('LEDGER_STORAGE_NOT_DEPLOYED'))
check('morning reuses mlb04b', contract.scheduling.morning.sourcePolicy.includes('MLB-04B MORNING') && snapshotService.includes("Mlb04bSnapshotType = 'MORNING' | 'FINAL_PREGAME'"))
check('final pregame reuses mlb04b', contract.scheduling.finalPregame.sourcePolicy.includes('MLB-04B FINAL_PREGAME'))
check('queue based policy', contract.scheduling.multiEventExecutionPolicy === 'QUEUE_BASED' && cert.schedulingContracts.multiEventExecutionPolicy === 'QUEUE_BASED')
check('kill switches default false', cert.authorization.defaultEnabled === false && ['MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED', 'MLB_MORNING_CAPTURE_ENABLED', 'MLB_FINAL_PREGAME_CAPTURE_ENABLED', 'MLB_RESEARCH_RESULT_EVALUATION_ENABLED'].every((name) => service.includes(name)))
check('provider budget zero', contract.providerBudget.currentPhaseProviderCalls === 0 && cert.providerBudget.currentPhaseProviderCalls === 0)
check('sportsdataio forbidden', contract.providerBudget.sportsDataIo.allowed === false && cert.providerBudget.sportsDataIoAllowed === false)
check('r6 context fields preserved', ['starterContext', 'offenseRecentFormContext', 'bullpenDirectionalInputs'].every((field) => doc.includes(field) && service.includes(field)))
check('v2 scorecard consumer', contract.contextCompatibility.scorecardVersion === 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2' && scorecardService.includes('evaluateMlb04cR6FrozenSnapshotScorecard'))
check('ledger additive not migrated', cert.ledgerStorage.migrationApplied === false && contract.ledgerStorageDecision.decision === 'NEW_ADDITIVE_RESEARCH_LEDGER_TABLE_REQUIRED_BEFORE_ACTIVATION')
check('ledger exact identity includes line', identity.includes('|8.5|') && fixture.fixture.ledgerIdentityIncludesExactLine === true)
check('result detection stored only', contract.resultDetection.providerCalls === 0 && contract.resultDetection.sourceTables.includes('game_results'))
check('research settlement semantics', totalWin === 'WIN' && fixture.fixture.marketResult === 'WIN')
check('metrics computed for raw/calibrated only', metrics.rawBrier === 0.2116 && metrics.calibratedBrier === 0.1936 && cert.resultEvaluation.chatBrierOrLogLossAllowed === false)
check('cohort checkpoints', JSON.stringify(contract.cohortMetrics.checkpoints) === JSON.stringify([5, 10, 25, 50, 100]))
check('accuracy claim guarded', cert.cohortMetrics.accuracyClaimReady === false && doc.includes('must not be marketed as accuracy'))
check('scorecard versions segmented', cert.cohortMetrics.versionSegmentationRequired === true && service.includes('MLB_04C_SCORECARD_VERSION') && service.includes('MLB_04C_R4_SCORECARD_VERSION'))
check('observations frozen', cert.observationFreezeState.retrospectiveEnrichment === false && doc.includes('Observations #1, #2 and #3 remain frozen'))
check('product isolated', cert.productIsolation.recommendedPick === false && cert.productIsolation.officialPickWrites === 0)
check('learning calibration isolated', cert.learningCalibrationIsolation.learningWrites === 0 && cert.learningCalibrationIsolation.calibrationWrites === 0)
check('fixture lifecycle proof', fixture.fixture.lifecycle.includes('RESEARCH_EVALUATED') && fixture.fixture.providerCalls === 0 && fixture.fixture.dbMutations === 0)
check('repeated pass idempotent', repeated.idempotencyPass === true && repeated.duplicateLedgerRows === 0)
check('package compatibility retained', Object.values(contract.packageCompatibility).every((value) => typeof value === 'string' && value.length > 0))
check('all safety counters zero', Object.values(cert.safetyCounters).every((value) => value === 0))
check('no route handler added', !service.includes('export async function GET') && !service.includes('export async function POST'))
check('no provider fetch in package d service', !/fetch\s*\(/.test(service) && !/axios\./.test(service))
check('no write query in package d dry-run', !/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/.test(service))
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([doc, JSON.stringify(cert), service].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d_forward_automation_prep_validate',
  classification: MLB_04D_D_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  fixtureResult: {
    marketResult: fixture.fixture.marketResult,
    scorecardVersion: fixture.fixture.scorecardVersion,
    duplicateLedgerRows: repeated.duplicateLedgerRows,
  },
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
