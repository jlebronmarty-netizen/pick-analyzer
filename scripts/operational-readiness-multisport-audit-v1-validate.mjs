import fs from 'node:fs'

const audit = JSON.parse(fs.readFileSync('docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.json', 'utf8'))
const coverage = JSON.parse(fs.readFileSync('docs/MULTI_SPORT_CURRENT_PREVIOUS_SEASON_COVERAGE_V1.json', 'utf8'))
const matrix = JSON.parse(fs.readFileSync('docs/MULTI_SPORT_PRODUCTION_READINESS_MATRIX_V1.json', 'utf8'))

const docs = [
  'docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.md',
  'docs/ODDS_API_EXTRACTION_COMPLETENESS_V1.md',
  'docs/ODDS_REFRESH_5_10_MINUTE_FEASIBILITY_V1.md',
  'docs/DAILY_AUTONOMY_CERTIFICATION_V1.md',
  'docs/OPERATIONAL_LAUNCH_REPAIR_ROADMAP_V1.md',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(audit.success === true, 'audit must succeed')
assert(audit.readOnly === true, 'audit must be read-only')
assert(audit.providerCallsMade === 0, 'provider calls must be zero')
assert(audit.databaseMutations === 0, 'database mutations must be zero')
assert(audit.productionMutations === 0, 'production mutations must be zero')
assert(audit.predictionWrites === 0, 'prediction writes must be zero')
assert(audit.settlementWrites === 0, 'settlement writes must be zero')
assert(audit.learningWrites === 0, 'learning writes must be zero')
assert(audit.modelTrainingRuns === 0, 'model training must be zero')
assert(audit.modelWeightMutations === 0, 'model weights must remain unchanged')
assert(audit.epochMutations === 0, 'epochs must remain unchanged')
assert(audit.executiveVerdict.canPlatformOperateDailyNow === 'PARTIAL_MLB_ONLY', 'platform verdict must be partial MLB only')
assert(audit.executiveVerdict.automaticTrainingStatus === 'DISABLED_AND_NOT_AUTHORIZED', 'automatic training must be disabled')
assert(audit.pipeline.length >= 10, 'pipeline must cover operating flow')
assert(audit.sports.length === 8, 'all 8 requested sports must be audited')

const bySport = Object.fromEntries(matrix.readinessMatrix.map((row) => [row.sport, row]))
assert(bySport.MLB.state === 'PRODUCTION_READY', 'MLB must be classified production ready for core workflow')
assert(bySport.NFL.state === 'PREVIEW_READY', 'NFL must remain preview')
assert(bySport.NHL.state === 'PREVIEW_READY', 'NHL must remain preview')
assert(bySport.Tennis.state === 'UNAVAILABLE', 'Tennis must remain unavailable')
assert(bySport.MLB.events > 0, 'MLB events required')
assert(bySport.MLB.currentOdds > 0, 'MLB odds required')
assert(bySport.MLB.features > 0, 'MLB features required')
assert(bySport.MLB.settlement > 0, 'MLB settlement evidence required')

assert(audit.oddsApiCompleteness.allAvailableDataDownloaded === false, 'must not overclaim all Odds API data')
assert(audit.oddsApiCompleteness.completePreviousSeasonEverySupportedSport === false, 'must not overclaim previous-season completeness')
assert(audit.oddsApiCompleteness.completeCurrentSeasonEverySupportedSport === false, 'must not overclaim current-season completeness')
assert(audit.refreshScenarios.length === 5, 'five refresh scenarios required')
assert(audit.refreshScenarios.some((row) => row.scenario === 'E_ADAPTIVE_REFRESH' && row.budgetSustainability === 'BEST_SAFE_POLICY'), 'adaptive refresh recommendation required')
assert(audit.repairRoadmap.length >= 6, 'repair roadmap priorities required')
assert(coverage.success === true, 'coverage artifact must succeed')
assert(coverage.providerCallsMade === 0, 'coverage provider calls must be zero')
assert(matrix.success === true, 'readiness matrix must succeed')
assert(matrix.providerCallsMade === 0, 'matrix provider calls must be zero')
assert(typeof audit.fingerprint === 'string' && audit.fingerprint.length === 64, 'audit fingerprint required')

for (const doc of docs) {
  const text = fs.readFileSync(doc, 'utf8')
  assert(text.includes('No provider calls'), `${doc} must include no-provider-call guardrail`)
  assert(text.includes('No production mutation'), `${doc} must include no-production-mutation guardrail`)
}

for (const marker of [
  'OPERATIONAL_READINESS_AUDIT_PASS',
  'MULTI_SPORT_DATA_COVERAGE_AUDIT_PASS',
  'CURRENT_PREVIOUS_SEASON_COVERAGE_AUDIT_PASS',
  'ODDS_API_EXTRACTION_COMPLETENESS_AUDIT_PASS',
  'MULTI_SPORT_PREDICTION_READINESS_AUDIT_PASS',
  'DAILY_AUTONOMY_AUDIT_PASS',
  'ODDS_REFRESH_FEASIBILITY_AUDIT_PASS',
  'RESULT_SETTLEMENT_LEARNING_LOOP_AUDIT_PASS',
  'MULTI_SPORT_PRODUCTION_READINESS_MATRIX_PASS',
  'NO_PROVIDER_CALL_PASS',
  'NO_PRODUCTION_MUTATION_PASS',
  'NO_PREDICTION_WRITE_PASS',
  'NO_SETTLEMENT_WRITE_PASS',
  'NO_MODEL_TRAINING_PASS',
  'NO_MODEL_WEIGHT_MUTATION_PASS',
  'NO_EPOCH_ACTIVATION_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  assert(audit.certificationMarkers.includes(marker), `missing marker ${marker}`)
}

console.log(JSON.stringify({
  success: true,
  mode: 'operational_readiness_multisport_audit_v1_validation',
  platformVerdict: audit.executiveVerdict.canPlatformOperateDailyNow,
  sportsAudited: audit.sports.length,
  mlbState: bySport.MLB.state,
  nflState: bySport.NFL.state,
  nhlState: bySport.NHL.state,
  providerCallsMade: audit.providerCallsMade,
  databaseMutations: audit.databaseMutations,
  predictionWrites: audit.predictionWrites,
  settlementWrites: audit.settlementWrites,
  modelTrainingRuns: audit.modelTrainingRuns,
  fingerprint: audit.fingerprint,
}, null, 2))
