import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import {
  R2D_FAIL_CLOSED_MESSAGE,
  R2D_SCOPE_CERTIFICATION,
  buildPrewriteScopeArtifact,
  createFrozenSlateContext,
  r2cCurrentSlateFeatureWrapper,
  r2cCurrentSlateMarketAcquisitionWrapper,
  r2cCurrentSlateNativeIdentityWrapper,
  r2cCurrentSlateOfficialPickWrapper,
  r2cCurrentSlatePredictionWrapper,
  r2cCurrentSlateStatcastWrapper,
  r2cCurrentSlateValueWrapper,
  stageWrapperBindings,
  wrapperNames,
} from './mlb-data-02r-r2d-current-slate-wrappers.mjs'

const errors = []
const executorPath = 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs'
const wrapperPath = 'scripts/mlb-data-02r-r2d-current-slate-wrappers.mjs'
const r2cArtifactPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2C_SAFE_DESIGN_SPLIT_BINDING_INVENTORY.json'
const artifactPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2D_CURRENT_SLATE_THIN_WRAPPER_CERTIFICATION.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2D_CURRENT_SLATE_THIN_WRAPPER_AUDIT.md'

function check(label, condition) {
  if (!condition) errors.push(label)
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function mustThrow(label, fn, token) {
  try {
    fn()
    errors.push(`${label} did not throw`)
  } catch (error) {
    if (!String(error.message).includes(token)) errors.push(`${label} wrong error: ${error.message}`)
  }
}

function fixtureContext(overrides = {}) {
  return createFrozenSlateContext({
    run_id: 'mlb-02r-r2d-fixture',
    run_date: '2026-09-07',
    run_as_of: '2026-09-07T14:00:00.000Z',
    execution_package_sha: '33f72ddc175bee380655e65cc0cdf5f9a4458fee',
    eligible_game_pks: [1001, 1002],
    blocked_game_pks: [9999],
    game_start_times: {
      1001: '2026-09-07T23:00:00.000Z',
      1002: '2026-09-08T00:10:00.000Z',
    },
    starter_states: {
      1001: { home: 'CONFIRMED', away: 'PROBABLE' },
      1002: { home: 'PROBABLE', away: 'PROBABLE' },
    },
    db_contract_digest: 'db-contract-fixture',
    model_artifact_digest: 'model-digest-fixture',
    feature_contract_digest: 'feature-digest-fixture',
    provider_budget: {
      MLB_OFFICIAL: { allowed: true, maxCalls: 1, consumed: 0, forbiddenInDryRun: true },
      STATCAST: { allowed: true, maxCalls: 2, consumed: 0, forbiddenInDryRun: true },
      THE_ODDS_API: { allowed: true, maxCalls: 1, consumed: 0, forbiddenInDryRun: true },
      BALLDONTLIE: { allowed: false, maxCalls: 0, consumed: 0 },
      SPORTSDATAIO: { allowed: false, maxCalls: 0, consumed: 0 },
    },
    per_stage_dml_caps: {
      nativeIdentity: 4,
      rawStatcast: 6,
      features: 8,
      predictions: 2,
      market: 4,
      value: 2,
      officialPicks: 2,
    },
    checkpoint_state: [{ stage: '01 schedule sync', status: 'PENDING' }],
    live_authorization: false,
    ...overrides,
  })
}

check('executor exists', fs.existsSync(executorPath))
check('wrapper exists', fs.existsSync(wrapperPath))
check('R2C artifact exists', fs.existsSync(r2cArtifactPath))

const executorSource = read(executorPath)
const wrapperSource = read(wrapperPath)
const r2c = JSON.parse(read(r2cArtifactPath))
const bindings = stageWrapperBindings()
const context = fixtureContext()

check('R2C certified', r2c.certificationVerdict === 'MLB_DATA_02R_R2C_SAFE_DESIGN_SPLIT_BINDING_INVENTORY_CERTIFIED')
check('R2C requires wrappers', r2c.thinWrapperDesign?.MLB_02R_R2C_THIN_WRAPPER_DESIGN === 'COMPLETE')
check('all required wrappers exported', wrapperNames.every((name) => wrapperSource.includes(`export const ${name}`)))
check('all bindings are thin wrappers', Object.values(bindings).every((binding) => binding.invocationMethod === 'thin_frozen_current_slate_wrapper' && binding.legacyBroadCommand === false && !binding.command))
check('executor imports wrapper module', executorSource.includes('mlb-data-02r-r2d-current-slate-wrappers.mjs'))
check('executor no spawnSync import/use', !executorSource.includes('spawnSync'))
check('executor does not read broad legacy hold', !executorSource.includes('process.env.MLB_DATA_02R_R2_ALLOW_CERTIFIED_COMPONENT_EXECUTION'))
check('executor fail closed message updated', executorSource.includes('R2D_FAIL_CLOSED_MESSAGE'))

const blocked = spawnSync(process.execPath, [executorPath, '--execute-current-slate'], { encoding: 'utf8' })
check('execute without R2B auth fails closed', blocked.status !== 0 && `${blocked.stdout}${blocked.stderr}`.includes(R2D_FAIL_CLOSED_MESSAGE))

const nativePlan = r2cCurrentSlateNativeIdentityWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [
    { game_pk: 1001, identity: 'game:1001', row_digest: 'a' },
    { game_pk: 1002, identity: 'player:777', row_digest: 'b' },
  ],
})
const statcastPlan = r2cCurrentSlateStatcastWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [{ game_pk: 1001, identity: 'statcast:1001:1:1', row_digest: 'p1' }],
})
const featurePlan = r2cCurrentSlateFeatureWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [{ target_game_pk: 1001, identity: 'feature:team:1001:home', feature_digest: 'f1' }],
  existingRows: [{ target_game_pk: 1001, identity: 'feature:team:1001:home', feature_digest: 'f1' }],
})
const predictionPlan = r2cCurrentSlatePredictionWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [{ game_pk: 1002, identity: 'prediction:1002:away', run_as_of: context.run_as_of, prediction_digest: 'pr1' }],
})
const valuePlan = r2cCurrentSlateValueWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [{ game_pk: 1002, identity: 'value:1002:away', run_as_of: context.run_as_of, value_digest: 'v1' }],
})
const officialPickPlan = r2cCurrentSlateOfficialPickWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [{ game_pk: 1002, identity: 'official:1002:away', run_as_of: context.run_as_of, row_digest: 'o1' }],
})
const marketAcquisitionPlan = r2cCurrentSlateMarketAcquisitionWrapper({ context, mode: 'DRY_RUN' })

check('native wrapper classifies inserts', nativePlan.prewriteScope?.planned_inserts === 2 && nativePlan.productionDml === 0)
check('statcast wrapper classifies inserts', statcastPlan.prewriteScope?.planned_inserts === 1 && statcastPlan.providerCalls === 0)
check('feature wrapper classifies reuse', featurePlan.prewriteScope?.reuses === 1 && featurePlan.prewriteScope.conflicts === 0)
check('prediction wrapper enforces run_as_of', predictionPlan.prewriteScope?.planned_inserts === 1)
check('value wrapper enforces run_as_of', valuePlan.prewriteScope?.planned_inserts === 1)
check('official wrapper enforces run_as_of', officialPickPlan.prewriteScope?.planned_inserts === 1)
check('market acquisition dry run does not call provider', marketAcquisitionPlan.providerStatus === 'DRY_RUN_PROVIDER_NOT_CALLED' && marketAcquisitionPlan.providerCalls === 0)

mustThrow('wrong game_pk', () => r2cCurrentSlateNativeIdentityWrapper({ context, mode: 'DRY_RUN', rows: [{ game_pk: 1234, identity: 'bad' }] }), 'OUT_OF_SCOPE_GAME_PK')
mustThrow('started game rejected', () => fixtureContext({ game_start_times: { 1001: '2026-09-07T13:59:00.000Z', 1002: '2026-09-08T00:10:00.000Z' } }), 'STARTED_GAME_SCOPE_ATTEMPT')
mustThrow('cap exceeded', () => r2cCurrentSlateNativeIdentityWrapper({
  context: fixtureContext({ per_stage_dml_caps: { ...context.per_stage_dml_caps, nativeIdentity: 1 } }),
  mode: 'DRY_RUN',
  rows: [{ game_pk: 1001, identity: 'n1' }, { game_pk: 1002, identity: 'n2' }],
}), 'CAP_EXCEEDED')
mustThrow('as_of mismatch', () => r2cCurrentSlatePredictionWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [{ game_pk: 1001, identity: 'prediction:bad', run_as_of: '2026-09-07T13:00:00.000Z' }],
}), 'AS_OF_MISMATCH')
mustThrow('conflict blocks', () => r2cCurrentSlateFeatureWrapper({
  context,
  mode: 'DRY_RUN',
  rows: [{ target_game_pk: 1001, identity: 'feature:conflict', feature_digest: 'new' }],
  existingRows: [{ target_game_pk: 1001, identity: 'feature:conflict', feature_digest: 'old' }],
}), 'BLOCK_CONFLICT')

const prewriteScope = buildPrewriteScopeArtifact(context, [
  nativePlan.prewriteScope,
  statcastPlan.prewriteScope,
  featurePlan.prewriteScope,
  predictionPlan.prewriteScope,
  valuePlan.prewriteScope,
  officialPickPlan.prewriteScope,
].filter(Boolean))

check('prewrite artifact zero mutation boundary', prewriteScope.provider_calls === 0 && prewriteScope.production_dml === 0 && prewriteScope.production_ddl === 0)
check('prewrite artifact contained', prewriteScope.historical_rows_touched === 0 && prewriteScope.out_of_scope_game_pks_touched === 0 && prewriteScope.conflicts === 0)

const artifact = {
  generatedAt: '2026-09-07T00:00:00.000Z',
  certificationVerdict: R2D_SCOPE_CERTIFICATION,
  phase: 'MLB_DATA_02R_R2D_CURRENT_SLATE_THIN_WRAPPER_IMPLEMENTATION',
  r2cDesignLoaded: r2c.certificationVerdict,
  wrappersImplemented: wrapperNames,
  executorPatch: {
    executorPath,
    legacyBroadCommandInvocation: 'DISABLED_FOR_R2_CURRENT_SLATE',
    broadGlobalHoldVariable: 'MLB_DATA_02R_R2_ALLOW_CERTIFIED_COMPONENT_EXECUTION',
    broadGlobalHoldUsedByR2Executor: false,
    failClosedMessage: R2D_FAIL_CLOSED_MESSAGE,
  },
  frozenContextFields: Object.keys(context).filter((key) => key !== 'live_authorization').sort(),
  guards: {
    frozenGamePkContainment: 'PASS',
    startedGameGuard: 'PASS',
    asOfGuard: 'PASS',
    capGuard: 'PASS',
    conflictGuard: 'PASS',
    providerDryRunGuard: 'PASS',
    historicalScopeGuard: 'PASS',
  },
  prewriteScopeArtifact: prewriteScope,
  zeroMutation: {
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
    oddsApiCalls: 0,
    officialPickWrites: 0,
    environmentChanges: 0,
    automationChanges: 0,
    cronChanges: 0,
  },
  futureExecution: {
    R2B_LIVE_REFRESH_EXECUTION_PERFORMED: 'NO',
    R2B_RETRY_READY_AFTER_DIRECT_AUTHORIZATION: 'YES_WITH_FROZEN_CONTEXT_AND_PREWRITE_GUARDS',
  },
}

check('certification artifact exists', fs.existsSync(artifactPath))
check('certification audit exists', fs.existsSync(auditPath))
if (fs.existsSync(artifactPath)) {
  const persisted = JSON.parse(read(artifactPath))
  check('persisted certification artifact matches verdict', persisted.certificationVerdict === artifact.certificationVerdict)
  check('persisted artifact records wrapper count', persisted.wrappersImplemented?.length === artifact.wrappersImplemented.length)
  check('persisted artifact records zero mutation', persisted.zeroMutation?.providerCalls === 0 && persisted.zeroMutation?.productionDml === 0 && persisted.zeroMutation?.productionDdl === 0)
}
if (fs.existsSync(auditPath)) {
  const audit = read(auditPath)
  check('audit records no live execution', audit.includes('This phase did not execute the live refresh'))
  check('audit records zero mutation', audit.includes('Provider calls: 0') && audit.includes('Production DML: 0') && audit.includes('Production DDL: 0'))
}

const combined = executorSource + wrapperSource + JSON.stringify(artifact)
check('targeted secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(combined))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2d-current-slate-thin-wrapper-validate', status: 'FAIL', errors }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'mlb-data-02r-r2d-current-slate-thin-wrapper-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  wrappersImplemented: wrapperNames.length,
  providerCalls: 0,
  productionDml: 0,
  productionDdl: 0,
}, null, 2))
