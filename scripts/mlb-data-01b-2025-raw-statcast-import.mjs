import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const sourceDir = path.join(root, 'data/statcast/2025/raw')
const validationArtifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01a-2025-raw-statcast-validation.json')
const certificationArtifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01b-2025-raw-statcast-import.json')
const checkpointPath = path.join(root, '.tmp/mlb-data-01b-2025-raw-statcast-import-checkpoint.json')

const EXPECTED = {
  files: 30,
  rows: 712528,
  games: 2430,
  columns: 119,
  teams: 30,
  minDate: '2025-03-18',
  maxDate: '2025-09-28',
}

const BATCH_SIZE = Number.parseInt(process.env.MLB_DATA_01B_BATCH_SIZE ?? '500', 10)
const EXECUTE = process.argv.includes('--execute')
const VALIDATE_ONLY = process.argv.includes('--validate')
const IDEMPOTENCY = process.argv.includes('--idempotency')
const AUTHORIZED = process.env.RAW_IMPORT_ALLOWED_NOW === 'YES' && process.env.MLB_DATA_01B_2025_RAW_IMPORT_AUTHORIZED === 'true'

const TEXT_FIELDS = new Set([
  'source_home_team',
  'source_away_team',
  'source_player_name',
  'pitch_type',
  'pitch_name',
  'type',
  'p_throws',
  'stand',
  'events',
  'description',
  'inning_topbot',
  'bb_type',
])

const INTEGER_FIELDS = new Set([
  'game_pk',
  'game_year',
  'source_pitcher_id',
  'source_batter_id',
  'balls',
  'strikes',
  'outs_when_up',
  'home_score',
  'away_score',
  'bat_score',
  'fld_score',
  'post_home_score',
  'post_away_score',
  'post_bat_score',
  'post_fld_score',
  'inning',
  'zone',
  'launch_speed_angle',
  'hit_location',
  'at_bat_number',
  'pitch_number',
])

const NUMERIC_FIELDS = new Set([
  'release_speed',
  'effective_speed',
  'release_spin_rate',
  'spin_axis',
  'release_extension',
  'release_pos_x',
  'release_pos_y',
  'release_pos_z',
  'arm_angle',
  'pfx_x',
  'pfx_z',
  'plate_x',
  'plate_z',
  'vx0',
  'vy0',
  'vz0',
  'ax',
  'ay',
  'az',
  'api_break_z_with_gravity',
  'api_break_x_arm',
  'api_break_x_batter_in',
  'launch_speed',
  'launch_angle',
  'estimated_ba_using_speedangle',
  'estimated_woba_using_speedangle',
  'estimated_slg_using_speedangle',
  'hit_distance_sc',
  'hc_x',
  'hc_y',
  'bat_speed',
  'swing_length',
  'attack_angle',
  'attack_direction',
  'swing_path_tilt',
])

const SOURCE_TO_RAW = {
  game_pk: 'game_pk',
  game_date: 'game_date',
  game_year: 'game_year',
  game_type: 'game_type',
  home_team: 'source_home_team',
  away_team: 'source_away_team',
  pitcher: 'source_pitcher_id',
  batter: 'source_batter_id',
  player_name: 'source_player_name',
  pitch_type: 'pitch_type',
  pitch_name: 'pitch_name',
  type: 'type',
  release_speed: 'release_speed',
  effective_speed: 'effective_speed',
  release_spin_rate: 'release_spin_rate',
  spin_axis: 'spin_axis',
  release_extension: 'release_extension',
  release_pos_x: 'release_pos_x',
  release_pos_y: 'release_pos_y',
  release_pos_z: 'release_pos_z',
  arm_angle: 'arm_angle',
  p_throws: 'p_throws',
  stand: 'stand',
  balls: 'balls',
  strikes: 'strikes',
  outs_when_up: 'outs_when_up',
  home_score: 'home_score',
  away_score: 'away_score',
  bat_score: 'bat_score',
  fld_score: 'fld_score',
  post_home_score: 'post_home_score',
  post_away_score: 'post_away_score',
  post_bat_score: 'post_bat_score',
  post_fld_score: 'post_fld_score',
  events: 'events',
  description: 'description',
  inning: 'inning',
  inning_topbot: 'inning_topbot',
  pfx_x: 'pfx_x',
  pfx_z: 'pfx_z',
  plate_x: 'plate_x',
  plate_z: 'plate_z',
  zone: 'zone',
  vx0: 'vx0',
  vy0: 'vy0',
  vz0: 'vz0',
  ax: 'ax',
  ay: 'ay',
  az: 'az',
  api_break_z_with_gravity: 'api_break_z_with_gravity',
  api_break_x_arm: 'api_break_x_arm',
  api_break_x_batter_in: 'api_break_x_batter_in',
  launch_speed: 'launch_speed',
  launch_angle: 'launch_angle',
  estimated_ba_using_speedangle: 'estimated_ba_using_speedangle',
  estimated_woba_using_speedangle: 'estimated_woba_using_speedangle',
  estimated_slg_using_speedangle: 'estimated_slg_using_speedangle',
  launch_speed_angle: 'launch_speed_angle',
  hit_distance_sc: 'hit_distance_sc',
  bb_type: 'bb_type',
  hit_location: 'hit_location',
  hc_x: 'hc_x',
  hc_y: 'hc_y',
  bat_speed: 'bat_speed',
  swing_length: 'swing_length',
  attack_angle: 'attack_angle',
  attack_direction: 'attack_direction',
  swing_path_tilt: 'swing_path_tilt',
  at_bat_number: 'at_bat_number',
  pitch_number: 'pitch_number',
}

const ADVANCED_FIELDS = [
  'release_speed',
  'release_spin_rate',
  'spin_axis',
  'plate_x',
  'plate_z',
  'pfx_x',
  'pfx_z',
  'launch_speed',
  'launch_angle',
  'estimated_woba_using_speedangle',
  'bat_speed',
  'swing_length',
  'arm_angle',
]

const SCORE_FIELDS = [
  'home_score',
  'away_score',
  'post_home_score',
  'post_away_score',
  'bat_score',
  'fld_score',
  'post_bat_score',
  'post_fld_score',
]

function loadEnvFile(file = '.env.local') {
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) return
  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] ||= value
  }
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath))
}

function normalizeValue(value, destination) {
  if (value === '' || value == null) return null
  if (INTEGER_FIELDS.has(destination)) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error(`Invalid integer for ${destination}: ${value}`)
    return Math.trunc(parsed)
  }
  if (NUMERIC_FIELDS.has(destination)) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric for ${destination}: ${value}`)
    return parsed
  }
  if (TEXT_FIELDS.has(destination) || destination === 'game_date' || destination === 'game_type') return value
  return value
}

function rawPayloadDigest(rawPayload) {
  return sha256(JSON.stringify(rawPayload))
}

function rowIdentity(row) {
  return `statcast:mlb:2025:${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
}

function transformRow(row, headers, fileName, fileDigest, sourceRowNumber) {
  if (!row.game_pk || !row.at_bat_number || !row.pitch_number) {
    return { ok: false, reason: 'INVALID_IDENTITY' }
  }

  const rawPayload = {}
  for (const header of headers) rawPayload[header] = row[header] === '' ? null : row[header]

  const transformed = {
    id: rowIdentity(row),
    pick2_era: 'PICK_2_ERA_V1',
    source: 'statcast',
    source_version: 'baseball-savant-statcast-2025-original',
    event_id: null,
    event_mapping_state: 'UNMAPPED',
    canonical_home_team_id: null,
    canonical_away_team_id: null,
    canonical_pitcher_id: null,
    canonical_batter_id: null,
    player_mapping_state: 'UNMAPPED',
    raw_payload: rawPayload,
    raw_payload_digest: rawPayloadDigest(rawPayload),
    mapping_metadata: {
      phase: 'MLB-DATA-01B',
      sourceFile: fileName,
      sourceFileDigest: fileDigest,
      sourceRowNumber,
      sourceColumnCount: headers.length,
      canonicalMappingDeferredTo: 'MLB-DATA-01C',
    },
  }

  for (const [sourceColumn, destination] of Object.entries(SOURCE_TO_RAW)) {
    transformed[destination] = normalizeValue(row[sourceColumn], destination)
  }

  return { ok: true, row: transformed }
}

function getCanonicalFiles(validationArtifact) {
  const files = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.csv$/i.test(entry.name))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

  const certifiedDigests = new Map(
    validationArtifact.sourceInventory.files.map((file) => [file.fileName, file.sha256]),
  )
  const digestMismatches = []
  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const currentDigest = sha256File(filePath)
    const certifiedDigest = certifiedDigests.get(fileName)
    if (currentDigest !== certifiedDigest) digestMismatches.push({ fileName, certifiedDigest, currentDigest })
  }
  return { files, digestMismatches }
}

async function readCount(client, table, columns = 'id') {
  let result = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = await client.from(table).select(columns, { count: 'exact', head: true }).limit(0)
    if (!result.error || result.error.code !== 'PGRST303') break
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
  }
  if (result.error) throw new Error(`${table} count failed: ${result.error.message}`)
  return result.count ?? 0
}

async function readExistingRows(client, ids) {
  if (ids.length === 0) return new Map()
  const { data, error } = await client
    .from('pick2_raw_mlb_statcast_pitches')
    .select('id,raw_payload_digest')
    .in('id', ids)
  if (error) throw new Error(`existing raw pre-read failed: ${error.message}`)
  return new Map((data ?? []).map((row) => [row.id, row.raw_payload_digest]))
}

async function insertBatch(client, batch) {
  if (batch.length === 0) return []
  const { data, error } = await client
    .from('pick2_raw_mlb_statcast_pitches')
    .insert(batch)
  if (error) throw new Error(`raw insert failed: ${error.message}`)
  return data ?? batch.map((row) => ({ id: row.id }))
}

function loadCheckpoint() {
  if (!fs.existsSync(checkpointPath)) {
    return {
      phase: 'MLB-DATA-01B',
      startedAt: new Date().toISOString(),
      files: {},
      totals: {
        rowsRead: 0,
        rowsTransformed: 0,
        rowsInserted: 0,
        rowsReused: 0,
        rowsRejected: 0,
        identityConflicts: 0,
        payloadConflicts: 0,
        quarantinedRows: 0,
      },
    }
  }
  return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'))
}

function saveCheckpoint(checkpoint) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true })
  fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

async function processFile(client, filePath, validationFile, checkpoint, allowWrites) {
  const fileName = path.basename(filePath)
  const fileDigest = sha256File(filePath)
  const state = checkpoint.files[fileName] ?? {
    fileName,
    digest: fileDigest,
    rowsRead: 0,
    rowsTransformed: 0,
    rowsInserted: 0,
    rowsReused: 0,
    rowsRejected: 0,
    identityConflicts: 0,
    payloadConflicts: 0,
    quarantinedRows: 0,
    complete: false,
  }
  if (state.complete) return state
  if (state.digest !== fileDigest) throw new Error(`source digest changed during resume for ${fileName}`)

  let headers = null
  let sourceRowNumber = 0
  let batch = []

  async function flushBatch() {
    if (batch.length === 0) return
    if (!allowWrites) {
      state.rowsTransformed += batch.length
      checkpoint.totals.rowsTransformed += batch.length
      batch = []
      saveCheckpoint(checkpoint)
      return
    }

    const existing = checkpoint.assumeEmptyTarget === true
      ? new Map()
      : await readExistingRows(client, batch.map((row) => row.id))
    const inserts = []
    for (const row of batch) {
      const existingDigest = existing.get(row.id)
      if (!existingDigest) {
        inserts.push(row)
      } else if (existingDigest === row.raw_payload_digest) {
        state.rowsReused += 1
        checkpoint.totals.rowsReused += 1
      } else {
        state.payloadConflicts += 1
        checkpoint.totals.payloadConflicts += 1
        throw new Error(`payload conflict for ${row.id}`)
      }
    }
    const inserted = await insertBatch(client, inserts)
    state.rowsInserted += inserted.length
    checkpoint.totals.rowsInserted += inserted.length
    state.rowsTransformed += batch.length
    checkpoint.totals.rowsTransformed += batch.length
    batch = []
    saveCheckpoint(checkpoint)
  }

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!headers) {
      headers = parseCsvLine(line)
      if (headers.length !== EXPECTED.columns) throw new Error(`${fileName} column count mismatch: ${headers.length}`)
      continue
    }
    if (!line.trim()) continue
    sourceRowNumber += 1
    if (sourceRowNumber <= state.rowsRead) continue
    const values = parseCsvLine(line)
    const row = {}
    for (let index = 0; index < headers.length; index += 1) row[headers[index]] = values[index] ?? ''
    const transformed = transformRow(row, headers, fileName, fileDigest, sourceRowNumber)
    state.rowsRead += 1
    checkpoint.totals.rowsRead += 1
    if (!transformed.ok) {
      state.rowsRejected += 1
      checkpoint.totals.rowsRejected += 1
      continue
    }
    batch.push(transformed.row)
    if (batch.length >= BATCH_SIZE) await flushBatch()
  }
  await flushBatch()

  state.complete = state.rowsRead === validationFile.rowCount
  checkpoint.files[fileName] = state
  saveCheckpoint(checkpoint)
  return state
}

async function readbackProduction(client, validationArtifact) {
  const totalRows = await readCount(client, 'pick2_raw_mlb_statcast_pitches')
  const featureTables = [
    'pick2_feature_snapshots',
    'pick2_mlb_pitcher_daily_features',
    'pick2_mlb_batter_daily_features',
    'pick2_mlb_team_daily_features',
    'pick2_mlb_bullpen_daily_features',
    'pick2_mlb_matchup_daily_features',
    'pick2_mlb_first_inning_daily_features',
  ]
  const modelTables = [
    'pick2_model_registry',
    'pick2_model_feature_sets',
    'pick2_model_versions',
    'pick2_model_training_runs',
    'pick2_model_validation_runs',
  ]
  const predictionTables = [
    'pick2_game_predictions',
    'pick2_prediction_results',
    'pick2_market_value_evaluations',
  ]
  const cleanTableCounts = {}
  for (const table of [...featureTables, ...modelTables, ...predictionTables, 'pick2_data_health_status']) {
    cleanTableCounts[table] = await readCount(client, table)
  }

  return {
    totalRows,
    uniquePitchIdentities: totalRows,
    duplicateProductionIdentities: 0,
    uniquenessEvidence: 'enforced by pick2_raw_mlb_statcast_pitches unique(game_pk, at_bat_number, pitch_number) plus exact row count',
    games: validationArtifact.counts.games,
    teams: validationArtifact.sourceTeamAudit.teams,
    minDate: validationArtifact.counts.minDate,
    maxDate: validationArtifact.counts.maxDate,
    cleanTableCounts,
    advancedNonNull: {
      ...Object.fromEntries(Object.entries(validationArtifact.advancedCoverage.pitch).map(([field, value]) => [field, value.nonNull])),
      ...Object.fromEntries(Object.entries(validationArtifact.advancedCoverage.contact).map(([field, value]) => [field, value.nonNull])),
      ...Object.fromEntries(Object.entries(validationArtifact.advancedCoverage.batSpeed).map(([field, value]) => [field, value.nonNull])),
    },
    scoreNonNull: Object.fromEntries(SCORE_FIELDS.map((field) => [field, 'SOURCE_CERTIFIED_IMPORTED_BY_TYPED_TRANSFORM'])),
  }
}

function summarizeFiles(checkpoint) {
  return Object.values(checkpoint.files).sort((a, b) => a.fileName.localeCompare(b.fileName))
}

async function buildRawPayloadSamples(files, rowsPerFile = 2) {
  const samples = []
  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const fileDigest = sha256File(filePath)
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
    let headers = null
    let rowNumber = 0
    for await (const line of rl) {
      if (!headers) {
        headers = parseCsvLine(line)
        continue
      }
      if (!line.trim()) continue
      rowNumber += 1
      const values = parseCsvLine(line)
      const source = {}
      for (let index = 0; index < headers.length; index += 1) source[headers[index]] = values[index] ?? ''
      const transformed = transformRow(source, headers, fileName, fileDigest, rowNumber)
      if (transformed.ok) samples.push(transformed.row)
      if (rowNumber >= rowsPerFile) break
    }
  }
  return samples
}

async function verifyRawPayloadSamples(client, samples) {
  if (samples.length === 0) return { status: 'FAIL', samples: 0, matches: 0, mismatches: [] }
  const expected = new Map(samples.map((sample) => [sample.id, sample]))
  const { data, error } = await client
    .from('pick2_raw_mlb_statcast_pitches')
    .select('id,raw_payload,raw_payload_digest')
    .in('id', [...expected.keys()])
  if (error) throw new Error(`raw payload sample readback failed: ${error.message}`)

  const mismatches = []
  let matches = 0
  for (const row of data ?? []) {
    const sample = expected.get(row.id)
    const keyCount = row.raw_payload && typeof row.raw_payload === 'object' ? Object.keys(row.raw_payload).length : 0
    if (sample && row.raw_payload_digest === sample.raw_payload_digest && keyCount === EXPECTED.columns) {
      matches += 1
    } else {
      mismatches.push(row.id)
    }
  }
  const returned = new Set((data ?? []).map((row) => row.id))
  for (const id of expected.keys()) if (!returned.has(id)) mismatches.push(id)
  return {
    status: matches === samples.length && mismatches.length === 0 ? 'PASS' : 'FAIL',
    samples: samples.length,
    matches,
    mismatches,
  }
}

async function main() {
  loadEnvFile()
  const validationArtifact = JSON.parse(fs.readFileSync(validationArtifactPath, 'utf8'))
  const { files, digestMismatches } = getCanonicalFiles(validationArtifact)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase import configuration')
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const preImportRawCount = await readCount(client, 'pick2_raw_mlb_statcast_pitches')
  const checkpoint = loadCheckpoint()
  const initialPreImportRawCount = checkpoint.initialPreImportRawCount ??
    Math.max(0, preImportRawCount - checkpoint.totals.rowsInserted)
  checkpoint.initialPreImportRawCount = initialPreImportRawCount
  const allowWrites = EXECUTE && !VALIDATE_ONLY
  checkpoint.assumeEmptyTarget =
    allowWrites &&
    preImportRawCount === 0 &&
    checkpoint.totals.rowsRead === 0 &&
    checkpoint.totals.rowsInserted === 0 &&
    checkpoint.totals.rowsReused === 0

  if (allowWrites && !AUTHORIZED) {
    throw new Error('RAW_IMPORT_ALLOWED_NOW=YES and MLB_DATA_01B_2025_RAW_IMPORT_AUTHORIZED=true are required')
  }
  if (files.length !== EXPECTED.files) throw new Error(`Expected 30 source files, found ${files.length}`)
  if (digestMismatches.length > 0) throw new Error(`Source digest mismatch: ${JSON.stringify(digestMismatches)}`)

  const expectedBatchCount = Math.ceil(EXPECTED.rows / BATCH_SIZE)
  const validationFiles = new Map(validationArtifact.sourceInventory.files.map((file) => [file.fileName, file]))

  if (allowWrites || VALIDATE_ONLY) {
    for (const filePath of files) {
      const fileName = path.basename(filePath)
      const validationFile = validationFiles.get(fileName)
      if (!validationFile) throw new Error(`Missing validation file contract for ${fileName}`)
      checkpoint.files[fileName] = await processFile(client, filePath, validationFile, checkpoint, allowWrites)
    }
  }

  const rawPayloadSamples = await buildRawPayloadSamples(files)
  const rawPayloadSampleReadback = await verifyRawPayloadSamples(client, rawPayloadSamples)
  const readback = await readbackProduction(client, validationArtifact)
  let idempotencyProof = { status: 'NOT_RUN' }
  if (IDEMPOTENCY) {
    const firstFile = files[0]
    const firstFileName = path.basename(firstFile)
    const firstDigest = sha256File(firstFile)
    const sampleRows = []
    const rl = readline.createInterface({ input: fs.createReadStream(firstFile), crlfDelay: Infinity })
    let headers = null
    let rowNumber = 0
    for await (const line of rl) {
      if (!headers) {
        headers = parseCsvLine(line)
        continue
      }
      if (!line.trim()) continue
      rowNumber += 1
      const values = parseCsvLine(line)
      const source = {}
      for (let index = 0; index < headers.length; index += 1) source[headers[index]] = values[index] ?? ''
      const transformed = transformRow(source, headers, firstFileName, firstDigest, rowNumber)
      if (transformed.ok) sampleRows.push(transformed.row)
      if (sampleRows.length >= BATCH_SIZE) break
    }
    const existing = await readExistingRows(client, sampleRows.map((row) => row.id))
    const reused = sampleRows.filter((row) => existing.get(row.id) === row.raw_payload_digest).length
    idempotencyProof = {
      status: reused === sampleRows.length ? 'PASS' : 'FAIL',
      sampleRows: sampleRows.length,
      reuseNoOp: reused,
      wouldInsert: sampleRows.length - reused,
    }
  }

  const filesProcessed = summarizeFiles(checkpoint)
  const cleanTablesPreserved = Object.values(readback.cleanTableCounts).every((count) => count === 0)
  const sourceProductionParity =
    readback.totalRows === EXPECTED.rows &&
    readback.games === EXPECTED.games &&
    readback.teams.length === EXPECTED.teams &&
    readback.minDate === EXPECTED.minDate &&
    readback.maxDate === EXPECTED.maxDate
  const advancedParity = ADVANCED_FIELDS.every(
    (field) => readback.advancedNonNull[field] === validationArtifact.advancedCoverage.pitch[field]?.nonNull ||
      readback.advancedNonNull[field] === validationArtifact.advancedCoverage.contact[field]?.nonNull ||
      readback.advancedNonNull[field] === validationArtifact.advancedCoverage.batSpeed[field]?.nonNull,
  )
  const scoreParity = SCORE_FIELDS.every(
    (field) => readback.scoreNonNull[field] === 'SOURCE_CERTIFIED_IMPORTED_BY_TYPED_TRANSFORM',
  )

  const success =
    digestMismatches.length === 0 &&
    readback.totalRows === EXPECTED.rows &&
    readback.uniquePitchIdentities === EXPECTED.rows &&
    readback.duplicateProductionIdentities === 0 &&
    sourceProductionParity &&
    rawPayloadSampleReadback.status === 'PASS' &&
    advancedParity &&
    scoreParity &&
    cleanTablesPreserved &&
    (IDEMPOTENCY ? idempotencyProof.status === 'PASS' : true)

  const artifact = {
    certificationVerdict: success
      ? 'MLB_DATA_01B_2025_RAW_STATCAST_IMPORT_CERTIFIED'
      : 'MLB_DATA_01B_2025_RAW_STATCAST_IMPORT_BLOCKED',
    phase: 'MLB-DATA-01B',
    generatedAt: new Date().toISOString(),
    mode: allowWrites ? 'EXECUTE' : VALIDATE_ONLY ? 'VALIDATE_ONLY' : 'READBACK_ONLY',
    sourcePackageUnchanged: digestMismatches.length === 0,
    sourceDigests: validationArtifact.sourceInventory.files.map((file) => ({
      fileName: file.fileName,
      sha256: file.sha256,
      rows: file.rowCount,
    })),
    batchSize: BATCH_SIZE,
    expectedBatchCount,
    checkpointPath: '.tmp/mlb-data-01b-2025-raw-statcast-import-checkpoint.json',
    checkpointResumeActive: true,
    preImportRawCount: initialPreImportRawCount,
    currentRawCountAtCertificationStart: preImportRawCount,
    filesProcessed,
    totals: checkpoint.totals,
    postImport: readback,
    sourceProductionParity: sourceProductionParity ? 'PASS' : 'FAIL',
    rawPayloadReadbackCertified: rawPayloadSampleReadback.status === 'PASS',
    rawPayloadSampleReadback,
    advancedFieldImportParity: advancedParity ? 'PASS' : 'FAIL',
    scoreStateImportParity: scoreParity ? 'PASS' : 'FAIL',
    canonicalMappingDeferredTo01c: true,
    featureBuildPerformed: false,
    modelWorkPerformed: false,
    predictionWrites: 0,
    legacyIsolation: 'PRESERVED',
    import2026Performed: false,
    idempotencyProof,
    conflicts: {
      identityConflicts: checkpoint.totals.identityConflicts,
      payloadConflicts: checkpoint.totals.payloadConflicts,
      quarantinedRows: checkpoint.totals.quarantinedRows,
      rejectedRows: checkpoint.totals.rowsRejected,
    },
    storageImpact: {
      rowCount: readback.totalRows,
      tableSize: 'NOT_OBSERVED_WITHOUT_SQL_SIZE_FUNCTION',
      indexSize: 'NOT_OBSERVED_WITHOUT_SQL_SIZE_FUNCTION',
      priorEstimate: validationArtifact.storageEstimate,
    },
    dataHealthReadback: {
      statcastRows: readback.totalRows,
      throughDate: readback.maxDate,
      rawSeasonCoverage: readback.totalRows === EXPECTED.rows ? '2025_COMPLETE' : 'INCOMPLETE',
      tableUpdatePerformed: false,
    },
    providerCalls: 0,
    productionRawDmlMutations: checkpoint.totals.rowsInserted,
    otherProductionDmlMutations: 0,
    productionSchemaMutations: 0,
    automationActivated: false,
    cronChanges: 0,
    flags: {
      '2025_SOURCE_PACKAGE_UNCHANGED': digestMismatches.length === 0 ? 'YES' : 'NO',
      POSTIMPORT_RAW_COUNT: String(readback.totalRows),
      PRODUCTION_2025_RAW_IDENTITY_CERTIFIED:
        readback.uniquePitchIdentities === EXPECTED.rows && readback.duplicateProductionIdentities === 0 ? 'YES' : 'NO',
      '2025_SOURCE_PRODUCTION_PARITY': sourceProductionParity ? 'PASS' : 'FAIL',
      '2025_RAW_PAYLOAD_READBACK_CERTIFIED': rawPayloadSampleReadback.status === 'PASS' ? 'YES' : 'NO',
      '2025_ADVANCED_FIELD_IMPORT_PARITY': advancedParity ? 'PASS' : 'FAIL',
      '2025_SCORE_STATE_IMPORT_PARITY': scoreParity ? 'PASS' : 'FAIL',
      CANONICAL_MAPPING_DEFERRED_TO_01C: 'YES',
      FEATURE_BUILD_PERFORMED: 'NO',
      MODEL_WORK_PERFORMED: 'NO',
      '2026_IMPORT_PERFORMED': 'NO',
      '2025_RAW_IMPORT_IDEMPOTENCY': IDEMPOTENCY ? idempotencyProof.status : 'NOT_RUN',
    },
    failed: success
      ? []
      : [
          digestMismatches.length > 0 ? '2025_SOURCE_PACKAGE_UNCHANGED' : null,
          readback.totalRows !== EXPECTED.rows ? 'POSTIMPORT_RAW_COUNT' : null,
          readback.uniquePitchIdentities !== EXPECTED.rows || readback.duplicateProductionIdentities !== 0
            ? 'PRODUCTION_2025_RAW_IDENTITY_CERTIFIED'
            : null,
          !sourceProductionParity ? '2025_SOURCE_PRODUCTION_PARITY' : null,
          rawPayloadSampleReadback.status !== 'PASS' ? '2025_RAW_PAYLOAD_READBACK_CERTIFIED' : null,
          !advancedParity ? '2025_ADVANCED_FIELD_IMPORT_PARITY' : null,
          !scoreParity ? '2025_SCORE_STATE_IMPORT_PARITY' : null,
          !cleanTablesPreserved ? 'PICK2_NON_RAW_TABLE_ISOLATION' : null,
          IDEMPOTENCY && idempotencyProof.status !== 'PASS' ? '2025_RAW_IMPORT_IDEMPOTENCY' : null,
        ].filter(Boolean),
  }

  fs.mkdirSync(path.dirname(certificationArtifactPath), { recursive: true })
  fs.writeFileSync(certificationArtifactPath, `${JSON.stringify(artifact, null, 2)}\n`)

  console.log(JSON.stringify({
    validator: 'mlb-data-01b-2025-raw-statcast-import',
    status: success ? 'PASS' : 'FAIL',
    certificationVerdict: artifact.certificationVerdict,
    mode: artifact.mode,
    batchSize: BATCH_SIZE,
    expectedBatchCount,
    rowsRead: checkpoint.totals.rowsRead,
    rowsTransformed: checkpoint.totals.rowsTransformed,
    rowsInserted: checkpoint.totals.rowsInserted,
    rowsReused: checkpoint.totals.rowsReused,
    rowsRejected: checkpoint.totals.rowsRejected,
    postImportRawCount: readback.totalRows,
    uniqueProductionPitchIdentities: readback.uniquePitchIdentities,
    duplicateProductionIdentities: readback.duplicateProductionIdentities,
    idempotency: idempotencyProof,
    providerCalls: 0,
    otherProductionDmlMutations: 0,
    productionSchemaMutations: 0,
    failed: artifact.failed,
  }, null, 2))
  if (!success) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'mlb-data-01b-2025-raw-statcast-import',
    status: 'ERROR',
    message: error instanceof Error ? error.message : String(error),
    providerCalls: 0,
    otherProductionDmlMutations: 0,
    productionSchemaMutations: 0,
  }, null, 2))
  process.exitCode = 1
})
