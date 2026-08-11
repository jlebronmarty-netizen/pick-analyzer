import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const servicePath = 'src/services/dashboard-today.service.ts'
const homePath = 'src/components/home/HomeBettingPlan.tsx'
const docPath = 'docs/PRODUCTION_PILOT/MLB_PRODUCT_EVIDENCE_RECONCILIATION.md'
const certPath = 'docs/CERTIFICATION/mlb-product-evidence-eligibility-reconciliation.json'

for (const file of [servicePath, homePath, docPath, certPath]) {
  assert(fs.existsSync(file), `missing reconciliation artifact: ${file}`)
}

const service = read(servicePath)
const home = read(homePath)
const doc = read(docPath)
const cert = JSON.parse(read(certPath))

assert(
  service.includes('productPriceRows = board.candidates.filter') &&
    service.includes('hasCanonicalPriceEvidence(candidate)'),
  'Today service must count current product price evidence from Current Board candidates'
)
assert(
  service.includes('Math.max(Number(coverage?.oddsRowsNormalized ?? 0), productPriceRows) === 0'),
  'Waiting-for-odds logic must reconcile legacy odds diagnostics with product price evidence'
)
assert(
  service.includes('storedOddsCount: Math.max(') &&
    service.includes('board.candidates.filter((candidate) => candidate.eventId === card.eventId && hasCanonicalPriceEvidence(candidate)).length'),
  'Per-game operational status must not report NO_STORED_ODDS when product price evidence exists'
)
assert(
  home.includes('bestValueSemantics?:') &&
    home.includes('candidatesWithPositiveEv?: number'),
  'Homepage type contract must expose positive-EV evidence separately from policy eligibility'
)
assert(
  home.includes('data.viewModel?.selectors?.bestValueSemantics?.candidatesWithPositiveEv') &&
    home.includes('currentBoard?.modeledValueCount'),
  'Homepage Value Candidates metric must use evidence-first positive EV counts before qualified-only fallback'
)
assert(
  home.includes('gamesWithDisplayableCurrentBoardMarket') &&
    home.includes('Math.max(0, gamesToday - analyzedGames)'),
  'Homepage Games Skipped must compare games today with analyzed games, not policy-qualified candidates'
)
assert(
  home.includes("data.summary?.marketPrices === 'Waiting for sportsbook refresh.'") &&
    home.includes("'Current market evidence available'"),
  'Homepage must not surface legacy sportsbook-refresh copy when Current Board displayable markets exist'
)
assert(!service.includes('ODDS_PRIMARY_AUTHORITY_STAGE=') && !home.includes('ODDS_PRIMARY_AUTHORITY_STAGE='), 'runtime config values must not be hardcoded')
assert(!service.includes('SPORTSDATAIO_MLB_API_KEY') && !home.includes('SPORTSDATAIO_MLB_API_KEY'), 'repair must not touch provider credentials')
assert(!service.includes('THE_ODDS_API_KEY') && !home.includes('THE_ODDS_API_KEY'), 'repair must not touch provider credentials')

assert(cert.classification === 'MLB_PRODUCT_EVIDENCE_RECONCILIATION_REPAIR_READY_FOR_DEPLOYMENT', 'cert classification must match bounded repair status')
assert(cert.productionEvidence.providerCallsFromCertificationReads === 0, 'certification reads must make zero provider calls')
assert(cert.productionEvidence.databaseMutationsFromCertificationReads === 0, 'certification reads must make zero database mutations')
assert(cert.protectedInvariants.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.protectedInvariants.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.protectedInvariants.oddsAuthorityChanged === false, 'odds authority must remain unchanged')
assert(cert.protectedInvariants.mlbDataSourceModeChanged === false, 'MLB data-source mode must remain unchanged')
assert(cert.protectedInvariants.providerCallsAdded === false, 'repair must not add provider calls')
assert(doc.includes('Hard missing data') && doc.includes('Soft missing data'), 'documentation must classify hard and soft missing data')
assert(doc.includes('45 canonical predictions') && doc.includes('39 Current Board candidates'), 'documentation must reconcile Performance and Current Board denominators')
assert(doc.includes('The Odds API remains product odds authority'), 'documentation must preserve authority statement')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_product_evidence_eligibility_reconciliation_validate_v1',
  checks: 22,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification,
}, null, 2))
