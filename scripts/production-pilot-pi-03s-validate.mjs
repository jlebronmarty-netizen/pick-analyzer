import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const requiredFiles = [
  'src/services/dashboard-today.service.ts',
  'src/components/home/HomeBettingPlan.tsx',
  'docs/PRODUCTION_PILOT/INCIDENT_PI_03S_CANONICAL_EVIDENCE_PROPAGATION.md',
  'docs/CERTIFICATION/production-pilot-pi-03s.json',
]

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `missing PI-03S file: ${file}`)
}

const dashboard = read('src/services/dashboard-today.service.ts')
const home = read('src/components/home/HomeBettingPlan.tsx')
const cert = JSON.parse(read('docs/CERTIFICATION/production-pilot-pi-03s.json'))

const dashboardTerms = [
  'function hasCanonicalPriceEvidence',
  "price.status === 'AVAILABLE'",
  'priceBindingMode',
  'priceSourceMarket',
  'priceSourceSelection',
  'priceSourceLine',
  'priceSourceSnapshotId',
  'providerSourceTimestamp',
  'snapshotCapturedAt',
  'productFreshness',
  'marketEvidenceFreshness',
  'hasCanonicalPriceEvidence(candidate)',
]

for (const term of dashboardTerms) {
  assert(dashboard.includes(term), `dashboard canonical propagation missing: ${term}`)
}

assert(!dashboard.includes("candidate.canonicalPrice?.source === 'selected_stored_price' &&\n      candidate.canonicalPrice?.status === 'AVAILABLE'"), 'best value must not be direct-price only')
assert(!dashboard.includes("const aligned = price?.source === 'selected_stored_price'"), 'grounded opportunity must not be direct-price only')
assert(dashboard.includes("candidate.canonicalPrice?.bindingMode === 'DIRECT'"), 'direct binding diagnostics must remain explicit')
assert(dashboard.includes("candidate.canonicalPrice?.bindingMode !== 'COMPLEMENT'"), 'complement diagnostics must allow certified complement binding')

const homeTerms = [
  'predictionId',
  'priceBindingMode',
  'priceSourceMarket',
  'priceSourceSelection',
  'priceSourceLine',
  'priceSourceSnapshotId',
  'providerSourceTimestamp',
  'snapshotCapturedAt',
  'Market Evidence',
  'Snapshot Captured',
  'Price Binding',
  'observedAt)}. This is not used as market evidence freshness.',
]

for (const term of homeTerms) {
  assert(home.includes(term), `homepage canonical propagation missing: ${term}`)
}

assert(home.includes('selector.productFreshness?.status ?? selector.freshness ?? selector.priceState'), 'homepage selectors must prefer Product Freshness SLA')
assert(home.includes('selector.predictionId ?? id'), 'homepage PlanPick should preserve selector prediction identity')
assert(home.includes('priceBindingMode: selector.priceBindingMode'), 'selector binding mode must propagate into PlanPick')
assert(home.includes('priceBindingMode: item.priceBindingMode'), 'watchlist must propagate binding mode')
assert(home.includes('priceBindingMode: pick.priceBindingMode'), 'smart parlay legs must propagate binding mode')

assert(cert.status === 'LOCAL_VALIDATION_COMPLETE_PRODUCTION_PROOF_PENDING', 'PI-03S cert status mismatch')
assert(cert.canonicalEvidenceContract.syntheticOddsAllowed === false, 'synthetic odds must remain forbidden')
assert(cert.canonicalEvidenceContract.providerCallsAdded === false, 'provider calls must not be added')
assert(cert.canonicalEvidenceContract.databaseWritesAdded === false, 'database writes must not be added')
assert(cert.protectedInvariants.predictionProbabilityChanged === false, 'prediction probability must remain unchanged')
assert(cert.protectedInvariants.confidenceChanged === false, 'confidence must remain unchanged')
assert(cert.protectedInvariants.rankingChanged === false, 'ranking must remain unchanged')
assert(cert.protectedInvariants.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.protectedInvariants.settlementChanged === false, 'settlement must remain unchanged')
assert(cert.protectedInvariants.learningChanged === false, 'learning must remain unchanged')
assert(cert.validation.providerCallsFromCertification === 0, 'provider calls must be zero')
assert(cert.validation.databaseMutationsFromCertification === 0, 'database mutations must be zero')
assert(cert.validation.staleActionable === 0, 'stale actionable must be zero')

console.log(JSON.stringify({
  success: true,
  mode: 'production_pilot_pi_03s_validation_v1',
  checks: 27,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification,
}, null, 2))

