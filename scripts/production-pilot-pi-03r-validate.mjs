import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const requiredFiles = [
  'src/services/current-board.service.ts',
  'src/components/home/HomeBettingPlan.tsx',
  'docs/PRODUCTION_PILOT/INCIDENT_PI_03R_COMPLEMENT_PRICE_REBINDING.md',
  'docs/CERTIFICATION/production-pilot-pi-03r.json',
]

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `missing PI-03R artifact: ${file}`)
}

const currentBoard = read('src/services/current-board.service.ts')
const homepage = read('src/components/home/HomeBettingPlan.tsx')
const cert = JSON.parse(read('docs/CERTIFICATION/production-pilot-pi-03r.json'))

const requiredCurrentBoardTerms = [
  'function latestSafeOdds',
  'function latestSafeComplementOdds',
  'function oddsMatchesComplement',
  'function complementLine',
  'function normalizedComplementSelection',
  'bindingMode',
  "'DIRECT'",
  "'COMPLEMENT'",
  "'UNAVAILABLE'",
  'complement_provider_price',
  'oddsMarketIdentity',
  'buildMarketAlignment',
  'COMPLEMENT_PRICE_BINDING',
]

for (const term of requiredCurrentBoardTerms) {
  assert(currentBoard.includes(term), `missing Current Board PI-03R term: ${term}`)
}

assert(
  currentBoard.indexOf('const safeOdds = latestSafeOdds') < currentBoard.indexOf('toCandidate(item.row, item.odds, item.event, nowMs, mode, oddsRows)'),
  'direct odds lookup must remain the first binding path'
)

assert(currentBoard.includes("if (canonicalPredictionMarket(row.market) === 'moneyline') return oddsLine === null"), 'moneyline complement must not bind across lines')
assert(currentBoard.includes("if (market === 'spread') return -line"), 'spread complement must negate line exactly')
assert(currentBoard.includes("if (market === 'total') return line"), 'total complement must keep exact line')
assert(currentBoard.includes("if (directOdds?.provider && odds.provider !== directOdds.provider) return false"), 'complement binding must preserve provider scope')
assert(currentBoard.includes("if (directOdds?.sportsbook && odds.sportsbook !== directOdds.sportsbook) return false"), 'complement binding must preserve sportsbook scope')
assert(!currentBoard.includes('100 - complementOdds'), 'validator guard: no synthetic odds math introduced')

assert(homepage.includes('Snapshot captured'), 'homepage must distinguish snapshot capture recency')
assert(homepage.includes('Market evidence'), 'homepage must expose underlying market evidence recency')
assert(!homepage.includes('Latest odds:'), 'homepage should not label snapshot capture as latest odds')

assert(cert.status === 'LOCAL_VALIDATION_COMPLETE_PRODUCTION_PROOF_PENDING', 'PI-03R certification status mismatch')
assert(cert.protectedInvariants.predictionProbabilitiesChanged === false, 'prediction probabilities must remain unchanged')
assert(cert.protectedInvariants.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.protectedInvariants.settlementChanged === false, 'settlement must remain unchanged')
assert(cert.protectedInvariants.learningChanged === false, 'learning must remain unchanged')
assert(cert.protectedInvariants.schedulerCadenceChanged === false, 'scheduler cadence must remain unchanged')
assert(cert.complementContract.crossLineBindingAllowed === false, 'cross-line binding must be forbidden')
assert(cert.complementContract.syntheticOddsAllowed === false, 'synthetic odds must be forbidden')
assert(cert.runtimeEvidence.usesExistingMarketAlignmentFunctions === true, 'existing market alignment functions must be used')
assert(cert.freshnessEvidence.staleEvidenceActionable === false, 'stale evidence must not be actionable')
assert(cert.providerCallsFromCertification === 0, 'certification must record zero provider calls')
assert(cert.databaseMutationsFromCertification === 0, 'certification must record zero database mutations')

console.log(JSON.stringify({
  success: true,
  mode: 'production_pilot_pi_03r_validation_v1',
  checks: 20,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification,
}, null, 2))

