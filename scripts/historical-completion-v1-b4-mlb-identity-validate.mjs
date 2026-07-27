import fs from 'node:fs'

const doc = fs.readFileSync('docs/MLB_PLAYER_STARTER_IDENTITY_V3.md', 'utf8')

const checks = [
  ['stored identity evidence documented', doc.includes('MLB provider identity rows: 59239')],
  ['sportsdataio identity domain documented', doc.includes('SportsDataIO player ID')],
  ['retrosheet identity domain documented', doc.includes('Retrosheet player ID')],
  ['odds api pitcher name domain documented', doc.includes('The Odds API pitcher name')],
  ['normalized only blocked', doc.includes('normalized-only name match')],
  ['manual review queue documented', doc.includes('"blockingReason"')],
  ['starter identity rules documented', doc.includes('Starter assignment can be projection-eligible only when')],
  ['no ambiguous persistence marker present', doc.includes('NO_AMBIGUOUS_PLAYER_PERSISTENCE_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'mlb_player_starter_identity_v3_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  newMappingsPersisted: 0
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
