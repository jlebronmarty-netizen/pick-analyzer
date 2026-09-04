import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02e-moneyline-champion-promotion.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}
const counts = artifact.persistence?.finalCounts ?? {}
const accounting = artifact.persistence?.accounting ?? {}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02E_MONEYLINE_CHAMPION_PROMOTION_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '87830c2ef2bc2d2a3c961e0016c9595ec6558665')
check('artifact', flags.MLB_02E_MODEL_ARTIFACT_INTEGRITY === 'PASS' && artifact.model?.artifactDigest === '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616')
check('dataset', flags.MLB_02E_DATASET_MODEL_IDENTITY === 'PASS' && artifact.model?.datasetDigest === '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209')
check('eligibility', flags.MLB_02E_PROMOTION_ELIGIBILITY === 'ELIGIBLE')
check('zero prewrite', flags.MLB_02E_PREWRITE_MODEL_ZERO_STATE === 'PASS' && Object.values(artifact.prewrite?.modelCounts ?? {}).every((count) => count === 0))
check('conflict audit', flags.MLB_02E_PREWRITE_CONFLICT_AUDIT === 'PASS' && Object.values(artifact.prewrite?.conflictAudit ?? {}).every((result) => result.conflicts === 0))
check('write cap', flags.MLB_02E_DML_ACCOUNTING === 'PASS' && accounting.totalLogicalNewWrites <= 6 && accounting.totalPhysicalRowsInserted === 5 && accounting.unrelatedDml === 0)
check('model table parity', flags.MLB_02E_MODEL_TABLE_PARITY === 'PASS' && counts.registry === 1 && counts.featureSets === 1 && counts.versions === 1 && counts.trainingRuns === 1 && counts.validationRuns === 1 && counts.champions === 1)
check('single champion', flags.MLB_02E_SINGLE_CHAMPION_STATE === 'PASS' && artifact.persistence?.championReadback?.modelVersion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('champion readback', flags.MLB_02E_CHAMPION_READBACK === 'PASS' && artifact.persistence?.championReadback?.artifactDigest === artifact.model?.artifactDigest && artifact.persistence?.championReadback?.featureSet === 'MLB_ML_FEATURE_SET_V1')
check('immutability', flags.MLB_02E_MODEL_METADATA_IMMUTABILITY === 'PASS')
check('prediction boundary', flags.MLB_02E_PREDICTION_BOUNDARY === 'PASS' && artifact.predictionBoundary?.predictions === 0 && artifact.predictionBoundary?.predictionResults === 0 && artifact.predictionBoundary?.marketValueEvaluations === 0 && artifact.predictionBoundary?.officialPicks === 0)
check('auto inference', flags.MLB_02E_PROMOTION_AUTO_INFERENCE === 'NO')
check('outcome only', flags.MLB_02E_OUTCOME_ONLY_CHAMPION_BOUNDARY === 'PASS' && artifact.predictionBoundary?.evCertification === 'NO' && artifact.predictionBoundary?.valueBoardReady === 'NO')
check('idempotency', flags.MLB_02E_PROMOTION_IDEMPOTENCY === 'PASS' && artifact.idempotency?.newWritesProjected === 0 && Object.values(artifact.idempotency?.secondReadOnlyPass ?? {}).every((result) => result.inserts === 0 && result.conflicts === 0))
check('feature foundation', flags.MLB_02E_FEATURE_FOUNDATION_UNCHANGED === 'PASS' && artifact.dataSafety?.featureFoundationAfter?.team === 4498 && artifact.dataSafety?.featureFoundationAfter?.snapshots === 67433)
check('raw native', flags.MLB_02E_RAW_NATIVE_UNCHANGED === 'PASS' && artifact.dataSafety?.rawNativeAfter?.raw === 712528 && artifact.dataSafety?.rawNativeAfter?.nativeGames === 2430 && artifact.dataSafety?.rawNativeAfter?.nativePlayers === 1469)
check('safety', artifact.safety?.providerCalls === 0 && artifact.safety?.productionDdl === 0 && artifact.safety?.predictionWrites === 0 && artifact.safety?.marketValueWrites === 0 && artifact.safety?.featureWrites === 0 && artifact.safety?.rawWrites === 0 && artifact.safety?.import2026 === 'NO' && artifact.safety?.automation === 'OFF' && artifact.safety?.cronChanges === 0 && flags.PREDICTION_WORK_PERFORMED === 'NO')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02e-moneyline-champion-promotion-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02e-moneyline-champion-promotion-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    champion: artifact.persistence.championReadback,
    productionDmlRows: artifact.safety.productionDmlRows,
  }, null, 2))
}
