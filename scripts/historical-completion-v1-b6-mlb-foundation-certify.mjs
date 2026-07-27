import fs from 'node:fs'

const doc = fs.readFileSync('docs/MLB_HISTORICAL_FOUNDATION_V3_CERTIFICATION.md', 'utf8')

const checks = [
  ['core partial verdict documented', doc.includes('certified core/partial foundation')],
  ['no full completion overclaim', doc.includes('not certified as historically complete')],
  ['result gap documented', doc.includes('| sport results | 471 | partial/import-required |')],
  ['stat and boxscore gaps documented', doc.includes('| team/game stats | 2926 | partial/import-required |') && doc.includes('| boxscores | 2926 | partial/import-required |')],
  ['injury gap documented', doc.includes('| injuries | 0 | empty/provider-blocked |')],
  ['market blockers documented', doc.includes('historical odds/opening/closing line coverage') && doc.includes('broader player props and alternate markets')],
  ['no execution boundary documented', doc.includes('provider calls remain 0') && doc.includes('remote and production mutations remain 0')],
  ['temporal and retrospective safety documented', doc.includes('temporal leakage protections are preserved') && doc.includes('Retrospective predictions generated: 0')],
  ['certification markers present', doc.includes('MLB_HISTORICAL_FOUNDATION_V3_CORE_PARTIAL_PASS') && doc.includes('MLB_HISTORICAL_FOUNDATION_V3_NO_FULL_COMPLETION_OVERCLAIM_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'mlb_historical_foundation_v3_certification',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  historicalOddsCalls: 0,
  retrospectivePredictionsGenerated: 0,
  verdict: 'CORE_PARTIAL_CERTIFIED_IMPORTS_REQUIRED'
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
