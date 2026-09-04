import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02b-moneyline-model-training-prep.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02B_MONEYLINE_MODEL_TRAINING_PREP_CERTIFIED')
check('production alignment', flags.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === 'b229387c0fa5dc2eee3d27e89993dff07cfa0967')
check('feature foundation', artifact.baselines?.MLB_02B_FEATURE_FOUNDATION === 'PASS' && artifact.baselines?.featureCounts?.team === 4498 && artifact.baselines?.featureCounts?.bullpen === 4498 && artifact.baselines?.featureCounts?.snapshots === 67433)
check('model zero', artifact.baselines?.MLB_02B_MODEL_ZERO_BASELINE === 'PASS' && Object.values(artifact.baselines?.modelCounts ?? {}).every((count) => count === 0))
check('prediction zero', Object.values(artifact.baselines?.predictionCounts ?? {}).every((count) => count === 0))
check('moneyline rows', artifact.moneylineDataset?.rows === 2249 && artifact.moneylineDataset?.targetGames === 2249)
check('target contract', flags.MLB_02B_MONEYLINE_TARGET_CONTRACT === 'PASS' && artifact.moneylineDataset?.ties === 0 && artifact.moneylineDataset?.unresolvedFinals === 0)
check('row identity', flags.MLB_02B_MONEYLINE_ROW_IDENTITY === 'PASS' && artifact.moneylineDataset?.rowIdentity === 'one canonical training row per game_pk')
check('home away', flags.MLB_02B_HOME_AWAY_REPRESENTATION === 'READY')
check('feature inventory', flags.MLB_02B_MONEYLINE_FEATURE_INVENTORY_COMPLETE === 'YES' && artifact.featureInventory?.candidateFeatureCount >= 70)
check('identifier guard', flags.MLB_02B_IDENTIFIER_LEAKAGE_GUARD === 'PASS' && artifact.featureInventory?.excludedIdentifierFields?.includes('game_pk'))
check('outcome guard', flags.MLB_02B_OUTCOME_FIELD_GUARD === 'PASS' && artifact.featureInventory?.excludedOutcomeFields?.includes('final_home_score'))
check('asof guard', flags.MLB_02B_FEATURE_ASOF_GUARD === 'PASS')
check('missing value', flags.MLB_02B_MISSING_VALUE_CONTRACT === 'READY' && /No silent/.test(artifact.missingValueContract?.policy ?? ''))
check('split ranges', flags.MLB_02B_CHRONOLOGICAL_SPLIT_READY === 'YES' && artifact.splitDesign?.train?.rows === 1574 && artifact.splitDesign?.validation?.rows === 337 && artifact.splitDesign?.test?.rows === 338)
check('split balance', artifact.splitDesign?.MLB_02B_SPLIT_CLASS_BALANCE === 'PASS' && Object.values(artifact.splitDesign?.classBalance ?? {}).every((item) => item.positiveRate > 0.45 && item.positiveRate < 0.6))
check('split distribution', artifact.splitDesign?.MLB_02B_SPLIT_DISTRIBUTION_AUDIT === 'PASS')
check('algorithm shortlist', flags.MLB_02B_ALGORITHM_SHORTLIST_READY === 'YES' && artifact.modelPrep?.algorithmShortlist?.includes('regularized_logistic_regression'))
check('trivial baseline', flags.MLB_02B_TRIVIAL_BASELINE_CONTRACT === 'READY')
check('metrics', flags.MLB_02B_PRIMARY_METRIC_CONTRACT === 'PASS' && artifact.modelPrep?.primaryMetrics?.includes('log_loss'))
check('calibration', flags.MLB_02B_CALIBRATION_PLAN === 'READY')
check('odds absence', flags.MLB_02B_HISTORICAL_ODDS_ABSENCE_HANDLED === 'PASS' && artifact.marketLimitation?.oddsAsTrainingFeature === 'EXCLUDED')
check('walk forward', flags.MLB_02B_WALK_FORWARD_PLAN === 'READY')
check('holdout', flags.MLB_02B_FINAL_HOLDOUT_CONTRACT === 'PASS')
check('digest', flags.MLB_02B_MONEYLINE_DATASET_DIGEST_READY === 'YES' && /^[a-f0-9]{64}$/.test(artifact.moneylineDataset?.datasetDigest ?? ''))
check('feature set', artifact.modelPrep?.MLB_02B_FEATURE_SET_VERSION_READY === 'YES')
check('training config', flags.MLB_02B_TRAINING_CONFIG_CONTRACT === 'READY')
check('champion', flags.MLB_02B_CHAMPION_PROMOTION_CONTRACT === 'READY')
check('probability value separation', flags.MLB_02B_PROBABILITY_VALUE_SEPARATION === 'PASS')
check('runner prep', flags.MLB_02B_TRAINING_RUNNER_PREP === 'PASS' && flags.MLB_02B_TRAINING_EXECUTION_FAIL_CLOSED === 'PASS')
check('zero model work', artifact.safety?.MODEL_WORK_PERFORMED === 'NO' && artifact.safety?.modelTraining === 'NO' && artifact.safety?.modelPersistence === 'NO')
check('zero prediction work', artifact.safety?.PREDICTION_WORK_PERFORMED === 'NO' && artifact.safety?.predictionGeneration === 'NO')
check('zero production mutation', artifact.safety?.productionDml === 0 && artifact.safety?.productionDdl === 0 && artifact.safety?.providerCalls === 0 && artifact.safety?.import2026 === 'NO' && artifact.safety?.automation === 'OFF' && artifact.safety?.cronChanges === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02b-moneyline-training-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02b-moneyline-training-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    datasetDigest: artifact.moneylineDataset.datasetDigest,
  }, null, 2))
}
