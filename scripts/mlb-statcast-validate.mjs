import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

loadEnvFile()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const EXPECTED = {
  2025: { pitches: 712528, games: 2430, lastGameDate: '2025-09-28' },
  2026: { pitches: 631404, games: 2139, lastGameDate: '2026-09-05' },
}

const { data: coverage, error: coverageError } = await supabase
  .from('mlb_statcast_coverage_v')
  .select('season, first_game_date, last_game_date, pitches, games, pitchers, batters, batting_teams')
  .in('season', [2025, 2026])
  .order('season', { ascending: true })

if (coverageError) throw new Error(`Coverage query failed: ${coverageError.message}`)
const bySeason = new Map((coverage ?? []).map((row) => [Number(row.season), row]))

for (const [seasonText, expected] of Object.entries(EXPECTED)) {
  const season = Number(seasonText)
  const row = bySeason.get(season)
  assert(row, `Missing Statcast coverage for ${season}`)
  assert(Number(row.pitches) === expected.pitches, `${season} pitch mismatch: expected ${expected.pitches}, got ${row.pitches}`)
  assert(Number(row.games) === expected.games, `${season} game mismatch: expected ${expected.games}, got ${row.games}`)
  assert(row.last_game_date === expected.lastGameDate, `${season} last-date mismatch: expected ${expected.lastGameDate}, got ${row.last_game_date}`)
  assert(Number(row.pitchers) > 0, `${season} has zero pitchers`)
  assert(Number(row.batters) > 0, `${season} has zero batters`)
  assert(Number(row.batting_teams) === 30, `${season} expected 30 batting teams, got ${row.batting_teams}`)

  const { count: rawCount, error: rawError } = await supabase
    .from('pick2_raw_mlb_statcast_pitches')
    .select('id', { count: 'exact', head: true })
    .eq('game_year', season)
  if (rawError) throw new Error(`${season} raw count failed: ${rawError.message}`)
  assert(Number(rawCount) === expected.pitches, `${season} raw/view count mismatch: expected ${expected.pitches}, got ${rawCount}`)
}

const viewChecks = [
  ['mlb_statcast_pitcher_game_logs', 'pitcher game logs'],
  ['mlb_statcast_batter_game_logs', 'batter game logs'],
  ['mlb_statcast_pitcher_season_summary', 'pitcher season summaries'],
  ['mlb_statcast_batter_season_summary', 'batter season summaries'],
  ['mlb_statcast_pitcher_pitch_type_summary', 'pitch-type summaries'],
  ['mlb_statcast_team_batting_season_summary', 'team batting summaries'],
  ['mlb_statcast_team_pitching_season_summary', 'team pitching summaries'],
]

const viewCounts = {}
for (const [view, label] of viewChecks) {
  const { count, error } = await supabase
    .from(view)
    .select('*', { count: 'exact', head: true })
    .in('season', [2025, 2026])
  if (error) throw new Error(`${label} count failed: ${error.message}`)
  assert((count ?? 0) > 0, `${label} is empty`)
  viewCounts[view] = count
}

console.log(JSON.stringify({
  certification: 'MLB_STATCAST_ANALYTICS_V1_DATA_CERTIFIED',
  rawSource: 'pick2_raw_mlb_statcast_pitches',
  coverage,
  viewCounts,
}, null, 2))
