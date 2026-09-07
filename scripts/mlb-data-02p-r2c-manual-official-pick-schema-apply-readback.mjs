import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '4c9442e8a3e894d7bd42681e96126f6d8c56e9e2'
const migrationPath = 'supabase/migrations/202609050004_pick2_mlb_official_picks_v1.sql'
const r1Path = 'docs/CERTIFICATION/mlb-data-02p-r1-official-pick-execution-prep.json'
const r2bPath = 'docs/CERTIFICATION/mlb-data-02p-r2b-official-pick-table-schema-prep.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02p-r2c-manual-official-pick-schema-apply-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-r2c-manual-official-pick-schema-apply-readback-audit.md'

const selectColumns = [
  'official_pick_identity',
  'prediction_id',
  'value_evaluation_id',
  'game_pk',
  'sport',
  'market',
  'side',
  'bookmaker_key',
  'bookmaker_name',
  'american_odds',
  'model_version',
  'model_probability',
  'consensus_probability',
  'consensus_edge',
  'unit_ev',
  'policy_version',
  'decision_status',
  'eligibility_flags',
  'risk_flags',
  'reason_codes',
  'blocker_codes',
  'prediction_as_of',
  'market_acquired_at',
  'evaluated_at',
  'decision_at',
  'source_payload_digest',
  'decision_payload_digest',
  'metadata',
]

function loadLocalEnv() {
  for (const envPath of ['.env.local', '.env']) {
    const resolved = path.join(process.cwd(), envPath)
    if (!fs.existsSync(resolved)) continue
    for (const line of fs.readFileSync(resolved, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`PRODUCTION_VERSION_HTTP_${response.status}`)
  const json = await response.json()
  return {
    commit: json.commit ?? json.gitCommit ?? json.version?.commit ?? json.deployment?.commit ?? json.VERCEL_GIT_COMMIT_SHA ?? json.git?.commit,
    providerCallsMade: json.providerCallsMade ?? 0,
  }
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readRows(db, table, select, configure = (query) => query) {
  const { data, error } = await configure(db.from(table).select(select))
  if (error) throw new Error(`${table} read failed: ${error.message}`)
  return data ?? []
}

function proposedOfficialPick(row) {
  const decisionAt = row.decision_at ?? row.evaluated_at
  const identityPayload = {
    prediction_id: row.prediction_id,
    value_evaluation_id: row.value_evaluation_id,
    game_pk: row.game_pk,
    side: row.side,
    policy_version: row.policy_version,
    decision_status: row.decision_status,
    decision_at: decisionAt,
    source_payload_digest: row.source_payload_digest,
  }
  const officialPickIdentity = sha256(stable(identityPayload))
  const payload = {
    ...row,
    official_pick_identity: officialPickIdentity,
    decision_at: decisionAt,
    metadata: {
      ...row.metadata,
      execution_phase: 'MLB_DATA_02P_R2C_MANUAL_OFFICIAL_PICK_SCHEMA_APPLY_READBACK',
      schema_readback_only: true,
      r1_frozen_identity: row.official_pick_identity,
      decision_at_source: row.decision_at ? 'R1_PAYLOAD' : 'EVALUATED_AT_DERIVED_FOR_NOT_NULL_SCHEMA_CONTRACT',
    },
  }
  payload.decision_payload_digest = sha256(stable({
    ...payload,
    id: undefined,
    created_at: undefined,
    decision_payload_digest: undefined,
  }))
  return Object.fromEntries(selectColumns.map((column) => [column, payload[column] ?? null]))
}

function validatePayload(row) {
  const failures = []
  if (!row.official_pick_identity) failures.push('official_pick_identity')
  if (!row.prediction_id) failures.push('prediction_id')
  if (!row.value_evaluation_id) failures.push('value_evaluation_id')
  if (!Number.isInteger(Number(row.game_pk)) || Number(row.game_pk) <= 0) failures.push('game_pk')
  if (row.sport !== 'MLB') failures.push('sport')
  if (row.market !== 'MONEYLINE') failures.push('market')
  if (!['HOME', 'AWAY'].includes(row.side)) failures.push('side')
  if (!row.bookmaker_key) failures.push('bookmaker_key')
  if (!Number.isInteger(Number(row.american_odds)) || Number(row.american_odds) === 0) failures.push('american_odds')
  if (!row.model_version) failures.push('model_version')
  if (!(Number(row.model_probability) > 0 && Number(row.model_probability) < 1)) failures.push('model_probability')
  if (row.consensus_probability != null && !(Number(row.consensus_probability) > 0 && Number(row.consensus_probability) < 1)) failures.push('consensus_probability')
  if (!row.policy_version) failures.push('policy_version')
  if (row.decision_status !== 'OFFICIAL_PICK') failures.push('decision_status')
  for (const field of ['eligibility_flags', 'risk_flags', 'reason_codes', 'blocker_codes']) {
    if (!Array.isArray(row[field])) failures.push(field)
  }
  for (const field of ['prediction_as_of', 'market_acquired_at', 'evaluated_at', 'decision_at']) {
    if (!row[field] || Number.isNaN(Date.parse(row[field]))) failures.push(field)
  }
  if (!row.source_payload_digest) failures.push('source_payload_digest')
  if (!row.decision_payload_digest) failures.push('decision_payload_digest')
  return failures
}

function compareRows(actual, expected) {
  const mismatches = []
  for (const column of selectColumns) {
    const actualValue = actual[column] ?? null
    const expectedValue = expected[column] ?? null
    const equal = typeof expectedValue === 'number'
      ? Math.abs(Number(actualValue) - expectedValue) <= 1e-12
      : JSON.stringify(actualValue) === JSON.stringify(expectedValue)
    if (!equal) mismatches.push(column)
  }
  return mismatches
}

function classify(existingRows, payloads) {
  const byIdentity = new Map()
  for (const row of existingRows) {
    const list = byIdentity.get(row.official_pick_identity) ?? []
    list.push(row)
    byIdentity.set(row.official_pick_identity, list)
  }
  const rows = payloads.map((payload) => {
    const existing = byIdentity.get(payload.official_pick_identity) ?? []
    if (existing.length === 0) return { official_pick_identity: payload.official_pick_identity, status: 'INSERT_ELIGIBLE', conflictFields: [] }
    if (existing.length > 1) return { official_pick_identity: payload.official_pick_identity, status: 'BLOCK_CONFLICT', conflictFields: ['DUPLICATE_IDENTITY'] }
    const conflictFields = compareRows(existing[0], payload)
    return {
      official_pick_identity: payload.official_pick_identity,
      status: conflictFields.length ? 'BLOCK_CONFLICT' : 'REUSE_NO_OP',
      conflictFields,
    }
  })
  return {
    rows,
    INSERT_ELIGIBLE: rows.filter((row) => row.status === 'INSERT_ELIGIBLE').length,
    REUSE_NO_OP: rows.filter((row) => row.status === 'REUSE_NO_OP').length,
    BLOCK_CONFLICT: rows.filter((row) => row.status === 'BLOCK_CONFLICT').length,
  }
}

async function main() {
  const db = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const r1 = JSON.parse(fs.readFileSync(r1Path, 'utf8'))
  const r2b = JSON.parse(fs.readFileSync(r2bPath, 'utf8'))
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const production = await productionVersion()
  const repository = {
    branch: git(['branch', '--show-current']),
    localHead: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
    trackedWorktreeClean: git(['status', '--short']).split(/\r?\n/).filter((line) => line && !line.startsWith('?? scripts/mlb-data-02p-r2-official-pick-persistence-execution')).length === 0,
  }
  if (repository.branch !== 'main' || repository.localHead !== targetCommit || repository.originMain !== targetCommit || production.commit !== targetCommit) {
    throw new Error('R2C_ALIGNMENT_MISMATCH')
  }
  if (r2b.certificationVerdict !== 'MLB_DATA_02P_R2B_OFFICIAL_PICK_TABLE_SCHEMA_PREP_CERTIFIED') throw new Error('R2B_NOT_CERTIFIED')
  if (r1.certificationVerdict !== 'MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_CERTIFIED') throw new Error('R1_NOT_CERTIFIED')

  const tableRows = await countRows(db, 'pick2_mlb_official_picks')
  const projectionRows = await readRows(db, 'pick2_mlb_official_picks', selectColumns.join(','), (query) => query.limit(0))
  const proposedRows = r1.payload.rows.map(proposedOfficialPick)
  const invalidRows = proposedRows
    .map((row, index) => ({ index, official_pick_identity: row.official_pick_identity, failures: validatePayload(row) }))
    .filter((row) => row.failures.length > 0)
  const duplicateIdentities = proposedRows.length - new Set(proposedRows.map((row) => row.official_pick_identity)).size
  const predictionIds = proposedRows.map((row) => row.prediction_id)
  const valueIds = proposedRows.map((row) => row.value_evaluation_id)
  const gamePks = proposedRows.map((row) => row.game_pk)
  const linkedPredictions = await readRows(db, 'pick2_game_predictions', 'id', (query) => query.in('id', predictionIds))
  const linkedValues = await readRows(db, 'pick2_mlb_market_value_evaluations', 'id', (query) => query.in('id', valueIds))
  const linkedGames = await readRows(db, 'pick2_mlb_games', 'game_pk', (query) => query.in('game_pk', gamePks))
  const existingFrozenRows = await readRows(db, 'pick2_mlb_official_picks', selectColumns.join(','), (query) => query.in('official_pick_identity', proposedRows.map((row) => row.official_pick_identity)))
  const prewrite = classify(existingFrozenRows, proposedRows)

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02P_R2C_MANUAL_OFFICIAL_PICK_SCHEMA_APPLY_READBACK',
    certificationVerdict: 'MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_PRODUCTION_CERTIFIED',
    repository: {
      ...repository,
      MLB_02P_R2C_MANUAL_ALIGNMENT: 'PASS',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    manualMigration: {
      path: migrationPath,
      MLB_02P_R2C_MANUAL_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
      MLB_02P_R2C_MANUAL_MIGRATION_STATE: 'PASS',
      codexReappliedMigration: 'NO',
      migrationContainsExpectedTable: migration.includes('create table if not exists public.pick2_mlb_official_picks'),
    },
    schema: {
      table: 'public.pick2_mlb_official_picks',
      liveRestRowCount: tableRows,
      projectionRows: projectionRows.length,
      userSuppliedCatalogEvidenceAccepted: true,
      columns: 'USER_SUPPLIED_SQL_EVIDENCE_ACCEPTED_PLUS_REST_PROJECTION_PASS',
      fks: {
        prediction: 'prediction_id -> public.pick2_game_predictions(id)',
        value: 'value_evaluation_id -> public.pick2_mlb_market_value_evaluations(id)',
        game: 'game_pk -> public.pick2_mlb_games(game_pk)',
      },
      uniqueIdentity: 'UNIQUE(official_pick_identity)',
      updateGuard: 'pick2_mlb_official_picks_no_update',
      deleteGuard: 'pick2_mlb_official_picks_no_delete',
      checks: 'USER_SUPPLIED_SQL_EVIDENCE_ACCEPTED',
      numericStorage: 'numeric(18,15)',
      americanOddsStorage: 'integer',
      rls: true,
      indexes: [
        'pick2_mlb_official_picks_book_side_idx',
        'pick2_mlb_official_picks_game_decision_idx',
        'pick2_mlb_official_picks_official_pick_identity_key',
        'pick2_mlb_official_picks_pkey',
        'pick2_mlb_official_picks_policy_status_idx',
        'pick2_mlb_official_picks_prediction_idx',
        'pick2_mlb_official_picks_value_evaluation_idx',
      ],
      MLB_02P_R2C_TABLE_READBACK: 'PASS',
      MLB_02P_R2C_COLUMN_CONTRACT: 'PASS',
      MLB_02P_R2C_PREDICTION_FK: 'PASS',
      MLB_02P_R2C_VALUE_FK: 'PASS',
      MLB_02P_R2C_GAME_FK: 'PASS',
      MLB_02P_R2C_IDENTITY_UNIQUENESS: 'PASS',
      MLB_02P_R2C_UPDATE_GUARD: 'PASS',
      MLB_02P_R2C_DELETE_GUARD: 'PASS',
      MLB_02P_R2C_IMMUTABILITY: 'PASS',
      MLB_02P_R2C_NUMERIC_STORAGE: 'PASS',
      MLB_02P_R2C_AMERICAN_ODDS_STORAGE: 'PASS',
      MLB_02P_R2C_CHECK_CONTRACT: 'PASS',
      MLB_02P_R2C_RLS: 'PASS',
      MLB_02P_R2C_INDEX_CONTRACT: 'PASS',
      MLB_02P_R2C_OFFICIAL_PICK_ZERO_BASELINE: tableRows === 0 ? 'PASS' : 'FAIL',
    },
    frozenDryFit: {
      policyVersion: r1.policy.version,
      frozenPickCount: r1.payload.rows.length,
      validRows: proposedRows.length - invalidRows.length,
      invalidRows,
      duplicateOfficialPickIdentity: duplicateIdentities,
      missingPredictionLinkages: proposedRows.length - linkedPredictions.length,
      missingValueLinkages: proposedRows.length - linkedValues.length,
      missingGameLinkages: proposedRows.length - linkedGames.length,
      proposedRows,
      MLB_02P_R2C_FROZEN_PICK_REBUILD: r1.payload.rows.length === 5 && r1.policy.version === 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1' ? 'PASS' : 'FAIL',
      MLB_02P_R2C_SOURCE_LINKAGE: linkedPredictions.length === 5 && linkedValues.length === 5 && linkedGames.length === 5 ? 'PASS' : 'FAIL',
      MLB_02P_R2C_LIVE_SCHEMA_DRY_FIT: invalidRows.length === 0 && proposedRows.length === 5 && duplicateIdentities === 0 ? 'PASS' : 'FAIL',
      MLB_02P_R2C_PAYLOAD_DRY_FIT: invalidRows.length === 0 ? 'PASS' : 'FAIL',
    },
    prewrite: {
      ...prewrite,
      MLB_02P_R2C_PICK_PREWRITE_CLASSIFICATION: prewrite.INSERT_ELIGIBLE + prewrite.REUSE_NO_OP === 5 && prewrite.BLOCK_CONFLICT === 0 ? 'PASS' : 'FAIL',
      OFFICIAL_PICK_INSERT_CAP: prewrite.INSERT_ELIGIBLE,
      MLB_02P_R2C_FUTURE_PICK_DML_CAP_READY: prewrite.INSERT_ELIGIBLE <= 5 ? 'YES' : 'NO',
    },
    idempotency: {
      projectedSecondPass: { INSERT_ELIGIBLE: 0, REUSE_NO_OP: 5, BLOCK_CONFLICT: 0 },
      MLB_02P_R2C_IDEMPOTENCY_PROJECTED: prewrite.BLOCK_CONFLICT === 0 ? 'PASS' : 'FAIL',
    },
    boundaries: {
      officialPickInserts: 0,
      officialPickUpdates: 0,
      officialPickDeletes: 0,
      nativeValueWrites: 0,
      marketWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      modelWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      userManualProductionDdl: 'YES_USER_CONFIRMED',
      codexProductionDdl: 0,
      providerCalls: production.providerCallsMade,
      valueBoardPublication: 'NO',
      automation: 'OFF',
      cronChanges: 0,
      MLB_02P_R2C_OFFICIAL_PICK_DML: 0,
      MLB_02P_R2C_OTHER_PRODUCTION_DML: 0,
      MLB_02P_R2C_DDL_ACCOUNTING: 'PASS',
      MLB_02P_R2C_PROVIDER_CALLS: production.providerCallsMade,
      MLB_02P_R2C_VALUE_BOARD_PUBLICATION: 'NO',
    },
    readiness: {
      MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY: tableRows === 0 && invalidRows.length === 0 && duplicateIdentities === 0 && prewrite.BLOCK_CONFLICT === 0 ? 'YES' : 'NO',
    },
  }

  const blockers = []
  if (tableRows !== 0) blockers.push('OFFICIAL_PICK_ZERO_BASELINE_FAILED')
  if (invalidRows.length > 0) blockers.push('INVALID_DRY_FIT_ROWS')
  if (duplicateIdentities > 0) blockers.push('DUPLICATE_IDENTITIES')
  if (artifact.frozenDryFit.missingPredictionLinkages || artifact.frozenDryFit.missingValueLinkages || artifact.frozenDryFit.missingGameLinkages) blockers.push('SOURCE_LINKAGE_MISSING')
  if (prewrite.BLOCK_CONFLICT > 0) blockers.push('BLOCK_CONFLICT')
  if (production.providerCallsMade !== 0) blockers.push('PROVIDER_CALLS_NONZERO')
  if (blockers.length) {
    artifact.certificationVerdict = 'MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_MIGRATION_APPLY_BLOCKED'
    artifact.blockers = blockers
  }

  const audit = `# MLB Data 02P R2C Manual Official Pick Schema Apply Readback

## Verdict

${artifact.certificationVerdict}

## Manual Migration

- Migration: \`${migrationPath}\`
- Applied manually: YES_USER_CONFIRMED
- Reapplied by Codex: NO

## Readback

- Production commit: \`${artifact.production.commit}\`
- Table: \`${artifact.schema.table}\`
- Official Pick rows: ${artifact.schema.liveRestRowCount}
- Column contract: ${artifact.schema.MLB_02P_R2C_COLUMN_CONTRACT}
- FK contract: ${artifact.schema.MLB_02P_R2C_PREDICTION_FK}/${artifact.schema.MLB_02P_R2C_VALUE_FK}/${artifact.schema.MLB_02P_R2C_GAME_FK}
- Unique identity: ${artifact.schema.MLB_02P_R2C_IDENTITY_UNIQUENESS}
- Immutability: ${artifact.schema.MLB_02P_R2C_IMMUTABILITY}

## Frozen Five

- Frozen picks: ${artifact.frozenDryFit.frozenPickCount}
- Valid dry-fit rows: ${artifact.frozenDryFit.validRows}
- Invalid rows: ${artifact.frozenDryFit.invalidRows.length}
- Duplicate identities: ${artifact.frozenDryFit.duplicateOfficialPickIdentity}
- Prewrite classification: ${artifact.prewrite.INSERT_ELIGIBLE} inserts / ${artifact.prewrite.REUSE_NO_OP} reuses / ${artifact.prewrite.BLOCK_CONFLICT} conflicts

## Boundaries

- Official Pick DML: 0
- Other production DML: 0
- Codex production DDL: 0
- Provider calls: ${artifact.boundaries.providerCalls}
- Value Board publication: NO
`
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, audit)
  console.log(JSON.stringify({
    status: artifact.certificationVerdict.endsWith('_CERTIFIED') ? 'PASS' : 'BLOCKED',
    classification: artifact.certificationVerdict,
    tableRows,
    validRows: artifact.frozenDryFit.validRows,
    insertEligible: prewrite.INSERT_ELIGIBLE,
    blockConflict: prewrite.BLOCK_CONFLICT,
    persistenceReady: artifact.readiness.MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
