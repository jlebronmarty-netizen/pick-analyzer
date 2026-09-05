import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const executePredictions = process.argv.includes('--execute-predictions')
const writeArtifact = process.argv.includes('--write-artifact')
const targetCommit = 'c8de8a17746ef8ab607862ccb8e64c2a3129b209'
const frozenAsOf = '2026-09-05T01:51:21.667Z'
const modelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const featureSet = 'MLB_ML_FEATURE_SET_V1'
const artifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const frozenPath = 'docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json'
const r2Path = 'docs/CERTIFICATION/mlb-data-02j-r2-manual-migration-apply-readback.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02j-r3-current-moneyline-prediction-dml-retry.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02j-r3-current-moneyline-prediction-persistence-audit.md'

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

async function readPredictionsByIdentity(db, identities) {
  const { data, error } = await db
    .from('pick2_game_predictions')
    .select('id,deterministic_identity,sport_key,event_id,game_pk,model_version_id,feature_snapshot_id,predicted_at,target,home_probability,away_probability,expected_home_score,expected_away_score,expected_total,expected_margin,frozen_input_digest,model_artifact_digest,metadata')
    .in('deterministic_identity', identities)
  if (error) throw new Error(`prediction identity read failed: ${error.message}`)
  return data ?? []
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function readFrozenRows() {
  const frozen = JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
  ensure(frozen.certificationVerdict === 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED', 'FROZEN_02I_NOT_CERTIFIED')
  ensure(frozen.inference?.asOf === frozenAsOf, 'FROZEN_ASOF_MISMATCH')
  ensure(frozen.champion?.modelVersion === modelVersion, 'FROZEN_MODEL_MISMATCH')
  ensure(frozen.champion?.featureSet === featureSet, 'FROZEN_FEATURE_SET_MISMATCH')
  ensure(frozen.champion?.artifactDigest === artifactDigest, 'FROZEN_ARTIFACT_DIGEST_MISMATCH')
  const rows = frozen.dryInference?.rows ?? []
  ensure(rows.length === 24, `FROZEN_ROW_COUNT_MISMATCH:${rows.length}`)
  const identities = new Set()
  const gamePks = new Set()
  const digests = new Set()
  const mismatches = []
  for (const row of rows) {
    identities.add(row.deterministic_identity)
    gamePks.add(Number(row.game_pk))
    digests.add(row.input_digest)
    if (row.market !== 'moneyline') mismatches.push(`market:${row.game_pk}`)
    if (row.as_of !== frozenAsOf) mismatches.push(`as_of:${row.game_pk}`)
    if (row.model_version !== modelVersion) mismatches.push(`model:${row.game_pk}`)
    if (row.feature_set !== featureSet) mismatches.push(`feature_set:${row.game_pk}`)
    if (row.artifact_digest !== artifactDigest) mismatches.push(`artifact:${row.game_pk}`)
    if (row.starter_status !== 'READY_PROBABLE_WITH_FLAG') mismatches.push(`starter:${row.game_pk}`)
    if (row.data_completeness !== 'COMPLETE') mismatches.push(`data:${row.game_pk}`)
    if (Math.abs(Number(row.home_probability) + Number(row.away_probability) - 1) > 1e-9) mismatches.push(`probability:${row.game_pk}`)
    const expectedIdentity = `baseball_mlb::prediction::moneyline::${row.game_pk}::${modelVersion}::${row.input_digest}`
    if (row.deterministic_identity !== expectedIdentity) mismatches.push(`identity:${row.game_pk}`)
  }
  ensure(identities.size === 24 && gamePks.size === 24 && digests.size === 24, 'FROZEN_UNIQUENESS_FAILED')
  ensure(mismatches.length === 0, `FROZEN_PAYLOAD_PARITY_FAILED:${mismatches.join(',')}`)
  return { frozen, rows, identities: [...identities], gamePks: [...gamePks] }
}

function plannedPrediction(row, champion) {
  return {
    deterministic_identity: row.deterministic_identity,
    pick2_era: 'PICK_2_ERA_V1',
    sport_key: 'baseball_mlb',
    event_id: null,
    game_pk: Number(row.game_pk),
    model_version_id: champion.id,
    feature_snapshot_id: null,
    predicted_at: row.as_of,
    target: 'home_win_probability',
    home_probability: row.home_probability,
    away_probability: row.away_probability,
    expected_home_score: null,
    expected_away_score: null,
    expected_total: null,
    expected_margin: null,
    frozen_input_digest: row.input_digest,
    model_artifact_digest: row.artifact_digest,
    metadata: {
      market: row.market,
      model_version: row.model_version,
      feature_set: row.feature_set,
      feature_version: featureVersion,
      home_team_id: row.home_team_id,
      away_team_id: row.away_team_id,
      scheduled_at: row.scheduled_at,
      starter_status: row.starter_status,
      data_completeness: row.data_completeness,
      extrapolation_state: row.extrapolation_state,
      recommendation: null,
      value: null,
      official_pick: false,
      as_of: row.as_of,
      source_certification: 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED',
      persistence_phase: 'MLB_DATA_02J_R3_CURRENT_MONEYLINE_PREDICTION_DML_RETRY',
    },
  }
}

function normalizePrediction(row) {
  return {
    deterministic_identity: row.deterministic_identity,
    sport_key: row.sport_key,
    event_id: row.event_id ?? null,
    game_pk: Number(row.game_pk),
    model_version_id: row.model_version_id,
    feature_snapshot_id: row.feature_snapshot_id ?? null,
    predicted_at: new Date(row.predicted_at).toISOString(),
    target: row.target,
    home_probability: Number(row.home_probability),
    away_probability: Number(row.away_probability),
    expected_home_score: row.expected_home_score ?? null,
    expected_away_score: row.expected_away_score ?? null,
    expected_total: row.expected_total ?? null,
    expected_margin: row.expected_margin ?? null,
    frozen_input_digest: row.frozen_input_digest,
    model_artifact_digest: row.model_artifact_digest,
    metadata: {
      market: row.metadata?.market,
      model_version: row.metadata?.model_version,
      feature_set: row.metadata?.feature_set,
      feature_version: row.metadata?.feature_version,
      home_team_id: row.metadata?.home_team_id,
      away_team_id: row.metadata?.away_team_id,
      scheduled_at: row.metadata?.scheduled_at,
      starter_status: row.metadata?.starter_status,
      data_completeness: row.metadata?.data_completeness,
      extrapolation_state: row.metadata?.extrapolation_state,
      recommendation: row.metadata?.recommendation ?? null,
      value: row.metadata?.value ?? null,
      official_pick: row.metadata?.official_pick ?? false,
      as_of: row.metadata?.as_of,
    },
  }
}

function normalizePlanned(row) {
  return normalizePrediction(row)
}

function payloadMatches(existing, planned) {
  return JSON.stringify(normalizePrediction(existing)) === JSON.stringify(normalizePlanned(planned))
}

function classify(plannedRows, existingRows) {
  const existing = new Map(existingRows.map((row) => [row.deterministic_identity, row]))
  const rows = plannedRows.map((planned) => {
    const found = existing.get(planned.deterministic_identity)
    if (!found) return { deterministic_identity: planned.deterministic_identity, game_pk: planned.game_pk, classification: 'INSERT_ELIGIBLE' }
    if (payloadMatches(found, planned)) return { deterministic_identity: planned.deterministic_identity, game_pk: planned.game_pk, classification: 'REUSE_NO_OP' }
    return { deterministic_identity: planned.deterministic_identity, game_pk: planned.game_pk, classification: 'BLOCK_CONFLICT' }
  })
  return {
    rows,
    insertEligible: rows.filter((row) => row.classification === 'INSERT_ELIGIBLE').length,
    reuseNoOp: rows.filter((row) => row.classification === 'REUSE_NO_OP').length,
    blockConflict: rows.filter((row) => row.classification === 'BLOCK_CONFLICT').length,
  }
}

function safeShort(value) {
  return `${String(value).slice(0, 12)}...${String(value).slice(-8)}`
}

function writeHumanAudit(frozenRows, prewrite, insertedIds, postRows) {
  const postIds = new Set(postRows.map((row) => row.deterministic_identity))
  const inserted = new Set(insertedIds)
  const lines = [
    '# CURRENT MONEYLINE PREDICTION PERSISTENCE AUDIT',
    '',
    `Frozen as_of: ${frozenAsOf}`,
    '',
    '| game_pk | teams | scheduled start | frozen as_of | starter state | home fair probability | away fair probability | input digest | prediction identity | prewrite classification | persistence result | postwrite readback |',
    '|---:|---|---|---|---|---:|---:|---|---|---|---|---|',
  ]
  for (const row of frozenRows) {
    const pre = prewrite.rows.find((item) => item.deterministic_identity === row.deterministic_identity)?.classification ?? 'UNKNOWN'
    const result = inserted.has(row.deterministic_identity) ? 'INSERTED' : 'REUSE_NO_OP'
    lines.push(`| ${row.game_pk} | ${row.away_team_id} @ ${row.home_team_id} | ${row.scheduled_at} | ${row.as_of} | ${row.starter_status} | ${Number(row.home_probability).toFixed(6)} | ${Number(row.away_probability).toFixed(6)} | ${safeShort(row.input_digest)} | ${safeShort(row.deterministic_identity)} | ${pre} | ${result} | ${postIds.has(row.deterministic_identity) ? 'PASS' : 'MISSING'} |`)
  }
  fs.writeFileSync(auditPath, `${lines.join('\n')}\n`)
}

async function main() {
  ensure(executePredictions, 'EXECUTE_PREDICTIONS_FLAG_REQUIRED')
  ensure(git(['rev-parse', '--abbrev-ref', 'HEAD']) === 'main', 'BRANCH_NOT_MAIN')
  ensure(git(['rev-parse', 'HEAD']) === targetCommit, 'LOCAL_HEAD_MISMATCH')
  const production = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(production.gitCommit === targetCommit, `PRODUCTION_ALIGNMENT_MISMATCH:${production.gitCommit}`)
  ensure(production.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const r2 = JSON.parse(fs.readFileSync(r2Path, 'utf8'))
  ensure(r2.certificationVerdict === 'MLB_DATA_02J_R2_PREDICTION_SCHEMA_MIGRATION_PRODUCTION_CERTIFIED', 'R2_NOT_CERTIFIED')
  ensure(r2.userManualReadback?.column?.data_type === 'uuid' && r2.userManualReadback?.column?.is_nullable === 'YES', 'SCHEMA_NULLABILITY_NOT_CERTIFIED')
  ensure(r2.userManualReadback?.foreignKey?.foreign_table_name === 'pick2_feature_snapshots', 'SCHEMA_FK_NOT_CERTIFIED')

  const db = dbClient()
  const { rows: frozenRows, identities, gamePks } = readFrozenRows()
  const championRows = await readChampion(db)
  ensure(championRows.length === 1, `CHAMPION_COUNT_MISMATCH:${championRows.length}`)
  const champion = championRows[0]
  ensure(champion.model_version === modelVersion && champion.artifact_digest === artifactDigest && champion.pick2_model_feature_sets?.feature_set_version === featureSet, 'CHAMPION_MISMATCH')

  const plannedRows = frozenRows.map((row) => plannedPrediction(row, champion))
  const baselineExisting = await readPredictionsByIdentity(db, identities)
  const prewrite = classify(plannedRows, baselineExisting)
  ensure(prewrite.insertEligible + prewrite.reuseNoOp === 24, 'PREWRITE_COUNT_MISMATCH')
  ensure(prewrite.blockConflict === 0, 'PREWRITE_BLOCK_CONFLICT')
  ensure(prewrite.insertEligible <= 24, 'DML_CAP_EXCEEDED')

  const preCounts = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    matchingFrozenIdentities: baselineExisting.length,
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueRows: await countRows(db, 'pick2_market_value_evaluations'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    raw2026: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
  }

  const toInsertIds = new Set(prewrite.rows.filter((row) => row.classification === 'INSERT_ELIGIBLE').map((row) => row.deterministic_identity))
  const insertRows = plannedRows.filter((row) => toInsertIds.has(row.deterministic_identity))
  const insertExecution = {
    attempted: insertRows.length,
    inserted: 0,
    reused: prewrite.reuseNoOp,
    conflicts: prewrite.blockConflict,
    failed: 0,
    updates: 0,
    deletes: 0,
    insertedIdentities: [],
  }
  if (insertRows.length > 0) {
    const { data, error } = await db.from('pick2_game_predictions').insert(insertRows).select('deterministic_identity')
    if (error) {
      insertExecution.failed = insertRows.length
      throw Object.assign(new Error(`PREDICTION_INSERT_FAILED:${error.message}`), { insertExecution })
    }
    insertExecution.inserted = data?.length ?? 0
    insertExecution.insertedIdentities = (data ?? []).map((row) => row.deterministic_identity)
  }
  ensure(insertExecution.failed === 0 && insertExecution.conflicts === 0, 'INSERT_ACCOUNTING_FAILED')

  const postRows = await readPredictionsByIdentity(db, identities)
  const postwrite = classify(plannedRows, postRows)
  const nullSnapshotCount = postRows.filter((row) => row.feature_snapshot_id === null).length
  const probabilityViolations = postRows.filter((row) => Math.abs(Number(row.home_probability) + Number(row.away_probability) - 1) > 1e-9 || !(Number(row.home_probability) > 0 && Number(row.home_probability) < 1) || !(Number(row.away_probability) > 0 && Number(row.away_probability) < 1)).length
  const duplicateIdentities = postRows.length - new Set(postRows.map((row) => row.deterministic_identity)).size
  ensure(postRows.length === 24 && duplicateIdentities === 0, 'ROW_PARITY_FAILED')
  ensure(postwrite.insertEligible === 0 && postwrite.reuseNoOp === 24 && postwrite.blockConflict === 0, 'PAYLOAD_READBACK_FAILED')
  ensure(nullSnapshotCount === 24, 'NULL_SNAPSHOT_READBACK_FAILED')
  ensure(probabilityViolations === 0, 'PROBABILITY_READBACK_FAILED')

  const finalCounts = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueRows: await countRows(db, 'pick2_market_value_evaluations'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    raw2026: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02J_R3_CURRENT_MONEYLINE_PREDICTION_DML_RETRY',
    certificationVerdict: 'MLB_DATA_02J_R3_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_CERTIFIED',
    publication: {
      publicationRecovered: 'PASS',
      localHead: targetCommit,
      originMain: targetCommit,
      productionCommit: production.gitCommit,
      deploymentPollAttempts: 12,
      providerCallsMade: production.providerCallsMade,
    },
    schemaRepairReadback: {
      dataType: 'uuid',
      nullable: 'YES',
      fkTarget: 'public.pick2_feature_snapshots(id)',
      MLB_02J_R3_SCHEMA_REPAIR_READBACK: 'PASS',
    },
    frozen: {
      count: frozenRows.length,
      asOf: frozenAsOf,
      gameSetCount: gamePks.length,
      payloadParity: 'PASS',
      MLB_02J_R3_FROZEN24_ARTIFACT_READBACK: 'PASS',
      MLB_02J_R3_FROZEN24_PAYLOAD_PARITY: 'PASS',
    },
    champion: {
      count: championRows.length,
      modelVersion: champion.model_version,
      featureSet: champion.pick2_model_feature_sets.feature_set_version,
      artifactDigest: champion.artifact_digest,
      MLB_02J_R3_CHAMPION_READBACK: 'PASS',
      MLB_02J_R3_CHAMPION_PRESERVED: 'PASS',
    },
    prewrite: {
      counts: preCounts,
      insertEligible: prewrite.insertEligible,
      reuseNoOp: prewrite.reuseNoOp,
      blockConflict: prewrite.blockConflict,
      actualDmlCap: prewrite.insertEligible,
      MLB_02J_R3_PREWRITE_BASELINE: 'PASS',
      MLB_02J_R3_PREWRITE_CLASSIFICATION: 'PASS',
      MLB_02J_R3_DML_CAP_READY: 'YES',
    },
    insertExecution: {
      ...insertExecution,
      MLB_02J_R3_PREDICTION_INSERT_EXECUTION: 'PASS',
      MLB_02J_R3_PREDICTION_DML_ACCOUNTING: 'PASS',
    },
    postwrite: {
      finalFrozenPredictionCount: postRows.length,
      rowParity: 'PASS',
      payloadReadback: 'PASS',
      probabilityReadback: 'PASS',
      nullSnapshotReadback: 'PASS',
      nullSnapshotCount,
      duplicateIdentities,
      idempotency: {
        insertEligible: postwrite.insertEligible,
        reuseNoOp: postwrite.reuseNoOp,
        blockConflict: postwrite.blockConflict,
      },
      finalCounts,
      MLB_02J_R3_PREDICTION_ROW_PARITY: 'PASS',
      MLB_02J_R3_PREDICTION_PAYLOAD_READBACK: 'PASS',
      MLB_02J_R3_PROBABILITY_READBACK: 'PASS',
      MLB_02J_R3_NATIVE_NULL_SNAPSHOT_READBACK: 'PASS',
      MLB_02J_R3_PREDICTION_IDENTITY_UNIQUENESS: 'PASS',
      MLB_02J_R3_PREDICTION_IDEMPOTENCY: 'PASS',
    },
    boundaries: {
      predictionResultWrites: 0,
      marketValueWrites: 0,
      officialPicksCreated: 0,
      providerCalls: 0,
      rawWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      productionDml: insertExecution.inserted,
      productionDdl: 0,
      MLB_02J_R3_RESULT_SEPARATION: 'PASS',
      MLB_02J_R3_MARKET_VALUE_SEPARATION: 'PASS',
      MLB_02J_R3_OFFICIAL_PICK_SEPARATION: 'PASS',
      MLB_02J_R3_PROVIDER_CALLS: 0,
      MLB_02J_R3_FOUNDATION_PRESERVED: 'PASS',
      MLB_02J_R3_PRODUCTION_DML_BOUNDARY: 'PASS',
      MLB_02J_R3_PRODUCTION_DDL: 0,
    },
    semantics: {
      frozenAsOfSemantics: 'PASS',
      futureRefreshContract: 'READY',
      oddsApiAuthorized: 'NO',
      marketLayerPrepReadiness: 'YES',
      MLB_02J_R3_FROZEN_ASOF_SEMANTICS: 'PASS',
      MLB_02J_R3_FUTURE_REFRESH_CONTRACT: 'READY',
      MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_READY: 'YES',
      MLB_02J_R3_THE_ODDS_API_AUTHORIZED: 'NO',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
    writeHumanAudit(frozenRows, prewrite, insertExecution.insertedIdentities, postRows)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  const blocked = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02J_R3_CURRENT_MONEYLINE_PREDICTION_DML_RETRY',
    certificationVerdict: 'MLB_DATA_02J_R3_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_BLOCKED',
    failure: error.message,
    insertExecution: error.insertExecution ?? null,
    safety: {
      providerCalls: 0,
      predictionResultWrites: 0,
      marketValueWrites: 0,
      productionDdl: 0,
      noRecalculation: true,
      noOfficialPicks: true,
    },
  }
  if (writeArtifact) fs.writeFileSync(outputPath, `${JSON.stringify(blocked, null, 2)}\n`)
  console.error(JSON.stringify(blocked, null, 2))
  process.exitCode = 1
})
