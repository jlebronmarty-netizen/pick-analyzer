import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!match || process.env[match[1]] !== undefined) continue
  let value = match[2].trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
  process.env[match[1]] = value
}

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tables = [
  'historical_feature_snapshots',
  'prediction_history',
  'sport_events',
  'sports_odds_snapshots',
  'sports_sync_jobs',
  'historical_import_registry',
  'historical_import_checkpoints',
  'ai_performance_snapshots',
  'model_weight_history',
  'operating_days',
  'operating_day_lifecycle_events',
  'sport_player_stats',
  'sport_game_stats',
  'sport_lineups',
]

async function timed(label, fn) {
  const started = performance.now()
  try {
    const result = await fn()
    return { label, durationMs: Math.round(performance.now() - started), ...result }
  } catch (error) {
    return { label, durationMs: Math.round(performance.now() - started), error: error instanceof Error ? error.message : String(error) }
  }
}

async function estimatedCount(table) {
  return timed(`${table} estimated count`, async () => {
    const { count, error } = await client.from(table).select('id', { count: 'estimated', head: true })
    return { table, count: count ?? null, error: error?.message ?? null }
  })
}

async function sample(table) {
  return timed(`${table} sample`, async () => {
    const { data, error } = await client.from(table).select('*').limit(1)
    return {
      table,
      rows: data?.length ?? 0,
      columns: data?.[0] ? Object.keys(data[0]).length : 0,
      sampleBytes: data?.[0] ? Buffer.byteLength(JSON.stringify(data[0]), 'utf8') : 0,
      error: error?.message ?? null,
    }
  })
}

async function safeHead(label, queryFactory) {
  return timed(label, async () => {
    const { count, error } = await queryFactory()
    return { count: count ?? null, error: error?.message ?? null }
  })
}

async function safeRows(label, queryFactory) {
  return timed(label, async () => {
    const { data, error } = await queryFactory()
    return { rows: data?.length ?? 0, data: data ?? [], error: error?.message ?? null }
  })
}

const tableCounts = []
const samples = []
for (const table of tables) {
  tableCounts.push(await estimatedCount(table))
  samples.push(await sample(table))
}

const baseline = {
  retrosheetSnapshots: await safeHead('retrosheet scoped snapshots estimated count', () =>
    client.from('historical_feature_snapshots').select('id', { count: 'estimated', head: true })
      .eq('sport_key', 'baseball_mlb')
      .eq('market', 'historical_mlb_feature_store')
      .like('deterministic_key', 'retrosheet_mlb_feature_store_v1:%')
  ),
  historicalGames: await safeHead('historical baseball games estimated count', () =>
    client.from('historical_baseball_games').select('id', { count: 'estimated', head: true })
  ),
  predictionHistory: await safeHead('prediction history estimated count', () =>
    client.from('prediction_history').select('id', { count: 'estimated', head: true })
  ),
  settlementPending: await safeHead('prediction settlement pending exact count', () =>
    client.from('prediction_history').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  ),
  settlementWin: await safeHead('prediction settlement win exact count', () =>
    client.from('prediction_history').select('id', { count: 'exact', head: true }).eq('result', 'win')
  ),
  settlementLoss: await safeHead('prediction settlement loss exact count', () =>
    client.from('prediction_history').select('id', { count: 'exact', head: true }).eq('result', 'loss')
  ),
  settlementPush: await safeHead('prediction settlement push exact count', () =>
    client.from('prediction_history').select('id', { count: 'exact', head: true }).eq('result', 'push')
  ),
  learningWeights: await safeHead('model weight history estimated count', () =>
    client.from('model_weight_history').select('id', { count: 'estimated', head: true })
  ),
  aiSnapshots: await safeHead('ai performance snapshots estimated count', () =>
    client.from('ai_performance_snapshots').select('id', { count: 'estimated', head: true })
  ),
  latestBackfill: await safeRows('latest local backfill job', () =>
    client.from('historical_import_registry')
      .select('id,status,game_count,normalized_record_count,provider_calls_made,remote_mutations_made,checkpoint,metadata,started_at,finished_at')
      .eq('source', 'retrosheet')
      .eq('sport_key', 'baseball_mlb')
      .eq('season', '2025')
      .order('started_at', { ascending: false })
      .limit(3)
  ),
  localBackfillCheckpoints: await safeHead('local backfill checkpoints exact count', () =>
    client.from('historical_import_checkpoints')
      .select('id', { count: 'exact', head: true })
      .like('id', 'retrosheet_local_feature_checkpoint:%')
  ),
}

const health = {
  runningJobs: await safeRows('running sync/import jobs', async () => {
    const sync = await client.from('sports_sync_jobs').select('id,job_type,status,started_at,metadata').eq('status', 'running').limit(25)
    return sync
  }),
  recentSyncJobs: await safeRows('recent sync jobs', () =>
    client.from('sports_sync_jobs').select('id,job_type,provider,status,records_fetched,records_inserted,records_updated,records_skipped,error_count,started_at,completed_at,metadata').order('started_at', { ascending: false }).limit(15)
  ),
}

const catalogExposure = []
for (const table of ['pg_stat_user_tables', 'pg_statio_user_tables', 'pg_stat_database', 'pg_locks', 'pg_stat_activity', 'pg_indexes']) {
  catalogExposure.push(await timed(`${table} exposure`, async () => {
    const { data, error } = await client.from(table).select('*').limit(1)
    return { table, rows: data?.length ?? 0, error: error?.message ?? null, code: error?.code ?? null }
  }))
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  readOnly: true,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  tableCounts,
  samples,
  baseline: {
    retrosheetSnapshots: baseline.retrosheetSnapshots,
    historicalGames: baseline.historicalGames,
    predictionHistory: baseline.predictionHistory,
    learningWeights: baseline.learningWeights,
    aiSnapshots: baseline.aiSnapshots,
    localBackfillCheckpoints: baseline.localBackfillCheckpoints,
    settlementPending: baseline.settlementPending,
    settlementWin: baseline.settlementWin,
    settlementLoss: baseline.settlementLoss,
    settlementPush: baseline.settlementPush,
    settlementCounts: {
      pending: baseline.settlementPending.count,
      wins: baseline.settlementWin.count,
      losses: baseline.settlementLoss.count,
      pushes: baseline.settlementPush.count,
    },
    latestBackfillRows: baseline.latestBackfill.rows,
    latestBackfill: (baseline.latestBackfill.data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      gameCount: row.game_count,
      normalizedRecordCount: row.normalized_record_count,
      providerCallsMade: row.provider_calls_made,
      remoteMutationsMade: row.remote_mutations_made,
      checkpoint: row.checkpoint,
      workerVersion: row.metadata?.workerVersion ?? null,
      processedGames: row.metadata?.processedGames ?? null,
      insertedRows: row.metadata?.insertedRows ?? null,
      updatedRows: row.metadata?.updatedRows ?? null,
      skippedRows: row.metadata?.skippedRows ?? null,
      resumedBatches: row.metadata?.resumedBatches ?? null,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  },
  health: {
    runningJobs: {
      ...health.runningJobs,
      data: (health.runningJobs.data ?? []).map((row) => ({
        id: row.id,
        jobType: row.job_type,
        status: row.status,
        startedAt: row.started_at,
      })),
    },
    recentSyncJobs: {
      ...health.recentSyncJobs,
      data: (health.recentSyncJobs.data ?? []).map((row) => ({
        id: row.id,
        jobType: row.job_type,
        provider: row.provider,
        status: row.status,
        recordsFetched: row.records_fetched,
        recordsInserted: row.records_inserted,
        recordsUpdated: row.records_updated,
        recordsSkipped: row.records_skipped,
        errorCount: row.error_count,
        providerCallsUsed: row.metadata?.providerCallsMade ?? row.metadata?.externalCallsUsed ?? row.metadata?.checkpoint?.providerCallsUsed ?? 0,
        startedAt: row.started_at,
        completedAt: row.completed_at,
      })),
    },
  },
  catalogExposure,
  platformMetricsUnavailableFromRest: [
    'pg_total_relation_size',
    'pg_indexes sizes',
    'pg_stat_user_tables dead tuples/autovacuum',
    'pg_stat_database cache hit ratio',
    'pg_locks blocked sessions',
    'pg_stat_activity long-running/idle-in-transaction sessions',
  ],
}, null, 2))
