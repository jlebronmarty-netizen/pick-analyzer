import fs from 'node:fs'

const doc = fs.readFileSync('docs/NFL_COMPLETION_PLAN_V1.md', 'utf8')

const checks = [
  ['plan only status documented', doc.includes('Status: plan-only')],
  ['empty baseline documented', doc.includes('| teams | 0 | empty/blocked |') && doc.includes('| odds snapshots | 0 | empty/blocked |')],
  ['legacy prediction preservation documented', doc.includes('| legacy predictions | 190 | preserve only |')],
  ['future manifests documented', doc.includes('nfl_team_player_identity_v1') && doc.includes('nfl_market_snapshots_v1')],
  ['props and recommendation logic out of scope', doc.includes('Player props, alternate lines, live markets, EV, Kelly, staking, Official Picks and Portfolio workflows remain out of scope.')],
  ['season governance documented', doc.includes('Use NFL season year, not calendar year')],
  ['no retrospective predictions documented', doc.includes('Do not generate retrospective predictions for imported completed games.')],
  ['post import gates documented', doc.includes('legacy prediction rows remain unchanged') && doc.includes('no production NFL activation occurs automatically')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Imports executed: 0')],
  ['certification markers present', doc.includes('NFL_COMPLETION_PLAN_V1_PASS') && doc.includes('NFL_IMPORT_MANIFESTS_PLAN_ONLY_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'nfl_completion_plan_v1_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  importsExecuted: 0,
  retrospectivePredictionsGenerated: 0
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
