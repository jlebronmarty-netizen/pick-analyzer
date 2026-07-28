import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function assertNoSecret(value) {
  const rendered = JSON.stringify(value)
  if (rendered.includes('apiKey=')) throw new Error('Artifact contains secret-bearing apiKey query material.')
  const key = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || ''
  if (key && rendered.includes(key)) throw new Error('Artifact contains the raw provider key.')
}

function md(result, validation) {
  const sportRows = result.sportsAttempted
    .map((row) => `| ${row.label} | ${row.providerSportKey} | ${row.eventsFetched} | ${row.futureEvents} | ${row.oddsEventsReturned} | ${row.rowsAccepted} | ${row.bookmakerCount} | ${(row.markets ?? []).join(', ') || 'none'} |`)
    .join('\n')
  return `# The Odds API Current Odds Acquisition V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Credit Safety

- Provider calls made: ${result.providerCallsMade}
- Requests remaining before: ${result.requestsRemainingBefore ?? 'unavailable'}
- Requests remaining after: ${result.requestsRemainingAfter ?? 'unavailable'}
- Requests used observed: ${result.requestsUsedObserved ?? 'unavailable'}
- Required reserve: ${result.creditReserve}

## Persistence

- Rows accepted: ${result.rowsAccepted}
- Rows rejected: ${result.rowsRejected}
- Rows inserted: ${result.rowsInserted}
- Rows updated: ${result.rowsUpdated}
- Mappings upserted: ${result.mappingsUpserted}
- Duplicate deterministic IDs: ${result.duplicateIds}
- Production mutations recorded: ${result.productionMutationsMade}

## Sport Coverage

| Sport | Provider key | Events | Future events | Odds events | Rows accepted | Bookmakers | Markets |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${sportRows}

## Validation

- Fixture validation: ${validation.success ? 'PASS' : 'FAIL'}
- Checks passed: ${validation.passed}/${validation.checks}

## Safety Notes

- Event mappings are provider-native and marked pending canonical crosswalk; canonical sport events are not overwritten.
- Only h2h, spreads and totals are acquired in this checkpoint.
- No prediction generation, feature rebuild, SQL migration, scheduler change, settlement write or recommendation-policy change was executed.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

const {
  runTheOddsApiCurrentOddsAcquisition,
  validateTheOddsApiCurrentOddsAcquisitionFixtures,
} = await import('../src/services/the-odds-api-current-odds-acquisition.service.ts')

const validation = validateTheOddsApiCurrentOddsAcquisitionFixtures()
if (!validation.success) {
  console.error(JSON.stringify(validation, null, 2))
  process.exit(1)
}

const result = await runTheOddsApiCurrentOddsAcquisition({
  live: true,
  dryRun: false,
  persist: true,
  confirm: 'ODDS_API_CURRENT_ODDS_V1',
  maxCalls: 18,
  maxSports: 6,
  certifyIdempotency: true,
})

assertNoSecret(result)

const artifact = {
  generatedAt: result.generatedAt,
  commit: git(['rev-parse', 'HEAD']),
  checkpoint: 'THE_ODDS_API_CURRENT_ODDS_ACQUISITION_V1',
  result,
  validation,
}

writeFileSync('docs/the-odds-api-current-odds-v1.json', `${JSON.stringify(artifact, null, 2)}\n`)
writeFileSync('docs/THE_ODDS_API_CURRENT_ODDS_V1.md', md(result, validation))

console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  requestsRemainingAfter: result.requestsRemainingAfter,
  rowsAccepted: result.rowsAccepted,
  rowsInserted: result.rowsInserted,
  rowsUpdated: result.rowsUpdated,
  mappingsUpserted: result.mappingsUpserted,
  duplicateIds: result.duplicateIds,
  productionMutationsMade: result.productionMutationsMade,
  blockers: result.blockers,
}, null, 2))

if (!result.success) process.exit(1)
