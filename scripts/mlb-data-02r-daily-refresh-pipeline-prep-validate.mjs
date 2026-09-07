import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const TARGET_COMMIT = 'aaec403c71585b3a5144c5c82b0ee3bcbe5d6518'
const ARTIFACT_PATH = 'docs/CERTIFICATION/mlb-data-02r-daily-refresh-pipeline-prep.json'
const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02R_DAILY_REFRESH_PIPELINE_PREP_CERTIFIED')
check('repo alignment', artifact.repository.branch === 'main' && artifact.repository.localHead === TARGET_COMMIT && artifact.repository.originMain === TARGET_COMMIT && artifact.repository.MLB_02R_REPOSITORY_ALIGNMENT === 'PASS')
check('production alignment', artifact.production.commit === TARGET_COMMIT && artifact.production.MLB_02R_PRODUCTION_ALIGNMENT === 'PASS' && artifact.production.providerCallsMade === 0)
check('inventory complete', artifact.inventory.MLB_02R_EXISTING_PIPELINE_INVENTORY === 'COMPLETE' && artifact.inventory.components.length >= 12)
check('reuse contract', artifact.reuse.MLB_02R_COMPONENT_REUSE_CONTRACT === 'PASS')
check('stage order', artifact.dailyStages.MLB_02R_STAGE_ORDER === 'READY' && artifact.dailyStages.stages.length === 14 && artifact.dailyStages.stages[0].stage === 'STAGE_01_SCHEDULE_SYNC' && artifact.dailyStages.stages.at(-1).stage === 'STAGE_14_RESULT_SETTLEMENT_PREP')
check('run identity', artifact.identity.MLB_02R_RUN_IDENTITY_CONTRACT === 'READY' && artifact.identity.runIdentity.pipeline_version === 'MLB_DATA_02R_DAILY_REFRESH_PIPELINE_V1' && artifact.identity.runIdentity.run_type === 'DRY_RUN')
check('stage checkpoints', artifact.identity.MLB_02R_STAGE_CHECKPOINT_CONTRACT === 'READY')
check('as of', artifact.temporalSafety.MLB_02R_ASOF_CONTRACT === 'PASS' && artifact.temporalSafety.MLB_02R_LIVE_PREGAME_ASOF === 'READY' && artifact.temporalSafety.MLB_02R_STARTED_GAME_GUARD === 'PASS')
check('game identity', artifact.gameIdentity.MLB_02R_GAME_IDENTITY === 'PASS' && artifact.gameIdentity.MLB_02R_DOUBLEHEADER_GUARD === 'PASS' && artifact.gameIdentity.rootKey === 'native game_pk')
check('provider matrix', artifact.providers.MLB_02R_PROVIDER_RESPONSIBILITY === 'PASS' && artifact.providers.MLB_02R_PROVIDER_SUBSTITUTION_GUARD === 'PASS' && artifact.providers.MLB_02R_PROVIDER_CALL_ACCOUNTING === 'READY' && artifact.providers.MLB_02R_PROVIDER_FAILURE_POLICY === 'READY')
check('raw policy', artifact.rawIngest.MLB_02R_RAW_RECONCILIATION === 'PASS' && artifact.rawIngest.MLB_02R_RAW_BATCH_POLICY === 'READY')
check('feature policy', artifact.features.MLB_02R_FEATURE_PIPELINE_REUSE === 'PASS' && artifact.features.MLB_02R_FEATURE_IDEMPOTENCY === 'PASS')
check('starter model', artifact.starters.MLB_02R_STARTER_STATUS_MODEL === 'READY' && artifact.starters.MLB_02R_STARTER_GUARD === 'PASS')
check('inference', artifact.inference.MLB_02R_CHAMPION_CONTRACT === 'PASS' && artifact.inference.MLB_02R_INFERENCE_REPRODUCIBILITY === 'PASS' && artifact.inference.featureCount === 76 && artifact.inference.MLB_02R_PROBABILITY_GUARD === 'READY')
check('prediction refresh', artifact.predictionRefresh.MLB_02R_PREDICTION_REFRESH_CONTRACT === 'PASS' && artifact.predictionRefresh.MLB_02R_MATERIAL_INPUT_CHANGE_CONTRACT === 'READY')
check('market contracts', artifact.markets.MLB_02R_MARKET_SCOPE === 'PASS' && artifact.markets.MLB_02R_MARKET_NORMALIZATION === 'PASS' && artifact.markets.MLB_02R_MARKET_IMMUTABILITY === 'PASS' && artifact.markets.MLB_02R_MARKET_FRESHNESS === 'READY')
check('value contracts', artifact.valueEvaluation.MLB_02R_VALUE_MATH === 'PASS' && artifact.valueEvaluation.MLB_02R_VALUE_PROVENANCE === 'PASS')
check('official pick contracts', artifact.officialPicks.MLB_02R_OFFICIAL_PICK_POLICY === 'PASS' && artifact.officialPicks.MLB_02R_ZERO_PICK_POLICY === 'PASS' && artifact.officialPicks.MLB_02R_ONE_SIDE_PER_GAME === 'PASS' && artifact.officialPicks.MLB_02R_OFFICIAL_PICK_REFRESH_SEMANTICS === 'READY' && artifact.officialPicks.MLB_02R_CURRENT_OFFICIAL_PICK_SELECTION === 'READY')
check('board contracts', artifact.valueBoardRefresh.MLB_02R_BOARD_REFRESH_CONTRACT === 'PASS' && artifact.valueBoardRefresh.MLB_02R_BOARD_STATUS_REFRESH === 'READY' && artifact.valueBoardRefresh.MLB_02R_PARTIAL_REFRESH_UI_CONTRACT === 'READY')
check('settlement boundary', artifact.settlement.MLB_02R_SETTLEMENT_INVENTORY === 'COMPLETE' && artifact.settlement.MLB_02R_SETTLEMENT_BOUNDARY === 'PASS')
check('run modes', artifact.runModes.MLB_02R_RUN_MODE_CONTRACT === 'READY' && artifact.runModes.MLB_02R_DEFAULT_RUN_MODE === 'DRY_RUN' && artifact.runModes.MLB_02R_EXECUTION_FAIL_CLOSED === 'PASS' && artifact.runModes.MLB_02R_AUTOMATION_EXECUTION_SEPARATION === 'PASS')
check('checkpointing', artifact.checkpointing.MLB_02R_CHECKPOINTING === 'READY' && artifact.checkpointing.MLB_02R_RESUME_IDEMPOTENCY === 'PASS')
check('observability', artifact.observability.MLB_02R_OBSERVABILITY_CONTRACT === 'READY' && artifact.observability.MLB_02R_DAILY_SUMMARY_CONTRACT === 'READY')
check('caps', artifact.caps.MLB_02R_DYNAMIC_DML_CAPS === 'READY' && artifact.caps.MLB_02R_DML_CAP_FAIL_CLOSED === 'PASS')
check('automation', artifact.automation.MLB_02R_AUTOMATION_SCHEDULE_PREP === 'READY' && artifact.automation.MLB_02R_AUTOMATION_STATE === 'OFF' && artifact.automation.cronChanges === 0)
check('preservation', artifact.preservation.MLB_02R_CURRENT_BOARD_PRESERVED === 'PASS' && artifact.preservation.MLB_02R_EXISTING_DATA_PRESERVED === 'PASS' && artifact.preservation.MLB_02R_PREP_MUTATION_BOUNDARY === 'PASS')
check('zero mutation', artifact.preservation.productionDml === 0 && artifact.preservation.productionDdl === 0 && artifact.preservation.providerCalls === 0 && artifact.preservation.envChanges === 0 && artifact.preservation.automationChanges === 0 && artifact.preservation.cronChanges === 0)
check('runner', artifact.runner.MLB_02R_DAILY_RUNNER_PREP === 'READY' && artifact.runner.MLB_02R_DAILY_RUNNER_EXECUTION_FORBIDDEN === 'PASS' && artifact.runner.MLB_02R_DAILY_PIPELINE_DRY_RUN === 'PASS' && artifact.runner.MLB_02R_DRY_RUN_PRODUCTION_DML === 0)
check('next readiness', artifact.readiness.MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP_READY === 'YES' && artifact.readiness.MLB_DATA_02R_AUTOMATION_ACTIVATION_READY === 'NO')
check('current board', artifact.currentProductState.valueBoardPublication === 'ACTIVE_WITH_NAVIGATION' && artifact.currentProductState.board.total === 42 && artifact.currentProductState.board.officialPicks === 5)
check('current data', artifact.currentProductState.currentOfficialPicks === 5 && artifact.currentProductState.currentNativeValueEvaluations === 386 && artifact.currentProductState.currentPredictions === 24 && artifact.currentProductState.currentMarketObservations === 492)
check('audit exists', fs.existsSync('docs/CERTIFICATION/mlb-data-02r-daily-refresh-pipeline-prep-audit.md'))

const forbidden = spawnSync(process.execPath, ['scripts/mlb-data-02r-daily-refresh-pipeline-prep.mjs', '--execute'], { encoding: 'utf8' })
check('execute forbidden', forbidden.status !== 0 && `${forbidden.stderr}${forbidden.stdout}`.includes('DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_PREP'))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-daily-refresh-pipeline-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02r-daily-refresh-pipeline-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    stages: artifact.dailyStages.stages.length,
    defaultRunMode: artifact.runModes.MLB_02R_DEFAULT_RUN_MODE,
    r1Ready: artifact.readiness.MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP_READY,
    automationReady: artifact.readiness.MLB_DATA_02R_AUTOMATION_ACTIVATION_READY,
  }, null, 2))
}
