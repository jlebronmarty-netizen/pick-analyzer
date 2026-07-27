import fs from 'node:fs'

const file = 'docs/SPORTS_DATA_SOURCE_REGISTRY_V2.md'
const text = fs.readFileSync(file, 'utf8')

const checks = [
  ['registry file exists', fs.existsSync(file)],
  ['SportsDataIO documented', text.includes('SportsDataIO')],
  ['The Odds API documented', text.includes('The Odds API')],
  ['Retrosheet documented', text.includes('Retrosheet')],
  ['manual CSV documented', text.includes('Manual CSV')],
  ['no secrets claim', text.includes('stores no secrets') || text.includes('Secrets stored: no')],
  ['historical odds blocked unless approved', text.includes('no historical odds calls') && text.includes('entitlement/cost')],
  ['source provenance marker present', text.includes('SOURCE_PROVENANCE_REGISTRY_V2_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'source_provenance_registry_v2_validation',
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
