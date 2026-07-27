import fs from 'node:fs'

const doc = fs.readFileSync('docs/NBA_RESULT_STAT_COMPLETION_PLAN_V1.md', 'utf8')

const checks = [
  ['plan only status documented', doc.includes('Status: plan-only')],
  ['baseline counts documented', doc.includes('| canonical results | 0 | blocked |') && doc.includes('| player stats | 918 |')],
  ['completion manifests documented', doc.includes('nba_schedule_results_v1') && doc.includes('nba_player_stats_v1')],
  ['player props out of scope', doc.includes('Player props remain out of scope')],
  ['idempotency rules documented', doc.includes('Player stats must key by event, player/provider ID, team and source.')],
  ['temporal safety documented', doc.includes('No retrospective predictions may be generated for already completed events.')],
  ['post import gates documented', doc.includes('no prediction rows are overwritten') && doc.includes('no production NBA activation occurs automatically')],
  ['blockers documented', doc.includes('production mutation approval is not granted in this phase')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Imports executed: 0')],
  ['certification markers present', doc.includes('NBA_RESULT_STAT_COMPLETION_PLAN_V1_PASS') && doc.includes('NO_PROVIDER_CALL_C2_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'nba_result_stat_completion_plan_v1_validation',
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
