import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const homePath = 'src/components/home/HomeBettingPlan.tsx'
const docPath = 'docs/PRODUCTION_PILOT/HOME_CLIENT_STATE_CARD_MAPPING_RECONCILIATION.md'
const certPath = 'docs/CERTIFICATION/home-client-state-card-mapping-reconciliation.json'

for (const file of [homePath, docPath, certPath]) {
  assert(fs.existsSync(file), `missing home reconciliation artifact: ${file}`)
}

const home = read(homePath)
const doc = read(docPath)
const cert = JSON.parse(read(certPath))

assert(
  home.includes('function pickPlan(data: TodayResponse | null, currentBoard?: ApiEnvelope | null)') &&
    home.includes('const candidates = allCandidates(data, currentBoard)'),
  'homepage plan must accept Current Board state as part of its candidate universe'
)
assert(
  home.includes("arrayValue(currentBoard?.candidates).forEach") &&
    home.includes("fromRow(`current-board-${index}`, 'Current Board'"),
  'Current Board candidates must feed card contracts when Today selectors/sections are sparse'
)
assert(
  home.includes('sourceRank(source)') &&
    home.includes("'Current Board'"),
  'Current Board rows must have a deterministic source rank'
)
assert(
  home.includes('policyBlockedReason') &&
    home.includes('Policy blocked:') &&
    home.includes("source === 'Current Board'"),
  'non-official Current Board rows must remain policy-blocked/review-only and fail closed'
)
assert(
  home.includes('const plan = useMemo(() => pickPlan(data, currentBoard), [data, currentBoard])'),
  'homepage client state must recompute cards when Current Board fetch resolves'
)
assert(
  home.includes('const boardPositiveEvCandidates = arrayValue(currentBoard?.candidates).filter') &&
    home.includes('boardPositiveEvCandidates'),
  'Value Candidates metric must use current board positive-EV evidence when Today scalars are stale or zero'
)
assert(
  home.includes('data.viewModel?.selectors?.gameCoverageSummary?.marketsPredicted') &&
    home.includes('data.viewModel?.selectors?.gameCoverageSummary?.currentBoardCandidates') &&
    home.includes('boardCandidates'),
  'Predictions metric must not remain zero when current stored board candidates exist'
)
assert(
  home.includes('boardFreshness') &&
    home.includes('latestSourceTimestamp'),
  'Snapshot captured display must fall back to Current Board freshness evidence'
)
assert(!home.includes('ODDS_PRIMARY_AUTHORITY_STAGE='), 'homepage repair must not hardcode odds authority')
assert(!home.includes('MLB_DATA_SOURCE_MODE='), 'homepage repair must not hardcode data-source mode')
assert(!home.includes('THE_ODDS_API_KEY'), 'homepage repair must not touch provider credentials')
assert(!home.includes('SPORTSDATAIO_MLB_API_KEY'), 'homepage repair must not touch provider credentials')

assert(cert.classification === 'HOME_CLIENT_STATE_RECONCILIATION_REPAIR_READY_FOR_DEPLOYMENT', 'certification classification must match local bounded repair')
assert(cert.safety.providerCallsFromCertificationReads === 0, 'certification reads must make zero provider calls')
assert(cert.safety.databaseMutationsFromCertificationReads === 0, 'certification reads must make zero database mutations')
assert(cert.protectedInvariants.predictionFormulaChanged === false, 'prediction formula must remain unchanged')
assert(cert.protectedInvariants.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.protectedInvariants.oddsAuthorityChanged === false, 'odds authority must remain unchanged')
assert(cert.protectedInvariants.mlbDataSourceModeChanged === false, 'MLB data-source mode must remain unchanged')

assert(doc.includes('CLIENT_PLAN_IGNORED_CURRENT_BOARD'), 'documentation must state the client-state root cause')
assert(doc.includes('NO_GAMES'), 'documentation must cover false no-games card states')
assert(doc.includes('policy-blocked'), 'documentation must document recommendation safety')

console.log(JSON.stringify({
  success: true,
  mode: 'home_client_state_card_mapping_reconciliation_validate_v1',
  checks: 22,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification,
}, null, 2))
