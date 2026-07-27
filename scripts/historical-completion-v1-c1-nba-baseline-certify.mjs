import fs from 'node:fs'

const doc = fs.readFileSync('docs/NBA_BASELINE_CERTIFICATION_V1.md', 'utf8')

const checks = [
  ['partial baseline status documented', doc.includes('partial baseline certified')],
  ['teams players events documented', doc.includes('| teams | 30 |') && doc.includes('| players | 579 |') && doc.includes('| events | 14 |')],
  ['canonical results blocked', doc.includes('| canonical results | 0 | blocked |')],
  ['stats and boxscores partial', doc.includes('| team/game stats | 18 |') && doc.includes('| player stats | 918 |') && doc.includes('| boxscores | 18 |')],
  ['odds and props truthful', doc.includes('| odds snapshots | 540 |') && doc.includes('| player props | 0 | empty/blocked |')],
  ['trial isolation preserved', doc.includes('trial/non-production isolation remains the correct operating label')],
  ['production prediction readiness blocked', doc.includes('not certified for production predictions')],
  ['no fabrication rule documented', doc.includes('Do not fabricate missing results, odds, injuries, props or stats.')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Remote mutations: 0') && doc.includes('Retrospective predictions generated: 0')],
  ['certification markers present', doc.includes('NBA_BASELINE_CERTIFICATION_V1_PASS') && doc.includes('NBA_TRIAL_ISOLATION_PRESERVED_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'nba_baseline_certification_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  retrospectivePredictionsGenerated: 0,
  verdict: 'PARTIAL_BASELINE_CERTIFIED_PRODUCTION_BLOCKED'
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
