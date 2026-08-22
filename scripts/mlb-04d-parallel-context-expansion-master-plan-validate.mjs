import fs from 'node:fs'

const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-parallel-context-expansion-master-plan.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_PARALLEL_CONTEXT_EXPANSION_MASTER_PLAN.md'
const CONTEXT_SERVICE = 'src/services/mlb-context-lineage.service.ts'
const SCORECARD_SERVICE = 'src/services/mlb-04c-chat-method-research-scorecard.service.ts'
const STARTER_MIGRATION = 'supabase/migrations/202607260002_mlb_starter_assignments_v1.sql'
const LINEUP_MIGRATION = 'supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql'
const BASE_MIGRATION = 'supabase/migrations/202607110001_nba_data_sync_v1.sql'
const MARKET_SERVICE = 'src/services/universal-market-intelligence.service.ts'

const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const contextService = fs.readFileSync(CONTEXT_SERVICE, 'utf8')
const scorecardService = fs.readFileSync(SCORECARD_SERVICE, 'utf8')
const starterMigration = fs.readFileSync(STARTER_MIGRATION, 'utf8')
const lineupMigration = fs.readFileSync(LINEUP_MIGRATION, 'utf8')
const baseMigration = fs.readFileSync(BASE_MIGRATION, 'utf8')
const marketService = fs.readFileSync(MARKET_SERVICE, 'utf8')

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const tracks = cert.tracks ?? {}
const packages = cert.packages ?? {}
const gates = cert.successGates ?? {}
const safety = cert.safetyCounters ?? {}

check('classification certified', cert.classification === 'MLB_04D_PARALLEL_CONTEXT_EXPANSION_MASTER_PLAN_CERTIFIED')
check('baseline commit locked', cert.baseline?.commit === '337bea82207874302ff2834ad7e338f69ab28493')
check('current completeness preserved', cert.baseline?.currentRealCompleteness?.value === 0.4286)
check('observation 1 frozen', cert.observationFreezeState?.observation1?.retrospectiveEnrichmentAllowed === false)
check('observation 2 frozen', cert.observationFreezeState?.observation2?.retrospectiveEnrichmentAllowed === false)
check('observation 3 frozen', cert.observationFreezeState?.observation3?.snapshotId === 'c0fda54f-a8b3-45d2-8994-efcd9e415e7d' && cert.observationFreezeState?.observation3?.retrospectiveEnrichmentAllowed === false)
check('starter table exists', starterMigration.includes('create table if not exists mlb_starter_assignments'))
check('starter active versioning exists', starterMigration.includes('valid_until') && starterMigration.includes('valid_from') && starterMigration.includes('source_updated_at'))
check('starter statuses support expected states', starterMigration.includes("'CONFIRMED'") && starterMigration.includes("'PROBABLE'") && starterMigration.includes("'EXPECTED'"))
check('context service reads starter assignments', contextService.includes('loadStarterAssignments') && contextService.includes('mlb_starter_assignments'))
check('official probable pitcher path exists', contextService.includes('probablePitchers') && contextService.includes('mlb_stats_api_schedule_hydrate_probablePitcher'))
check('lineup storage exists', lineupMigration.includes('create table if not exists sport_lineups') && lineupMigration.includes('lineup_type'))
check('lineup source states separated', lineupMigration.includes("'confirmed'") && lineupMigration.includes("'projected'") && contextService.includes('LINEUP_PROJECTED_NOT_CONFIRMED'))
check('splits fail closed', tracks.C_SPLITS_HANDEDNESS?.splitEdgeForwardReady === 'NO')
check('park venue identity path exists', contextService.includes('mlb_stats_api_schedule_venue') && contextService.includes('PARK_IDENTITY_UNAVAILABLE'))
check('weather provider blocked', tracks.E_WEATHER?.providerDecision === 'WEATHER_PROVIDER_REQUIRED' && contextService.includes('WEATHER_CONTEXT_REQUIRES_APPROVED_PROVIDER'))
check('injury source blocked without fabrication', tracks.F_INJURIES?.sourceDecision === 'NO_APPROVED_SOURCE' && contextService.includes('INJURY_CONTEXT_UNAVAILABLE_FROM_APPROVED_SOURCE'))
check('injury table exists', baseMigration.includes('create table if not exists sport_injuries'))
check('pitcher props production blocked', Object.values(tracks.G_PITCHER_PROP_FOUNDATION?.readinessMatrix ?? {}).every((row) => row.PRODUCTION_READY === 'NO'))
check('first inning market remains blocked', marketService.includes("canonicalMarketKey: 'first_inning'") && marketService.includes("settlementSupport: 'BLOCKED'"))
check('nrfi yrfi production blocked', tracks.H_NRFI_YRFI_FOUNDATION?.readinessMatrix?.PRODUCTION_READY === 'NO')
check('forward continuity checkpoints retained', JSON.stringify(tracks.I_FORWARD_OBSERVATION_CONTINUITY?.cohortCheckpoints) === JSON.stringify([5, 10, 25, 50, 100]))
check('scorecard v2 unchanged', scorecardService.includes("MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2") && cert.integration?.scorecardV3Required.includes('NO_FOR_MASTER_PLAN'))
check('package A partial', packages.PACKAGE_A_INTERNAL_CONTEXT?.readiness === 'PARTIAL')
check('package B external dependency', packages.PACKAGE_B_EXTERNAL_CONTEXT?.readiness === 'EXTERNAL_DEPENDENCY')
check('package C audit only', packages.PACKAGE_C_MARKET_EXPANSION_FOUNDATION?.readiness === 'AUDIT_ONLY')
check('package D ready', packages.PACKAGE_D_FORWARD_AUTOMATION?.readiness === 'READY_TO_IMPLEMENT')
check('all tracks audited', gates.ALL_TRACKS_AUDITED === true && Object.keys(tracks).length === 9)
check('parallel package plan ready', gates.PARALLEL_PACKAGE_PLAN_READY === true)
check('internal path ready', gates.INTERNAL_IMPLEMENTATION_PATH_READY === true)
check('external dependencies identified', gates.EXTERNAL_DEPENDENCIES_IDENTIFIED === true)
check('prop nrfi dependency map ready', gates.PROP_NRFI_DEPENDENCY_MAP_READY === true)
check('forward capture continuity preserved', gates.FORWARD_CAPTURE_CONTINUITY_PRESERVED === true)
check('no retrospective enrichment', gates.NO_RETROSPECTIVE_ENRICHMENT === true && doc.includes('does not enrich Observation #1, Observation #2 or Observation #3'))
check('production model unchanged', gates.PRODUCTION_MODEL_CHANGED === false)
check('provider calls zero', safety.providerCallsMade === 0)
check('production database mutations zero', safety.productionDatabaseMutations === 0)
check('all write counters zero', [
  'predictionWrites',
  'currentEraShadowWrites',
  'chatResearchPredictionWrites',
  'officialPickWrites',
  'settlementWrites',
  'learningWrites',
  'calibrationWrites',
  'productWrites',
  'bankrollWrites',
  'notificationWrites',
].every((key) => safety[key] === 0))
check('sportsdataio not reintroduced', doc.includes('SportsDataIO reintroduction: `NO`') && contextService.includes("sportsDataIO: 'excluded'"))
check('completion estimates conservative', cert.completionEstimates?.mlbCore?.value === 97 && cert.completionEstimates?.mlbFullVision?.value === 80)
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([doc, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_parallel_context_expansion_master_plan_validate',
  classification: cert.classification,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
