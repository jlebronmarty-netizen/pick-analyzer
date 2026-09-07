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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase environment')
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const views = [
  'mlb_statcast_pitcher_hand_split_summary',
  'mlb_statcast_batter_hand_split_summary',
  'mlb_statcast_pitcher_vs_team_summary',
  'mlb_statcast_batter_pitch_type_summary',
  'mlb_statcast_team_vs_pitch_type_summary',
  'mlb_statcast_league_pitch_type_summary',
  'mlb_statcast_pitcher_batter_summary',
]

const counts = {}
for (const view of views) {
  const { count, error } = await supabase.from(view).select('*', { count: 'exact', head: true }).eq('season', 2026)
  if (error) throw new Error(`${view}: ${error.message}`)
  assert((count ?? 0) > 0, `${view} is empty for 2026`)
  counts[view] = count
}

const { data: teamRows, error: teamError } = await supabase
  .from('mlb_statcast_team_vs_pitch_type_summary')
  .select('team')
  .eq('season', 2026)
if (teamError) throw new Error(teamError.message)
const teams = new Set((teamRows ?? []).map((row) => row.team))
assert(teams.size === 30, `Expected 30 team-vs-pitch-type teams, got ${teams.size}`)

const { data: leagueRows, error: leagueError } = await supabase
  .from('mlb_statcast_league_pitch_type_summary')
  .select('pitcher_throws, pitch_type, total_pitches, whiff_rate, avg_xwoba')
  .eq('season', 2026)
if (leagueError) throw new Error(leagueError.message)
assert((leagueRows ?? []).some((row) => row.pitcher_throws === 'R'), 'Missing RHP league baseline')
assert((leagueRows ?? []).some((row) => row.pitcher_throws === 'L'), 'Missing LHP league baseline')
assert((leagueRows ?? []).every((row) => Number(row.total_pitches) > 0), 'League baseline contains empty pitch type')

const { data: sample, error: sampleError } = await supabase
  .from('mlb_statcast_pitcher_vs_team_summary')
  .select('pitcher, opponent_team, games, total_pitches, plate_appearances, whiff_rate')
  .eq('season', 2026)
  .gte('games', 2)
  .limit(1)
if (sampleError) throw new Error(sampleError.message)
assert(sample?.length === 1, 'No multi-game pitcher-vs-team sample found')
assert(Number(sample[0].total_pitches) > 0, 'Pitcher-vs-team sample has zero pitches')

console.log(JSON.stringify({
  certification: 'MLB_STATCAST_MATCHUP_V1_DATA_READY',
  season: 2026,
  counts,
  teamCount: teams.size,
  leaguePitchTypes: leagueRows?.length ?? 0,
  sample: sample?.[0] ?? null,
  activation: 'DESCRIPTIVE_ONLY_NO_BETTING_MARKET',
}, null, 2))
