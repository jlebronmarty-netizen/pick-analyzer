import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02m-r1-exact-market-sample-recovery.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', [
  'MLB_DATA_02M_R1_EXACT_286_MARKET_SAMPLE_RECOVERY_CERTIFIED',
  'MLB_DATA_02M_R1_FRESH_MARKET_SAMPLE_ACQUISITION_REQUIRED_CERTIFIED',
].includes(artifact.certificationVerdict))
check('publication', artifact.publication?.MLB_02M_R1_REPOSITORY_BASELINE === 'PASS' && artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS')
check('inventory', artifact.recoveryEvidenceInventory?.MLB_02M_R1_RECOVERY_EVIDENCE_INVENTORY === 'COMPLETE')
check('no fabrication', artifact.exactRowRecovery?.recoveredRowCount <= artifact.parity?.rows)
check('unmatched excluded', artifact.identityAndPairing?.MLB_02M_R1_UNMATCHED_EVENT_EXCLUSION === 'PASS')
check('provider calls', artifact.boundaries?.MLB_02M_R1_PROVIDER_CALLS === 0 && artifact.freshSample?.MLB_02M_R1_FRESH_PROVIDER_CALL_AUTHORIZED === 'NO')
check('zero dml', artifact.boundaries?.MLB_02M_R1_MARKET_DML === 0 && artifact.boundaries?.MLB_02M_R1_OTHER_MUTATIONS === 0)
check('no value', artifact.boundaries?.MLB_02M_R1_VALUE_WORK === 'NO')

if (artifact.certificationVerdict === 'MLB_DATA_02M_R1_EXACT_286_MARKET_SAMPLE_RECOVERY_CERTIFIED') {
  check('exact rows', artifact.exactRowRecovery.recoveredRowCount === 286 && artifact.exactRowRecovery.missingRows === 0)
  check('aggregate parity', artifact.parity.MLB_02M_R1_RECOVERED_SAMPLE_AGGREGATE_PARITY === 'PASS')
  check('source digest', artifact.parity.MLB_02M_R1_SOURCE_DIGEST_PARITY === 'PASS')
  check('identity', artifact.identityAndPairing.MLB_02M_R1_OBSERVATION_IDENTITY_REBUILD === 'PASS')
  check('frozen', artifact.frozenSample.MLB_02M_R1_EXACT_286_SAMPLE_FROZEN === 'YES' && artifact.frozenSample.MLB_02M_R1_RECOVERED_SAMPLE_SHA256)
  check('dry classification', artifact.dryClassification.MLB_02M_R1_OBSERVATION_DRY_CLASSIFICATION === 'PASS')
} else {
  check('fresh required', artifact.freshSample?.MLB_02M_R1_EXACT_SAMPLE_RECOVERY_FAILED === 'YES')
  check('contract ready', artifact.freshSample?.MLB_02M_R1_FRESH_SAMPLE_CONTRACT_READY === 'YES')
  check('dml not ready', artifact.dryClassification?.MLB_DATA_02M_CURRENT_MONEYLINE_MARKET_DML_READY === 'NO')
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02m-r1-exact-market-sample-recovery-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02m-r1-exact-market-sample-recovery-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    recoveredRows: artifact.exactRowRecovery.recoveredRowCount,
    missingRows: artifact.exactRowRecovery.missingRows,
    freshSampleContract: artifact.freshSample.MLB_02M_R1_FRESH_SAMPLE_CONTRACT_READY,
  }, null, 2))
}
