import fs from 'node:fs'

const doc = fs.readFileSync('docs/NHL_BASELINE_AND_COMPLETION_PLAN_V1.md', 'utf8')

const checks = [
  ['empty blocked status documented', doc.includes('empty/blocked baseline certified')],
  ['core zeros documented', doc.includes('| teams | 0 | empty/blocked |') && doc.includes('| events | 0 | empty/blocked |')],
  ['results stats market zeros documented', doc.includes('| canonical results | 0 | empty/blocked |') && doc.includes('| odds snapshots | 0 | empty/blocked |')],
  ['goalie context documented', doc.includes('| goalie/starter context | 0 | empty/blocked |')],
  ['future manifests documented', doc.includes('nhl_team_player_identity_v1') && doc.includes('nhl_goalies_injuries_v1')],
  ['cross year season governance documented', doc.includes('Use cross-year season governance for NHL seasons.')],
  ['goalie temporal safety documented', doc.includes('Do not use post-start goalie evidence as pregame input.')],
  ['activation blocked', doc.includes('NHL remains blocked from production predictions')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Imports executed: 0')],
  ['certification markers present', doc.includes('NHL_BASELINE_AND_COMPLETION_PLAN_V1_PASS') && doc.includes('NHL_GOALIE_TEMPORAL_SAFETY_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'nhl_baseline_and_completion_plan_v1_validation',
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
