import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02j-r3-current-moneyline-prediction-dml-retry.json', 'utf8'))
const auditExists = fs.existsSync('docs/CERTIFICATION/mlb-data-02j-r3-current-moneyline-prediction-persistence-audit.md')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02J_R3_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_CERTIFIED')
check('publication', artifact.publication?.publicationRecovered === 'PASS' && artifact.publication?.productionCommit === 'c8de8a17746ef8ab607862ccb8e64c2a3129b209')
check('schema', artifact.schemaRepairReadback?.nullable === 'YES' && artifact.schemaRepairReadback?.fkTarget === 'public.pick2_feature_snapshots(id)')
check('frozen', artifact.frozen?.count === 24 && artifact.frozen?.asOf === '2026-09-05T01:51:21.667Z' && artifact.frozen?.payloadParity === 'PASS')
check('champion', artifact.champion?.count === 1 && artifact.champion?.modelVersion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('prewrite', artifact.prewrite?.insertEligible + artifact.prewrite?.reuseNoOp === 24 && artifact.prewrite?.blockConflict === 0 && artifact.prewrite?.actualDmlCap <= 24)
check('insert accounting', artifact.insertExecution?.attempted <= 24 && artifact.insertExecution?.inserted <= 24 && artifact.insertExecution?.conflicts === 0 && artifact.insertExecution?.failed === 0 && artifact.insertExecution?.updates === 0 && artifact.insertExecution?.deletes === 0)
check('row parity', artifact.postwrite?.finalFrozenPredictionCount === 24 && artifact.postwrite?.rowParity === 'PASS')
check('payload', artifact.postwrite?.payloadReadback === 'PASS' && artifact.postwrite?.probabilityReadback === 'PASS')
check('null snapshot', artifact.postwrite?.nullSnapshotReadback === 'PASS' && artifact.postwrite?.nullSnapshotCount === 24)
check('identity', artifact.postwrite?.duplicateIdentities === 0)
check('idempotency', artifact.postwrite?.idempotency?.insertEligible === 0 && artifact.postwrite?.idempotency?.reuseNoOp === 24 && artifact.postwrite?.idempotency?.blockConflict === 0)
check('result market separation', artifact.boundaries?.predictionResultWrites === 0 && artifact.boundaries?.marketValueWrites === 0)
check('official provider separation', artifact.boundaries?.officialPicksCreated === 0 && artifact.boundaries?.providerCalls === 0)
check('foundation', artifact.boundaries?.MLB_02J_R3_FOUNDATION_PRESERVED === 'PASS')
check('ddl', artifact.boundaries?.productionDdl === 0)
check('02k ready', artifact.semantics?.MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_READY === 'YES')
check('odds unauthorized', artifact.semantics?.MLB_02J_R3_THE_ODDS_API_AUTHORIZED === 'NO')
check('audit', auditExists)

if (errors.length) {
  console.error(JSON.stringify({
    validator: 'mlb-data-02j-r3-current-moneyline-prediction-dml-retry-validate',
    status: 'FAIL',
    errors,
  }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02j-r3-current-moneyline-prediction-dml-retry-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    inserted: artifact.insertExecution.inserted,
    finalFrozenPredictionCount: artifact.postwrite.finalFrozenPredictionCount,
  }, null, 2))
}
