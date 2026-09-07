import crypto from 'node:crypto'

export const STAGE_MODES = Object.freeze(['DRY_RUN', 'LIVE_EXECUTE', 'READBACK_ONLY'])
export const R2F_LIVE_AUTH_ERROR = 'MLB_02R_R2F_LIVE_EXECUTE_REQUIRES_FUTURE_DIRECT_AUTHORIZATION'

export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex')
}

export function assertStageMode(mode) {
  if (!STAGE_MODES.includes(mode)) throw new Error(`INVALID_STAGE_MODE:${mode}`)
  return mode
}

export function assertNoLiveExecute(mode, authorization = false) {
  assertStageMode(mode)
  if (mode === 'LIVE_EXECUTE' && authorization !== true) throw new Error(R2F_LIVE_AUTH_ERROR)
}

export function normalizeGamePk(value, label = 'game_pk') {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) throw new Error(`INVALID_${label.toUpperCase()}:${value}`)
  return parsed
}

export function uniqueGamePks(values, label = 'eligible_game_pks') {
  if (!Array.isArray(values)) throw new Error(`INVALID_${label.toUpperCase()}`)
  return [...new Set(values.map((value) => normalizeGamePk(value, label)))]
}

export function assertIsoTimestamp(value, label = 'run_as_of') {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`INVALID_${label.toUpperCase()}:${value}`)
  return String(value)
}

export function assertGameScope(rows, eligibleGamePks, readGamePk = (row) => row.game_pk ?? row.target_game_pk) {
  const allowed = new Set(uniqueGamePks(eligibleGamePks))
  for (const row of rows) {
    const gamePk = normalizeGamePk(readGamePk(row))
    if (!allowed.has(gamePk)) throw new Error(`OUT_OF_SCOPE_GAME_PK:${gamePk}`)
  }
  return true
}

export function makeRunContext(input = {}) {
  const runContext = {
    run_id: String(input.run_id ?? input.runId ?? 'mlb-02r-r2f-dry-run'),
    run_date: String(input.run_date ?? input.runDate ?? '2026-09-07'),
    run_as_of: assertIsoTimestamp(input.run_as_of ?? input.runAsOf ?? new Date('2026-09-07T15:00:00.000Z').toISOString()),
    execution_package_sha: String(input.execution_package_sha ?? input.executionPackageSha ?? 'c10734f614cdb332ccee2c601e19fc0a9087ec46'),
    db_contract_digest: String(input.db_contract_digest ?? input.dbContractDigest ?? 'r2f-dry-db-contract'),
    model_artifact_digest: String(input.model_artifact_digest ?? input.modelArtifactDigest ?? 'r2f-dry-model-contract'),
    feature_contract_digest: String(input.feature_contract_digest ?? input.featureContractDigest ?? 'r2f-dry-feature-contract'),
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runContext.run_date)) throw new Error(`INVALID_RUN_DATE:${runContext.run_date}`)
  return runContext
}

export function makeProviderAccounting(provider, planned = 0, consumed = 0) {
  return {
    provider,
    planned,
    consumed,
    blocked: 0,
    calls: consumed,
  }
}

export function assertProviderBudget(providerBudget = {}, provider, requestedCalls, mode) {
  const budget = providerBudget?.[provider] ?? { allowed: false, maxCalls: 0, consumed: 0 }
  if (mode === 'DRY_RUN' || mode === 'READBACK_ONLY') {
    if (requestedCalls !== 0) throw new Error(`PROVIDER_CALL_FORBIDDEN_IN_${mode}:${provider}`)
    return makeProviderAccounting(provider, 0, 0)
  }
  if (!budget.allowed) throw new Error(`PROVIDER_NOT_ALLOWED:${provider}`)
  if (Number(budget.consumed ?? 0) + requestedCalls > Number(budget.maxCalls ?? 0)) throw new Error(`PROVIDER_CAP_EXCEEDED:${provider}`)
  return makeProviderAccounting(provider, requestedCalls, Number(budget.consumed ?? 0) + requestedCalls)
}

export function identityFor(row, fields) {
  const parts = fields.map((field) => row[field])
  if (parts.some((value) => value === undefined || value === null || value === '')) throw new Error(`ROW_IDENTITY_INCOMPLETE:${fields.join(',')}`)
  return parts.map(String).join(':')
}

export function classifyInsertReuseConflict({
  plannedRows,
  existingRows = [],
  identityFields,
  digestField = null,
  eligibleGamePks,
  cap = null,
  readGamePk = (row) => row.game_pk ?? row.target_game_pk,
}) {
  assertGameScope(plannedRows, eligibleGamePks, readGamePk)
  const existingByIdentity = new Map(existingRows.map((row) => [identityFor(row, identityFields), row]))
  const seen = new Set()
  const classifications = []
  for (const row of plannedRows) {
    const identity = identityFor(row, identityFields)
    const gamePk = normalizeGamePk(readGamePk(row))
    if (seen.has(identity)) {
      classifications.push({ identity, game_pk: gamePk, classification: 'BLOCK_CONFLICT', reason: 'DUPLICATE_PLANNED_IDENTITY' })
      continue
    }
    seen.add(identity)
    const existing = existingByIdentity.get(identity)
    if (!existing) {
      classifications.push({ identity, game_pk: gamePk, classification: 'INSERT_ELIGIBLE' })
      continue
    }
    if (digestField && row[digestField] != null && existing[digestField] != null && row[digestField] !== existing[digestField]) {
      classifications.push({ identity, game_pk: gamePk, classification: 'BLOCK_CONFLICT', reason: 'DIGEST_MISMATCH' })
      continue
    }
    classifications.push({ identity, game_pk: gamePk, classification: 'REUSE_NO_OP' })
  }
  const summary = {
    plannedRows: plannedRows.length,
    insertEligible: classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE').length,
    reuseNoOp: classifications.filter((row) => row.classification === 'REUSE_NO_OP').length,
    blockConflict: classifications.filter((row) => row.classification === 'BLOCK_CONFLICT').length,
    classifications,
  }
  if (summary.blockConflict > 0) throw new Error(`BLOCK_CONFLICT:${summary.blockConflict}`)
  if (Number.isInteger(cap) && summary.insertEligible > cap) throw new Error(`CAP_EXCEEDED:${summary.insertEligible}:${cap}`)
  return summary
}

export function stageResult({
  stage,
  mode,
  status = 'PASS',
  plannedRows = 0,
  insertEligible = 0,
  reuseNoOp = 0,
  blockConflict = 0,
  providerCalls = 0,
  productionDml = 0,
  productionDdl = 0,
  artifact = {},
}) {
  return {
    stage,
    mode,
    status,
    plannedRows,
    insertEligible,
    reuseNoOp,
    blockConflict,
    providerCalls,
    productionDml,
    productionDdl,
    artifact,
  }
}

export function createMemoryCheckpoint() {
  const events = []
  return {
    events,
    record(type, payload = {}) {
      events.push({ type, ...payload })
      return events[events.length - 1]
    },
    firstIncomplete(stages) {
      const completed = new Set(events.filter((event) => event.type === 'stage_complete').map((event) => event.stage))
      return stages.find((stage) => !completed.has(stage)) ?? null
    },
  }
}
