import fs from 'node:fs'

const doc = fs.readFileSync('docs/NBA_IDENTITY_MARKET_READINESS_V1.md', 'utf8')

const checks = [
  ['readiness status documented', doc.includes('readiness contract prepared')],
  ['stored evidence documented', doc.includes('| provider identities | 2335 |') && doc.includes('| player props | 0 | unavailable |')],
  ['exact identity allowed', doc.includes('exact provider ID to canonical NBA player mapping')],
  ['ambiguous identity blocked', doc.includes('normalized-only player name persistence') && doc.includes('fuzzy player identity persistence')],
  ['market readiness partial', doc.includes('partial/trial evidence only')],
  ['player props blocked', doc.includes('NBA player props')],
  ['no ev kelly recommendation boundary', doc.includes('EV, Kelly, stake, bankroll, official-pick or portfolio logic')],
  ['activation gates documented', doc.includes('settlement and replay support are certified') && doc.includes('prediction model readiness is separately certified')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Market rows created: 0')],
  ['certification markers present', doc.includes('NBA_IDENTITY_MARKET_READINESS_V1_PASS') && doc.includes('NBA_PLAYER_PROPS_REMAIN_BLOCKED_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'nba_identity_market_readiness_v1_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  newMappingsPersisted: 0,
  marketRowsCreated: 0
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
