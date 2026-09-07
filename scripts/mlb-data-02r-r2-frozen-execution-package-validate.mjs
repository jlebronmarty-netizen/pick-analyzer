import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02r-r2-frozen-execution-package.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2_FROZEN_EXECUTION_PACKAGE.md'
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const run = spawnSync(process.execPath, ['scripts/mlb-data-02r-r2-frozen-execution-package.mjs'], {
  encoding: 'utf8',
})
check('dry runner exits zero', run.status === 0)

const forbidden = spawnSync(process.execPath, ['scripts/mlb-data-02r-r2-frozen-execution-package.mjs', '--execute-current-slate'], {
  encoding: 'utf8',
})
check('execute flag fails closed', forbidden.status !== 0 && `${forbidden.stdout}${forbidden.stderr}`.includes('DAILY_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2_AUTHORIZATION'))

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02R_R2_FROZEN_EXECUTION_PACKAGE_COMPATIBILITY_CERTIFIED')
check('runtime snapshot', artifact.currentSnapshot.MLB_02R_R2_CURRENT_RUNTIME_SNAPSHOT === 'PASS')
check('strategy', artifact.executionPackage.MLB_02R_R2_EXECUTION_PACKAGE_STRATEGY === 'READY')
check('web independence', artifact.executionPackage.MLB_02R_R2_WEB_DEPLOYMENT_INDEPENDENCE === 'PASS')
check('db manifest', artifact.dbContract.MLB_02R_R2_EXECUTION_DB_CONTRACT_MANIFEST === 'READY' && artifact.dbContract.manifest.length >= 17)
check('db compatibility', artifact.dbContract.MLB_02R_R2_CURRENT_DB_COMPATIBILITY === 'PASS' && artifact.dbContract.incompatible.length === 0)
check('additive tolerance', artifact.dbContract.MLB_02R_R2_ADDITIVE_SCHEMA_TOLERANCE === 'PASS')
check('model contract', artifact.modelContract.MLB_02R_R2_EXECUTION_MODEL_CONTRACT === 'PASS' && artifact.modelContract.champion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1' && artifact.modelContract.featureSet === 'MLB_ML_FEATURE_SET_V1' && artifact.modelContract.featureCount === 76)
check('provider contract', artifact.providerContract.MLB_02R_R2_EXECUTION_PROVIDER_CONTRACT === 'READY')
check('route dependency', artifact.routeDependencyAudit.MLB_02R_R2_WEB_ROUTE_DEPENDENCY_AUDIT === 'COMPLETE' && artifact.routeDependencyAudit.productionWebRouteCoreDependency === false)
check('runner certified', artifact.runner.MLB_02R_R2_EXECUTION_RUNNER_STATE === 'RUNNER_EXISTS_AND_CERTIFIED' && artifact.runner.MLB_02R_R2_EXECUTION_RUNNER_PREP === 'READY')
check('dry certification', artifact.runner.MLB_02R_R2_EXECUTION_RUNNER_DRY_CERTIFICATION === 'PASS' && artifact.runner.dryRunProviderCalls === 0 && artifact.runner.dryRunProductionDml === 0)
check('fail closed', artifact.runner.MLB_02R_R2_RUNNER_FAIL_CLOSED === 'PASS')
check('run freeze', artifact.runFreezeV2.MLB_02R_R2_RUN_FREEZE_V2 === 'PASS' && artifact.runFreezeV2.execution_package_sha === 'FROZEN_GIT_SHA_SELECTED_AT_EXECUTION_START' && artifact.runFreezeV2.production_web_sha_observability)
check('midrun policy', artifact.compatibilityPolicy.MLB_02R_R2_MIDRUN_COMPATIBILITY_POLICY === 'READY')
check('schema guard', artifact.compatibilityPolicy.MLB_02R_R2_STAGE_SCHEMA_GUARD === 'READY')
check('shared ingest', artifact.compatibilityPolicy.MLB_02R_R2_SHARED_INGEST_PATH === 'PASS')
check('automation path', artifact.compatibilityPolicy.MLB_02R_R2_MANUAL_TO_AUTOMATION_PATH === 'READY')
check('descendant compatibility', artifact.currentWebDescendant.MLB_02R_R2_CURRENT_WEB_DESCENDANT_COMPATIBILITY === 'PASS')
check('moving web sha', artifact.currentWebDescendant.MLB_02R_R2_MOVING_WEB_SHA_NO_LONGER_BLOCKS_EXECUTION === 'YES')
check('manual readiness', artifact.manualReadiness.MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY === 'YES')
check('boundaries', artifact.boundaries.productionDml === 0 && artifact.boundaries.productionDdl === 0 && artifact.boundaries.providerCalls === 0 && artifact.boundaries.cronChanges === 0)
check('audit', audit.includes('Production web deployment equality is not a hard gate') && audit.includes('DAILY_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2_AUTHORIZATION'))

const combined = JSON.stringify(artifact) + audit + run.stdout + run.stderr
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(combined))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2-frozen-execution-package-validate', status: 'FAIL', errors }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'mlb-data-02r-r2-frozen-execution-package-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  productionWebSha: artifact.currentSnapshot.productionWebSha,
  executionPackageSha: artifact.runFreezeV2.execution_package_sha,
  manualExecutionReady: artifact.manualReadiness.MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY,
}, null, 2))
