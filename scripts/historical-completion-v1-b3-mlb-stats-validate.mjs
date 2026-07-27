import fs from 'node:fs'

const doc = fs.readFileSync('docs/MLB_BOXSCORE_STAT_COMPLETION_V3.md', 'utf8')

const checks = [
  ['stored stat counts documented', doc.includes('Player stat rows: 47232') && doc.includes('Team/game stat rows: 2926')],
  ['supported stat domains documented', doc.includes('recorded outs') && doc.includes('earned runs')],
  ['pitch count nullable boundary documented', doc.includes('Pitch count is optional')],
  ['team reconciliation documented', doc.includes('Team stat reconciliation')],
  ['player identity guard documented', doc.includes('provider player IDs must never be guessed') || doc.includes('provider player IDs must never be guessed'.replace('provider', 'Provider'))],
  ['recorded outs quarantine documented', doc.includes('direct outs and innings-derived outs conflicts are quarantined') || doc.includes('Direct outs and innings-derived outs conflicts are quarantined')],
  ['execution remains blocked', doc.includes('Execution remains blocked until approved')],
  ['feature rebuild not executed', doc.includes('Feature rebuilds executed: 0')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'mlb_boxscore_stat_completion_v3_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  blockers: ['production_stat_import_requires_separate_approval']
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
