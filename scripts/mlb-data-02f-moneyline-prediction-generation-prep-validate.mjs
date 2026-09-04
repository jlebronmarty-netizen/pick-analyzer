import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02f-moneyline-prediction-generation-prep.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}
const safety = artifact.safety ?? {}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02F_MONEYLINE_PREDICTION_GENERATION_PREP_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '9102cabeb6ff1a255c3012ccfacc78c4ddb6efbd')
check('champion', flags.MLB_02F_CHAMPION_READBACK === 'PASS' && artifact.champion?.count === 1 && artifact.champion?.modelVersion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('artifact', flags.MLB_02F_MODEL_ARTIFACT_INTEGRITY === 'PASS' && artifact.modelArtifact?.digest === '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616')
check('feature ordering', flags.MLB_02F_FEATURE_ORDERING === 'PASS' && artifact.modelArtifact?.featureCount === 76)
check('preprocessing', flags.MLB_02F_PREPROCESSING_READBACK === 'PASS' && artifact.modelArtifact?.preprocessing === 'train_only_median_impute_then_standardize')
check('input contract', flags.MLB_02F_GAME_IDENTITY_CONTRACT === 'PASS' && flags.MLB_02F_INFERENCE_ASOF_CONTRACT === 'PASS' && flags.MLB_02F_REQUIRED_FEATURE_DOMAINS === 'READY' && flags.MLB_02F_MISSINGNESS_CONTRACT === 'PASS')
check('sample replay', flags.MLB_02F_REPLAY_SAMPLE_READY === 'YES' && artifact.replay?.sample?.rows >= 20 && artifact.replay.sample.homeWins > 0 && artifact.replay.sample.awayWins > 0)
check('probability sanity', flags.MLB_02F_REPLAY_PROBABILITY_SANITY === 'PASS' && flags.MLB_02F_FULL_PROBABILITY_SANITY === 'PASS' && artifact.replay?.full?.probabilitySanity?.invalidRange === 0 && artifact.replay.full.probabilitySanity.complementViolations === 0)
check('reproducibility', flags.MLB_02F_INFERENCE_REPRODUCIBILITY === 'PASS' && artifact.replay?.reproducibility?.failures === 0)
check('full replay', flags.MLB_02F_FULL_REPLAY_ROWS === 2249 && artifact.replay?.full?.rows === 2249)
check('metric parity', flags.MLB_02F_REPLAY_METRIC_PARITY === 'PASS' && artifact.replay?.full?.metricParity?.replayTest?.logLoss === artifact.replay.full.metricParity.certifiedTest.logLoss)
check('live contract', flags.MLB_02F_LIVE_INPUT_CONTRACT === 'READY' && flags.MLB_02F_STARTER_STATUS_POLICY === 'READY' && flags.MLB_02F_LINEUP_DEPENDENCY === 'CERTIFIED' && artifact.liveContract?.lineupDependency === 'LINEUP_NOT_REQUIRED_FOR_MONEYLINE_V1')
check('output contract', flags.MLB_02F_PREDICTION_OUTPUT_CONTRACT === 'READY' && flags.MLB_02F_PROBABILITY_COMPLEMENT_CONTRACT === 'PASS' && flags.MLB_02F_CONFIDENCE_SEMANTICS === 'READY')
check('persistence prep', flags.MLB_02F_PREDICTION_SCHEMA_INVENTORY_COMPLETE === 'YES' && flags.MLB_02F_PREDICTION_IDENTITY_CONTRACT === 'READY' && flags.MLB_02F_PREDICTION_IMMUTABILITY_CONTRACT === 'PASS' && flags.MLB_02F_PREDICTION_IDEMPOTENCY_CONTRACT === 'PASS')
check('market boundary', flags.MLB_02F_ODDS_INDEPENDENT_INFERENCE === 'PASS' && flags.MLB_02F_NO_MARKET_RECOMMENDATION === 'PASS')
check('runner prep', flags.MLB_02F_PREDICTION_RUNNER_PREP === 'PASS' && flags.MLB_02F_PREDICTION_EXECUTION_FAIL_CLOSED === 'PASS' && flags.MLB_02F_STALE_PREDICTION_GUARD === 'PASS')
check('preservation', flags.MLB_02F_CHAMPION_UNCHANGED === 'PASS' && flags.MLB_02F_FEATURE_FOUNDATION_UNCHANGED === 'PASS' && flags.MLB_02F_RAW_NATIVE_UNCHANGED === 'PASS' && flags.MLB_02F_PRODUCTION_PREDICTION_ZERO_STATE === 'PASS')
check('safety', safety.productionDml === 0 && safety.productionDdl === 0 && safety.providerCalls === 0 && safety.predictionWrites === 0 && safety.marketValueWrites === 0 && safety.modelWrites === 0 && safety.championChanges === 0 && safety.import2026 === 'NO' && safety.automation === 'OFF' && safety.cronChanges === 0 && flags.PREDICTION_WORK_PERFORMED === 'NO')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02f-moneyline-prediction-generation-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02f-moneyline-prediction-generation-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    fullReplayRows: artifact.replay.full.rows,
    predictionWrites: artifact.safety.predictionWrites,
  }, null, 2))
}
