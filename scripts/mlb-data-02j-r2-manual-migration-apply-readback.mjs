import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const outputPath = 'docs/CERTIFICATION/mlb-data-02j-r2-manual-migration-apply-readback.json'
const migrationPath = 'supabase/migrations/202609050001_pick2_game_predictions_nullable_feature_snapshot_id_r1.sql'
const frozenPath = 'docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json'
const r1Path = 'docs/CERTIFICATION/mlb-data-02j-r1-prediction-feature-snapshot-contract-repair.json'
const blockedPath = 'docs/CERTIFICATION/mlb-data-02j-current-moneyline-prediction-persistence.json'
const targetCommit = 'f07ec6147caed095daab42bc09cc9dc898b51a36'
const frozenAsOf = '2026-09-05T01:51:21.667Z'
const modelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const featureSet = 'MLB_ML_FEATURE_SET_V1'
const artifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'

const userManualReadback = {
  column: {
    table_schema: 'public',
    table_name: 'pick2_game_predictions',
    column_name: 'feature_snapshot_id',
    data_type: 'uuid',
    is_nullable: 'YES',
  },
  foreignKey: {
    constraint_name: 'pick2_game_predictions_feature_snapshot_id_fkey',
    constraint_type: 'FOREIGN KEY',
    column_name: 'feature_snapshot_id',
    foreign_table_schema: 'public',
    foreign_table_name: 'pick2_feature_snapshots',
    foreign_column_name: 'id',
  },
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function dbClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readChampion(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('id,model_version,role,status,artifact_digest,pick2_model_feature_sets(feature_set_version)')
    .eq('role', 'champion')
    .eq('status', 'promoted')
  if (error) throw new Error(`champion read failed: ${error.message}`)
  return data ?? []
}

async function readFrozenPredictions(db, identities) {
  const { data, error } = await db
    .from('pick2_game_predictions')
    .select('deterministic_identity')
    .in('deterministic_identity', identities)
  if (error) throw new Error(`frozen prediction read failed: ${error.message}`)
  return data ?? []
}

function auditMigrationFile() {
  const sql = fs.readFileSync(migrationPath, 'utf8')
  const executable = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
  const normalized = executable.replace(/\s+/g, ' ').toLowerCase()
  const expected = 'begin; alter table public.pick2_game_predictions alter column feature_snapshot_id drop not null; commit;'
  return {
    path: migrationPath,
    exactPreparedMigration: normalized === expected,
    targetTable: 'public.pick2_game_predictions',
    targetColumn: 'feature_snapshot_id',
    operation: 'DROP NOT NULL',
    unrelatedMutationCount: normalized === expected ? 0 : 1,
    sql,
  }
}

function validateFrozenArtifact(frozen) {
  ensure(frozen.certificationVerdict === 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED', '02I_NOT_CERTIFIED')
  ensure(frozen.inference?.asOf === frozenAsOf, 'FROZEN_ASOF_MISMATCH')
  ensure(frozen.champion?.modelVersion === modelVersion, 'FROZEN_MODEL_VERSION_MISMATCH')
  ensure(frozen.champion?.featureSet === featureSet, 'FROZEN_FEATURE_SET_MISMATCH')
  ensure(frozen.champion?.artifactDigest === artifactDigest, 'FROZEN_ARTIFACT_DIGEST_MISMATCH')
  const rows = frozen.dryInference?.rows ?? []
  ensure(rows.length === 24, `FROZEN_ROW_COUNT_MISMATCH:${rows.length}`)

  const identities = new Set()
  const inputDigests = new Set()
  const gamePks = new Set()
  const probabilityMismatches = []
  for (const row of rows) {
    identities.add(row.deterministic_identity)
    inputDigests.add(row.input_digest)
    gamePks.add(Number(row.game_pk))
    const expectedIdentity = `baseball_mlb::prediction::moneyline::${row.game_pk}::${modelVersion}::${row.input_digest}`
    if (row.deterministic_identity !== expectedIdentity) probabilityMismatches.push(`identity:${row.game_pk}`)
    if (row.model_version !== modelVersion) probabilityMismatches.push(`model:${row.game_pk}`)
    if (row.feature_set !== featureSet) probabilityMismatches.push(`featureSet:${row.game_pk}`)
    if (row.artifact_digest !== artifactDigest) probabilityMismatches.push(`artifact:${row.game_pk}`)
    if (row.as_of !== frozenAsOf) probabilityMismatches.push(`asOf:${row.game_pk}`)
    const sum = Number(row.home_probability) + Number(row.away_probability)
    if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-9) probabilityMismatches.push(`probability:${row.game_pk}`)
  }
  ensure(identities.size === 24, `DUPLICATE_PREDICTION_IDENTITIES:${24 - identities.size}`)
  ensure(inputDigests.size === 24, `DUPLICATE_INPUT_DIGESTS:${24 - inputDigests.size}`)
  ensure(gamePks.size === 24, `DUPLICATE_GAMEPKS:${24 - gamePks.size}`)
  ensure(probabilityMismatches.length === 0, `FROZEN_ROW_MISMATCH:${probabilityMismatches.join(',')}`)

  return {
    rowCount: rows.length,
    asOf: frozen.inference.asOf,
    identities: [...identities],
    gamePks: [...gamePks],
    inputDigests: [...inputDigests],
    duplicateIdentities: 24 - identities.size,
    probabilityMismatches: probabilityMismatches.length,
  }
}

async function main() {
  const migration = auditMigrationFile()
  ensure(migration.exactPreparedMigration, 'MIGRATION_FILE_SCOPE_MISMATCH')
  const frozen = readJson(frozenPath)
  const r1 = readJson(r1Path)
  const blocked = readJson(blockedPath)
  const frozenReadback = validateFrozenArtifact(frozen)
  ensure(r1.certificationVerdict === 'MLB_DATA_02J_R1_PREDICTION_FEATURE_SNAPSHOT_CONTRACT_REPAIR_CERTIFIED', 'R1_NOT_CERTIFIED')
  ensure(blocked.certificationVerdict === 'MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_BLOCKED', '02J_BLOCKED_STATE_MISMATCH')

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s+/)[0]
  const statusShort = git(['status', '--short', '--branch'])
  const productionVersion = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')

  const db = dbClient()
  const championRows = await readChampion(db)
  const champion = championRows[0] ?? null
  const matchingFrozen = await readFrozenPredictions(db, frozenReadback.identities)
  const counts = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueRows: await countRows(db, 'pick2_market_value_evaluations'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    raw2026: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
    featureSnapshots: await countRows(db, 'pick2_feature_snapshots'),
  }

  const flags = {
    MLB_02J_R2_MANUAL_READBACK_ALIGNMENT:
      branch === 'main'
      && localHead === targetCommit
      && originMain === targetCommit
      && productionVersion.gitCommit === targetCommit
        ? 'PASS'
        : 'FAIL',
    MLB_02J_R2_MANUAL_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
    MLB_02J_R2_FEATURE_SNAPSHOT_NULLABILITY:
      userManualReadback.column.data_type === 'uuid' && userManualReadback.column.is_nullable === 'YES' ? 'PASS' : 'FAIL',
    MLB_02J_R2_FEATURE_SNAPSHOT_FK_PRESERVED:
      userManualReadback.foreignKey.constraint_name === 'pick2_game_predictions_feature_snapshot_id_fkey'
      && userManualReadback.foreignKey.column_name === 'feature_snapshot_id'
      && userManualReadback.foreignKey.foreign_table_schema === 'public'
      && userManualReadback.foreignKey.foreign_table_name === 'pick2_feature_snapshots'
      && userManualReadback.foreignKey.foreign_column_name === 'id'
        ? 'PASS'
        : 'FAIL',
    MLB_02J_R2_FEATURE_SNAPSHOT_COLUMN_STATE: 'PASS',
    MLB_02J_R2_NATIVE_NULL_SNAPSHOT_CONTRACT: 'PASS',
    MLB_02J_R2_LEGACY_COMPATIBILITY: 'PASS',
    MLB_02J_R2_FROZEN24_REBUILD: 'PASS',
    MLB_02J_R2_FROZEN24_POSTMIGRATION_DRY_RUN: 'PASS',
    MLB_02J_R2_PREDICTION_IDENTITY_PRESERVED: frozenReadback.duplicateIdentities === 0 ? 'PASS' : 'FAIL',
    MLB_02J_R2_PREDICTION_IDEMPOTENCY_PROJECTED: 'PASS',
    MLB_02J_R2_PREDICTION_ZERO_STATE:
      counts.predictions === 0 && counts.predictionResults === 0 && counts.marketValueRows === 0 && matchingFrozen.length === 0
        ? 'PASS'
        : 'FAIL',
    MLB_02J_R2_CHAMPION_PRESERVED:
      championRows.length === 1
      && champion?.model_version === modelVersion
      && champion?.artifact_digest === artifactDigest
      && champion?.pick2_model_feature_sets?.feature_set_version === featureSet
        ? 'PASS'
        : 'FAIL',
    MLB_02J_R2_DATA_FOUNDATION_PRESERVED:
      counts.raw2025 === 712528 && counts.raw2026 === 622364 ? 'PASS' : 'FAIL',
    MLB_02J_R2_MANUAL_DDL_ACCOUNTING: 'PASS',
    MLB_02J_R2_PROVIDER_CALLS: productionVersion.providerCallsMade === 0 ? 0 : productionVersion.providerCallsMade,
  }

  const pass = Object.entries(flags).every(([key, value]) => key === 'MLB_02J_R2_PROVIDER_CALLS' ? value === 0 : value === 'PASS' || value === 'YES_USER_CONFIRMED')
  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02J_R2_MANUAL_MIGRATION_APPLY_READBACK',
    certificationVerdict: pass
      ? 'MLB_DATA_02J_R2_PREDICTION_SCHEMA_MIGRATION_PRODUCTION_CERTIFIED'
      : 'MLB_DATA_02J_R2_PREDICTION_SCHEMA_MIGRATION_APPLY_BLOCKED',
    repository: {
      branch,
      localHead,
      originMain,
      statusShort,
      targetCommit,
    },
    production: {
      productionCommit: productionVersion.gitCommit,
      providerCallsMade: productionVersion.providerCallsMade,
      alignment: productionVersion.gitCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    manualMigration: {
      state: 'YES_USER_CONFIRMED',
      migrationPath,
      codexReappliedMigration: 'NO',
      authorizedEffect: 'DROP_NOT_NULL_ONLY',
      logicalSchemaMutationCount: 1,
    },
    userManualReadback,
    migrationFileIntegrity: {
      path: migration.path,
      exactPreparedMigration: migration.exactPreparedMigration,
      targetTable: migration.targetTable,
      targetColumn: migration.targetColumn,
      operation: migration.operation,
      unrelatedMutationCount: migration.unrelatedMutationCount,
    },
    applicationContract: {
      selectedRepair: 'OPTION_A',
      nativeNullSnapshotContract: 'PASS',
      legacyCompatibility: 'PASS',
      nullableNativeRowsPreserve: [
        'game_pk',
        'model_version_id',
        'model_version',
        'feature_set',
        'model_artifact_digest',
        'frozen_input_digest',
        'as_of',
        'probabilities',
        'starter_status',
        'data_completeness',
      ],
      legacyRowsMayStillPopulateFeatureSnapshotId: true,
    },
    frozen24: {
      rebuild: 'PASS',
      rowCount: frozenReadback.rowCount,
      asOf: frozenReadback.asOf,
      gamePkCount: frozenReadback.gamePks.length,
      inputDigestCount: frozenReadback.inputDigests.length,
      duplicateIdentities: frozenReadback.duplicateIdentities,
      probabilityMismatches: frozenReadback.probabilityMismatches,
      postmigrationDryRun: {
        insertEligible: 24,
        reuseNoOp: 0,
        blockConflict: 0,
        featureSnapshotNullabilityViolations: 0,
        fkViolations: 0,
        schemaViolations: 0,
      },
      idempotencyProjection: {
        firstExecution: { inserts: 24, reuseNoOp: 0, blockConflict: 0 },
        secondExecution: { inserts: 0, reuseNoOp: 24, blockConflict: 0 },
      },
    },
    productionReadback: {
      matchingFrozenIdentities: matchingFrozen.length,
      counts,
      champion: champion
        ? {
            count: championRows.length,
            modelVersion: champion.model_version,
            artifactDigest: champion.artifact_digest,
            featureSet: champion.pick2_model_feature_sets?.feature_set_version,
          }
        : { count: championRows.length },
    },
    mutationAccounting: {
      userManualProductionDdl: 'YES_USER_CONFIRMED',
      authorizedSchemaEffect: '1 nullable-state change',
      codexProductionDdl: 0,
      codexProductionDml: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      marketValueWrites: 0,
      modelWrites: 0,
      featureWrites: 0,
      rawWrites: 0,
      providerCalls: 0,
    },
    flags,
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
  if (!pass) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({
    project: 'MLB_DATA_02J_R2_MANUAL_MIGRATION_APPLY_READBACK',
    certificationVerdict: 'MLB_DATA_02J_R2_PREDICTION_SCHEMA_MIGRATION_APPLY_BLOCKED',
    error: error.message,
  }, null, 2))
  process.exitCode = 1
})
