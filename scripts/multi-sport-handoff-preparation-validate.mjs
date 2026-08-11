import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const files = [
  'docs/ARCHITECTURE/MULTI_SPORT_HANDOFF_V1.md',
  'docs/ARCHITECTURE/NBA_IMPLEMENTATION_MASTER_PLAN_V1.md',
  'docs/PRODUCTION_PILOT/MULTI_SPORT_HANDOFF_PREPARATION.md',
  'docs/CERTIFICATION/multi-sport-handoff-preparation.json',
  'docs/ARCHITECTURE/SPORT_ONBOARDING_TEMPLATE_V1.md',
]

for (const file of files) assert(fs.existsSync(file), `missing required artifact: ${file}`)

const architecture = read('docs/ARCHITECTURE/MULTI_SPORT_HANDOFF_V1.md')
const plan = read('docs/ARCHITECTURE/NBA_IMPLEMENTATION_MASTER_PLAN_V1.md')
const pilot = read('docs/PRODUCTION_PILOT/MULTI_SPORT_HANDOFF_PREPARATION.md')
const template = read('docs/ARCHITECTURE/SPORT_ONBOARDING_TEMPLATE_V1.md')
const cert = JSON.parse(read('docs/CERTIFICATION/multi-sport-handoff-preparation.json'))

for (const sport of ['NBA', 'NFL', 'NHL', 'Soccer', 'Tennis', 'UFC', 'BSN']) {
  assert(cert.sportsAudited.includes(sport), `${sport} must be audited`)
  assert(architecture.includes(`| ${sport} |`) || architecture.includes(`| ${sport} `), `${sport} must appear in architecture audit`)
}

assert(cert.classification === 'MULTI_SPORT_HANDOFF_PASS', 'classification must be PASS')
assert(cert.nextSport.sport === 'NBA', 'NEXT_SPORT must be NBA')
assert(cert.ranking.length === 7, 'all seven sports must be ranked')
assert(cert.ranking[0].sport === 'NBA' && cert.ranking[0].rank === 1, 'NBA must rank first')
assert(cert.ranking.every((row, index) => row.rank === index + 1), 'ranking must be internally ordered')
assert(cert.ranking.every((row) => Number.isFinite(row.totalScore) && row.totalScore >= 0 && row.totalScore <= 100), 'scores must be bounded 0-100')
assert(cert.ranking[0].totalScore > cert.ranking[1].totalScore, 'NBA selection must be deterministic')

assert(architecture.includes('Repository Service Inventory'), 'actual repository state must be inventoried')
assert(architecture.includes('Database And Historical Inventory'), 'historical inventories must be documented')
assert(architecture.includes('Official And Free Source Matrix'), 'official/free source matrix must be complete')
assert(architecture.includes('Paid Provider Dependency Audit'), 'paid dependencies must be identified')
assert(architecture.includes('The Odds API Coverage'), 'The Odds API support must be classified')
assert(architecture.includes('Feature Store') && architecture.includes('Prediction Engine') && architecture.includes('Settlement'), 'maturity domains must be classified')
assert(architecture.includes('MODEL_REPLAY_READY_NO_PRICES'), 'replay feasibility must distinguish price-aware replay')
assert(architecture.includes('No source was live-tested'), 'no provider exploration must be documented')

assert(plan.includes('NBA-01_DATA_FOUNDATION_PROVIDER_INDEPENDENCE_AND_HISTORICAL_READINESS'), 'first executable master block must be defined')
assert(plan.includes('No implementation is started by this plan.'), 'plan must not activate implementation')
assert(plan.includes('The Odds API only after explicit bounded call authorization.'), 'provider budget safety must require authorization')
assert(plan.includes('No old-line probability may be rebound to a new-line price.'), 'exact-line fail-closed lesson must be preserved')
assert(plan.includes('Phase 10 - Natural Production Pilot'), 'ten-phase master plan must be present')

assert(cert.providerMap.paidProviderDependency === 'NONE_REQUIRED_FOR_CORE_PLAN', 'provider map must not hide paid dependency')
assert(cert.historicalPlan.leakageSafety.includes('No final result'), 'historical plan must be leakage-safe')
assert(cert.providerBudget.explicitBudgetAuthorizationRequired === true, 'budget authorization must be explicit')
assert(cert.operations.operationsProductionReadyClassification === 'NON_BLOCKING_POSTURE_FOR_PREPARATION', 'operationsProductionReady posture must be classified')
assert(cert.mlbRollbackWindow.sportsDataIoMlbCalls === 0, 'SportsDataIO zero-call must be preserved')
assert(cert.mlbRollbackWindow.sportsDataIoCancellationReady === 'NOT_YET', 'SportsDataIO cancellation must not be automatic')
assert(cert.safety.providerCallsFromCertification === 0, 'provider calls must be zero')
assert(cert.safety.databaseMutationsFromCertification === 0, 'database mutations must be zero')
assert(cert.safety.runtimeCodeChanged === false, 'runtime code must not change')
assert(cert.safety.newSportProductionActivation === false, 'no new sport may be production activated')

assert(template.includes('Provider exit / rollback'), 'template must include provider exit lesson')
assert(template.includes('Home evidence semantics'), 'template must include home evidence semantics')
assert(template.includes('Coverage-aware operations health'), 'template must include coverage-aware health lesson')

assert(pilot.includes('MULTI_SPORT_HANDOFF_PASS'), 'pilot summary must record PASS classification')
assert(pilot.includes('NEXT_SPORT: NBA'), 'pilot summary must identify NBA')

console.log(JSON.stringify({
  success: true,
  mode: 'multi_sport_handoff_preparation_validate_v1',
  checks: 35,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification,
  nextSport: cert.nextSport.sport,
}, null, 2))
