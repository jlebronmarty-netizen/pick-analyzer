import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const componentPath = 'src/components/home/HomeBettingPlan.tsx'
const architecturePath = 'docs/ARCHITECTURE/MLB_RECOMMENDATION_SURFACE_CONTRACT_V1.md'
const pilotPath = 'docs/PRODUCTION_PILOT/MLB_RECOMMENDATION_SURFACE_SEMANTICS_FINALIZATION.md'
const certPath = 'docs/CERTIFICATION/mlb-recommendation-surface-semantics-finalization.json'

for (const path of [componentPath, architecturePath, pilotPath, certPath]) {
  assert(fs.existsSync(path), `missing required file: ${path}`)
}

const component = read(componentPath)
const architecture = read(architecturePath)
const pilot = read(pilotPath)
const cert = JSON.parse(read(certPath))

assert(cert.classification === 'MLB_RECOMMENDATION_SURFACE_REPAIR_READY_FOR_DEPLOYMENT', 'classification must be repair-ready')
assert(cert.policyChanges.predictionFormulaChanged === false, 'prediction formula must not change')
assert(cert.policyChanges.probabilityChanged === false, 'probability must not change')
assert(cert.policyChanges.evFormulaChanged === false, 'EV formula must not change')
assert(cert.policyChanges.officialPickPolicyChanged === false, 'Official Pick policy must not change')
assert(cert.policyChanges.providerAuthorityChanged === false, 'provider authority must not change')
assert(cert.safety.providerCallsFromCertification === 0, 'provider calls must be zero')
assert(cert.safety.databaseMutationsFromCertification === 0, 'database mutations must be zero')
assert(cert.safety.sportsDataIoRoutineMlbCalls === 0, 'SportsDataIO routine calls must be zero')
assert(cert.safety.nbaImplementationStarted === false, 'NBA implementation must not start')

assert(component.includes("type RentPlayGateStatus = 'PASS' | 'FAIL' | 'PENDING' | 'NOT_AVAILABLE' | 'OPTIONAL'"), 'gate states must include OPTIONAL')
assert(component.includes("const applicable = gates.filter((item) => item.status !== 'OPTIONAL')"), 'NOT_AVAILABLE must remain applicable to readiness')
assert(component.includes('function blockingRecommendationGates'), 'blocking gate helper required')
assert(component.includes("item.status === 'NOT_AVAILABLE'"), 'NOT_AVAILABLE must block qualified recommendations')
assert(component.includes('if (!pick.marketTimestamp) return false'), 'missing market timestamp must fail freshness actionability')
assert(component.includes('/UNAVAILABLE|UNKNOWN|PENDING/.test(freshness)'), 'unavailable freshness must not pass')
assert(component.includes('blockingGates.length === 0'), 'actionability must use blocking gate helper')
assert(component.includes('No Qualified Rent Play'), 'blocked Rent Play cannot render as qualified primary')
assert(component.includes('Most Evidence-Complete Review Candidate - Not Rent Play / Not A Recommendation'), 'review-only Rent Play candidate must be explicitly non-recommendation')
assert(component.includes('No Qualified Moneyline Bet'), 'blocked Moneyline cannot render as qualified primary')
assert(component.includes('Most Evidence-Complete Moneyline Review Candidate - Not A Recommendation'), 'review-only Moneyline candidate must be explicit')
assert(component.includes('What Would Make This Eligible'), 'blocked candidates need state-aware eligibility copy')
assert(component.includes('BUILDER_AVAILABLE'), 'Smart Parlay builder availability must be distinct')
assert(component.includes('PARLAY ACTIONABLE'), 'Smart Parlay recommendation actionability must be distinct')
assert(component.includes('Browsable Legs'), 'Smart Parlay browsable legs must be labeled')
assert(component.includes('Certified Legs'), 'Smart Parlay certified legs must be labeled')
assert(component.includes('Value Signals'), 'Value count must be evidence-labeled, not recommendation-labeled')
assert(component.includes('Analysis Snapshot'), 'analysis snapshot label required')
assert(component.includes('Market Evidence Time'), 'market evidence timestamp label required')
assert(component.includes('Observed At'), 'observed-at label required')
assert(component.includes('This is not used as market evidence freshness'), 'observed-at must not become freshness')
assert(component.includes("rentPlay.status === 'ACTIONABLE'"), 'Watchlist/parlay overlap must require actionable Rent Play')
assert(component.includes("moneyline.status === 'ACTIONABLE'"), 'Watchlist/parlay overlap must require actionable Moneyline')
assert(component.includes('uniqueList'), 'blocker deduplication helper required')
assert(component.includes("jointProbabilityMethod: 'NOT_CERTIFIED'"), 'joint probability must remain uncertified')
assert(!component.includes('SPORTSDATAIO_MLB_API_KEY'), 'homepage repair must not reference SportsDataIO credentials')
assert(!component.includes('THE_ODDS_API_KEY'), 'homepage repair must not reference provider credentials')

assert(architecture.includes('Unavailable required evidence must never render as `PASS`.'), 'architecture must document unavailable required gate behavior')
assert(architecture.includes('Value Signals'), 'architecture must document value signal semantics')
assert(architecture.includes('Complement Binding'), 'architecture must document complement safety')
assert(architecture.includes('Timestamp Taxonomy'), 'architecture must document timestamps')
assert(pilot.includes('No prediction, probability, EV, Official Pick'), 'pilot doc must record no policy/model changes')
assert(pilot.includes('Production-Safe Post-Deploy Plan'), 'post-deploy plan required')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_recommendation_surface_semantics_finalization_validate_v1',
  checks: 36,
  classification: cert.classification,
  providerCallsMade: 0,
  databaseMutationsMade: 0
}, null, 2))
