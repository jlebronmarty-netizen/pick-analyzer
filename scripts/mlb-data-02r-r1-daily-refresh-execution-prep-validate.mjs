import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02r-r1-daily-refresh-execution-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02r-r1-manual-daily-refresh-execution-prep-audit.md'
const targetCommit = 'ecf3c666aaa5c801feb4b322f87375e012ceb191'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP_CERTIFIED')
check('repository alignment', artifact.repository.branch === 'main' && artifact.repository.localHead === targetCommit && artifact.repository.originMain === targetCommit && artifact.repository.MLB_02R_R1_REPOSITORY_ALIGNMENT === 'PASS')
check('production alignment', artifact.production.commit === targetCommit && artifact.production.MLB_02R_R1_PRODUCTION_ALIGNMENT === 'PASS' && artifact.production.providerCallsMade === 0)
check('run identity', artifact.runIdentity.MLB_02R_R1_RUN_IDENTITY === 'READY' && artifact.runIdentity.identity.sport === 'MLB' && artifact.runIdentity.identity.run_type === 'MANUAL_CURRENT_SLATE')
check('run id', /^mlb-manual-refresh:[a-f0-9]{32}$/.test(artifact.runIdentity.runId))
check('baseline', artifact.productionBaseline.MLB_02R_R1_PRODUCTION_BASELINE === 'PASS' && artifact.productionBaseline.counts.officialPicks === 5 && artifact.productionBaseline.counts.nativeValueEvaluations === 386)
check('champion', artifact.championBaseline.MLB_02R_R1_CHAMPION_BASELINE === 'PASS' && artifact.championBaseline.champion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('board', artifact.valueBoardBaseline.MLB_02R_R1_VALUE_BOARD_BASELINE === 'PASS' && artifact.valueBoardBaseline.httpStatus === 200 && artifact.valueBoardBaseline.readOnly === true)
check('schedule contracts', artifact.scheduleDiscoveryContract.MLB_02R_R1_SCHEDULE_DISCOVERY_CONTRACT === 'READY' && artifact.scheduleOutputContract.MLB_02R_R1_SCHEDULE_OUTPUT_CONTRACT === 'READY')
check('provider plan', artifact.providerCallPlan.MLB_02R_R1_PROVIDER_CALL_PLAN === 'READY' && artifact.providerCallPlan.providerCallsInR1 === 0 && artifact.providerCallPlan.providers.length === 5)
check('provider caps', artifact.providerCaps.MLB_02R_R1_PROVIDER_CAPS === 'PASS' && artifact.providerCaps.openEndedLoops === 0)
check('cache reuse', artifact.cacheReusePlan.MLB_02R_R1_CACHE_REUSE_PLAN === 'READY' && artifact.cacheReusePlan.MLB_02R_R1_CACHE_FIRST_POLICY === 'PASS')
check('raw plan', artifact.rawPlan.MLB_02R_R1_RAW_PREWRITE_CLASSIFIER === 'READY' && artifact.rawPlan.MLB_02R_R1_RAW_DML_CAP === 'READY' && artifact.rawPlan.MLB_02R_R1_RAW_BATCH_EXECUTION_PLAN === 'READY' && artifact.rawPlan.batchSize === 100)
check('features', artifact.featurePlan.MLB_02R_R1_FEATURE_TARGET_PLAN === 'READY' && artifact.featurePlan.MLB_02R_R1_FEATURE_DML_CAPS === 'READY' && artifact.featurePlan.MLB_02R_R1_FEATURE_FAIL_CLOSED === 'PASS')
check('starters', artifact.starterReadiness.MLB_02R_R1_STARTER_READBACK === 'READY' && artifact.starterReadiness.MLB_02R_R1_STARTER_EXECUTION_POLICY === 'PASS')
check('inference', artifact.inferencePlan.MLB_02R_R1_INFERENCE_PLAN === 'READY' && artifact.inferencePlan.features === 76 && artifact.inferencePlan.MLB_02R_R1_PREDICTION_CLASSIFIER === 'READY' && artifact.inferencePlan.MLB_02R_R1_PREDICTION_DML_CAP === 'READY')
check('market', artifact.marketPlan.MLB_02R_R1_MARKET_ACQUISITION_PLAN === 'READY' && artifact.marketPlan.MLB_02R_R1_ODDS_PROVIDER_CAP === 'READY' && artifact.marketPlan.oddsProviderCap === 1 && artifact.marketPlan.MLB_02R_R1_MARKET_PREWRITE_CLASSIFIER === 'READY' && artifact.marketPlan.MLB_02R_R1_MARKET_DML_CAPS === 'READY')
check('value', artifact.valuePlan.MLB_02R_R1_VALUE_EXECUTION_PLAN === 'READY' && artifact.valuePlan.MLB_02R_R1_VALUE_DML_CAP === 'READY')
check('official picks', artifact.officialPickPlan.MLB_02R_R1_PICK_POLICY_PARITY === 'PASS' && artifact.officialPickPlan.MLB_02R_R1_OFFICIAL_PICK_REFRESH_PLAN === 'READY' && artifact.officialPickPlan.MLB_02R_R1_OFFICIAL_PICK_DML_CAP === 'READY' && artifact.officialPickPlan.MLB_02R_R1_ONE_SIDE_PER_GAME === 'PASS')
check('board plan', artifact.boardReadbackPlan.MLB_02R_R1_BOARD_READBACK_PLAN === 'READY')
check('settlement excluded', artifact.settlement.MLB_02R_R1_SETTLEMENT_EXECUTION_STATE === 'EXCLUDED')
check('checkpointing', artifact.checkpointing.MLB_02R_R1_CHECKPOINT_SEQUENCE === 'READY' && artifact.checkpointing.MLB_02R_R1_RESUME_PLAN === 'READY' && artifact.checkpointing.stages.length === 14)
check('execution command', artifact.executionCommand.MLB_02R_R1_EXECUTION_COMMAND === 'READY' && artifact.executionCommand.MLB_02R_R1_EXECUTION_AUTH_GUARD === 'PASS' && artifact.executionCommand.command.includes('--execute-current-slate'))
check('execution matrix', artifact.executionMatrix.MLB_02R_R1_EXECUTION_MATRIX === 'READY' && artifact.executionMatrix.rows.length === 14)
check('observability', artifact.observability.MLB_02R_R1_EXECUTION_AUDIT === 'READY' && artifact.observability.MLB_02R_R1_EXECUTION_SUMMARY === 'READY')
check('dry prep', artifact.dryCurrentSlatePrep.MLB_02R_R1_CURRENT_SLATE_DRY_PREP === 'PASS' && artifact.dryCurrentSlatePrep.providerCalls === 0 && artifact.dryCurrentSlatePrep.productionDml === 0)
check('stage readiness', artifact.stageReadinessMatrix.MLB_02R_R1_STAGE_READINESS_MATRIX === 'READY' && artifact.stageReadinessMatrix.rows.some((row) => row.readiness === 'REQUIRES_PROVIDER_CALL'))
check('dynamic caps', artifact.dynamicCaps.MLB_02R_R1_DYNAMIC_CAPS === 'PASS' && Object.keys(artifact.dynamicCaps.caps).length >= 10)
check('zero mutation', artifact.prepMutationBoundary.MLB_02R_R1_PREP_MUTATION_BOUNDARY === 'PASS' && artifact.prepMutationBoundary.providerCalls === 0 && artifact.prepMutationBoundary.productionDml === 0 && artifact.prepMutationBoundary.productionDdl === 0 && artifact.prepMutationBoundary.automationChanges === 0 && artifact.prepMutationBoundary.cronChanges === 0)
check('readiness', artifact.readiness.MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY === 'YES' && artifact.readiness.MLB_DATA_02R_AUTOMATION_ACTIVATION_READY === 'NO')
check('audit says no execution', audit.includes('EXECUTION NOT PERFORMED') && audit.includes('Provider calls: 0') && audit.includes('Production DML: 0') && audit.includes('Automation: OFF'))

const forbidden = spawnSync(process.execPath, ['scripts/mlb-data-02r-r1-daily-refresh-execution-prep.mjs', '--execute-current-slate'], { encoding: 'utf8' })
check('execute flag forbidden', forbidden.status !== 0 && `${forbidden.stdout}${forbidden.stderr}`.includes('DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_R1_PREP'))

check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(JSON.stringify(artifact) + audit))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r1-daily-refresh-execution-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02r-r1-daily-refresh-execution-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    runDate: artifact.runIdentity.identity.run_date,
    runId: artifact.runIdentity.runId,
    productionCommit: artifact.production.commit,
    r2Ready: artifact.readiness.MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY,
    automationReady: artifact.readiness.MLB_DATA_02R_AUTOMATION_ACTIVATION_READY,
  }, null, 2))
}
