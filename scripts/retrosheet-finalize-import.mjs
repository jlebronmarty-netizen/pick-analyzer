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

const importId = process.argv[2]
if (!importId) {
  throw new Error('Usage: node scripts/retrosheet-finalize-import.mjs <import-id>')
}

loadEnvLocal()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tables = {
  historical_source_registry: 61,
  historical_raw_records: 399497,
  historical_import_checkpoints: 30,
  historical_identity_foundation: 3930,
  historical_baseball_games: 2430,
  historical_baseball_lineups: 76135,
  historical_baseball_substitutions: 27535,
  historical_baseball_plays: 216845,
  historical_baseball_pitcher_appearances: 20870,
  historical_baseball_batter_appearances: 189311,
}

const observed = {}
for (const table of Object.keys(tables)) {
  const result = await client.from(table).select('*', { count: 'exact', head: true }).limit(0)
  if (result.error) throw new Error(`${table} count failed: ${result.error.message}`)
  observed[table] = result.count
  if (result.count !== tables[table]) {
    throw new Error(`${table} count mismatch: expected ${tables[table]}, observed ${result.count}`)
  }
}

const normalizedRecordCount =
  tables.historical_baseball_games +
  tables.historical_baseball_lineups +
  tables.historical_baseball_substitutions +
  tables.historical_baseball_plays +
  tables.historical_baseball_pitcher_appearances +
  tables.historical_baseball_batter_appearances

const update = await client
  .from('historical_import_registry')
  .update({
    status: 'completed',
    finished_at: new Date().toISOString(),
    file_count: 61,
    game_count: 2430,
    raw_record_count: 399497,
    normalized_record_count: normalizedRecordCount,
    warning_count: 98,
    error_count: 0,
    warnings: ['Second idempotency run completed deterministic upserts; final registry update reconciled after client header timeout.'],
    errors: [],
    provider_calls_made: 0,
    remote_mutations_made: 953662,
    checkpoint: { completedFiles: 30, batchSize: 500, reconciledAfterClientTimeout: true },
    metadata: {
      observed,
      idempotencyCertification: 'RETROSHEET_IMPORT_IDEMPOTENCY_PASS',
      providerCallsMade: 0,
      productionIsolation: {
        historicalOnly: true,
        postgameKnown: true,
        trainingEligible: false,
        pregameEligible: false,
      },
    },
  })
  .eq('id', importId)
  .eq('source', 'retrosheet')
  .eq('sport_key', 'baseball_mlb')
  .eq('season', '2025')
  .eq('status', 'running')
  .select('id,status,finished_at,file_count,game_count,raw_record_count,normalized_record_count,error_count,provider_calls_made,remote_mutations_made')
  .single()

if (update.error) throw new Error(`historical_import_registry finalize failed: ${update.error.message}`)

console.log(JSON.stringify({
  success: true,
  finalizedImportPresent: Boolean(update.data?.id),
  status: update.data?.status,
  fileCount: update.data?.file_count,
  gameCount: update.data?.game_count,
  rawRecordCount: update.data?.raw_record_count,
  normalizedRecordCount: update.data?.normalized_record_count,
  errorCount: update.data?.error_count,
  providerCallsMade: update.data?.provider_calls_made,
  remoteMutationsMade: update.data?.remote_mutations_made,
}, null, 2))
