import { existsSync, readFileSync } from 'node:fs'
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

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

const {
  runTheOddsApiCurrentOddsAcquisition,
  validateTheOddsApiCurrentOddsAcquisitionFixtures,
} = await import('../src/services/the-odds-api-current-odds-acquisition.service.ts')

const fixture = validateTheOddsApiCurrentOddsAcquisitionFixtures()
const dry = await runTheOddsApiCurrentOddsAcquisition({ dryRun: true })
const rendered = JSON.stringify(dry)
const checks = [
  ['fixture validation passes', fixture.success],
  ['dry run succeeds', dry.success],
  ['dry run makes zero provider calls', dry.providerCallsMade === 0],
  ['dry run makes zero database mutations', dry.productionMutationsMade === 0],
  ['dry run renders no api key query', !rendered.includes('apiKey=')],
  ['dry run has current odds mode', dry.mode === 'the_odds_api_current_odds_acquisition_v1'],
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
