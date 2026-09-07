import crypto from 'node:crypto'

export const R2D_SCOPE_CERTIFICATION = 'MLB_DATA_02R_R2D_CURRENT_SLATE_THIN_WRAPPER_IMPLEMENTATION_CERTIFIED'
export const R2D_FAIL_CLOSED_MESSAGE = 'LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2B_AUTHORIZATION'

export const wrapperNames = [
  'r2cCurrentSlateNativeIdentityWrapper',
  'r2cCurrentSlateStatcastWrapper',
  'r2cCurrentSlateFeatureWrapper',
  'r2cCurrentSlatePredictionWrapper',
  'r2cCurrentSlateMarketAcquisitionWrapper',
  'r2cCurrentSlateMarketPersistenceWrapper',
  'r2cCurrentSlateValueWrapper',
  'r2cCurrentSlateOfficialPickWrapper',
]

const WRAPPER_BY_STAGE = {
  '01 schedule sync': { wrapper: 'r2cCurrentSlateScheduleReadWrapper', provider: 'MLB_OFFICIAL', writeCapKey: null, readOnly: true },
  '02 native reconciliation': { wrapper: 'r2cCurrentSlateNativeIdentityWrapper', provider: null, writeCapKey: 'nativeIdentity' },
  '03 raw Statcast reconciliation': { wrapper: 'r2cCurrentSlateStatcastWrapper', provider: 'STATCAST', writeCapKey: 'rawStatcast' },
  '04 feature refresh': { wrapper: 'r2cCurrentSlateFeatureWrapper', provider: null, writeCapKey: 'features' },
  '05 starter readiness': { wrapper: 'r2cCurrentSlateStarterReadinessWrapper', provider: null, writeCapKey: null, readOnly: true },
  '06 moneyline inference': { wrapper: 'r2cCurrentSlateInferenceWrapper', provider: null, writeCapKey: null, readOnly: true },
  '07 prediction persistence': { wrapper: 'r2cCurrentSlatePredictionWrapper', provider: null, writeCapKey: 'predictions' },
  '08 market acquisition': { wrapper: 'r2cCurrentSlateMarketAcquisitionWrapper', provider: 'THE_ODDS_API', writeCapKey: null, readOnly: true },
  '09 market persistence': { wrapper: 'r2cCurrentSlateMarketPersistenceWrapper', provider: null, writeCapKey: 'market' },
  '10 value evaluation': { wrapper: 'r2cCurrentSlateValueWrapper', provider: null, writeCapKey: 'value' },
  '11 Official Pick policy': { wrapper: 'r2cCurrentSlateOfficialPickWrapper', provider: null, writeCapKey: null, readOnly: true },
  '12 Official Pick persistence': { wrapper: 'r2cCurrentSlateOfficialPickWrapper', provider: null, writeCapKey: 'officialPicks' },
  '13 Value Board readback': { wrapper: 'r2cCurrentSlateValueBoardReadWrapper', provider: null, writeCapKey: null, readOnly: true },
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function digest(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex')
}

function requireField(object, field) {
  if (object[field] === undefined || object[field] === null) throw new Error(`FROZEN_CONTEXT_FIELD_MISSING:${field}`)
  return object[field]
}

function uniqueIntegers(name, values) {
  if (!Array.isArray(values)) throw new Error(`FROZEN_CONTEXT_FIELD_INVALID:${name}`)
  const parsed = values.map((value) => {
    const number = Number(value)
    if (!Number.isInteger(number)) throw new Error(`FROZEN_CONTEXT_FIELD_INVALID:${name}`)
    return number
  })
  return [...new Set(parsed)]
}

function assertIsoTimestamp(label, value) {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label}_INVALID`)
}

export function createFrozenSlateContext(input) {
  const context = {
    run_id: String(requireField(input, 'run_id')),
    run_date: String(requireField(input, 'run_date')),
    run_as_of: String(requireField(input, 'run_as_of')),
    execution_package_sha: String(requireField(input, 'execution_package_sha')),
    eligible_game_pks: uniqueIntegers('eligible_game_pks', requireField(input, 'eligible_game_pks')),
    blocked_game_pks: uniqueIntegers('blocked_game_pks', requireField(input, 'blocked_game_pks')),
    game_start_times: requireField(input, 'game_start_times'),
    starter_states: requireField(input, 'starter_states'),
    db_contract_digest: String(requireField(input, 'db_contract_digest')),
    model_artifact_digest: String(requireField(input, 'model_artifact_digest')),
    feature_contract_digest: String(requireField(input, 'feature_contract_digest')),
    provider_budget: requireField(input, 'provider_budget'),
    per_stage_dml_caps: requireField(input, 'per_stage_dml_caps'),
    checkpoint_state: requireField(input, 'checkpoint_state'),
    live_authorization: input.live_authorization === true,
  }

  assertIsoTimestamp('RUN_AS_OF', context.run_as_of)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(context.run_date)) throw new Error('RUN_DATE_INVALID')

  const blocked = new Set(context.blocked_game_pks)
  for (const gamePk of context.eligible_game_pks) {
    if (blocked.has(gamePk)) throw new Error(`FROZEN_GAME_SCOPE_OVERLAP:${gamePk}`)
    const startTime = context.game_start_times[String(gamePk)]
    if (!startTime) throw new Error(`GAME_START_TIME_MISSING:${gamePk}`)
    assertIsoTimestamp(`GAME_START_TIME:${gamePk}`, startTime)
    if (Date.parse(startTime) <= Date.parse(context.run_as_of)) throw new Error(`STARTED_GAME_SCOPE_ATTEMPT:${gamePk}`)
    if (!context.starter_states[String(gamePk)]) throw new Error(`STARTER_STATE_MISSING:${gamePk}`)
  }

  return {
    ...context,
    frozen_context_digest: digest({
      run_id: context.run_id,
      run_date: context.run_date,
      run_as_of: context.run_as_of,
      execution_package_sha: context.execution_package_sha,
      eligible_game_pks: context.eligible_game_pks,
      blocked_game_pks: context.blocked_game_pks,
      db_contract_digest: context.db_contract_digest,
      model_artifact_digest: context.model_artifact_digest,
      feature_contract_digest: context.feature_contract_digest,
    }),
  }
}

export function stageWrapperBindings() {
  return Object.fromEntries(Object.entries(WRAPPER_BY_STAGE).map(([stage, binding]) => [
    stage,
    {
      ...binding,
      liveCallable: true,
      invocationMethod: 'thin_frozen_current_slate_wrapper',
      legacyBroadCommand: false,
    },
  ]))
}

export function assertNoBroadLegacyInvocation(binding) {
  if (binding?.command) throw new Error('HISTORICAL_SCOPE_ATTEMPT')
  if (binding?.invocationMethod === 'spawnSync command behind global hold') throw new Error('HISTORICAL_SCOPE_ATTEMPT')
  return true
}

export function assertStageAuthorized(context, stageName, mode = 'DRY_RUN') {
  const binding = stageWrapperBindings()[stageName]
  if (!binding) throw new Error(`UNKNOWN_STAGE:${stageName}`)
  assertNoBroadLegacyInvocation(binding)
  if (mode === 'EXECUTE_CURRENT_SLATE' && !context.live_authorization) throw new Error(R2D_FAIL_CLOSED_MESSAGE)
  if (binding.provider) {
    const budget = context.provider_budget[binding.provider]
    if (!budget?.allowed) throw new Error(`PROVIDER_NOT_ALLOWED_FOR_STAGE:${stageName}`)
    if (mode === 'DRY_RUN' && budget.forbiddenInDryRun) return { binding, providerStatus: 'DRY_RUN_PROVIDER_NOT_CALLED' }
  }
  return { binding, providerStatus: 'NO_PROVIDER_CALL' }
}

function rowGamePk(row) {
  return Number(row.game_pk ?? row.target_game_pk ?? row.source_game_pk ?? row.provider_game_pk)
}

function identityFor(row, fields) {
  const values = fields.map((field) => row[field])
  if (values.some((value) => value === undefined || value === null || value === '')) throw new Error('ROW_IDENTITY_INCOMPLETE')
  return values.join(':')
}

export function classifyRows({ context, stage, table, rows = [], existingRows = [], identityFields = ['identity'], cap = null, requireRunAsOf = false }) {
  const allowed = new Set(context.eligible_game_pks)
  const existing = new Map(existingRows.map((row) => [identityFor(row, identityFields), row]))
  const plannedIdentities = new Set()
  const result = {
    table,
    stage,
    frozen_game_pk_scope: [...context.eligible_game_pks],
    planned_identities: [],
    planned_inserts: 0,
    reuses: 0,
    conflicts: 0,
    cap,
    historical_rows_touched: 0,
    out_of_scope_game_pks_touched: 0,
    classifications: [],
  }

  for (const row of rows) {
    const gamePk = rowGamePk(row)
    if (!allowed.has(gamePk)) throw new Error(`OUT_OF_SCOPE_GAME_PK:${gamePk}`)
    if (requireRunAsOf && row.run_as_of !== context.run_as_of && row.as_of !== context.run_as_of && row.prediction_as_of !== context.run_as_of) {
      throw new Error(`AS_OF_MISMATCH:${gamePk}`)
    }
    const identity = identityFor(row, identityFields)
    if (plannedIdentities.has(identity)) throw new Error(`DUPLICATE_PLANNED_IDENTITY:${identity}`)
    plannedIdentities.add(identity)
    result.planned_identities.push(identity)
    const persisted = existing.get(identity)
    if (!persisted) {
      result.planned_inserts += 1
      result.classifications.push({ identity, game_pk: gamePk, classification: 'INSERT_ELIGIBLE' })
      continue
    }
    const rowDigest = row.row_digest ?? row.raw_payload_digest ?? row.feature_digest ?? row.prediction_digest ?? row.value_digest ?? null
    const persistedDigest = persisted.row_digest ?? persisted.raw_payload_digest ?? persisted.feature_digest ?? persisted.prediction_digest ?? persisted.value_digest ?? null
    if (rowDigest && persistedDigest && rowDigest !== persistedDigest) {
      result.conflicts += 1
      result.classifications.push({ identity, game_pk: gamePk, classification: 'BLOCK_CONFLICT' })
    } else {
      result.reuses += 1
      result.classifications.push({ identity, game_pk: gamePk, classification: 'REUSE_NO_OP' })
    }
  }

  if (result.conflicts > 0) throw new Error(`BLOCK_CONFLICT:${stage}`)
  if (Number.isInteger(cap) && result.planned_inserts > cap) throw new Error(`CAP_EXCEEDED:${stage}:${result.planned_inserts}:${cap}`)
  return result
}

export function buildPrewriteScopeArtifact(context, plans) {
  return {
    run_id: context.run_id,
    run_as_of: context.run_as_of,
    frozen_context_digest: context.frozen_context_digest,
    tables: plans,
    historical_rows_touched: plans.reduce((sum, plan) => sum + plan.historical_rows_touched, 0),
    out_of_scope_game_pks_touched: plans.reduce((sum, plan) => sum + plan.out_of_scope_game_pks_touched, 0),
    conflicts: plans.reduce((sum, plan) => sum + plan.conflicts, 0),
    provider_calls: 0,
    production_dml: 0,
    production_ddl: 0,
  }
}

export function runCurrentSlateStage({ context, stage, mode = 'DRY_RUN', rows = [], existingRows = [] }) {
  const { binding, providerStatus } = assertStageAuthorized(context, stage, mode)
  const readOnlyResult = {
    status: mode === 'DRY_RUN' ? 'DRY_RUN_SCOPE_WRAPPER_PASS' : 'WRAPPER_READY_REQUIRES_STAGE_IMPLEMENTATION',
    wrapper: binding.wrapper,
    providerStatus,
    legacyBroadCommand: false,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }
  if (binding.readOnly || rows.length === 0) return readOnlyResult
  const plan = classifyRows({
    context,
    stage,
    table: binding.writeCapKey,
    rows,
    existingRows,
    identityFields: ['identity'],
    cap: Number.isInteger(context.per_stage_dml_caps[binding.writeCapKey]) ? context.per_stage_dml_caps[binding.writeCapKey] : null,
    requireRunAsOf: ['07 prediction persistence', '10 value evaluation', '12 Official Pick persistence'].includes(stage),
  })
  return { ...readOnlyResult, prewriteScope: plan }
}

export const r2cCurrentSlateNativeIdentityWrapper = (input) => runCurrentSlateStage({ ...input, stage: '02 native reconciliation' })
export const r2cCurrentSlateStatcastWrapper = (input) => runCurrentSlateStage({ ...input, stage: '03 raw Statcast reconciliation' })
export const r2cCurrentSlateFeatureWrapper = (input) => runCurrentSlateStage({ ...input, stage: '04 feature refresh' })
export const r2cCurrentSlatePredictionWrapper = (input) => runCurrentSlateStage({ ...input, stage: '07 prediction persistence' })
export const r2cCurrentSlateMarketAcquisitionWrapper = (input) => runCurrentSlateStage({ ...input, stage: '08 market acquisition' })
export const r2cCurrentSlateMarketPersistenceWrapper = (input) => runCurrentSlateStage({ ...input, stage: '09 market persistence' })
export const r2cCurrentSlateValueWrapper = (input) => runCurrentSlateStage({ ...input, stage: '10 value evaluation' })
export const r2cCurrentSlateOfficialPickWrapper = (input) => runCurrentSlateStage({ ...input, stage: '12 Official Pick persistence' })
