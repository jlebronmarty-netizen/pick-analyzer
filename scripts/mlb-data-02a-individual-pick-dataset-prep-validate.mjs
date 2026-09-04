import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02a-individual-pick-model-dataset-preparation.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION_CERTIFIED')
check('production alignment', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '215896e7fc62c95260782fd2ccc77f1c522219b1')
check('live authority', artifact.liveAuthority?.MLB_02A_LIVE_AUTHORITY === 'PASS' && artifact.liveAuthority?.productionAuthorityReady === true)
check('feature foundation', artifact.baselines?.MLB_02A_FEATURE_FOUNDATION_READBACK === 'PASS' && artifact.baselines?.featureCounts?.batter === 44943)
check('raw native', artifact.baselines?.raw?.rawRows === 712528 && artifact.baselines?.nativeCounts?.games === 2430 && artifact.baselines?.nativeCounts?.players === 1469)
check('model prediction zero', Object.values(artifact.baselines?.modelCounts ?? {}).every((count) => count === 0) && Object.values(artifact.baselines?.predictionCounts ?? {}).every((count) => count === 0))
check('dataset prep only', flags.MLB_02A_DATASET_PREP_ONLY_CONTRACT === 'PASS' && artifact.datasetPrepOnlyContract?.fitsModels === false && artifact.datasetPrepOnlyContract?.predictions === false)
check('individual pick target', flags.MLB_02A_INDIVIDUAL_PICK_TARGET_CONTRACT === 'PASS' && artifact.datasetPrepOnlyContract?.parlayLabels === false)
check('ready families', artifact.datasetFamilies?.moneyline?.state === 'READY' && artifact.datasetFamilies?.nrfiYrfi?.state === 'READY' && artifact.datasetFamilies?.pitcherStrikeouts?.state === 'READY' && artifact.datasetFamilies?.batterHits?.state === 'READY')
check('partial/block honest', artifact.datasetFamilies?.runLine?.state === 'PARTIAL' && artifact.datasetFamilies?.pitcherEarnedRuns?.state === 'BLOCKED')
check('label inventory', flags.MLB_02A_LABEL_SOURCE_INVENTORY_COMPLETE === 'YES' && artifact.labelSourceInventory?.pitcherEarnedRuns === 'REQUIRES_RESULT_ADAPTER')
check('outcome market separation', flags.MLB_02A_OUTCOME_MARKET_SEPARATION === 'PASS')
check('split guards', flags.MLB_02A_CHRONOLOGICAL_SPLIT_CONTRACT === 'READY' && flags.MLB_02A_GAME_GROUP_SPLIT_GUARD === 'PASS' && flags.MLB_02A_DOUBLEHEADER_SPLIT_GUARD === 'PASS')
check('asof leakage', flags.MLB_02A_DATASET_ASOF_CONTRACT === 'PASS' && flags.MLB_02A_DATASET_LEAKAGE_DENYLIST === 'PASS')
check('sample counts', artifact.sampleCounts?.gameLevel?.moneyline?.rows === 2249 && artifact.sampleCounts?.gameLevel?.nrfiYrfi?.rows === 2249 && artifact.sampleCounts?.batter?.hits?.rows > 0)
check('quality audits', flags.MLB_02A_MISSINGNESS_MATRIX_READY === 'YES' && flags.MLB_02A_CLASS_BALANCE_AUDIT === 'PASS' && flags.MLB_02A_TARGET_DISTRIBUTION_AUDIT === 'PASS')
check('odds gap documented', Object.values(artifact.historicalOddsAvailability ?? {}).includes('MISSING') && flags.MLB_02A_MARKET_HISTORY_DEPENDENCY_DOCUMENTED === 'YES')
check('artifact policy', artifact.datasetArtifactPolicy?.giantDataExportCommitted === false && artifact.datasetArtifactPolicy?.MLB_02A_DATASET_BUILD_DRY_RUN === 'PASS')
check('first model recommendation', artifact.recommendedFirstModelFamily?.MLB_02A_RECOMMENDED_FIRST_MODEL_FAMILY === 'moneyline')
check('product alignment', flags.MLB_02A_VALUE_BOARD_ALIGNMENT === 'PASS' && flags.MLB_02A_OFFICIAL_PICK_ALIGNMENT === 'PASS' && flags.MLB_02A_PARLAY_POLICY === 'PASS')
check('safety', artifact.safety?.productionDml === 0 && artifact.safety?.productionDdl === 0 && artifact.safety?.providerCalls === 0 && artifact.safety?.modelTraining === 0 && artifact.safety?.predictionGeneration === 0 && artifact.safety?.import2026 === 0 && artifact.safety?.automation === 'OFF' && artifact.safety?.cronChanges === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02a-individual-pick-dataset-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02a-individual-pick-dataset-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    recommendedFirstModelFamily: artifact.recommendedFirstModelFamily.MLB_02A_RECOMMENDED_FIRST_MODEL_FAMILY,
  }, null, 2))
}
