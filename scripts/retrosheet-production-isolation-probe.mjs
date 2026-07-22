import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const text = fs.readFileSync('.env.local', 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] ??= value
  }
}

loadEnvLocal()
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function safeCount(table, configure = (query) => query) {
  const result = await configure(client.from(table).select('*', { count: 'exact', head: true }).limit(0))
  return result.error ? { error: result.error.message } : { count: result.count ?? 0 }
}

const recentJobs = await client
  .from('sports_sync_jobs')
  .select('id,job_type,sport_key,league_key,provider,season,status,started_at,completed_at,records_fetched,records_inserted,records_updated,records_skipped,error_count')
  .order('started_at', { ascending: false })
  .limit(5)

const checks = {
  recentSportsSyncJobs: recentJobs.error ? { error: recentJobs.error.message } : recentJobs.data,
  predictionHistoryRetrosheetGameLeak: await safeCount('prediction_history', (query) =>
    query.eq('sport_key', 'baseball_mlb').ilike('game_id', 'retrosheet:%')
  ),
  predictionHistoryRetrosheetSnapshotLeak: await safeCount('prediction_history', (query) =>
    query.eq('sport_key', 'baseball_mlb').ilike('feature_snapshot_key', '%retrosheet%')
  ),
  predictionHistoryRetrosheetSettlementLeak: await safeCount('prediction_history', (query) =>
    query.eq('sport_key', 'baseball_mlb').ilike('settlement_source', '%retrosheet%')
  ),
  predictionHistoryCurrentProductionEligible: await safeCount('prediction_history', (query) =>
    query.eq('sport_key', 'baseball_mlb').eq('is_current', true).eq('production_eligible', true)
  ),
  historicalPregameEligibleGames: await safeCount('historical_baseball_games', (query) => query.eq('pregame_eligible', true)),
  historicalTrainingEligibleGames: await safeCount('historical_baseball_games', (query) => query.eq('training_eligible', true)),
  historicalNonHistoricalOnlyGames: await safeCount('historical_baseball_games', (query) => query.eq('historical_only', false)),
}

console.log(JSON.stringify(checks, null, 2))
