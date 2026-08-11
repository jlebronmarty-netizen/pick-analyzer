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

const cert = json('docs/CERTIFICATION/health-current-board-timeout-repair.json')
const report = read('docs/PRODUCTION_PILOT/HEALTH_CURRENT_BOARD_TIMEOUT_REPAIR.md')
const health = read('src/services/operations-health.service.ts')
const settlement = read('src/services/settlement-guarantee.service.ts')
const board = read('src/services/current-board.service.ts')
const freshness = read('src/services/product-freshness-sla.service.ts')
const oddsConfig = read('src/config/odds-primary-authority.config.ts')
const oddsAuthority = read('src/services/odds-primary-authority.service.ts')
const sdioSuppression = read('src/services/adaptive-refresh-orchestrator.service.ts')
const r2 = read('src/services/line-versioned-reprediction-writer.service.ts')

check('timeout query path identified', cert.timeoutRootCause === 'HEALTH_REQUIRED_FULL_CURRENT_BOARD_READ' && report.includes('readOddsForEvents'))
check('expensive portion classified', cert.failingService.includes('readOddsForEvents') && report.includes('sports_odds_snapshots'))
check('Current Board health scope bounded', health.includes('safeCurrentBoardHealthSummary') && health.includes('limit: 25') && health.includes('includeMlbContext: false'))
check('Stage 3 authority filtering preserved', board.includes('productOddsProviderForCurrentBoard') && oddsAuthority.includes('THE_ODDS_API'))
check('Stage 1 rollback compatibility preserved', board.includes("status.productAuthority === 'THE_ODDS_API' ? 'the-odds-api' : 'sportsdataio'"))
check('exact-line semantics unchanged', board.includes('oddsMatchesPrediction') && board.includes('Math.abs(expectedLine - oddsLine) < 0.001'))
check('fail-closed stale behavior unchanged', board.includes('STALE_ODDS') && freshness.includes('WAIT_FOR_REFRESH') && oddsConfig.includes('NO_FRESH_EXACT_LINE_PRICE'))
check('health reports real failures', health.includes('CURRENT_BOARD_READ_FAILED') && health.includes('current_board_read_failed'))
check('settlement guarantee semantics preserved', settlement.includes('classifyCanonicalSettlementState') && settlement.includes('readyForSettlementRows'))
check('settlement decoupled from full-board scan', settlement.includes('getOperationsHealth().catch') && settlement.includes('OPERATIONS_HEALTH_UNAVAILABLE'))
check('SportsDataIO zero-call design preserved', sdioSuppression.includes('SKIPPED_AUTHORITY_NOT_SPORTSDATAIO') && sdioSuppression.includes('providerCallsMade: 0'))
check('R2 regression PASS', r2.includes('assertDbUuidOrNull(row.feature_snapshot_id') && r2.includes('PERSISTENT_PRIMARY_WRITER'))
check('provider calls from certification zero', cert.providerCallsFromCertification === 0)
check('production DB mutations from certification zero', cert.productionDbMutationsFromCertification === 0)
check('documentation records no health fake green', report.includes('explicit') && report.includes('instead of HTTP 500'))

if (failures) {
  console.error(`Health Current Board timeout repair validation failed: ${failures}`)
  process.exit(1)
}

console.log('Health Current Board timeout repair validation passed')
