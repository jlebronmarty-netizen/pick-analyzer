import fs from 'node:fs'

const doc = fs.readFileSync('docs/NFL_BASELINE_CERTIFICATION_V1.md', 'utf8')

const checks = [
  ['empty blocked status documented', doc.includes('empty/blocked foundation certified')],
  ['core zeros documented', doc.includes('| teams | 0 | empty/blocked |') && doc.includes('| events | 0 | empty/blocked |')],
  ['results stats odds zeros documented', doc.includes('| canonical results | 0 | empty/blocked |') && doc.includes('| odds snapshots | 0 | empty/blocked |')],
  ['legacy predictions preserved', doc.includes('| predictions | 190 | legacy preserved |') && doc.includes('| settlement evidence | 190 | legacy preserved |')],
  ['production readiness blocked', doc.includes('not ready for production prediction')],
  ['no fabrication documented', doc.includes('no missing sport rows are fabricated')],
  ['season safety documented', doc.includes('season-year governance with cross-calendar postseason handling')],
  ['blockers documented', doc.includes('team/player dimension import') && doc.includes('model readiness')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Imports executed: 0')],
  ['certification markers present', doc.includes('NFL_BASELINE_CERTIFICATION_V1_PASS') && doc.includes('NFL_EMPTY_FOUNDATION_NO_PRODUCTION_OVERCLAIM_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'nfl_baseline_certification_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  importsExecuted: 0,
  retrospectivePredictionsGenerated: 0,
  verdict: 'EMPTY_BLOCKED_FOUNDATION_CERTIFIED'
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
