import fs from 'node:fs'

const migrationFiles = [
  'supabase/migrations/20260907035833_mlb_statcast_runtime_performance_v1.sql',
  'supabase/migrations/20260907040410_mlb_statcast_team_runtime_rollups_v1.sql',
]

for (const file of migrationFiles) {
  if (!fs.existsSync(file)) throw new Error(`MISSING_MIGRATION:${file}`)
}

const runtime = fs.readFileSync(migrationFiles[0], 'utf8')
const team = fs.readFileSync(migrationFiles[1], 'utf8')

const requiredRuntimeFragments = [
  'mlb_statcast_coverage_mv',
  'security_invoker = true',
  'refresh_mlb_statcast_coverage_mv',
  'grant select on public.mlb_statcast_coverage_mv to service_role',
  'revoke all on public.mlb_statcast_coverage_mv from public, anon, authenticated',
  'coalesce(mlbam_pitcher_id, source_pitcher_id)',
  'coalesce(mlbam_batter_id, source_batter_id)',
]

const requiredTeamFragments = [
  'mlb_statcast_team_batting_season_summary_mv',
  'mlb_statcast_team_pitching_season_summary_mv',
  'refresh_mlb_statcast_runtime_rollups',
  'grant select on public.mlb_statcast_team_batting_season_summary_mv to service_role',
  'grant select on public.mlb_statcast_team_pitching_season_summary_mv to service_role',
  'revoke all on function public.refresh_mlb_statcast_runtime_rollups() from public, anon, authenticated',
]

for (const fragment of requiredRuntimeFragments) {
  if (!runtime.includes(fragment)) throw new Error(`RUNTIME_CONTRACT_MISSING:${fragment}`)
}
for (const fragment of requiredTeamFragments) {
  if (!team.includes(fragment)) throw new Error(`TEAM_RUNTIME_CONTRACT_MISSING:${fragment}`)
}

const forbidden = [
  /official[_ ]?pick/i,
  /productionActivationEnabled\s*=\s*true/i,
  /api\.the-odds-api\.com/i,
]

for (const [name, sql] of [['runtime', runtime], ['team', team]]) {
  for (const pattern of forbidden) {
    if (pattern.test(sql)) throw new Error(`FORBIDDEN_${name.toUpperCase()}_SIDE_EFFECT:${pattern}`)
  }
}

console.log(JSON.stringify({
  status: 'MLB_STATCAST_RUNTIME_PERFORMANCE_V1_STATIC_PASS',
  migrations: migrationFiles,
  providerCalls: 0,
  officialPickWrites: 0,
  productionBettingActivation: false,
}, null, 2))
