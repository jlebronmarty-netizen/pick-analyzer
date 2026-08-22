import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key'

const SERVICE_PATH = 'src/services/mlb-04d-internal-context-expansion.service.ts'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04d-a-internal-context-expansion.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04D_A_INTERNAL_CONTEXT_EXPANSION.md'
const CONTEXT_SERVICE = 'src/services/mlb-context-lineage.service.ts'
const SCORECARD_SERVICE = 'src/services/mlb-04c-chat-method-research-scorecard.service.ts'
const PACKAGE_D_SERVICE = 'src/services/mlb-04d-forward-automation-prep.service.ts'
const STARTER_MIGRATION = 'supabase/migrations/202607260002_mlb_starter_assignments_v1.sql'
const LINEUP_MIGRATION = 'supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql'
const EVENT_MIGRATION = 'supabase/migrations/202607110001_nba_data_sync_v1.sql'

const {
  MLB_04D_A_CLASSIFICATION,
  auditMlb04dAInternalContextExpansion,
  getMlb04dAStarterSourceInventory,
  getMlb04dALineupSourceInventory,
  getMlb04dAVenueSourceInventory,
  runMlb04dAPackageAFixture,
} = await import('../src/services/mlb-04d-internal-context-expansion.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const contextService = fs.readFileSync(CONTEXT_SERVICE, 'utf8')
const scorecardService = fs.readFileSync(SCORECARD_SERVICE, 'utf8')
const packageDService = fs.readFileSync(PACKAGE_D_SERVICE, 'utf8')
const starterMigration = fs.readFileSync(STARTER_MIGRATION, 'utf8')
const lineupMigration = fs.readFileSync(LINEUP_MIGRATION, 'utf8')
const eventMigration = fs.readFileSync(EVENT_MIGRATION, 'utf8')

const audit = auditMlb04dAInternalContextExpansion()
const fixture = runMlb04dAPackageAFixture()
const starterInventory = getMlb04dAStarterSourceInventory()
const lineupInventory = getMlb04dALineupSourceInventory()
const venueInventory = getMlb04dAVenueSourceInventory()

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('classification', cert.classification === MLB_04D_A_CLASSIFICATION && audit.classification === MLB_04D_A_CLASSIFICATION)
check('observation 1 immutable', cert.observationRegression.observation1.regressionStable === true && doc.includes('Observation #1 remains frozen'))
check('observation 2 immutable', cert.observationRegression.observation2.regressionStable === true)
check('observation 3 immutable', cert.observationRegression.observation3.regressionStable === true)
check('no retrospective enrichment', cert.observationRegression.noRetrospectiveEnrichment === true && doc.includes('does not backfill, enrich, rescore or rewrite'))
check('starter assignment source exists', starterMigration.includes('create table if not exists mlb_starter_assignments') && starterInventory.some((row) => row.source === 'mlb_starter_assignments'))
check('starter source precedence', JSON.stringify(audit.starter.acquisitionPriority) === JSON.stringify(['mlb_starter_assignments', 'sport_lineups_starting_pitcher', 'stored_mlb_official_probable_pitcher_lineage']))
check('starter temporal safety', starterInventory.every((row) => row.sourceTimestamp && row.eventLinkage))
check('starter states explicit', ['CONFIRMED', 'PROBABLE', 'PROJECTED', 'UNKNOWN'].every((state) => audit.starter.stateContract.includes(state)))
check('starter missing behavior', audit.starter.edgeForwardReady === 'PARTIAL' && cert.starter.edgeForwardReady === 'PARTIAL')
check('morning final starter changes immutable', audit.starter.morningFinalChangeSemantics.includes('MORNING_IMMUTABLE'))
check('lineup table exists', lineupMigration.includes('create table if not exists sport_lineups') && lineupInventory.some((row) => row.source === 'sport_lineups'))
check('projected versus confirmed separated', audit.lineup.projectedLineupForwardReady === 'YES' && audit.lineup.confirmedLineupForwardReady === 'PARTIAL' && cert.lineup.projectedNeverConfirmed === true)
check('lineup temporal safety', lineupInventory.every((row) => row.sourceTimestamp && row.eventLinkage))
check('lineup player mapping', cert.lineup.sources.includes('stored_mlb_official_batting_order_lineage') && service.includes('provider_entity_mappings'))
check('missing lineup behavior', audit.lineup.edgeForwardReady === 'PARTIAL' && doc.includes('LINEUP_EDGE` remains partial'))
check('venue source exists', eventMigration.includes('venue text') && venueInventory.some((row) => row.source === 'sport_events.venue'))
check('venue mapping documented', audit.venue.parkIdentityForwardReady === 'YES' && cert.venue.parkIdentityForwardReady === 'YES')
check('park factor not fabricated', audit.venue.parkFactorForwardReady === 'NO' && cert.venue.parkFactorForwardReady === 'NO' && doc.includes('No certified park-factor source exists'))
check('context edge not falsely available', audit.venue.contextEdgeImpact.includes('NOT_CONTEXT_EDGE_AVAILABILITY') && cert.venue.contextEdgeImpact.includes('NOT_CONTEXT_EDGE_AVAILABILITY'))
check('splits audit only', audit.splits.splitEdgeForwardReady === 'AUDIT_ONLY' && cert.splits.splitEdgeForwardReady === 'AUDIT_ONLY')
check('frozen snapshot consumer', cert.frozenConsumer.scorecardReadsFrozenSnapshotNotLaterState === true && scorecardService.includes('evaluateMlb04cR6FrozenSnapshotScorecard'))
check('scorecard v2 preserved', cert.scorecardVersioning.scorecardV2Preserved === true && scorecardService.includes('MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2'))
check('v3 required before semantics change', audit.integration.scorecardV3Required.includes('YES_BEFORE_LINEUP_OR_CONTEXT_EDGE_SCORING_CHANGE'))
check('missing as null policy', cert.frozenConsumer.missingDataPolicy.includes('NULL') && cert.frozenConsumer.missingDataPolicy.includes('NO_NEUTRAL_ZERO'))
check('component bounds preserved', scorecardService.includes('clampScore') && fixture.componentCompleteness >= 0 && fixture.componentCompleteness <= 1)
check('fixture source snapshot scorecard parity', fixture.sourceToSnapshotToScorecard === 'PASS' && fixture.scorecardVersion === 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2')
check('lineup remains partial in fixture', fixture.lineupRemainsPartial === true)
check('context remains partial in fixture', fixture.contextRemainsPartial === true)
check('completeness projection conservative', cert.projectedCompleteness.currentRealCompleteness === 0.4286 && cert.projectedCompleteness.postPackageACompleteness === 0.5714)
check('package d compatible', audit.packageDCompatibility.compatible === true && packageDService.includes('MLB_04D_D_FORWARD_AUTOMATION_PREP_CERTIFIED'))
check('package d not scheduled', audit.packageDCompatibility.schedulerChanged === false && audit.packageDCompatibility.automationActivated === false)
check('raw isolation', cert.guards.rawModelChanged === false)
check('calibration isolation', cert.guards.calibratedModelChanged === false)
check('official pick isolation', cert.guards.officialPickWrites === 0)
check('product isolation', cert.guards.productWrites === 0)
check('learning isolation', cert.guards.learningWrites === 0)
check('settlement isolation', cert.guards.settlementWrites === 0)
check('sportsdataio exclusion', cert.guards.sportsDataIoExcluded === true && contextService.includes("sportsDataIO: 'excluded'"))
check('nfl nba isolation', cert.guards.nflIsolation === true && cert.guards.nbaIsolation === true)
check('no active cron changes in service', !service.includes('export async function GET') && !service.includes('export async function POST'))
check('no provider fetch in package a service', !/fetch\s*\(/.test(service) && !/axios\./.test(service))
check('no write query in package a service', !/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/.test(service))
check('provider calls zero', cert.guards.providerCallsMade === 0 && fixture.providerCallsMade === 0)
check('database mutations zero', cert.guards.productionDatabaseMutations === 0 && fixture.productionDatabaseMutations === 0)
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, doc, JSON.stringify(cert)].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_a_internal_context_expansion_validate',
  classification: MLB_04D_A_CLASSIFICATION,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  readiness: {
    starterIdentity: audit.starter.identityCaptureForwardReady,
    starterEdge: audit.starter.edgeForwardReady,
    projectedLineup: audit.lineup.projectedLineupForwardReady,
    confirmedLineup: audit.lineup.confirmedLineupForwardReady,
    parkIdentity: audit.venue.parkIdentityForwardReady,
    splitEdge: audit.splits.splitEdgeForwardReady,
  },
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
