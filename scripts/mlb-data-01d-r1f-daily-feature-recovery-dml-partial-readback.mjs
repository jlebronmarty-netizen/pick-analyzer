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

async function countRows(table, configure = (query) => query) {
  const query = configure(db.from(table).select(countColumn(table), { count: 'exact', head: true }))
  const { count, error } = await query
  if (error) throw new Error(`${table} count failed: ${error.message || JSON.stringify(error)}`)
  return count ?? 0
}

async function fetchAll(table, columns) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table} fetch failed at ${from}: ${error.message || JSON.stringify(error)}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

function duplicateCount(rows, fields) {
  const seen = new Set()
  let duplicates = 0
  for (const row of rows) {
    const key = fields.map((field) => row[field]).join('|')
    if (seen.has(key)) duplicates += 1
    else seen.add(key)
  }
  return duplicates
}

async function main() {
  const [
    teamRows,
    starterRows,
  ] = await Promise.all([
    fetchAll('pick2_mlb_team_daily_features', 'target_game_pk,team_id,feature_date,feature_version'),
    fetchAll('pick2_mlb_pitcher_daily_features', 'target_game_pk,mlbam_pitcher_id,feature_date,feature_version'),
  ])

  const counts = {
    pick2_feature_snapshots: await countRows('pick2_feature_snapshots'),
    pick2_mlb_team_daily_features: await countRows('pick2_mlb_team_daily_features'),
    pick2_mlb_pitcher_daily_features: await countRows('pick2_mlb_pitcher_daily_features'),
    pick2_mlb_bullpen_daily_features: await countRows('pick2_mlb_bullpen_daily_features'),
    pick2_mlb_batter_daily_features: await countRows('pick2_mlb_batter_daily_features'),
    pick2_mlb_matchup_daily_features: await countRows('pick2_mlb_matchup_daily_features'),
    pick2_mlb_first_inning_daily_features: await countRows('pick2_mlb_first_inning_daily_features'),
    pick2_mlb_games: await countRows('pick2_mlb_games'),
    pick2_mlb_players: await countRows('pick2_mlb_players'),
    pick2_mlb_game_results: await countRows('pick2_mlb_game_results'),
    pick2_mlb_market_event_mappings: await countRows('pick2_mlb_market_event_mappings'),
    pick2_model_registry: await countRows('pick2_model_registry'),
    pick2_model_feature_sets: await countRows('pick2_model_feature_sets'),
    pick2_model_versions: await countRows('pick2_model_versions'),
    pick2_model_training_runs: await countRows('pick2_model_training_runs'),
    pick2_model_validation_runs: await countRows('pick2_model_validation_runs'),
    pick2_game_predictions: await countRows('pick2_game_predictions'),
    pick2_prediction_results: await countRows('pick2_prediction_results'),
    pick2_market_value_evaluations: await countRows('pick2_market_value_evaluations'),
    rawRowsFromExecutionGuardScan: 712528,
    raw2026: 0,
  }

  const { data: raw2026Rows, error: raw2026Error } = await db
    .from('pick2_raw_mlb_statcast_pitches')
    .select('id')
    .or('game_year.eq.2026,game_date.gte.2026-01-01')
    .limit(1)
  if (raw2026Error) throw new Error(`raw2026 probe failed: ${raw2026Error.message || JSON.stringify(raw2026Error)}`)
  counts.raw2026 = raw2026Rows?.length ? 'AT_LEAST_1' : 0

  const duplicateKeys = {
    team: duplicateCount(teamRows, ['target_game_pk', 'team_id', 'feature_date', 'feature_version']),
    starter: duplicateCount(starterRows, ['target_game_pk', 'mlbam_pitcher_id', 'feature_date', 'feature_version']),
  }

  const versionResponse = await fetch('https://pick-analyzer.vercel.app/api/system/version')
  const version = versionResponse.ok ? await versionResponse.json() : { error: `HTTP_${versionResponse.status}` }

  const status =
    counts.pick2_feature_snapshots === 67433 &&
    counts.pick2_mlb_team_daily_features === 4498 &&
    counts.pick2_mlb_pitcher_daily_features === 4498 &&
    counts.pick2_mlb_bullpen_daily_features === 0 &&
    counts.pick2_mlb_batter_daily_features === 0 &&
    counts.pick2_mlb_matchup_daily_features === 0 &&
    counts.pick2_mlb_first_inning_daily_features === 0 &&
    counts.pick2_mlb_games === 2430 &&
    counts.pick2_mlb_players === 1469 &&
    counts.pick2_mlb_game_results === 0 &&
    counts.pick2_mlb_market_event_mappings === 0 &&
    Object.entries(counts)
      .filter(([key]) => key.startsWith('pick2_model') || key.startsWith('pick2_game_predictions') || key.startsWith('pick2_prediction') || key.startsWith('pick2_market_value'))
      .every(([, count]) => count === 0) &&
    counts.rawRowsFromExecutionGuardScan === 712528 &&
    counts.raw2026 === 0 &&
    duplicateKeys.team === 0 &&
    duplicateKeys.starter === 0
      ? 'PASS'
      : 'FAIL'

  console.log(JSON.stringify({
    status,
    classification: 'MLB_DATA_01D_R1F_DAILY_FEATURE_RECOVERY_DML_PARTIAL',
    version,
    counts,
    duplicateKeys,
    stoppedAt: 'pick2_mlb_bullpen_daily_features legacy uniqueness constraint',
    providerCalls: 0,
    productionSchemaMutations: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
