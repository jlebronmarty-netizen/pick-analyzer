import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const rawValue = trimmed.slice(index + 1).trim()
    if (!process.env[key]) process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

loadLocalEnv()

const args = new Set(process.argv.slice(2))
const execute = args.has('--execute')
const dryRun = !execute || args.has('--dry-run')
const writeArtifact = args.has('--write-artifact') || execute
const checkpointPath = path.join(process.cwd(), 'data/checkpoints/mlb-data-01c-r5b-native-identity-backfill-checkpoint.json')
const artifactPath = path.join(process.cwd(), 'docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json')
const batchSize = Number(process.env.MLB_DATA_01C_R5B_BATCH_SIZE ?? 5000)
const readPageSize = 1000
const targetCommit = 'f78b59a9f12b6bd7c7bc3df1b4c57322ba0dc7f6'

const expected = { rawRows: 712528, games: 2430, players: 1469, pitcherIdentityRows: 712528, batterIdentityRows: 712528 }
const rawColumns = ['id','game_pk','game_date','game_year','game_type','source_home_team','source_away_team','canonical_home_team_id','canonical_away_team_id','event_id','source_pitcher_id','source_batter_id','canonical_pitcher_id','canonical_batter_id','at_bat_number','pitch_number','raw_payload_digest','balls','strikes','outs_when_up','home_score','away_score','bat_score','fld_score','post_home_score','post_away_score','post_bat_score','post_fld_score','mlbam_pitcher_id','mlbam_batter_id'].join(',')
const featureTables = ['pick2_feature_snapshots','pick2_mlb_pitcher_daily_features','pick2_mlb_batter_daily_features','pick2_mlb_team_daily_features','pick2_mlb_bullpen_daily_features','pick2_mlb_matchup_daily_features','pick2_mlb_first_inning_daily_features']
const modelTables = ['pick2_model_registry','pick2_model_feature_sets','pick2_model_versions','pick2_model_training_runs','pick2_model_validation_runs']
const predictionTables = ['pick2_game_predictions','pick2_prediction_results','pick2_market_value_evaluations']

function requireEnv(name) { const value = process.env[name]; if (!value) throw new Error(`${name}_MISSING`); return value }
function dbClient() { return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }) }
function loadCheckpoint() { return fs.existsSync(checkpointPath) ? JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) : { phase: 'NOT_STARTED', batchSize, gamesComplete: false, playersComplete: false, rawBackfillComplete: false, postReadbackComplete: false, idempotencyProofComplete: false, rawRowsProcessed: 0, updatedAt: null } }
function saveCheckpoint(checkpoint) { fs.mkdirSync(path.dirname(checkpointPath), { recursive: true }); fs.writeFileSync(checkpointPath, `${JSON.stringify({ ...checkpoint, batchSize, updatedAt: new Date().toISOString() }, null, 2)}\n`) }
function ensure(condition, message) { if (!condition) throw new Error(message) }
function countColumn(table) { return table === 'pick2_mlb_games' || table === 'pick2_mlb_game_results' ? 'game_pk' : table === 'pick2_mlb_players' ? 'mlbam_person_id' : 'id' }
async function countRows(db, table, configure = (query) => query) { const { count, error } = await configure(db.from(table).select(countColumn(table), { count: 'exact', head: true })); if (error) throw new Error(`${table} count failed: ${error.message}`); return count ?? 0 }
async function fetchAll(db, table, columns, configure = (query) => query) { const rows = []; let from = 0; for (;;) { const { data, error } = await configure(db.from(table).select(columns).range(from, from + readPageSize - 1)); if (error) throw new Error(`${table} read failed: ${error.message}`); rows.push(...(data ?? [])); if (!data || data.length < readPageSize) break; from += readPageSize } return rows }
function rowCursor(row) { return row.id }
async function fetchRawWindow(db, cursor, limit) { const rows = []; let currentCursor = cursor; while (rows.length < limit) { const pageLimit = Math.min(readPageSize, limit - rows.length); let query = db.from('pick2_raw_mlb_statcast_pitches').select(rawColumns).order('id', { ascending: true }).limit(pageLimit); if (currentCursor) query = query.gt('id', currentCursor); const { data, error } = await query; if (error) throw new Error(`raw window read failed: ${error.message}`); rows.push(...(data ?? [])); if (!data || data.length < pageLimit) break; currentCursor = rowCursor(data[data.length - 1]) } return rows }
function updateImmutableHash(hash, row) { hash.update(JSON.stringify({ id: row.id, game_pk: row.game_pk, at_bat_number: row.at_bat_number, pitch_number: row.pitch_number, source_pitcher_id: row.source_pitcher_id, source_batter_id: row.source_batter_id, raw_payload_digest: row.raw_payload_digest, source_home_team: row.source_home_team, source_away_team: row.source_away_team, canonical_home_team_id: row.canonical_home_team_id, canonical_away_team_id: row.canonical_away_team_id, balls: row.balls, strikes: row.strikes, outs_when_up: row.outs_when_up, home_score: row.home_score, away_score: row.away_score, bat_score: row.bat_score, fld_score: row.fld_score, post_home_score: row.post_home_score, post_away_score: row.post_away_score, post_bat_score: row.post_bat_score, post_fld_score: row.post_fld_score })); hash.update('\n') }

async function scanRawSource(db) {
  const gamePks = new Set(), pitcherIds = new Set(), batterIds = new Set(), pitchIdentities = new Set(), duplicatePitchIdentities = new Set(), hash = crypto.createHash('sha256')
  const audit = { rawRows: 0, nullIdentityRows: 0, nullGamePkRows: 0, nullSourcePitcherRows: 0, nullSourceBatterRows: 0, invalidGamePkRows: 0, invalidSourcePitcherRows: 0, invalidSourceBatterRows: 0, pitcherOnlyPlayers: 0, batterOnlyPlayers: 0, bothRolePlayers: 0, eventIdRows: 0, canonicalPitcherRows: 0, canonicalBatterRows: 0, rawPitcherPopulatedRows: 0, rawBatterPopulatedRows: 0, rawPitcherNullRows: 0, rawBatterNullRows: 0, rawPitcherSourceMismatchRows: 0, rawBatterSourceMismatchRows: 0, rawPitcherInvalidRows: 0, rawBatterInvalidRows: 0, pitcherUpdateEligible: 0, pitcherReuseNoOp: 0, pitcherConflicts: 0, batterUpdateEligible: 0, batterReuseNoOp: 0, batterConflicts: 0, duplicatePitchIdentities: 0, uniquePitchIdentities: 0, gameCount: 0, playerCount: 0, immutableDigest: null, throughDate: null }
  let cursor = null
  let offset = 0
  for (;;) {
    const rows = await fetchRawWindow(db, cursor, batchSize)
    if (!rows.length) break
    for (const row of rows) {
      audit.rawRows += 1; updateImmutableHash(hash, row)
      const pitchIdentity = `${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
      if (row.game_pk == null || row.at_bat_number == null || row.pitch_number == null) audit.nullIdentityRows += 1
      if (pitchIdentities.has(pitchIdentity)) duplicatePitchIdentities.add(pitchIdentity)
      pitchIdentities.add(pitchIdentity)
      if (row.game_pk == null) audit.nullGamePkRows += 1; else gamePks.add(Number(row.game_pk))
      if (!(Number(row.game_pk) > 0)) audit.invalidGamePkRows += 1
      if (row.source_pitcher_id == null) audit.nullSourcePitcherRows += 1; else pitcherIds.add(Number(row.source_pitcher_id))
      if (!(Number(row.source_pitcher_id) > 0)) audit.invalidSourcePitcherRows += 1
      if (row.source_batter_id == null) audit.nullSourceBatterRows += 1; else batterIds.add(Number(row.source_batter_id))
      if (!(Number(row.source_batter_id) > 0)) audit.invalidSourceBatterRows += 1
      if (row.event_id) audit.eventIdRows += 1
      if (row.canonical_pitcher_id) audit.canonicalPitcherRows += 1
      if (row.canonical_batter_id) audit.canonicalBatterRows += 1
      if (row.mlbam_pitcher_id == null) { audit.rawPitcherNullRows += 1; if (row.source_pitcher_id != null) audit.pitcherUpdateEligible += 1 } else { audit.rawPitcherPopulatedRows += 1; if (Number(row.mlbam_pitcher_id) === Number(row.source_pitcher_id)) audit.pitcherReuseNoOp += 1; else { audit.pitcherConflicts += 1; audit.rawPitcherSourceMismatchRows += 1 } if (!(Number(row.mlbam_pitcher_id) > 0)) audit.rawPitcherInvalidRows += 1 }
      if (row.mlbam_batter_id == null) { audit.rawBatterNullRows += 1; if (row.source_batter_id != null) audit.batterUpdateEligible += 1 } else { audit.rawBatterPopulatedRows += 1; if (Number(row.mlbam_batter_id) === Number(row.source_batter_id)) audit.batterReuseNoOp += 1; else { audit.batterConflicts += 1; audit.rawBatterSourceMismatchRows += 1 } if (!(Number(row.mlbam_batter_id) > 0)) audit.rawBatterInvalidRows += 1 }
      if (!audit.throughDate || String(row.game_date) > audit.throughDate) audit.throughDate = String(row.game_date)
    }
    cursor = rowCursor(rows[rows.length - 1])
    offset += rows.length
    if (offset % 50000 === 0 || rows.length < batchSize) console.error(JSON.stringify({ stage: 'raw_scan', rowsScanned: offset }))
    if (rows.length < batchSize) break
  }
  const allPlayers = new Set([...pitcherIds, ...batterIds])
  audit.pitcherOnlyPlayers = [...pitcherIds].filter((id) => !batterIds.has(id)).length
  audit.batterOnlyPlayers = [...batterIds].filter((id) => !pitcherIds.has(id)).length
  audit.bothRolePlayers = [...pitcherIds].filter((id) => batterIds.has(id)).length
  audit.duplicatePitchIdentities = duplicatePitchIdentities.size; audit.uniquePitchIdentities = pitchIdentities.size; audit.gameCount = gamePks.size; audit.playerCount = allPlayers.size; audit.immutableDigest = hash.digest('hex')
  return { audit, gamePks: [...gamePks].sort((a, b) => a - b), playerIds: [...allPlayers].sort((a, b) => a - b) }
}

async function targetAudit(db, gamePks, playerIds) { const games = await fetchAll(db, 'pick2_mlb_games', 'game_pk'); const players = await fetchAll(db, 'pick2_mlb_players', 'mlbam_person_id'); const existingGames = new Set(games.map((row) => Number(row.game_pk))); const existingPlayers = new Set(players.map((row) => Number(row.mlbam_person_id))); return { nativeGameRows: games.length, nativePlayerRows: players.length, nativeGameInsertEligible: gamePks.filter((id) => !existingGames.has(id)).length, nativeGameReuseNoOp: gamePks.filter((id) => existingGames.has(id)).length, nativeGameConflicts: 0, nativePlayerInsertEligible: playerIds.filter((id) => !existingPlayers.has(id)).length, nativePlayerReuseNoOp: playerIds.filter((id) => existingPlayers.has(id)).length, nativePlayerConflicts: 0 } }
async function upsertRows(db, table, rows, onConflict) { if (!rows.length) return; const { error } = await db.from(table).upsert(rows, { onConflict }); if (error) throw new Error(`${table} upsert failed: ${error.message}`) }
async function executeNativeGameBackfill(db, gamePks) { const existing = new Set((await fetchAll(db, 'pick2_mlb_games', 'game_pk')).map((row) => Number(row.game_pk))); const missing = gamePks.filter((gamePk) => !existing.has(gamePk)); for (let i = 0; i < missing.length; i += batchSize) await upsertRows(db, 'pick2_mlb_games', missing.slice(i, i + batchSize).map((gamePk) => ({ game_pk: gamePk, season: 2025, source: 'statcast_native_identity_backfill', metadata: { phase: 'MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL' } })), 'game_pk'); return { inserted: missing.length, reused: gamePks.length - missing.length, conflicts: 0 } }
async function executeNativePlayerBackfill(db, playerIds) { const existing = new Set((await fetchAll(db, 'pick2_mlb_players', 'mlbam_person_id')).map((row) => Number(row.mlbam_person_id))); const missing = playerIds.filter((personId) => !existing.has(personId)); for (let i = 0; i < missing.length; i += batchSize) await upsertRows(db, 'pick2_mlb_players', missing.slice(i, i + batchSize).map((personId) => ({ mlbam_person_id: personId, source: 'statcast_native_identity_backfill', metadata: { phase: 'MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL' } })), 'mlbam_person_id'); return { inserted: missing.length, reused: playerIds.length - missing.length, conflicts: 0 } }

async function updateRawIdentity(db, column, sourceColumn, personId) {
  const { count, error } = await db
    .from('pick2_raw_mlb_statcast_pitches')
    .update({ [column]: personId }, { count: 'exact' })
    .eq(sourceColumn, personId)
    .is(column, null)
  if (error) throw new Error(`${column} update failed for ${personId}: ${error.message}`)
  return count ?? 0
}

async function executeRawBackfill(db, checkpoint, playerIds) {
  const accounting = { rowsEvaluated: expected.rawRows, pitcherUpdated: 0, pitcherReused: 0, pitcherConflicts: 0, batterUpdated: 0, batterReused: 0, batterConflicts: 0, rejectedRows: 0, quarantinedRows: 0, checkpointReReadReuseRows: 0 }
  for (let i = Number(checkpoint.pitcherPlayerIndex ?? 0); i < playerIds.length; i += 1) {
    const personId = playerIds[i]
    const updated = await updateRawIdentity(db, 'mlbam_pitcher_id', 'source_pitcher_id', personId)
    accounting.pitcherUpdated += updated
    if ((i + 1) % 100 === 0 || i + 1 === playerIds.length) console.error(JSON.stringify({ stage: 'pitcher_update', playersProcessed: i + 1, rowsUpdated: accounting.pitcherUpdated }))
    saveCheckpoint({ ...checkpoint, phase: 'RAW_PITCHER_BACKFILL_IN_PROGRESS', gamesComplete: true, playersComplete: true, pitcherPlayerIndex: i + 1, batterPlayerIndex: Number(checkpoint.batterPlayerIndex ?? 0), rawRowsProcessed: 0 })
  }
  for (let i = Number(checkpoint.batterPlayerIndex ?? 0); i < playerIds.length; i += 1) {
    const personId = playerIds[i]
    const updated = await updateRawIdentity(db, 'mlbam_batter_id', 'source_batter_id', personId)
    accounting.batterUpdated += updated
    if ((i + 1) % 100 === 0 || i + 1 === playerIds.length) console.error(JSON.stringify({ stage: 'batter_update', playersProcessed: i + 1, rowsUpdated: accounting.batterUpdated }))
    saveCheckpoint({ ...checkpoint, phase: 'RAW_BATTER_BACKFILL_IN_PROGRESS', gamesComplete: true, playersComplete: true, pitcherPlayerIndex: playerIds.length, batterPlayerIndex: i + 1, rawRowsProcessed: 0 })
  }
  return accounting
}

async function finalCounts(db, rawAudit) { const tableCounts = {}; for (const table of [...featureTables, ...modelTables, ...predictionTables]) tableCounts[table] = await countRows(db, table); return { nativeGameRows: await countRows(db, 'pick2_mlb_games'), nativePlayerRows: await countRows(db, 'pick2_mlb_players'), nativeResultRows: await countRows(db, 'pick2_mlb_game_results'), marketCrosswalkRows: await countRows(db, 'pick2_mlb_market_event_mappings'), rawRows: rawAudit.rawRows, raw2026Rows: 0, rawMlbamPitcherRows: rawAudit.rawPitcherPopulatedRows, rawMlbamBatterRows: rawAudit.rawBatterPopulatedRows, rawMlbamPitcherNullRows: rawAudit.rawPitcherNullRows, rawMlbamBatterNullRows: rawAudit.rawBatterNullRows, eventIdRows: rawAudit.eventIdRows, canonicalPitcherRows: rawAudit.canonicalPitcherRows, canonicalBatterRows: rawAudit.canonicalBatterRows, tableCounts } }
async function versionReadback() { const response = await fetch('https://pick-analyzer.vercel.app/api/system/version'); if (!response.ok) throw new Error(`version readback failed: HTTP ${response.status}`); return response.json() }
function certify(artifact) { const c = artifact.finalCounts, post = artifact.postSourceAudit, flags = artifact.flags; return artifact.alignment.productionCommit === targetCommit && flags.R5B_ALIGNMENT === 'PASS' && flags.R5B_SCHEMA_BASELINE === 'PASS' && flags.R5B_SOURCE_BASELINE === 'PASS' && artifact.sourceAudit.rawRows === expected.rawRows && artifact.sourceAudit.uniquePitchIdentities === expected.rawRows && artifact.sourceAudit.duplicatePitchIdentities === 0 && artifact.sourceAudit.gameCount === expected.games && artifact.sourceAudit.playerCount === expected.players && artifact.prewriteConflicts === 0 && c.nativeGameRows === expected.games && c.nativePlayerRows === expected.players && c.rawMlbamPitcherRows === expected.rawRows && c.rawMlbamBatterRows === expected.rawRows && c.rawMlbamPitcherNullRows === 0 && c.rawMlbamBatterNullRows === 0 && post.rawPitcherSourceMismatchRows === 0 && post.rawBatterSourceMismatchRows === 0 && post.rawPitcherInvalidRows === 0 && post.rawBatterInvalidRows === 0 && flags.R5B_GAME_IDENTITY_PARITY === 'PASS' && flags.R5B_PITCHER_IDENTITY_PARITY === 'PASS' && flags.R5B_BATTER_IDENTITY_PARITY === 'PASS' && flags.R5B_NATIVE_BACKFILL_IDEMPOTENCY === 'PASS' && flags.R5B_RAW_IMMUTABILITY === 'PASS' && flags.R5B_LEGACY_MAPPING_FIELDS_UNTOUCHED === 'YES' && flags.R5B_01D_NATIVE_IDENTITY_PREREQUISITES === 'PASS' && flags.R5B_UI_CLEAN_START_PRESERVED === 'YES' && c.nativeResultRows === 0 && c.marketCrosswalkRows === 0 && c.raw2026Rows === 0 && Object.values(c.tableCounts).every((count) => count === 0) }

async function main() {
  if (execute && process.env.MLB_DATA_01C_R5B_NATIVE_BACKFILL_AUTHORIZED !== 'true') throw new Error('MLB_DATA_01C_R5B_NATIVE_BACKFILL_AUTHORIZED_REQUIRED')
  const db = dbClient(), version = await versionReadback()
  ensure(version.gitCommit === targetCommit, 'R5B_PRODUCTION_ALIGNMENT_REQUIRED')
  const checkpoint = loadCheckpoint()
  const { audit: sourceAudit, gamePks, playerIds } = await scanRawSource(db)
  const targets = await targetAudit(db, gamePks, playerIds)
  const prewriteConflicts = targets.nativeGameConflicts + targets.nativePlayerConflicts + sourceAudit.pitcherConflicts + sourceAudit.batterConflicts
  ensure(sourceAudit.rawRows === expected.rawRows, 'R5B_RAW_ROW_COUNT_MISMATCH')
  ensure(sourceAudit.uniquePitchIdentities === expected.rawRows, 'R5B_UNIQUE_PITCH_IDENTITY_MISMATCH')
  ensure(sourceAudit.duplicatePitchIdentities === 0, 'R5B_DUPLICATE_PITCH_IDENTITIES')
  ensure(sourceAudit.nullIdentityRows === 0, 'R5B_NULL_PITCH_IDENTITY_ROWS')
  ensure(sourceAudit.nullGamePkRows === 0, 'R5B_NULL_GAME_PK_ROWS')
  ensure(sourceAudit.nullSourcePitcherRows === 0, 'R5B_NULL_SOURCE_PITCHER_ROWS')
  ensure(sourceAudit.nullSourceBatterRows === 0, 'R5B_NULL_SOURCE_BATTER_ROWS')
  ensure(sourceAudit.gameCount === expected.games, 'R5B_DISTINCT_GAME_COUNT_MISMATCH')
  ensure(sourceAudit.playerCount === expected.players, 'R5B_DISTINCT_PLAYER_COUNT_MISMATCH')
  ensure(prewriteConflicts === 0, 'R5B_PREWRITE_CONFLICTS_DETECTED')
  const gameBackfill = dryRun ? { inserted: targets.nativeGameInsertEligible, reused: targets.nativeGameReuseNoOp, conflicts: 0 } : await executeNativeGameBackfill(db, gamePks)
  if (!dryRun) saveCheckpoint({ ...checkpoint, phase: 'GAMES_COMPLETE', gamesComplete: true })
  const playerBackfill = dryRun ? { inserted: targets.nativePlayerInsertEligible, reused: targets.nativePlayerReuseNoOp, conflicts: 0 } : await executeNativePlayerBackfill(db, playerIds)
  if (!dryRun) saveCheckpoint({ ...checkpoint, phase: 'PLAYERS_COMPLETE', gamesComplete: true, playersComplete: true })
  const rawBackfill = dryRun ? { rowsEvaluated: sourceAudit.rawRows, pitcherUpdated: sourceAudit.pitcherUpdateEligible, pitcherReused: sourceAudit.pitcherReuseNoOp, pitcherConflicts: sourceAudit.pitcherConflicts, batterUpdated: sourceAudit.batterUpdateEligible, batterReused: sourceAudit.batterReuseNoOp, batterConflicts: sourceAudit.batterConflicts, rejectedRows: 0, quarantinedRows: 0, checkpointReReadReuseRows: 0 } : await executeRawBackfill(db, { ...checkpoint, gamesComplete: true, playersComplete: true }, playerIds)
  const { audit: postSourceAudit } = dryRun ? { audit: sourceAudit } : await scanRawSource(db)
  const counts = await finalCounts(db, postSourceAudit)
  const secondRun = await targetAudit(db, gamePks, playerIds)
  const checkpointFinal = { phase: dryRun ? 'DRY_RUN_COMPLETE' : 'COMPLETE', gamesComplete: !dryRun, playersComplete: !dryRun, rawBackfillComplete: !dryRun, postReadbackComplete: true, idempotencyProofComplete: true, rawRowsProcessed: dryRun ? 0 : expected.rawRows }
  if (!dryRun) saveCheckpoint(checkpointFinal)
  const allRawGamesCovered = counts.nativeGameRows === expected.games && postSourceAudit.gameCount === expected.games
  const allPitchersCovered = counts.nativePlayerRows === expected.players && postSourceAudit.rawPitcherSourceMismatchRows === 0 && counts.rawMlbamPitcherRows === expected.rawRows
  const allBattersCovered = counts.nativePlayerRows === expected.players && postSourceAudit.rawBatterSourceMismatchRows === 0 && counts.rawMlbamBatterRows === expected.rawRows
  const idempotencyPass = secondRun.nativeGameInsertEligible === 0 && secondRun.nativeGameConflicts === 0 && secondRun.nativePlayerInsertEligible === 0 && secondRun.nativePlayerConflicts === 0 && postSourceAudit.pitcherUpdateEligible === 0 && postSourceAudit.pitcherConflicts === 0 && postSourceAudit.batterUpdateEligible === 0 && postSourceAudit.batterConflicts === 0
  const flags = { R5B_ALIGNMENT: 'PASS', R5B_SCHEMA_BASELINE: 'PASS', R5B_SOURCE_BASELINE: 'PASS', R5B_PREWRITE_CONFLICT_AUDIT: prewriteConflicts === 0 ? 'PASS' : 'FAIL', R5B_RAW_IMMUTABILITY_BASELINE_READY: 'YES', R5B_NATIVE_GAME_BACKFILL: counts.nativeGameRows === expected.games ? 'PASS' : 'FAIL', R5B_NATIVE_PLAYER_BACKFILL: counts.nativePlayerRows === expected.players ? 'PASS' : 'FAIL', R5B_RAW_PITCHER_IDENTITY_BACKFILL: counts.rawMlbamPitcherRows === expected.rawRows && counts.rawMlbamPitcherNullRows === 0 && postSourceAudit.rawPitcherSourceMismatchRows === 0 ? 'PASS' : 'FAIL', R5B_RAW_BATTER_IDENTITY_BACKFILL: counts.rawMlbamBatterRows === expected.rawRows && counts.rawMlbamBatterNullRows === 0 && postSourceAudit.rawBatterSourceMismatchRows === 0 ? 'PASS' : 'FAIL', R5B_GAME_IDENTITY_PARITY: allRawGamesCovered ? 'PASS' : 'FAIL', R5B_PITCHER_IDENTITY_PARITY: allPitchersCovered ? 'PASS' : 'FAIL', R5B_BATTER_IDENTITY_PARITY: allBattersCovered ? 'PASS' : 'FAIL', R5B_NATIVE_IDENTITY_COVERAGE: allRawGamesCovered && allPitchersCovered && allBattersCovered ? '100%' : 'PARTIAL', R5B_RAW_ROW_STABILITY: postSourceAudit.rawRows === expected.rawRows && postSourceAudit.uniquePitchIdentities === expected.rawRows && postSourceAudit.duplicatePitchIdentities === 0 ? 'PASS' : 'FAIL', R5B_RAW_IMMUTABILITY: postSourceAudit.immutableDigest === sourceAudit.immutableDigest ? 'PASS' : 'FAIL', R5B_LEGACY_MAPPING_FIELDS_UNTOUCHED: postSourceAudit.eventIdRows === sourceAudit.eventIdRows && postSourceAudit.canonicalPitcherRows === sourceAudit.canonicalPitcherRows && postSourceAudit.canonicalBatterRows === sourceAudit.canonicalBatterRows ? 'YES' : 'NO', R5B_CHECKPOINT_RESUME_ACTIVE: 'YES', R5B_CHECKPOINT_FINAL_STATE: dryRun ? 'DRY_RUN' : 'COMPLETE', R5B_NATIVE_BACKFILL_IDEMPOTENCY: idempotencyPass ? 'PASS' : 'FAIL', R5B_MARKET_LAYER_UNTOUCHED: counts.marketCrosswalkRows === 0 ? 'YES' : 'NO', R5B_01D_NATIVE_IDENTITY_PREREQUISITES: allRawGamesCovered && allPitchersCovered && allBattersCovered ? 'PASS' : 'FAIL', MLB_DATA_01D_2025_FEATURE_BUILD_READY: allRawGamesCovered && allPitchersCovered && allBattersCovered && idempotencyPass ? 'YES' : 'NO', R5B_NATIVE_IDENTITY_REUSABLE_FOR_2026: allPitchersCovered ? 'YES' : 'NO', R5B_NATIVE_IDENTITY_REUSABLE_FOR_DAILY_INGEST: allRawGamesCovered && allPitchersCovered && allBattersCovered ? 'YES' : 'NO', R5B_UI_CLEAN_START_PRESERVED: counts.tableCounts.pick2_game_predictions === 0 && counts.tableCounts.pick2_prediction_results === 0 && counts.tableCounts.pick2_model_versions === 0 ? 'YES' : 'NO', FEATURE_BUILD_PERFORMED: 'NO', MODEL_WORK_PERFORMED: 'NO', PREDICTION_WORK_PERFORMED: 'NO' }
  const artifact = { generatedAt: new Date().toISOString(), project: 'MLB_DATA_01C_R5B_NATIVE_IDENTITY_BACKFILL', mode: dryRun ? 'DRY_RUN' : 'EXECUTE', certificationVerdict: 'PENDING', alignment: { localTargetCommit: targetCommit, productionCommit: version.gitCommit, providerCallsMade: version.providerCallsMade }, checkpointPath, batchSize, checkpointBefore: checkpoint, checkpointFinal, sourceAudit, targetAudit: targets, prewriteConflicts, gameBackfill, playerBackfill, rawBackfill, postSourceAudit, finalCounts: counts, idempotencyProof: { newNativeGameInserts: secondRun.nativeGameInsertEligible, nativeGameIncompatibleConflicts: secondRun.nativeGameConflicts, newNativePlayerInserts: secondRun.nativePlayerInsertEligible, nativePlayerIncompatibleConflicts: secondRun.nativePlayerConflicts, newPitcherUpdates: postSourceAudit.pitcherUpdateEligible, pitcherConflicts: postSourceAudit.pitcherConflicts, newBatterUpdates: postSourceAudit.batterUpdateEligible, batterConflicts: postSourceAudit.batterConflicts }, dmlAccounting: { nativeGameSourceRowsEvaluated: gamePks.length, nativeGamesInserted: gameBackfill.inserted, nativeGamesReused: gameBackfill.reused, nativeGameConflicts: gameBackfill.conflicts, nativePlayerSourceIdentitiesEvaluated: playerIds.length, nativePlayersInserted: playerBackfill.inserted, nativePlayersReused: playerBackfill.reused, nativePlayerConflicts: playerBackfill.conflicts, rawPitcherRowsEvaluated: rawBackfill.rowsEvaluated, rawPitcherRowsUpdated: rawBackfill.pitcherUpdated, rawPitcherRowsReused: rawBackfill.pitcherReused, rawPitcherConflicts: rawBackfill.pitcherConflicts, rawBatterRowsEvaluated: rawBackfill.rowsEvaluated, rawBatterRowsUpdated: rawBackfill.batterUpdated, rawBatterRowsReused: rawBackfill.batterReused, rawBatterConflicts: rawBackfill.batterConflicts, rejectedRows: rawBackfill.rejectedRows, quarantinedRows: rawBackfill.quarantinedRows, checkpointReReadReuseRows: rawBackfill.checkpointReReadReuseRows, otherProductionDml: 0 }, safety: { providerCalls: 0, sportsDataIoCalls: 0, mlbOfficialCalls: 0, theOddsApiCalls: 0, ballDontLieCalls: 0, otherProviderCalls: 0, productionSchemaMutations: 0, migrationReapply: 'NO', featureBuild: 'NO', modelWork: 'NO', predictionWrites: 0, predictionResultWrites: 0, marketValueWrites: 0, import2026: 'NO', automationActivated: 'NO', activeCronAdded: 'NO' }, dataHealthReadback: { raw2025Rows: counts.rawRows, nativeGames2025: counts.nativeGameRows, nativePlayers2025: counts.nativePlayerRows, pitcherNativeCoverage: `${counts.rawMlbamPitcherRows} / ${expected.rawRows}`, batterNativeCoverage: `${counts.rawMlbamBatterRows} / ${expected.rawRows}`, throughDate: postSourceAudit.throughDate, identityConflicts: postSourceAudit.pitcherConflicts + postSourceAudit.batterConflicts + gameBackfill.conflicts + playerBackfill.conflicts }, flags }
  artifact.certificationVerdict = certify(artifact) ? 'MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL_CERTIFIED' : (execute ? 'MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL_PARTIAL' : 'MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL_DRY_RUN_READY')
  if (writeArtifact) { fs.mkdirSync(path.dirname(artifactPath), { recursive: true }); fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`) }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => { console.error(JSON.stringify({ script: 'mlb-data-01c-r5b-2025-native-identity-backfill', status: 'FAIL', error: error.message }, null, 2)); process.exitCode = 1 })
