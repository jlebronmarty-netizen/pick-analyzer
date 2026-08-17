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

const productionColumns = audit?.productionResultColumns ?? []
const unsupportedColumns = audit?.unsupportedProductionColumns ?? []
const fixtures = audit?.idempotencyFixtures ?? {}

check('NFL-02 base validator succeeds', report.success === true)
check('provider calls remain zero', report.providerCallsMade === 0)
check('production database mutations remain zero', report.productionDatabaseMutationsMade === 0)
check('completed source results remain 1359', report.canonicalCounts?.gameResults === 1359)
check('production candidates remain 1359', audit?.productionCompatibleRows === 1359)
check('insert payload omits UUID id', !productionColumns.includes('id'))
check('insert payload includes game_id', productionColumns.includes('game_id'))
check('id is treated as unsupported production payload column', unsupportedColumns.includes('id'))
check('unsupported columns absent from payload', Array.isArray(audit?.unsupportedColumnsPresent) && audit.unsupportedColumnsPresent.length === 0)
check('same game reuses game_id', fixtures.sameGameTwiceSameGameId === true)
check('corrected score updates same game_id', fixtures.correctedScoreSameGameId === true)
check('different game has distinct game_id', fixtures.differentGameDistinctGameId === true)
check('cancelled game creates no candidate', fixtures.cancelledGameCreatesNoResult === true)
check('duplicate game_id blocks import by policy', fixtures.duplicateGameIdBlocksImport === true)
check('deterministic text is not sent to UUID id', fixtures.deterministicTextSentToUuidId === false)
check('lineage preserved via game_id/event/mapping', audit?.resultLineagePreserved === true)

if (failures.length) {
  console.error(JSON.stringify({ status: 'NFL_02_GAME_RESULTS_UUID_IDENTITY_REPAIR_BLOCKED', failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'NFL_02_GAME_RESULTS_UUID_IDENTITY_REPAIR_CERTIFIED',
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
  sourceCompletedResults: report.canonicalCounts.gameResults,
  productionCandidates: audit.productionCompatibleRows,
  insertPayloadColumns: productionColumns,
  uuidIdPayloadValues: 0,
  idempotencyIdentity: 'game_id',
  fixtures,
}, null, 2))
