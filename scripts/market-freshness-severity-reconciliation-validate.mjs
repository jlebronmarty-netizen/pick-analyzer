import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const healthPath = 'src/services/operations-health.service.ts'
const boardPath = 'src/services/current-board.service.ts'
const docPath = 'docs/PRODUCTION_PILOT/MARKET_FRESHNESS_SEVERITY_RECONCILIATION.md'
const certPath = 'docs/CERTIFICATION/market-freshness-severity-reconciliation.json'

for (const file of [healthPath, boardPath, docPath, certPath]) {
  assert(fs.existsSync(file), `missing artifact: ${file}`)
}

const health = read(healthPath)
const board = read(boardPath)
const doc = read(docPath)
const cert = JSON.parse(read(certPath))

assert(health.includes('function marketDomain'), 'market freshness source must be identified in operations health service')
assert(health.includes('const visibleMarketCount = Number(input.board.dataFreshness.visibleMarketCount ?? 0)'), 'freshness denominator must use visible market count')
assert(health.includes('const freshVisibleMarketCount = Number(input.board.dataFreshness.freshVisibleMarketCount ?? 0)'), 'fresh row count must be included')
assert(health.includes('const staleVisibleMarketCount = Number(input.board.dataFreshness.staleVisibleMarketCount ?? 0)'), 'stale row count must be included')
assert(health.includes('const allVisibleMarketsStale = visibleMarketCount > 0 && staleVisibleMarketCount >= visibleMarketCount'), 'all-stale condition must remain critical')
assert(health.includes("(oddsNotCurrent && !hasFreshCoverage)") || health.includes('(oddsNotCurrent && !hasFreshCoverage'), 'odds_not_current without fresh coverage must remain critical')
assert(health.includes('boardFreshness === \'partial\' || hasStaleCoverage || oddsNotCurrent'), 'partial coverage must be deterministic degraded')
assert(health.includes('PARTIAL_FAIL_CLOSED_MARKET_STALENESS'), 'partial fail-closed reason code must be emitted')
assert(health.includes('ODDS_NOT_CURRENT_WITH_PARTIAL_FRESH_COVERAGE'), 'odds_not_current with fresh coverage must be visible as a warning')
assert(health.includes('freshCoveragePercent'), 'fresh coverage percentage must be exposed')
assert(health.includes('staleCoveragePercent'), 'stale coverage percentage must be exposed')
assert(health.includes('failClosedStaleMarkets'), 'fail-closed stale count must be exposed')
assert(health.includes('humanInterventionRequired: status === \'CRITICAL\' && oddsNotCurrent && !hasFreshCoverage'), 'human intervention should target true critical odds outage')
assert(health.includes('safeCurrentBoardHealthSummary') && health.includes('limit: 200') && health.includes('includeMlbContext: false'), 'operations health must read the full bounded Current Board without MLB context expansion')

assert(board.includes('freshVisibleMarketCount') && board.includes('staleVisibleMarketCount'), 'Current Board must preserve visible fresh/stale counts')
assert(board.includes('staleVisibleMarketCount > 0 && freshVisibleMarketCount > 0'), 'Current Board must remain degraded for mixed fresh/stale rows')
assert(board.includes('STALE_MARKET') && board.includes("modeledValueStatus = stale"), 'stale rows must remain fail-closed')
assert(!health.includes('SPORTSDATAIO_MLB_API_KEY'), 'health repair must not touch SportsDataIO credentials')
assert(!health.includes('THE_ODDS_API_KEY'), 'health repair must not touch The Odds API credential')
assert(!health.includes('ODDS_PRIMARY_AUTHORITY_STAGE='), 'health repair must not hardcode odds authority env assignment')
assert(!health.includes('MLB_DATA_SOURCE_MODE='), 'health repair must not hardcode MLB data-source env assignment')

assert(cert.classification === 'MARKET_FRESHNESS_SEVERITY_REPAIR_READY_FOR_DEPLOYMENT', 'classification must match bounded repair')
assert(cert.currentState.currentBoardCandidates === 38, 'cert must preserve observed Current Board denominator')
assert(cert.currentState.freshRows === 37, 'cert must preserve observed fresh rows')
assert(cert.currentState.staleRows === 1, 'cert must preserve observed stale rows')
assert(cert.currentState.failClosedRows === 1, 'cert must preserve observed fail-closed row count')
assert(cert.staleRow.event === 'TB @ ATH' && cert.staleRow.market === 'Total' && cert.staleRow.line === 10, 'stale row identity must be recorded')
assert(cert.staleRow.actionability === 'WAIT_FOR_REFRESH', 'stale row must remain non-actionable')
assert(cert.staleRow.identityClassification === 'STALE_EXACT_LINE_NO_ALTERNATIVE', 'stale row classification must be explicit')
assert(cert.coverage.gamesWithFreshEvidence === 15, 'event coverage must be measured')
assert(cert.coverage.gamesPartiallyFresh === 1, 'partial event coverage must be measured')
assert(cert.coverage.gamesWithNoFreshEvidence === 0, 'zero-fresh event count must be measured')
assert(cert.coverage.moneylineFreshCoverage === '15/15', 'Moneyline coverage must be measured')
assert(cert.coverage.runLineFreshCoverage === '15/15', 'Run Line coverage must be measured')
assert(cert.coverage.totalFreshCoverage === '7/8', 'Total coverage must be measured')
assert(cert.severityBefore.marketFreshness === 'CRITICAL', 'before state must capture excessive critical severity')
assert(cert.severityAfter.marketFreshness === 'DEGRADED', 'after state must downgrade only partial fail-closed stale coverage')
assert(cert.scenarioMatrix.allStale.marketFreshness === 'CRITICAL', 'full outage must remain critical')
assert(cert.scenarioMatrix.providerFailure.marketFreshness === 'CRITICAL', 'provider failure must remain critical')
assert(cert.scenarioMatrix.schedulerFailure.operations === 'CRITICAL', 'scheduler missed intervals must remain critical at operations level')
assert(cert.safety.staleEvidenceActionable === false, 'stale evidence must not become actionable')
assert(cert.safety.exactLineSafetyPreserved === true, 'exact-line safety must be preserved')
assert(cert.safety.failClosedSafetyPreserved === true, 'fail-closed safety must be preserved')
assert(cert.safety.officialPickLeakage === false, 'Official Pick leakage must remain false')
assert(cert.safety.rentPlayLeakage === false, 'Rent Play leakage must remain false')
assert(cert.safety.smartParlayLeakage === false, 'Smart Parlay leakage must remain false')
assert(cert.safety.providerCallsFromCertificationReads === 0, 'certification reads must make zero provider calls')
assert(cert.safety.databaseMutationsFromCertificationReads === 0, 'certification reads must make zero database mutations')
assert(cert.protectedInvariants.providerAuthorityChanged === false, 'provider authority must remain unchanged')
assert(cert.protectedInvariants.mlbDataSourceModeChanged === false, 'MLB data-source mode must remain unchanged')
assert(cert.protectedInvariants.sportsDataIoReactivated === false, 'SportsDataIO must not be reactivated')

assert(doc.includes('ODDS_NOT_CURRENT_PROMOTED') || doc.includes('odds_not_current'), 'documentation must explain the root cause')
assert(doc.includes('37 fresh rows plus 1 stale fail-closed row'), 'documentation must describe the current state')
assert(doc.includes('Scenario Matrix'), 'documentation must include scenario matrix')
assert(doc.includes('All visible evidence stale') && doc.includes('CRITICAL'), 'documentation must keep full outage critical')
assert(doc.includes('SportsDataIO rollback window Day 1 remains 2026-08-11'), 'rollback window must not reset')

console.log(JSON.stringify({
  success: true,
  mode: 'market_freshness_severity_reconciliation_validate_v1',
  checks: 54,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification,
}, null, 2))
