import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02j-current-moneyline-prediction-persistence.json'
const frozenPath = 'docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json'

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

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function main() {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  const frozen = JSON.parse(fs.readFileSync(frozenPath, 'utf8'))
  const identities = frozen.dryInference.rows.map((row) => row.deterministic_identity)
  const db = dbClient()
  const { data, error } = await db
    .from('pick2_game_predictions')
    .select('deterministic_identity')
    .in('deterministic_identity', identities)
  if (error) throw new Error(`frozen prediction readback failed: ${error.message}`)

  const readback = {
    matchingFrozenIdentities: data?.length ?? 0,
    totalPredictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueRows: await countRows(db, 'pick2_market_value_evaluations'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    raw2026: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
  }

  const errors = []
  if (artifact.certificationVerdict !== 'MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_BLOCKED') errors.push('blocked verdict')
  if (!String(artifact.failure ?? '').includes('feature_snapshot_id')) errors.push('feature snapshot blocker')
  if (artifact.insertExecution?.attempted !== 24) errors.push('attempted count')
  if (artifact.insertExecution?.inserted !== 0) errors.push('inserted zero')
  if (artifact.insertExecution?.failed !== 24) errors.push('failed count')
  if (artifact.insertExecution?.updates !== 0 || artifact.insertExecution?.deletes !== 0) errors.push('update/delete zero')
  if (readback.matchingFrozenIdentities !== 0) errors.push('frozen rows inserted')
  if (readback.predictionResults !== 0) errors.push('prediction result zero')
  if (readback.marketValueRows !== 0) errors.push('market value zero')
  if (readback.raw2025 !== 712528 || readback.raw2026 !== 622364) errors.push('raw preservation')
  if (artifact.safety?.noProviderCalls !== true || artifact.safety?.noSchemaMutation !== true) errors.push('safety flags')

  const result = {
    validator: 'mlb-data-02j-current-moneyline-prediction-persistence-validate',
    status: errors.length ? 'FAIL' : 'PASS',
    classification: artifact.certificationVerdict,
    readback,
    errors,
  }
  console.log(JSON.stringify(result, null, 2))
  if (errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'mlb-data-02j-current-moneyline-prediction-persistence-validate',
    status: 'FAIL',
    error: error.message,
  }, null, 2))
  process.exitCode = 1
})
