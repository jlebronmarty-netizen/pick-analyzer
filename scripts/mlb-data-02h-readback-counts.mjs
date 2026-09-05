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

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function pageCountRows(db, table, column = 'id', configure = (query) => query, pageSize = 1000) {
  let total = 0
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await configure(db.from(table).select(column).range(from, from + pageSize - 1))
    if (error) throw new Error(`${table} page-count failed at ${from}: ${error.message}`)
    total += data?.length ?? 0
    if (!data || data.length < pageSize) break
  }
  return total
}

loadLocalEnv()

const db = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const skipRaw = process.argv.includes('--skip-raw')
const counts = {
  raw2025BaselinePresumed: skipRaw ? 'SKIPPED' : 712528,
  raw2026: skipRaw ? 'SKIPPED' : await pageCountRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
  nativeGames2026: await countRows(db, 'pick2_mlb_games', 'game_pk', (query) => query.eq('season', 2026)),
  nativePlayers: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
  team2026: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  starter2026: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  bullpen2026: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  batter2026: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  matchup2026: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  firstInning2026: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  snapshots2026: await countRows(db, 'pick2_feature_snapshots', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  predictions: await countRows(db, 'pick2_game_predictions'),
  predictionResults: await countRows(db, 'pick2_prediction_results'),
  marketValues: await countRows(db, 'pick2_market_value_evaluations'),
}

console.log(JSON.stringify(counts, null, 2))
