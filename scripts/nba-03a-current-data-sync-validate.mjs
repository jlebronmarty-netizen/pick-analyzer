import fs from 'node:fs'

const certPath = 'docs/CERTIFICATION/nba-03a-current-data-sync.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_CURRENT_DATA_SYNC.md'
const adapterPath = 'src/services/multi-sport-adapters.service.ts'

const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const adapter = fs.readFileSync(adapterPath, 'utf8')

const checks = []
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) })
}

check('status ready for first shadow authorization', cert.status === 'NBA_03A_CURRENT_DATA_SYNC_PASS_READY_FOR_FIRST_SHADOW_AUTHORIZATION')
check('adapter reuses THE_ODDS_API_KEY first', adapter.includes('process.env.THE_ODDS_API_KEY?.trim()'))
check('legacy ODDS_API_KEY fallback preserved', adapter.includes('process.env.ODDS_API_KEY?.trim()'))
check('The Odds API calls bounded', cert.providerCalls.theOddsApi.count === 2)
check('SportsDataIO not called', cert.providerCalls.sportsDataIo.count === 0 && cert.providerArchitecture.sportsDataIoUsed === false)
check('future NBA events persisted', cert.scheduleSync.storedFutureNbaEventsAfterSync === 41)
check('odds snapshots persisted', cert.oddsSync.snapshotsStored === 608)
check('moneyline spread total covered', ['moneyline', 'spread', 'total'].every((market) => cert.oddsSync.supportedMarkets.includes(market)))
check('no fake fallback odds', cert.dataIntegrity.fakeFallbackOdds === 0)
check('no trial SportsDataIO evidence', cert.dataIntegrity.trialSportsDataIoEvidenceUsed === 0)
check('canary dry-run only', cert.safeCanaryDryRun.mode === 'dry-run' && cert.safeCanaryDryRun.databaseMutationsFromDryRun === 0)
check('eligible canary opportunities found', cert.safeCanaryDryRun.fullyEligible > 0)
check('no Current Era Shadow rows written', cert.isolation.currentEraShadowDelta === 0)
check('historical replay unchanged', cert.isolation.historicalReplayShadowDelta === 0)
check('MLB unchanged', cert.isolation.mlbMutationDelta === 0)
check('next instruction preserves separate authorization', cert.next.readyForFirstShadowAuthorization === true && doc.includes('separate authorization boundary'))

const failed = checks.filter((item) => !item.passed)
for (const item of checks) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}`)
}

console.log(`\nnba_03a_current_data_sync_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) process.exit(1)
