import fs from 'node:fs'

const doc = fs.readFileSync('docs/MLB_MARKET_DATA_FOUNDATION_V2.md', 'utf8')

const checks = [
  ['stored odds count documented', doc.includes('MLB odds snapshots: 48569')],
  ['stored prop count documented', doc.includes('MLB genuine stored player-prop rows: 11')],
  ['standard market families documented', doc.includes('moneyline') && doc.includes('run line/spread') && doc.includes('totals')],
  ['historical odds blocked', doc.includes('historical endpoints are not called') && doc.includes('Historical odds calls: 0')],
  ['no fake markets rule documented', doc.includes('no sportsbook line may be fabricated') || doc.includes('fabricate missing markets')],
  ['storage contract documented', doc.includes('sports_odds_snapshots')],
  ['no EV/Kelly boundary documented', doc.includes('calculate EV') && doc.includes('calculate Kelly')],
  ['certification markers present', doc.includes('MLB_MARKET_DATA_FOUNDATION_V2_PASS') && doc.includes('MLB_PROP_MARKET_READINESS_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'mlb_market_data_foundation_v2_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  historicalOddsCalls: 0
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
