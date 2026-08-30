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

const db = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function countColumn(table) {
  if (table === 'pick2_mlb_games' || table === 'pick2_mlb_game_results') return 'game_pk'
  if (table === 'pick2_mlb_players') return 'mlbam_person_id'
  return 'id'
}

async function countRows(table) {
  const { count, error } = await db.from(table).select(countColumn(table), { count: 'exact', head: true })
  if (error) throw new Error(`${table} count failed: ${error.message || JSON.stringify(error)}`)
  return count ?? 0
}

async function main() {
  const tables = [
    'pick2_feature_snapshots',
    'pick2_mlb_team_daily_features',
    'pick2_mlb_pitcher_daily_features',
    'pick2_mlb_bullpen_daily_features',
    'pick2_mlb_batter_daily_features',
    'pick2_mlb_matchup_daily_features',
    'pick2_mlb_first_inning_daily_features',
    'pick2_mlb_games',
    'pick2_mlb_players',
    'pick2_mlb_game_results',
    'pick2_mlb_market_event_mappings',
    'pick2_model_registry',
    'pick2_model_feature_sets',
    'pick2_model_versions',
    'pick2_model_training_runs',
    'pick2_model_validation_runs',
    'pick2_game_predictions',
    'pick2_prediction_results',
    'pick2_market_value_evaluations',
  ]
  const counts = {}
  for (const table of tables) counts[table] = await countRows(table)

  const { data: raw2026, error: raw2026Error } = await db
    .from('pick2_raw_mlb_statcast_pitches')
    .select('id')
    .or('game_year.eq.2026,game_date.gte.2026-01-01')
    .limit(1)
  counts.raw2026 = raw2026Error ? `UNKNOWN:${raw2026Error.message || JSON.stringify(raw2026Error)}` : raw2026?.length ? 'AT_LEAST_1' : 0

  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version')
  const version = response.ok ? await response.json() : { error: `HTTP_${response.status}` }
  console.log(JSON.stringify({ status: 'PASS', version, counts }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
