import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const raw = trimmed.slice(index + 1).trim()
    if (!key || process.env[key]) continue
    process.env[key] = raw.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'))

const { supabaseAdmin } = await import('../src/lib/supabase-admin.ts')

async function countPrediction(queryName, apply) {
  const query = supabaseAdmin.from('prediction_history').select('id', { count: 'exact', head: true })
  const result = await apply(query)
  if (result.error) throw new Error(`${queryName} failed: ${result.error.message}`)
  return result.count ?? 0
}

const [
  currentEraShadow,
  historicalReplayShadow,
  nbaOfficialPicks,
  nbaCurrentEraVisible,
  mlbCurrentEraShadow,
] = await Promise.all([
  countPrediction('currentEraShadow', (query) => query.eq('sport_key', 'basketball_nba').eq('prediction_origin', 'CURRENT_ERA_SHADOW')),
  countPrediction('historicalReplayShadow', (query) => query.eq('sport_key', 'basketball_nba').eq('prediction_origin', 'HISTORICAL_REPLAY_SHADOW')),
  countPrediction('nbaOfficialPicks', (query) => query.eq('sport_key', 'basketball_nba').eq('recommended_pick', true)),
  countPrediction('nbaCurrentEraVisible', (query) => query.eq('sport_key', 'basketball_nba').eq('production_eligible', true)),
  countPrediction('mlbCurrentEraShadow', (query) => query.eq('sport_key', 'baseball_mlb').eq('prediction_origin', 'CURRENT_ERA_SHADOW')),
])

console.log(JSON.stringify({
  currentEraShadow,
  historicalReplayShadow,
  nbaOfficialPicks,
  nbaCurrentEraVisible,
  mlbCurrentEraShadow,
  providerCalls: 0,
  databaseMutations: 0,
}, null, 2))
