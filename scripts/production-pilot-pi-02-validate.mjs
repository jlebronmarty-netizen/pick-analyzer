import fs from 'node:fs'

const jsonPath = 'docs/CERTIFICATION/production-pilot-pi-02.json'
const mdPath = 'docs/PRODUCTION_PILOT/INCIDENT_PI_02_MARKET_FRESHNESS_LINEAGE.md'

const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const md = fs.readFileSync(mdPath, 'utf8')

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
}

check('exact market identity traced', json.freshness.exactMarket.eventId && json.freshness.exactMarket.market && json.freshness.exactMarket.selection)
check('capture time distinguished', json.freshness.exactMarket.snapshotCaptureTimestamp !== json.freshness.exactMarket.providerSourceTimestamp)
check('source market time distinguished', json.freshness.exactMarket.providerSourceTimestamp === '2026-08-08T14:07:23.000Z')
check('freshness contracts inventoried', md.includes('Freshness Contract Matrix'))
check('homepage/dashboard/current-board source identified', md.includes('latestOddsTimestamp') && md.includes('SNAPSHOT_CAPTURE_TIMESTAMP'))
check('most likely source identified', md.includes('Most Likely') && md.includes('productFreshness.marketTimestamp'))
check('operations source identified', md.includes('Operations/Product Freshness SLA'))
check('90 snapshots reconciled', json.freshness.acquisition.normalizedRowsProduced === 90 && json.freshness.acquisition.rowsInserted === 90)
check('unchanged source not falsely counted fresh actionability', json.freshness.currentBoard.productFreshnessByActionability.ACTIONABLE === 0)
check('stale evidence cannot become actionable', json.freshness.staleEvidenceActionable === false)
check('no freshness threshold changed', md.includes('No prediction formula') && md.includes('freshness threshold changed'))
check('prior-day denominator preserved', json.priorDay.canonicalPredictions === 42)
check('all 18 unsettled rows inventoried', json.priorDay.remainingBefore === 18 && md.match(/^[\\-] `[0-9a-f-]+`/gm)?.length === 18)
check('prior-day equation balances', json.priorDay.canonicalPredictions === json.priorDay.settledBefore + json.priorDay.validPending + json.priorDay.blocked)
check('silent pending is zero', json.priorDay.silentPending === 0)
check('no retrospective prediction created', json.readOnlyCertification.predictionWrites === 0)
check('no fabricated settlement', json.readOnlyCertification.settlementWrites === 0)
check('replay remains isolated by omission from repair', json.runtimeCommit === null && json.readOnlyCertification.predictionWrites === 0)
check('certification reads used zero provider calls', json.readOnlyCertification.providerCallsFromCertificationReads === 0)
check('certification reads used zero mutations', json.readOnlyCertification.databaseMutationsFromCertificationReads === 0)
check('pilot remains active', json.productionPilotWeek === 'ACTIVE')
check('mc03 not started', json.mc03Started === false)

const failed = checks.filter((item) => !item.passed)
const result = {
  mode: 'production_pilot_pi_02_validation_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length) process.exit(1)

