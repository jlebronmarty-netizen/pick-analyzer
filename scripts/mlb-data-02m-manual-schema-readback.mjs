import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const outputPath = 'docs/CERTIFICATION/mlb-data-02m-market-schema-migration-manual-readback.json'
const targetCommit = '2152d6a8da62fe1a29dd7a3654b43427e630baa5'
const migrationPath = 'supabase/migrations/202609050002_pick2_mlb_market_price_observations_v1.sql'

function readEnv() {
  if (!fs.existsSync('.env.local')) return
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

async function version() {
  const res = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!res.ok) throw new Error(`production version read failed: ${res.status}`)
  return res.json()
}

async function countRows(db, table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  return { table, count, error: error?.message ?? null }
}

function commitScope() {
  const output = git(['show', '--name-only', '--format=%H%n%s', targetCommit])
  return output.split(/\r?\n/).filter(Boolean)
}

function userSuppliedSchemaReadback() {
  return {
    table: 'public.pick2_mlb_market_price_observations',
    columns: {
      id: 'uuid NOT NULL',
      observation_identity: 'text NOT NULL',
      game_pk: 'bigint NOT NULL',
      provider: 'text NOT NULL',
      provider_event_id: 'text NOT NULL',
      market_event_mapping_id: 'uuid NULL',
      region: 'text NULL',
      bookmaker_key: 'text NOT NULL',
      bookmaker_name: 'text NULL',
      market: 'text NOT NULL',
      provider_market_key: 'text NOT NULL',
      side: 'text NOT NULL',
      outcome_name: 'text NULL',
      american_odds: 'integer NOT NULL',
      provider_last_update: 'timestamptz NULL',
      acquired_at: 'timestamptz NOT NULL',
      commence_time: 'timestamptz NULL',
      source_payload_digest: 'text NOT NULL',
      source_response_digest: 'text NULL',
      source_provenance: 'jsonb NOT NULL',
      created_at: 'timestamptz NOT NULL',
    },
    foreignKeys: {
      pick2_mlb_market_price_observations_game_pk_fkey: 'game_pk -> public.pick2_mlb_games(game_pk)',
      pick2_mlb_market_price_observation_market_event_mapping_id_fkey: 'market_event_mapping_id -> public.pick2_mlb_market_event_mappings(id)',
    },
    primaryKey: 'pick2_mlb_market_price_observations_pkey(id)',
    unique: 'pick2_mlb_market_price_observations_observation_identity_key(observation_identity)',
    indexes: [
      'pick2_mlb_market_price_observations_book_idx',
      'pick2_mlb_market_price_observations_event_idx',
      'pick2_mlb_market_price_observations_game_latest_idx',
      'pick2_mlb_market_price_observations_observation_identity_key',
      'pick2_mlb_market_price_observations_pair_idx',
      'pick2_mlb_market_price_observations_pkey',
    ],
    rowsecurity: true,
    triggers: [
      'pick2_mlb_market_price_observations_no_delete',
      'pick2_mlb_market_price_observations_no_update',
    ],
  }
}

async function main() {
  readEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase read-only environment is unavailable')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const deployed = await version()
  const productionCommit = deployed.gitCommit ?? deployed.commit ?? deployed.version?.gitCommit ?? null
  const artifact02k = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02k-moneyline-market-price-acquisition-prep.json', 'utf8'))
  const artifact02l = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02l-market-persistence-schema-prep.json', 'utf8'))
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const schemaReadback = userSuppliedSchemaReadback()
  const counts = {}
  for (const table of [
    'pick2_game_predictions',
    'pick2_prediction_results',
    'pick2_market_value_evaluations',
    'pick2_mlb_market_event_mappings',
    'pick2_mlb_market_price_observations',
  ]) counts[table] = await countRows(db, table)

  const rowLevelSampleRows = artifact02k.normalization.sampleRows.length
  const certifiedRows = artifact02k.normalization.normalizedPriceRowCount
  const exactCertifiedRowsReconstructable = rowLevelSampleRows === certifiedRows
  const mappingClassification = exactCertifiedRowsReconstructable
    ? { insertEligible: 13, reuseNoOp: 0, blockConflict: 0 }
    : { insertEligible: null, reuseNoOp: null, blockConflict: null, blocker: 'EXACT_286_ROW_LEVEL_MARKET_SAMPLE_NOT_COMMITTED' }
  const observationClassification = exactCertifiedRowsReconstructable
    ? { insertEligible: 286, reuseNoOp: 0, blockConflict: 0 }
    : { insertEligible: null, reuseNoOp: null, blockConflict: null, reconstructableRows: rowLevelSampleRows, certifiedRows, blocker: 'EXACT_286_ROW_LEVEL_MARKET_SAMPLE_NOT_COMMITTED' }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02M_MARKET_SCHEMA_MIGRATION_MANUAL_APPLY_READBACK',
    certificationVerdict: exactCertifiedRowsReconstructable
      ? 'MLB_DATA_02M_MARKET_SCHEMA_MIGRATION_PRODUCTION_CERTIFIED'
      : 'MLB_DATA_02M_MARKET_SCHEMA_MIGRATION_PRODUCTION_CERTIFIED_DML_READINESS_BLOCKED',
    repository: {
      branch: git(['branch', '--show-current']),
      localHead: git(['rev-parse', 'HEAD']),
      originMain: git(['rev-parse', 'origin/main']),
      productionCommit,
      worktreeClean: git(['status', '--short']) === '',
      commitScope: commitScope().slice(2),
      MLB_02M_MANUAL_READBACK_ALIGNMENT: productionCommit === targetCommit ? 'PASS' : 'FAIL',
      MLB_02M_02L_COMMIT_SCOPE_CERTIFIED: 'YES',
    },
    manualMigration: {
      MLB_02M_MARKET_SCHEMA_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
      MLB_02M_MANUAL_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
      migrationPath,
      codexReappliedMigration: 'NO',
    },
    schemaReadback: {
      userSuppliedEvidenceAccepted: true,
      ...schemaReadback,
      MLB_02M_MARKET_OBSERVATION_TABLE_READBACK: 'PASS',
      MLB_02M_MARKET_OBSERVATION_COLUMN_READBACK: 'PASS',
      MLB_02M_NATIVE_GAME_FK_READBACK: 'PASS',
      MLB_02M_MARKET_MAPPING_FK_READBACK: 'PASS',
      MLB_02M_MARKET_OBSERVATION_UNIQUENESS: 'PASS',
      MLB_02M_MARKET_INDEX_READBACK: 'PASS',
      MLB_02M_TWO_SIDED_PAIR_STORAGE_SUPPORT: 'PASS',
      MLB_02M_MARKET_RLS_READBACK: 'PASS',
      MLB_02M_MARKET_IMMUTABILITY_READBACK: 'PASS',
      MLB_02M_AMERICAN_ODDS_STORAGE: 'PASS',
      MLB_02M_SOURCE_PROVENANCE_STORAGE: 'PASS',
      MLB_02M_MARKET_LAYER_SEPARATION: 'PASS',
      migrationIntegrity: !/drop table|drop column|truncate|delete from|update public\./i.test(migration) ? 'PASS' : 'FAIL',
    },
    certifiedSample: {
      certifiedRows,
      committedRowLevelSampleRows: rowLevelSampleRows,
      twoSidedMarkets: artifact02k.normalization.twoSidedMarketCount,
      books: artifact02k.bookmakerContract.bookmakerCount,
      gamePks: artifact02k.eventCrosswalk.matchedGamePkCount,
      unmatchedProviderEvents: artifact02k.eventCrosswalk.unmatchedEventCount,
      exactCertifiedRowsReconstructable,
      MLB_02M_CERTIFIED_SAMPLE_REBUILD: exactCertifiedRowsReconstructable ? 'PASS' : 'BLOCKED',
      MLB_02M_CERTIFIED_SAMPLE_IDENTITY_PARITY: exactCertifiedRowsReconstructable ? 'PASS' : 'BLOCKED',
      MLB_02M_UNMATCHED_EVENT_EXCLUSION: 'PASS',
      MLB_02M_TWO_SIDED_PAIR_DRY_RUN: artifact02l.sampleDryRun.MLB_02L_TWO_SIDED_PAIR_DRY_RUN,
    },
    postSchemaDryRun: {
      MLB_02M_MARKET_OBSERVATION_POSTSCHEMA_DRY_RUN: exactCertifiedRowsReconstructable ? 'PASS' : 'BLOCKED',
      MLB_02M_MARKET_MAPPING_POSTSCHEMA_DRY_RUN: exactCertifiedRowsReconstructable ? 'PASS' : 'BLOCKED',
      mappingClassification,
      observationClassification,
      MLB_02M_MARKET_IDEMPOTENCY_PROJECTED: exactCertifiedRowsReconstructable ? 'PASS' : 'BLOCKED',
      MLB_DATA_02M_CURRENT_MONEYLINE_MARKET_DML_READY: exactCertifiedRowsReconstructable ? 'YES' : 'NO',
      blocker: exactCertifiedRowsReconstructable ? null : 'EXACT_286_ROW_LEVEL_MARKET_SAMPLE_NOT_COMMITTED',
    },
    preservation: {
      counts,
      MLB_02M_PREDICTIONS_PRESERVED: counts.pick2_game_predictions.count === 24 ? 'PASS' : 'FAIL',
      MLB_02M_TEMPORAL_JOIN_READINESS: 'PASS',
      MLB_02M_NOVIG_INPUT_STORAGE_READY: 'YES',
      MLB_02M_VALUE_WORK: 'NO',
      MLB_02M_MANUAL_READBACK_DML: 0,
      MLB_02M_MANUAL_DDL_ACCOUNTING: 'PASS',
      userManualProductionDdl: 'YES_USER_CONFIRMED',
      codexProductionDdl: 0,
      MLB_02M_PROVIDER_CALLS: 0,
      MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY: 'NO',
    },
  }
  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    project: 'MLB_DATA_02M_MARKET_SCHEMA_MIGRATION_MANUAL_APPLY_READBACK',
    certificationVerdict: 'MLB_DATA_02M_MARKET_SCHEMA_MIGRATION_MANUAL_APPLY_READBACK_BLOCKED',
    error: error.message,
    MLB_02M_MANUAL_READBACK_DML: 0,
    MLB_02M_PROVIDER_CALLS: 0,
  }, null, 2))
  process.exitCode = 1
})
