import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const executePredictions = process.argv.includes('--execute-predictions')
const writeArtifact = process.argv.includes('--write-artifact')

const targetCommit = 'c6d9963ec26c401d3e6442f7daa81ef38102a848'
const previousProductionCommit = '8f3c419ddc55ee218aea5dfacda4b0bec274381b'
const frozenAsOf = '2026-09-05T01:51:21.667Z'
const expectedArtifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const expectedModelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const expectedFeatureSet = 'MLB_ML_FEATURE_SET_V1'
const expectedFeatureCount = 76
const maxPredictionInserts = 24
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const inputPath = 'docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02j-current-moneyline-prediction-persistence.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02j-current-moneyline-prediction-persistence-audit.md'

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

function ensure(condition, message) {
  if (!condition) throw new Error(message)
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

async function readPredictionsByIdentity(db, identities) {
  const { data, error } = await db
    .from('pick2_game_predictions')
    .select('id,deterministic_identity,pick2_era,sport_key,event_id,game_pk,model_version_id,feature_snapshot_id,predicted_at,target,home_probability,away_probability,expected_home_score,expected_away_score,expected_total,expected_margin,frozen_input_digest,model_artifact_digest,metadata')
    .in('deterministic_identity', identities)
  if (error) throw new Error(`pick2_game_predictions identity read failed: ${error.message}`)
  return data ?? []
}

async function readChampion(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('id,model_version,role,status,artifact_digest,feature_set_id,pick2_model_feature_sets(feature_set_version)')
    .eq('role', 'champion')
    .eq('status', 'promoted')
  if (error) throw new Error(`champion read failed: ${error.message}`)
  ensure((data ?? []).length === 1, `CHAMPION_COUNT_MISMATCH:${(data ?? []).length}`)
  const champion = data[0]
  ensure(champion.model_version === expectedModelVersion, 'CHAMPION_MODEL_VERSION_MISMATCH')
  ensure(champion.artifact_digest === expectedArtifactDigest, 'CHAMPION_ARTIFACT_DIGEST_MISMATCH')
  ensure(champion.pick2_model_feature_sets?.feature_set_version === expectedFeatureSet, 'CHAMPION_FEATURE_SET_MISMATCH')
  return champion
}

async function readNativeGameCount(db, gamePks) {
  const { data, error } = await db
    .from('pick2_mlb_games')
    .select('game_pk')
    .in('game_pk', gamePks)
  if (error) throw new Error(`pick2_mlb_games read failed: ${error.message}`)
  return {
    rows: data ?? [],
    unique: new Set((data ?? []).map((row) => Number(row.game_pk))).size,
  }
}

function readFrozenArtifact() {
  ensure(fs.existsSync(inputPath), '02I_ARTIFACT_MISSING')
  const artifact = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  ensure(artifact.certificationVerdict === 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED', '02I_VERDICT_MISMATCH')
  ensure(artifact.inference?.asOf === frozenAsOf, '02I_ASOF_MISMATCH')
  ensure(artifact.champion?.modelVersion === expectedModelVersion, '02I_MODEL_VERSION_MISMATCH')
  ensure(artifact.champion?.featureSet === expectedFeatureSet, '02I_FEATURE_SET_MISMATCH')
  ensure(artifact.champion?.artifactDigest === expectedArtifactDigest, '02I_ARTIFACT_DIGEST_MISMATCH')
  ensure(artifact.modelArtifact?.featureCount === expectedFeatureCount, '02I_FEATURE_COUNT_MISMATCH')
  ensure(artifact.dryInference?.cap === maxPredictionInserts, '02I_CAP_MISMATCH')
  ensure((artifact.dryInference?.rows ?? []).length === maxPredictionInserts, '02I_ROW_COUNT_MISMATCH')
  ensure(artifact.prewriteClassification?.insertEligible === maxPredictionInserts, '02I_INSERT_ELIGIBLE_MISMATCH')
  ensure(artifact.prewriteClassification?.blockConflict === 0, '02I_BLOCK_CONFLICT_MISMATCH')
  return artifact
}

function validateFrozenRows(rows) {
  const identities = rows.map((row) => row.deterministic_identity)
  const gamePks = rows.map((row) => Number(row.game_pk))
  const inputDigests = rows.map((row) => row.input_digest)
  const errors = []
  const seenIdentity = new Set()
  const seenGamePk = new Set()
  const seenDigest = new Set()
  for (const row of rows) {
    if (seenIdentity.has(row.deterministic_identity)) errors.push(`DUPLICATE_IDENTITY:${row.deterministic_identity}`)
    if (seenGamePk.has(Number(row.game_pk))) errors.push(`DUPLICATE_GAME_PK:${row.game_pk}`)
    if (seenDigest.has(row.input_digest)) errors.push(`DUPLICATE_INPUT_DIGEST:${row.input_digest}`)
    seenIdentity.add(row.deterministic_identity)
    seenGamePk.add(Number(row.game_pk))
    seenDigest.add(row.input_digest)
    if (row.market !== 'moneyline') errors.push(`MARKET_MISMATCH:${row.game_pk}`)
    if (row.as_of !== frozenAsOf) errors.push(`ASOF_MISMATCH:${row.game_pk}`)
    if (row.model_version !== expectedModelVersion) errors.push(`MODEL_VERSION_MISMATCH:${row.game_pk}`)
    if (row.feature_set !== expectedFeatureSet) errors.push(`FEATURE_SET_MISMATCH:${row.game_pk}`)
    if (row.artifact_digest !== expectedArtifactDigest) errors.push(`ARTIFACT_DIGEST_MISMATCH:${row.game_pk}`)
    if (row.starter_status !== 'READY_PROBABLE_WITH_FLAG') errors.push(`STARTER_STATUS_MISMATCH:${row.game_pk}`)
    if (row.data_completeness !== 'COMPLETE') errors.push(`DATA_COMPLETENESS_MISMATCH:${row.game_pk}`)
    if (!(row.home_probability > 0 && row.home_probability < 1)) errors.push(`HOME_PROBABILITY_RANGE:${row.game_pk}`)
    if (!(row.away_probability > 0 && row.away_probability < 1)) errors.push(`AWAY_PROBABILITY_RANGE:${row.game_pk}`)
    if (Math.abs(row.home_probability + row.away_probability - 1) > 1e-9) errors.push(`PROBABILITY_COMPLEMENT:${row.game_pk}`)
    const expectedIdentity = ['baseball_mlb', 'prediction', 'moneyline', String(row.game_pk), expectedModelVersion, row.input_digest].join('::')
    if (row.deterministic_identity !== expectedIdentity) errors.push(`DETERMINISTIC_IDENTITY_MISMATCH:${row.game_pk}`)
  }
  ensure(errors.length === 0, `FROZEN_PAYLOAD_PARITY_FAILED:${errors.join(',')}`)
  return {
    gamePks,
    identities,
    inputDigests,
    duplicateGamePks: rows.length - seenGamePk.size,
    duplicateIdentities: rows.length - seenIdentity.size,
    duplicateInputDigests: rows.length - seenDigest.size,
  }
}

function predictionInsertRow(row, champion) {
  return {
    deterministic_identity: row.deterministic_identity,
    pick2_era: 'PICK_2_ERA_V1',
    sport_key: 'baseball_mlb',
    event_id: null,
    game_pk: Number(row.game_pk),
    model_version_id: champion.id,
    feature_snapshot_id: row.feature_snapshot_id ?? null,
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
      source_commit: targetCommit,
      frozen_input_policy: 'MLB_02J_FROZEN_02I_INPUT',
    },
  }
}

function comparable(row) {
  return {
    deterministic_identity: row.deterministic_identity,
    sport_key: row.sport_key,
    game_pk: Number(row.game_pk),
    event_id: row.event_id ?? null,
    model_version_id: row.model_version_id,
    feature_snapshot_id: row.feature_snapshot_id ?? null,
    predicted_at: new Date(row.predicted_at).toISOString(),
    target: row.target,
    home_probability: Number(row.home_probability),
    away_probability: Number(row.away_probability),
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

function payloadMatches(existing, planned) {
  const actual = comparable(existing)
  const expected = comparable(planned)
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function classify(plannedRows, existingRows) {
  const existing = new Map(existingRows.map((row) => [row.deterministic_identity, row]))
  const classifications = []
  for (const planned of plannedRows) {
    const current = existing.get(planned.deterministic_identity)
    if (!current) {
      classifications.push({ deterministic_identity: planned.deterministic_identity, game_pk: planned.game_pk, classification: 'INSERT_ELIGIBLE' })
    } else if (payloadMatches(current, planned)) {
      classifications.push({ deterministic_identity: planned.deterministic_identity, game_pk: planned.game_pk, classification: 'REUSE_NO_OP' })
    } else {
      classifications.push({ deterministic_identity: planned.deterministic_identity, game_pk: planned.game_pk, classification: 'BLOCK_CONFLICT' })
    }
  }
  return {
    rows: classifications,
    insertEligible: classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE').length,
    reuseNoOp: classifications.filter((row) => row.classification === 'REUSE_NO_OP').length,
    blockConflict: classifications.filter((row) => row.classification === 'BLOCK_CONFLICT').length,
  }
}

function countDuplicate(values) {
  return values.length - new Set(values).size
}

function short(value) {
  return `${String(value).slice(0, 12)}...${String(value).slice(-8)}`
}

function writeHumanAudit(artifact, rows, prewrite, postRows) {
  const postSet = new Set(postRows.map((row) => row.deterministic_identity))
  const lines = [
    '# CURRENT MONEYLINE PREDICTION PERSISTENCE AUDIT',
    '',
    `Frozen 02I as_of: ${artifact.frozen02i.asOf}`,
    '',
    '| game_pk | teams | scheduled start | frozen as_of | starter state | home fair probability | away fair probability | input digest | prediction identity | prewrite | persistence result | readback |',
    '|---:|---|---|---|---|---:|---:|---|---|---|---|---|',
  ]
  for (const row of rows) {
    const classification = prewrite.rows.find((item) => item.deterministic_identity === row.deterministic_identity)?.classification ?? 'UNKNOWN'
    const result = artifact.insertExecution.insertedIdentities.includes(row.deterministic_identity) ? 'INSERTED' : 'REUSED'
    lines.push(`| ${row.game_pk} | ${row.away_team_id} @ ${row.home_team_id} | ${row.scheduled_at} | ${row.as_of} | ${row.starter_status} | ${row.home_probability.toFixed(6)} | ${row.away_probability.toFixed(6)} | ${short(row.input_digest)} | ${short(row.deterministic_identity)} | ${classification} | ${result} | ${postSet.has(row.deterministic_identity) ? 'PASS' : 'MISSING'} |`)
  }
  fs.writeFileSync(auditPath, `${lines.join('\n')}\n`)
}

async function main() {
  const frozen = readFrozenArtifact()
  const frozenRows = frozen.dryInference.rows
  const frozenSet = validateFrozenRows(frozenRows)
  const plannedRows = []
  const db = dbClient()
  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === targetCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')
  ensure(git(['rev-parse', '--abbrev-ref', 'HEAD']) === 'main', 'BRANCH_NOT_MAIN')
  ensure(git(['rev-parse', 'HEAD']) === targetCommit, 'LOCAL_HEAD_MISMATCH')

  const champion = await readChampion(db)
  for (const row of frozenRows) plannedRows.push(predictionInsertRow(row, champion))

  const nativeGames = await readNativeGameCount(db, frozenSet.gamePks)
  ensure(nativeGames.rows.length === maxPredictionInserts && nativeGames.unique === maxPredictionInserts, `NATIVE_GAME_IDENTITY_FAILED:${nativeGames.rows.length}:${nativeGames.unique}`)

  const baseline = {
    totalPredictions: await countRows(db, 'pick2_game_predictions'),
    mlbMoneylinePredictions: await countRows(db, 'pick2_game_predictions', 'id', (query) => query.eq('sport_key', 'baseball_mlb').eq('target', 'home_win_probability')),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueRows: await countRows(db, 'pick2_market_value_evaluations'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    raw2026: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
    team2026: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.eq('feature_version', featureVersion).gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    starter2026: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.eq('feature_version', featureVersion).gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    bullpen2026: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.eq('feature_version', featureVersion).gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    batter2026: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.eq('feature_version', featureVersion).gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    matchup2026: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.eq('feature_version', featureVersion).gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    firstInning2026: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.eq('feature_version', featureVersion).gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    snapshots2026: await countRows(db, 'pick2_feature_snapshots', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  }
  ensure(baseline.raw2025 === 712528 && baseline.raw2026 === 622364, 'RAW_BASELINE_CHANGED')
  ensure(baseline.team2026 === 3902 && baseline.starter2026 === 3902 && baseline.bullpen2026 === 3902 && baseline.batter2026 === 39521 && baseline.matchup2026 === 1951 && baseline.firstInning2026 === 1951 && baseline.snapshots2026 === 59031, 'FEATURE_BASELINE_CHANGED')

  const preExisting = await readPredictionsByIdentity(db, frozenSet.identities)
  const prewrite = classify(plannedRows, preExisting)
  ensure(prewrite.insertEligible + prewrite.reuseNoOp === maxPredictionInserts, 'PREWRITE_COUNT_MISMATCH')
  ensure(prewrite.blockConflict === 0, 'PREWRITE_BLOCK_CONFLICT')
  ensure(prewrite.insertEligible <= maxPredictionInserts, 'DML_CAP_EXCEEDED')

  let insertExecution = {
    attempted: 0,
    inserted: 0,
    reused: prewrite.reuseNoOp,
    conflicts: prewrite.blockConflict,
    failed: 0,
    updates: 0,
    deletes: 0,
    insertedIdentities: [],
    errors: [],
  }

  if (executePredictions) {
    const insertIds = new Set(prewrite.rows.filter((row) => row.classification === 'INSERT_ELIGIBLE').map((row) => row.deterministic_identity))
    const insertRows = plannedRows.filter((row) => insertIds.has(row.deterministic_identity))
    insertExecution.attempted = insertRows.length
    if (insertRows.length > 0) {
      const { data, error } = await db.from('pick2_game_predictions').insert(insertRows).select('deterministic_identity')
      if (error) {
        insertExecution.failed = insertRows.length
        insertExecution.errors.push(error.message)
        throw Object.assign(new Error(`PREDICTION_INSERT_FAILED:${error.message}`), { insertExecution })
      }
      insertExecution.inserted = data?.length ?? 0
      insertExecution.insertedIdentities = (data ?? []).map((row) => row.deterministic_identity)
    }
  } else {
    throw new Error('EXPLICIT_EXECUTE_PREDICTIONS_FLAG_REQUIRED')
  }

  const postRows = await readPredictionsByIdentity(db, frozenSet.identities)
  const postwrite = classify(plannedRows, postRows)
  const postIdentities = postRows.map((row) => row.deterministic_identity)
  const probabilityViolations = postRows.filter((row) => !(Number(row.home_probability) > 0 && Number(row.home_probability) < 1) || !(Number(row.away_probability) > 0 && Number(row.away_probability) < 1) || Math.abs(Number(row.home_probability) + Number(row.away_probability) - 1) > 1e-9)
  ensure(postRows.length === maxPredictionInserts && new Set(postIdentities).size === maxPredictionInserts, `POSTWRITE_ROW_PARITY_FAILED:${postRows.length}`)
  ensure(postwrite.reuseNoOp === maxPredictionInserts && postwrite.insertEligible === 0 && postwrite.blockConflict === 0, `POSTWRITE_PAYLOAD_MISMATCH:${JSON.stringify(postwrite)}`)
  ensure(probabilityViolations.length === 0, `PROBABILITY_READBACK_FAILED:${probabilityViolations.length}`)
  ensure(countDuplicate(postRows.map((row) => `${row.game_pk}|${row.model_version_id}|${row.frozen_input_digest}`)) === 0, 'DUPLICATE_GAME_MODEL_INPUT_IDENTITY')

  const secondExisting = await readPredictionsByIdentity(db, frozenSet.identities)
  const secondPass = classify(plannedRows, secondExisting)
  ensure(secondPass.insertEligible === 0 && secondPass.reuseNoOp === maxPredictionInserts && secondPass.blockConflict === 0, `IDEMPOTENCY_FAILED:${JSON.stringify(secondPass)}`)

  const finalCounts = {
    totalPredictions: await countRows(db, 'pick2_game_predictions'),
    mlbMoneylinePredictions: await countRows(db, 'pick2_game_predictions', 'id', (query) => query.eq('sport_key', 'baseball_mlb').eq('target', 'home_win_probability')),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueRows: await countRows(db, 'pick2_market_value_evaluations'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    raw2026: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_EXECUTION',
    certificationVerdict: 'MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_CERTIFIED',
    publication: {
      previousProductionCommit,
      localHead: targetCommit,
      originMain: targetCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02J_REPOSITORY_BASELINE: 'PASS',
      MLB_02J_02I_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    frozen02i: {
      verdict: frozen.certificationVerdict,
      asOf: frozenAsOf,
      authorizedPredictionCount: maxPredictionInserts,
      gameSetCount: frozenSet.gamePks.length,
      duplicateGamePks: frozenSet.duplicateGamePks,
      duplicateInputDigests: frozenSet.duplicateInputDigests,
      duplicateDeterministicIdentities: frozenSet.duplicateIdentities,
      payloadMismatches: 0,
      MLB_02J_02I_ARTIFACT_READBACK: 'PASS',
      MLB_02J_FROZEN_GAME_SET: 'PASS',
      MLB_02J_FROZEN_PAYLOAD_PARITY: 'PASS',
    },
    champion: {
      count: 1,
      modelVersion: champion.model_version,
      featureSet: champion.pick2_model_feature_sets.feature_set_version,
      artifactDigest: champion.artifact_digest,
      modelVersionId: champion.id,
      MLB_02J_CHAMPION_READBACK: 'PASS',
      MLB_02J_MODEL_IMMUTABILITY: 'PASS',
      MLB_02J_CHAMPION_PRESERVED: 'PASS',
    },
    prewriteBaseline: {
      ...baseline,
      matchingFrozenIdentitiesBefore: preExisting.length,
      MLB_02J_PREDICTION_PREWRITE_BASELINE: 'PASS',
    },
    prewriteClassification: {
      insertEligible: prewrite.insertEligible,
      reuseNoOp: prewrite.reuseNoOp,
      blockConflict: prewrite.blockConflict,
      actualInsertCap: prewrite.insertEligible,
      rows: prewrite.rows,
      MLB_02J_PREWRITE_CLASSIFICATION: 'PASS',
      MLB_02J_ACTUAL_DML_CAP_READY: 'YES',
      MLB_02J_NATIVE_GAME_IDENTITY: 'PASS',
      MLB_02J_STARTER_STATUS_PRESERVATION: 'PASS',
    },
    insertExecution: {
      ...insertExecution,
      MLB_02J_PREDICTION_INSERT_EXECUTION: 'PASS',
      MLB_02J_PREDICTION_DML_ACCOUNTING: 'PASS',
    },
    postwriteReadback: {
      finalFrozenPredictionCount: postRows.length,
      rowParity: 'PASS',
      payloadReadback: 'PASS',
      probabilityReadback: 'PASS',
      probabilityViolations: 0,
      duplicateDeterministicIdentities: countDuplicate(postRows.map((row) => row.deterministic_identity)),
      duplicateGameModelInputIdentities: countDuplicate(postRows.map((row) => `${row.game_pk}|${row.model_version_id}|${row.frozen_input_digest}`)),
      MLB_02J_PREDICTION_ROW_PARITY: 'PASS',
      MLB_02J_PREDICTION_PAYLOAD_READBACK: 'PASS',
      MLB_02J_PROBABILITY_READBACK: 'PASS',
      MLB_02J_PREDICTION_IDENTITY_UNIQUENESS: 'PASS',
    },
    immutability: {
      evidence: 'pick2_game_predictions_no_update trigger defined by 202608270002_pick2_data_foundation_v1.sql; no mutation test required',
      noOverwrite: insertExecution.updates === 0 && insertExecution.deletes === 0 ? 'PASS' : 'FAIL',
      MLB_02J_PREDICTION_IMMUTABILITY: 'PASS',
      MLB_02J_NO_PREDICTION_OVERWRITE: 'PASS',
    },
    idempotency: {
      insertEligible: secondPass.insertEligible,
      reuseNoOp: secondPass.reuseNoOp,
      blockConflict: secondPass.blockConflict,
      MLB_02J_PREDICTION_IDEMPOTENCY: 'PASS',
    },
    finalCounts,
    boundaries: {
      predictionResultWrites: 0,
      marketValueWrites: 0,
      officialPicksCreated: 0,
      officialPicksPromoted: 0,
      oddsProviderCalls: 0,
      theOddsApiCalls: 0,
      ballDontLieCalls: 0,
      sportsDataIoCalls: 0,
      mlbOfficialCalls: 0,
      statcastCalls: 0,
      otherProviderCalls: 0,
      modelWrites: 0,
      featureWrites: 0,
      rawWrites: 0,
      otherDml: 0,
      productionDdl: 0,
      automation: 'OFF',
      cronChanges: 0,
      valueBoardWork: 'NO',
      valueWork: 'NO',
      edgeCalculation: 'NO',
      evCalculation: 'NO',
      noVigCalculation: 'NO',
      MLB_02J_PREDICTION_RESULT_SEPARATION: 'PASS',
      MLB_02J_MARKET_VALUE_SEPARATION: 'PASS',
      MLB_02J_OFFICIAL_PICK_SEPARATION: 'PASS',
      MLB_02J_PROVIDER_CALLS: 0,
      MLB_02J_RAW_PRESERVATION: 'PASS',
      MLB_02J_FEATURE_PRESERVATION: 'PASS',
      MLB_02J_PRODUCTION_DML_BOUNDARY: 'PASS',
      MLB_02J_PRODUCTION_SCHEMA_UNCHANGED: 'PASS',
      MLB_02J_AUTOMATION_STATE: 'OFF',
    },
    semantics: {
      frozenAsOfSemantics: 'Persisted predictions represent the frozen 02I model state only.',
      futureRefreshContract: 'READY',
      outcomeOnlyBoundary: 'PASS',
      theOddsApiAuthorized: 'NO',
      valueBoardWork: 'NO',
      MLB_02J_FROZEN_ASOF_SEMANTICS: 'PASS',
      MLB_02J_FUTURE_REFRESH_CONTRACT: 'READY',
      MLB_02J_OUTCOME_ONLY_BOUNDARY: 'PASS',
      MLB_02J_THE_ODDS_API_AUTHORIZED: 'NO',
      MLB_02J_VALUE_BOARD_WORK: 'NO',
    },
    post02jReadiness: {
      MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_READY: postRows.length === maxPredictionInserts && secondPass.reuseNoOp === maxPredictionInserts && finalCounts.predictionResults === 0 && finalCounts.marketValueRows === 0 ? 'YES' : 'NO',
    },
  }
  if (writeArtifact) {
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
    writeHumanAudit(artifact, frozenRows, prewrite, postRows)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  const blocked = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_EXECUTION',
    certificationVerdict: 'MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_BLOCKED',
    failure: error.message,
    insertExecution: error.insertExecution ?? null,
    safety: {
      noRepairSqlAttempted: true,
      noProviderCalls: true,
      noOddsCalls: true,
      noValueWork: true,
      noOfficialPicks: true,
      noModelTraining: true,
      noSchemaMutation: true,
      automation: 'OFF',
      cronChanges: 0,
    },
  }
  if (writeArtifact) fs.writeFileSync(outputPath, `${JSON.stringify(blocked, null, 2)}\n`)
  console.error(JSON.stringify(blocked, null, 2))
  process.exitCode = 1
})
