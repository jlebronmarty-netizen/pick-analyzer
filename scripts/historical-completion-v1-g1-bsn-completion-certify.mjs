import fs from 'node:fs'

const doc = fs.readFileSync('docs/BSN_COMPLETION_CERTIFICATION_V1.md', 'utf8')

const checks = [
  ['partial custom status documented', doc.includes('partial custom-league foundation certified')],
  ['available rows documented', doc.includes('| teams | 12 | available |') && doc.includes('| events | 38 | partial |')],
  ['result gap documented', doc.includes('| canonical results | 2 | partial/import-required |')],
  ['stats and odds gaps documented', doc.includes('| team/game stats | 0 | empty/import-required |') && doc.includes('| odds snapshots | 0 | unavailable |')],
  ['provider identities documented', doc.includes('| provider identities | 87 | partial |')],
  ['no full production overclaim', doc.includes('not a fully complete production prediction foundation')],
  ['completion source provenance documented', doc.includes('official BSN homepage or approved manual source')],
  ['no fake data boundary documented', doc.includes('no fake odds, stats or results are fabricated')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Imports executed: 0')],
  ['certification markers present', doc.includes('BSN_COMPLETION_CERTIFICATION_V1_PASS') && doc.includes('BSN_CSV_MANUAL_IMPORT_PLAN_ONLY_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'bsn_completion_certification_v1',
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
