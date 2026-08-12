import { readFileSync } from 'node:fs'

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed, detail })
}

const orchestrator = readFileSync('src/services/adaptive-refresh-orchestrator.service.ts', 'utf8')
const predictionWriter = readFileSync('src/services/sportsdataio-mlb-prospective-preview.service.ts', 'utf8')
const oddsAcquisition = readFileSync('src/services/the-odds-api-current-odds-acquisition.service.ts', 'utf8')
const cert = JSON.parse(readFileSync('docs/CERTIFICATION/mlb-aug12-morning-pipeline-recovery.json', 'utf8'))

check(
  'The Odds API provider timestamp is persisted to column',
  /provider_timestamp:\s*snapshotTime/.test(oddsAcquisition),
  'sports_odds_snapshots.provider_timestamp must not rely on metadata only.'
)
check(
  'The Odds API odds classification is persisted',
  /odds_classification:\s*productPriceAuthority\s*\?/.test(oddsAcquisition),
  'Stage 3 rows should carry product-primary classification.'
)
check(
  'stored-odds writer imports authority runtime',
  predictionWriter.includes("getOddsPrimaryAuthorityRuntimeStatus"),
  'Writer must select provider based on authority stage.'
)
check(
  'stored-odds writer supports The Odds API provider',
  predictionWriter.includes("const THE_ODDS_API_PROVIDER = 'the-odds-api'"),
  'Stage 3 must not be hard-wired to SportsDataIO odds rows.'
)
check(
  'stored-odds writer requires product primary metadata',
  predictionWriter.includes("metadata.productPriceAuthority === true") &&
    predictionWriter.includes("metadata.validation_status === 'product_primary'") &&
    predictionWriter.includes("STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT"),
  'The Odds API rows must be product-authoritative Stage 3 evidence.'
)
check(
  'stored-odds writer still preserves SportsDataIO quarantine path',
  predictionWriter.includes("metadata.production_eligible === false && metadata.validation_status === 'quarantined'"),
  'Legacy rollback path must remain unchanged.'
)
check(
  'orchestrator triggers writer after The Odds API row changes',
  orchestrator.includes('theOddsApiRowsChanged') &&
    orchestrator.includes('rowsInserted') &&
    orchestrator.includes('generateMlbProspectivePredictionsFromStoredOdds'),
  'Prediction generation must be chained after Stage 3 acquisition changes.'
)
check(
  'orchestrator preserves SportsDataIO suppression',
  orchestrator.includes('SKIPPED_AUTHORITY_NOT_SPORTSDATAIO') &&
    orchestrator.includes('shouldSuppressSportsDataIoOddsAcquisition'),
  'SportsDataIO remains rollback-only in Stage 3.'
)
check(
  'certification records zero certification provider calls',
  cert.safety.providerCallsFromCertification === 0,
  'Read-only certification cannot consume providers.'
)
check(
  'certification records no production mutation during local certification',
  cert.safety.productionDatabaseMutationsFromCertification === 0,
  'The local repair certification did not execute production recovery writes.'
)
check(
  'no provider authority change',
  cert.safety.providerAuthorityChanged === false,
  'ODDS_PRIMARY_AUTHORITY_STAGE is configuration controlled.'
)

const failed = checks.filter((item) => !item.passed)
for (const item of checks) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` - ${item.detail}` : ''}`)
}
if (failed.length) {
  console.error(`MLB Aug 12 pipeline recovery validation failed: ${failed.length}`)
  process.exit(1)
}
console.log('MLB Aug 12 pipeline recovery validation PASS')
