import fs from 'node:fs'

const doc = fs.readFileSync('docs/SOCCER_COMPETITION_COMPLETION_PLAN_V1.md', 'utf8')

const checks = [
  ['competition specific status documented', doc.includes('competition-specific empty/blocked baseline certified')],
  ['no global league rule documented', doc.includes('Soccer must not be treated as one global league.')],
  ['empty baseline documented', doc.includes('| teams | 0 | empty/blocked |') && doc.includes('| predictions | 0 | empty/blocked |')],
  ['competition manifests documented', doc.includes('soccer_competition_registry_v1') && doc.includes('soccer_schedule_results_v1')],
  ['required scope documented', doc.includes('competition + season')],
  ['no global overclaim boundary', doc.includes('No global soccer coverage claim.')],
  ['market identity boundary documented', doc.includes('No market rows without certified event identity.')],
  ['recommendation logic blocked', doc.includes('No player props, alternate lines, live markets, EV, Kelly, staking, Official Picks or Portfolio workflows.')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Imports executed: 0')],
  ['certification markers present', doc.includes('SOCCER_COMPETITION_COMPLETION_PLAN_V1_PASS') && doc.includes('SOCCER_NO_GLOBAL_COVERAGE_OVERCLAIM_V1_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'soccer_competition_completion_plan_v1_validation',
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
