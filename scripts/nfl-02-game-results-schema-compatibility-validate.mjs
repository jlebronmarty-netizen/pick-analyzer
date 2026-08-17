import { execFileSync } from 'node:child_process'

const output = execFileSync('node', ['scripts/nfl-02-canonical-historical-import.mjs', '--validate'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})

const report = JSON.parse(output)
const audit = report.resultCompatibilityAudit
const failures = []

function check(label, condition) {
  if (!condition) failures.push(label)
}

check('NFL-02 validator succeeds', report.success === true)
check('provider calls remain zero', report.providerCallsMade === 0)
check('production database mutations remain zero', report.productionDatabaseMutationsMade === 0)
check('result compatibility audit exists', Boolean(audit))
check('source results remain 1359', report.canonicalCounts?.gameResults === 1359)
check('production-compatible rows remain 1359', audit?.productionCompatibleRows === 1359)
check('unsupported result columns omitted', Array.isArray(audit?.unsupportedColumnsPresent) && audit.unsupportedColumnsPresent.length === 0)
check('league_key rejected from persistence payload', audit?.unsupportedProductionColumns?.includes('league_key'))
check('result_source rejected from persistence payload', audit?.unsupportedProductionColumns?.includes('result_source'))
check('metadata rejected from persistence payload', audit?.unsupportedProductionColumns?.includes('metadata'))
check('updated_at rejected from persistence payload', audit?.unsupportedProductionColumns?.includes('updated_at'))
check('lineage preserved outside game_results optional columns', audit?.resultLineagePreserved === true)
check('same game import is idempotent', audit?.idempotencyFixtures?.sameGameTwiceSameId === true)
check('corrected score keeps same identity', audit?.idempotencyFixtures?.correctedScoreSameId === true)
check('different game uses distinct identity', audit?.idempotencyFixtures?.differentGameDistinctId === true)
check('cancelled game creates no result', audit?.idempotencyFixtures?.cancelledGameCreatesNoResult === true)
check('existing identity reuses same logical row', audit?.idempotencyFixtures?.existingIdentityReusesSameLogicalRow === true)

if (failures.length) {
  console.error(JSON.stringify({ status: 'NFL_02_GAME_RESULTS_SCHEMA_COMPATIBILITY_REPAIR_BLOCKED', failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'NFL_02_GAME_RESULTS_SCHEMA_COMPATIBILITY_REPAIR_CERTIFIED',
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
  productionCompatibleResultRows: audit.productionCompatibleRows,
  unsupportedColumnsPresent: audit.unsupportedColumnsPresent.length,
  resultLineagePreserved: audit.resultLineagePreserved,
  idempotencyFixtures: audit.idempotencyFixtures,
}, null, 2))
