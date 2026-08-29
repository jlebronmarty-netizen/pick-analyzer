import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const execute = args.has('--execute')
const dryRun = !execute || args.has('--dry-run')
const checkpointPath = path.join(process.cwd(), 'data/checkpoints/mlb-data-01c-r5b-native-identity-backfill-checkpoint.json')
const batchSize = Number(process.env.MLB_DATA_01C_R5B_BATCH_SIZE ?? 5000)

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function client() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function loadCheckpoint() {
  if (!fs.existsSync(checkpointPath)) {
    return { phase: 'NOT_STARTED', lastRawId: null, gamesProcessed: 0, playersProcessed: 0, rawRowsProcessed: 0 }
  }
  return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'))
}

function saveCheckpoint(checkpoint) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true })
  fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

async function countRows(db, configure = (query) => query) {
  const { count, error } = await configure(db.from('pick2_raw_mlb_statcast_pitches').select('id', { count: 'exact', head: true }))
  if (error) throw new Error(`raw count failed: ${error.message}`)
  return count ?? 0
}

async function distinctValues(db, column) {
  const values = new Set()
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await db
      .from('pick2_raw_mlb_statcast_pitches')
      .select(column)
      .not(column, 'is', null)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${column} read failed: ${error.message}`)
    for (const row of data ?? []) values.add(row[column])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return values
}

async function auditSources(db) {
  const [rawRows, pitcherRows, batterRows, gamePks, pitcherIds, batterIds] = await Promise.all([
    countRows(db),
    countRows(db, (q) => q.not('source_pitcher_id', 'is', null)),
    countRows(db, (q) => q.not('source_batter_id', 'is', null)),
    distinctValues(db, 'game_pk'),
    distinctValues(db, 'source_pitcher_id'),
    distinctValues(db, 'source_batter_id'),
  ])
  const playerIds = new Set([...pitcherIds, ...batterIds])
  return {
    rawRows,
    gameCount: gamePks.size,
    playerCount: playerIds.size,
    pitcherIdentityRows: pitcherRows,
    batterIdentityRows: batterRows,
  }
}

async function main() {
  if (execute && process.env.MLB_DATA_01C_R5B_NATIVE_BACKFILL_AUTHORIZED !== 'true') {
    throw new Error('MLB_DATA_01C_R5B_NATIVE_BACKFILL_AUTHORIZED_REQUIRED')
  }

  const db = client()
  const checkpoint = loadCheckpoint()
  const sourceAudit = await auditSources(db)

  const plan = {
    mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
    migrationRequiredBeforeExecution: '202608290001_pick2_mlb_native_identity_foundation_v1.sql',
    checkpointPath,
    batchSize,
    checkpoint,
    sourceAudit,
    expected: {
      rawRows: 712528,
      games: 2430,
      players: 1469,
      pitcherIdentityRows: 712528,
      batterIdentityRows: 712528,
    },
    conflictContract: {
      games: ['REUSE_NO_OP for compatible same game_pk', 'BLOCK_CONFLICT for incompatible same game_pk'],
      players: ['REUSE_NO_OP for compatible same MLBAM id', 'BLOCK_CONFLICT for incompatible same MLBAM id'],
      rawColumns: ['UPDATE_ELIGIBLE when null plus certified source id', 'REUSE_NO_OP when same value', 'BLOCK_CONFLICT when different value'],
    },
    writesPlannedNow: execute ? 'AUTHORIZED_EXECUTION_PATH_NOT_RUN_DURING_R5' : 'NO_WRITES_DRY_RUN_ONLY',
  }

  if (dryRun) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  saveCheckpoint({ ...checkpoint, phase: 'EXECUTION_NOT_IMPLEMENTED_IN_R5_CERTIFICATION', checkedAt: new Date().toISOString() })
  throw new Error('R5B_EXECUTION_BODY_DEFERRED_TO_SEPARATE_AUTHORIZED_PHASE')
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-01c-r5b-2025-native-identity-backfill', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
