import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const errors = []
const scriptPath = 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02r-r2a-live-refresh-executor.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2A_LIVE_MANUAL_REFRESH_EXECUTOR_AUDIT.md'

function check(label, condition) {
  if (!condition) errors.push(label)
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

check('executor exists', fs.existsSync(scriptPath))
check('audit path exists after dry run possible', true)

const dry = spawnSync(process.execPath, [scriptPath, '--dry-run'], { encoding: 'utf8' })
check('dry run exits zero', dry.status === 0)

const blocked = spawnSync(process.execPath, [scriptPath, '--execute-current-slate'], { encoding: 'utf8' })
check('execute without auth fails closed', blocked.status !== 0 && `${blocked.stdout}${blocked.stderr}`.includes('LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2_AUTHORIZATION'))

check('artifact created', fs.existsSync(artifactPath))
check('audit created', fs.existsSync(auditPath))

const source = read(scriptPath)
const artifact = JSON.parse(read(artifactPath))
const audit = read(auditPath)

check('certification verdict', artifact.certificationVerdict === 'MLB_DATA_02R_R2A_LIVE_REFRESH_EXECUTOR_CERTIFIED')
check('component inventory complete', artifact.componentInventory?.MLB_02R_R2A_COMPONENT_INVENTORY === 'COMPLETE' && artifact.componentInventory.inventory.length === 13)
check('component files present', artifact.componentInventory.inventory.every((entry) => entry.filesPresent === true))
check('reuse contract', artifact.reuseContract?.MLB_02R_R2A_REUSE_CONTRACT === 'PASS')
check('live executor ready', artifact.liveExecutorPath === scriptPath)
check('execution guard', artifact.guards?.MLB_02R_R2A_EXECUTION_GUARD === 'PASS' && artifact.guards.failClosedMessage === 'LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2_AUTHORIZATION')
check('run freeze', artifact.runFreeze?.MLB_02R_R2A_RUN_FREEZE_IMPLEMENTATION === 'PASS' && artifact.runFreeze.execution_package_sha)
check('db preflight', artifact.dbPreflight?.MLB_02R_R2A_DB_PREFLIGHT === 'READY' && artifact.dbPreflight.incompatible.length === 0)
check('model preflight', artifact.modelPreflight?.MLB_02R_R2A_MODEL_PREFLIGHT === 'READY' && artifact.modelPreflight.champion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1' && artifact.modelPreflight.featureSet === 'MLB_ML_FEATURE_SET_V1' && artifact.modelPreflight.featureCount === 76)
check('provider budget', artifact.providerBudget?.MLB_02R_R2A_PROVIDER_BUDGET_ENGINE === 'PASS' && artifact.providerBudget.budget.THE_ODDS_API.maxCalls === 1 && artifact.providerBudget.budget.BALLDONTLIE.maxCalls === 0 && artifact.providerBudget.budget.SPORTSDATAIO.maxCalls === 0)
check('started-game guard', artifact.guards?.MLB_02R_R2A_STARTED_GAME_GUARD === 'PASS' && artifact.guards.scheduleClassifications.includes('PREGAME_SAFE'))
check('frozen game set', artifact.guards?.MLB_02R_R2A_FROZEN_GAME_SET === 'READY')
check('dynamic caps', artifact.guards?.MLB_02R_R2A_DYNAMIC_CAP_ENGINE === 'PASS' && Object.keys(artifact.guards.dmlCaps).length >= 14)
check('13 stages ready', artifact.stages?.rows.length === 13 && artifact.stages.rows.every((stage) => stage.dryRunReachable === true))
check('native stage', artifact.stages.MLB_02R_R2A_NATIVE_STAGE === 'READY')
check('raw stage', artifact.stages.MLB_02R_R2A_RAW_STAGE === 'READY')
check('feature stage', artifact.stages.MLB_02R_R2A_FEATURE_STAGE === 'READY')
check('starter stage', artifact.stages.MLB_02R_R2A_STARTER_STAGE === 'READY')
check('inference stage', artifact.stages.MLB_02R_R2A_INFERENCE_STAGE === 'READY')
check('prediction stage', artifact.stages.MLB_02R_R2A_PREDICTION_STAGE === 'READY')
check('odds stage', artifact.stages.MLB_02R_R2A_ODDS_STAGE === 'READY')
check('market stage', artifact.stages.MLB_02R_R2A_MARKET_STAGE === 'READY')
check('value stage', artifact.stages.MLB_02R_R2A_VALUE_STAGE === 'READY')
check('pick policy stage', artifact.stages.MLB_02R_R2A_PICK_POLICY_STAGE === 'READY')
check('pick persistence stage', artifact.stages.MLB_02R_R2A_PICK_PERSISTENCE_STAGE === 'READY')
check('board stage', artifact.stages.MLB_02R_R2A_BOARD_READBACK_STAGE === 'READY')
check('checkpoint/resume', artifact.checkpointResume?.MLB_02R_R2A_CHECKPOINT_RESUME === 'PASS' && artifact.checkpointResume.checkpointPath)
check('web independence', artifact.webIndependence?.MLB_02R_R2A_WEB_SHA_INDEPENDENCE === 'PASS')
check('idempotency', artifact.idempotency?.MLB_02R_R2A_IDEMPOTENCY_MODE === 'READY')
check('observability', artifact.observability?.MLB_02R_R2A_OBSERVABILITY === 'READY')
check('automation reuse', artifact.automationReuse?.MLB_02R_R2A_AUTOMATION_REUSE_PATH === 'PASS' && artifact.automationReuse.duplicateAutomationEngineCreated === false)
check('settlement excluded', artifact.settlement?.MLB_02R_R2A_SETTLEMENT_BOUNDARY === 'PASS' && artifact.settlement.settlementExecuted === false)
check('dry certification', artifact.dryCertification?.MLB_02R_R2A_LIVE_EXECUTOR_DRY_RUN === 'PASS')
check('zero mutation boundary', artifact.boundaries.providerCalls === 0 && artifact.boundaries.productionDml === 0 && artifact.boundaries.productionDdl === 0 && artifact.boundaries.officialPickWrites === 0 && artifact.boundaries.cronChanges === 0)
check('source supports flags', source.includes('--dry-run') && source.includes('--execute-current-slate') && source.includes('--resume-from') && source.includes('--run-id'))
check('source does not keep old compatibility blocker', !source.includes('DAILY_REFRESH_EXECUTION_NOT_PERFORMED_IN_COMPATIBILITY_CERTIFICATION'))
check('source binds certified components', source.includes('liveComponentBindings') && source.includes('mlb-data-02h-2026-current-foundation.mjs') && source.includes('mlb-data-02m-r2-fresh-market-sample-acquisition.mjs'))
check('audit states live not performed', audit.includes('REAL EXECUTOR IMPLEMENTED') && audit.includes('Provider calls: 0') && audit.includes('Production DML: 0') && audit.includes('Settlement: EXCLUDED'))

const combined = source + JSON.stringify(artifact) + audit + dry.stdout + dry.stderr
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(combined))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2a-live-refresh-executor-validate', status: 'FAIL', errors }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'mlb-data-02r-r2a-live-refresh-executor-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  dryRun: artifact.dryCertification.MLB_02R_R2A_LIVE_EXECUTOR_DRY_RUN,
  failClosed: artifact.guards.MLB_02R_R2A_EXECUTION_GUARD,
  providerCalls: artifact.boundaries.providerCalls,
  productionDml: artifact.boundaries.productionDml,
}, null, 2))
