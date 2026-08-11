import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

let failures = 0
function check(name, passed) {
  if (passed) {
    console.log(`PASS ${name}`)
  } else {
    failures += 1
    console.error(`FAIL ${name}`)
  }
}

const cert = json('docs/CERTIFICATION/current-board-query-performance-repair.json')
const report = read('docs/PRODUCTION_PILOT/CURRENT_BOARD_QUERY_PERFORMANCE_REPAIR.md')
const board = read('src/services/current-board.service.ts')
const health = read('src/services/operations-health.service.ts')
const settlement = read('src/services/settlement-guarantee.service.ts')
const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')
const oddsAuthority = read('src/services/odds-primary-authority.service.ts')
const r2 = read('src/services/line-versioned-reprediction-writer.service.ts')
const oddsConfig = read('src/config/odds-primary-authority.config.ts')
const mlbMode = read('src/config/mlb-data-source-mode.config.ts')

check('exact timeout query identified', cert.failingService.includes('readOddsForEvents') && report.includes('sports_odds_snapshots'))
check('root cause classified', cert.timeoutRootCause.includes('BOOK_FILTER_AFTER_FETCH') && cert.timeoutRootCause.includes('TOO_MANY_HISTORICAL_SNAPSHOTS_PER_EVENT'))
check('event scope bounded', board.includes('for (const chunk of chunks(uniqueIds, 10))') && board.includes(".in('event_id', chunk)"))
check('authority provider filter correct', board.includes('productOddsProviderForCurrentBoard') && board.includes("status.productAuthority === 'THE_ODDS_API' ? 'the-odds-api' : 'sportsdataio'"))
check('certified book scope correct', board.includes('CURRENT_BOARD_CERTIFIED_BOOK_KEYS') && board.includes("query.in('sportsbook', certifiedBookScope)") && oddsConfig.includes('FanDuel'))
check('market scope correct', board.includes('CURRENT_BOARD_PRODUCT_ODDS_MARKETS') && board.includes("'moneyline', 'run_line', 'total'"))
check('recency scope bounded safely', board.includes('CURRENT_BOARD_PRODUCT_ODDS_RECENCY_MULTIPLIER') && board.includes('currentBoardProductOddsRecencyMinutes') && cert.queryScopeAfter.recencyWindowMinutes === 90)
check('data-volume reduction recorded', cert.readOnlyDataVolumeEvidence.currentEventIds24hTheOddsApi > cert.readOnlyDataVolumeEvidence.currentEventIds90mTheOddsApiCertifiedBooksCoreMarkets)
check('historical modes remain broad', board.includes("mode === 'HISTORICAL_EXPLORER' || mode === 'ALL_STORED_ADVANCED'") && cert.queryScopeAfter.historicalModesUnchanged)
check('exact-line semantics preserved', board.includes('oddsMatchesPrediction') && board.includes('Math.abs(predictionLine - oddsLine) < 0.001') && board.includes('oddsMatchesComplement'))
check('latest-price semantics preserved', board.includes('selectedMarketFreshness') && board.includes('return candidates[0] ?? null'))
check('fail-closed rows preserved', board.includes('STALE_ODDS') && oddsAuthority.includes('NO_FRESH_EXACT_LINE_PRICE') && report.includes('fail-closed'))
check('Stage 1 rollback remains supported', cert.semanticSafety.stage1RollbackSupported && board.includes("productOddsProvider === 'the-odds-api'"))
check('health wrapper still safe', cert.semanticSafety.healthWrapperStillSafe && health.includes('CURRENT_BOARD_READ_FAILED'))
check('settlement decoupling retained', cert.semanticSafety.settlementDecouplingRetained && settlement.includes('OPERATIONS_HEALTH_UNAVAILABLE'))
check('SportsDataIO zero-call preserved', cert.semanticSafety.sportsDataIoZeroCallPreserved && orchestrator.includes('SKIPPED_AUTHORITY_NOT_SPORTSDATAIO'))
check('The Odds API primary preserved', cert.semanticSafety.stage3TheOddsApiPrimaryPreserved && oddsAuthority.includes('STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT'))
check('MLB Official primary preserved', cert.semanticSafety.mlbOfficialPrimaryPreserved && mlbMode.includes('MLB_OFFICIAL_PRIMARY'))
check('R2 behavior preserved', cert.semanticSafety.r2Regression === 'PASS' && r2.includes('PERSISTENT_PRIMARY_WRITER'))
check('no DB migration required', cert.indexRequired === false && cert.migrationRequired === false && cert.productionDbMigrationApplied === false)
check('provider calls during certification zero', cert.providerCallsFromCertification === 0)
check('production DB mutations during certification zero', cert.productionDbMutationsFromCertification === 0)

if (failures) {
  console.error(`Current Board query performance repair validation failed: ${failures}`)
  process.exit(1)
}

console.log('Current Board query performance repair validation passed')
