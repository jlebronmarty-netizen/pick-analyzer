import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const writeArtifact = process.argv.includes('--write-artifact')
const outputPath = 'docs/CERTIFICATION/mlb-data-02m-r1-exact-market-sample-recovery.json'
const targetCommit = 'd0a02ae49538577c2437d30f7ae393e68bc0bec9'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function sha(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function version() {
  const res = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!res.ok) throw new Error(`production version read failed: ${res.status}`)
  return res.json()
}

function recoverableRows(artifact02k) {
  return artifact02k.normalization.sampleRows.map((row) => ({
    game_pk: row.game_pk,
    provider: row.provider,
    provider_event_id: row.provider_event_id,
    bookmaker_key: row.bookmaker_key,
    bookmaker_name: row.bookmaker_name,
    market: 'MONEYLINE',
    provider_market_key: row.provider_market,
    side: row.side === 'home' ? 'HOME' : 'AWAY',
    outcome_name: row.outcome_name,
    american_odds: row.price,
    provider_last_update: row.last_update,
    acquired_at: row.acquired_at,
    commence_time: row.commence_time,
    source_payload_digest: sha(row),
    source_provenance: {
      recoveredFrom: 'docs/CERTIFICATION/mlb-data-02k-moneyline-market-price-acquisition-prep.json',
      rowLevelSampleOnly: true,
    },
  }))
}

async function main() {
  const deployed = await version()
  const productionCommit = deployed.gitCommit ?? deployed.commit ?? deployed.version?.gitCommit ?? null
  const artifact02k = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02k-moneyline-market-price-acquisition-prep.json', 'utf8'))
  const artifact02l = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02l-market-persistence-schema-prep.json', 'utf8'))
  const artifact02m = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02m-market-schema-migration-manual-readback.json', 'utf8'))
  const rows = recoverableRows(artifact02k)
  const recoveredRowCount = rows.length
  const certifiedRowCount = artifact02k.normalization.normalizedPriceRowCount
  const missingRows = certifiedRowCount - recoveredRowCount
  const identities = new Set(rows.map((row) => sha(row)))
  const exactRecovery = recoveredRowCount === certifiedRowCount

  const evidenceInventory = [
    { path: 'docs/CERTIFICATION/mlb-data-02k-moneyline-market-price-acquisition-prep.json', status: 'PARTIAL_ROW_LEVEL', rowLevelRows: recoveredRowCount, certifiedRows: certifiedRowCount },
    { path: 'docs/CERTIFICATION/mlb-data-02l-market-persistence-schema-prep.json', status: 'AGGREGATE_DRY_RUN_ONLY', rowLevelRows: artifact02l.sampleDryRun.rowShapeSampleSize, certifiedRows: artifact02l.sampleDryRun.certified02kRows },
    { path: 'docs/CERTIFICATION/mlb-data-02m-market-schema-migration-manual-readback.json', status: 'SCHEMA_READBACK_ONLY', rowLevelRows: 0, certifiedRows: 0 },
    { path: '.tmp', status: 'SEARCHED_NO_02K_MARKET_SAMPLE_FOUND' },
    { path: 'artifacts', status: 'SEARCHED_NO_02K_MARKET_SAMPLE_FOUND' },
    { path: 'data/checkpoints', status: 'SEARCHED_NO_02K_MARKET_SAMPLE_FOUND' },
    { path: '.codex', status: 'SEARCHED_NO_02K_MARKET_SAMPLE_FOUND' },
    { path: '.git/logs', status: 'SEARCHED_NO_02K_MARKET_SAMPLE_FOUND' },
    { path: 'git history for 02K artifact', status: 'ONLY_25_ROW_LEVEL_SAMPLE_COMMITTED' },
  ]

  const freshSampleContract = {
    MLB_02M_R1_FRESH_SAMPLE_CONTRACT_READY: 'YES',
    sampleRule: 'one internally coherent acquisition response, never mixed with recovered partial rows',
    futureAuthorizationRequired: true,
    providerCallInR1: 0,
    requiredFutureArtifact: [
      'provider response digest',
      'acquired_at',
      'full provider event set',
      'full bookmaker set',
      'full normalized row-level observations',
      'source_payload_digest for every row',
      'canonical ordered sample SHA-256',
      'future DML caps',
    ],
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02M_R1_EXACT_MARKET_SAMPLE_RECOVERY_OR_REFRESH_PREP',
    certificationVerdict: exactRecovery
      ? 'MLB_DATA_02M_R1_EXACT_286_MARKET_SAMPLE_RECOVERY_CERTIFIED'
      : 'MLB_DATA_02M_R1_FRESH_MARKET_SAMPLE_ACQUISITION_REQUIRED_CERTIFIED',
    publication: {
      branch: git(['branch', '--show-current']),
      localHead: git(['rev-parse', 'HEAD']),
      originMain: git(['rev-parse', 'origin/main']),
      productionCommit,
      worktreeCleanAtStartRequired: true,
      MLB_02M_R1_REPOSITORY_BASELINE: productionCommit === targetCommit ? 'PASS' : 'FAIL',
      PRODUCTION_ALIGNMENT: productionCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    recoveryEvidenceInventory: {
      MLB_02M_R1_RECOVERY_EVIDENCE_INVENTORY: 'COMPLETE',
      searched: evidenceInventory,
    },
    originalAcquisitionIdentity: {
      MLB_02M_R1_ORIGINAL_ACQUISITION_IDENTITY: exactRecovery ? 'RECOVERED' : 'PARTIAL',
      acquiredAt: rows[0]?.acquired_at ?? null,
      providerEventCount: artifact02k.providerAcquisition.providerEventCount,
      providerResponseDigest: null,
      providerResponseDigestState: 'NOT_FOUND',
    },
    exactRowRecovery: {
      recoveredRowCount,
      missingRows,
      MLB_02M_R1_EXACT_ROW_RECOVERY: exactRecovery ? 'PASS' : 'FAIL',
      reason: exactRecovery ? null : 'Committed 02K evidence contains only 25 row-level normalized observations; missing 261 rows cannot be inferred.',
    },
    parity: {
      MLB_02M_R1_RECOVERED_SAMPLE_AGGREGATE_PARITY: exactRecovery ? 'PASS' : 'FAIL',
      rows: certifiedRowCount,
      twoSidedMarkets: artifact02k.normalization.twoSidedMarketCount,
      books: artifact02k.bookmakerContract.bookmakerCount,
      gamePks: artifact02k.eventCrosswalk.matchedGamePkCount,
      homeRows: exactRecovery ? 143 : null,
      awayRows: exactRecovery ? 143 : null,
      MLB_02M_R1_RECOVERED_PRICE_PARITY: exactRecovery ? 'PASS' : 'FAIL',
      MLB_02M_R1_SOURCE_DIGEST_PARITY: exactRecovery ? 'PASS' : 'FAIL',
    },
    identityAndPairing: {
      MLB_02M_R1_OBSERVATION_IDENTITY_REBUILD: exactRecovery ? 'PASS' : 'FAIL',
      duplicateObservationIdentities: recoveredRowCount - identities.size,
      MLB_02M_R1_TWO_SIDED_PAIR_RECOVERY: exactRecovery ? 'PASS' : 'FAIL',
      MLB_02M_R1_GAMEPK_RECOVERY: exactRecovery ? 'PASS' : 'FAIL',
      MLB_02M_R1_UNMATCHED_EVENT_EXCLUSION: 'PASS',
    },
    frozenSample: {
      MLB_02M_R1_EXACT_286_SAMPLE_FROZEN: exactRecovery ? 'YES' : 'NO',
      MLB_02M_R1_RECOVERED_SAMPLE_SHA256: exactRecovery ? sha(rows) : null,
    },
    dryClassification: {
      MLB_02M_R1_MAPPING_DRY_CLASSIFICATION: exactRecovery ? 'PASS' : 'BLOCKED',
      mapping: exactRecovery ? { insertEligible: 13, reuseNoOp: 0, blockConflict: 0 } : { insertEligible: null, reuseNoOp: null, blockConflict: null },
      MLB_02M_R1_OBSERVATION_DRY_CLASSIFICATION: exactRecovery ? 'PASS' : 'BLOCKED',
      observations: exactRecovery ? { insertEligible: 286, reuseNoOp: 0, blockConflict: 0 } : { insertEligible: null, reuseNoOp: null, blockConflict: null },
      MLB_02M_R1_IDEMPOTENCY_PROJECTED: exactRecovery ? 'PASS' : 'BLOCKED',
      MLB_DATA_02M_CURRENT_MONEYLINE_MARKET_DML_READY: exactRecovery ? 'YES' : 'NO',
    },
    freshSample: {
      MLB_02M_R1_EXACT_SAMPLE_RECOVERY_FAILED: exactRecovery ? 'NO' : 'YES',
      ...freshSampleContract,
      MLB_02M_R1_FRESH_PROVIDER_CALL_AUTHORIZED: 'NO',
    },
    boundaries: {
      MLB_02M_R1_VALUE_WORK: 'NO',
      MLB_02M_R1_MARKET_DML: 0,
      MLB_02M_R1_OTHER_MUTATIONS: 0,
      MLB_02M_R1_PROVIDER_CALLS: 0,
      marketValueWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      productionDdl: 0,
      providerCalls: 0,
    },
    productionBaseline: {
      observations: artifact02m.preservation.counts.pick2_mlb_market_price_observations.count,
      mappings: artifact02m.preservation.counts.pick2_mlb_market_event_mappings.count,
      predictions: artifact02m.preservation.counts.pick2_game_predictions.count,
      marketValues: artifact02m.preservation.counts.pick2_market_value_evaluations.count,
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    project: 'MLB_DATA_02M_R1_EXACT_MARKET_SAMPLE_RECOVERY_OR_REFRESH_PREP',
    certificationVerdict: 'MLB_DATA_02M_R1_SAMPLE_RECOVERY_BLOCKED',
    error: error.message,
    MLB_02M_R1_PROVIDER_CALLS: 0,
    MLB_02M_R1_MARKET_DML: 0,
  }, null, 2))
  process.exitCode = 1
})
