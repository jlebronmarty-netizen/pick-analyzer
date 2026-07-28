import {
  runTheOddsApiMaximumUtilizationCheckpoint1,
  validateTheOddsApiMaximumUtilizationCheckpoint1Fixtures,
} from '../src/services/the-odds-api-maximum-utilization.service.ts'

const fixture = validateTheOddsApiMaximumUtilizationCheckpoint1Fixtures()
const dry = await runTheOddsApiMaximumUtilizationCheckpoint1({ dryRun: true })
const rendered = JSON.stringify(dry)
const checks = [
  ['fixture validation passes', fixture.success],
  ['dry run succeeds', dry.success],
  ['dry run makes zero provider calls', dry.providerCallsMade === 0],
  ['dry run makes zero remote mutations', dry.remoteMutationsMade === 0],
  ['dry run makes zero production mutations', dry.productionMutationsMade === 0],
  ['catalog endpoint contract exists in dry payload', dry.catalog.mappedSports.length >= 8],
  ['capability matrix includes all required dimensions', dry.capabilityMatrix.every((row) => (
    row.CURRENT_EVENTS &&
    row.CURRENT_ODDS &&
    row.EVENT_MARKETS &&
    row.PLAYER_PROPS &&
    row.SCORES &&
    row.HISTORICAL_ODDS &&
    row.BOOKMAKER_COVERAGE &&
    row.REGION_COVERAGE &&
    row.SEASON_STATE
  ))],
  ['secret query is never rendered', !rendered.includes('apiKey=')],
]
const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
}
console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
