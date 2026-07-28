import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import {
  runTheOddsApiMaximumUtilizationCheckpoint1,
  validateTheOddsApiMaximumUtilizationCheckpoint1Fixtures,
} from '../src/services/the-odds-api-maximum-utilization.service.ts'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function assertNoSecret(value) {
  const rendered = JSON.stringify(value)
  if (rendered.includes('apiKey=')) throw new Error('Sanitized artifact still contains apiKey query material.')
  const key = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || ''
  if (key && rendered.includes(key)) throw new Error('Sanitized artifact contains the raw provider key.')
}

function md(result, validation) {
  const matrixRows = result.capabilityMatrix
    .map((row) => `| ${row.label} | ${row.SEASON_STATE} | ${row.CURRENT_EVENTS} | ${row.CURRENT_ODDS} | ${row.EVENT_MARKETS} | ${row.PLAYER_PROPS} | ${row.SCORES} | ${row.HISTORICAL_ODDS} | ${row.BOOKMAKER_COVERAGE.length} | ${row.REGION_COVERAGE.join(', ') || 'none'} |`)
    .join('\n')
  return `# The Odds API Maximum Utilization V1 - Checkpoint 1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Credit Safety

- Provider calls made: ${result.providerCallsMade}
- Requests remaining before: ${result.requestsRemainingBefore ?? 'unavailable'}
- Requests remaining after: ${result.requestsRemainingAfter ?? 'unavailable'}
- Requests used observed: ${result.requestsUsedObserved ?? 'unavailable'}
- Required reserve: ${result.creditReserve}
- Remote mutations: ${result.remoteMutationsMade}
- Production mutations: ${result.productionMutationsMade}
- Rows persisted as odds/predictions: ${result.rowsPersisted}

## Catalog

- Provider sports found: ${result.catalog.providerSportsFound}
- Active provider sports found: ${result.catalog.activeProviderSports ?? 0}
- Mapped sports: ${result.catalog.mappedSports.length}

## Capability Matrix

| Sport | Season state | Current events | Current odds | Event markets | Player props | Scores | Historical odds | Bookmakers | Regions |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
${matrixRows}

## Coverage

- Sports with current events: ${result.coverage.sportsWithCurrentEvents}
- Sports with current odds: ${result.coverage.sportsWithCurrentOdds}
- Sports with score rows: ${result.coverage.sportsWithScores}
- Sports with player-prop rows: ${result.coverage.sportsWithPlayerProps}
- Bookmakers observed: ${result.coverage.bookmakersObserved.join(', ') || 'none'}
- Markets observed: ${result.coverage.marketsObserved.join(', ') || 'none'}

## Validation

- Fixture validation: ${validation.success ? 'PASS' : 'FAIL'}
- Checks passed: ${validation.passed}/${validation.checks}

## Safety Notes

- No API key, authorization header or provider secret is written to this artifact.
- No SQL migration, historical import, feature rebuild, prediction generation or scheduler change was executed.
- Historical odds range discovery remains deferred to the next bounded checkpoint.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

const validation = validateTheOddsApiMaximumUtilizationCheckpoint1Fixtures()
if (!validation.success) {
  console.error(JSON.stringify(validation, null, 2))
  process.exit(1)
}

const result = await runTheOddsApiMaximumUtilizationCheckpoint1({
  live: true,
  dryRun: false,
  confirm: 'ODDS_API_MAX_UTILIZATION_V1',
  maxCalls: 12,
  maxSports: 6,
})

assertNoSecret(result)

const artifact = {
  generatedAt: result.generatedAt,
  commit: git(['rev-parse', 'HEAD']),
  checkpoint: 'THE_ODDS_API_MAXIMUM_UTILIZATION_V1_CHECKPOINT_1',
  result,
  validation,
}

writeFileSync('docs/the-odds-api-maximum-utilization-v1-checkpoint1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/THE_ODDS_API_MAXIMUM_UTILIZATION_V1.md', md(result, validation))

console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  requestsRemainingAfter: result.requestsRemainingAfter,
  reserveMaintained: result.requestsRemainingAfter !== null && result.requestsRemainingAfter > result.creditReserve,
  catalogSportsFound: result.catalog.providerSportsFound,
  mappedSports: result.catalog.mappedSports.length,
  sportsWithCurrentOdds: result.coverage.sportsWithCurrentOdds,
  sportsWithPlayerProps: result.coverage.sportsWithPlayerProps,
  blockers: result.blockers,
}, null, 2))

if (!result.success) process.exit(1)
