import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const envText = fs.readFileSync('.env.local', 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = value
    }
  }
}

function redacted(value) {
  return String(value ?? '').replace(/[A-Za-z0-9_=.:\-/+]{20,}/g, '[redacted]')
}

function envStatus(name) {
  const value = process.env[name] ?? ''
  return {
    present: value.length > 0,
    length: value.length,
  }
}

const tables = [
  'sports_sync_jobs',
  'sport_events',
  'sports_teams',
  'sport_players',
  'historical_source_registry',
  'historical_import_registry',
  'historical_raw_records',
  'historical_import_checkpoints',
  'historical_identity_foundation',
  'historical_baseball_games',
  'historical_baseball_lineups',
  'historical_baseball_substitutions',
  'historical_baseball_plays',
  'historical_baseball_pitcher_appearances',
  'historical_baseball_batter_appearances',
]

const recentImportsTable = 'historical_import_registry'

loadEnvLocal()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
let hostname = null
try {
  hostname = new URL(supabaseUrl).hostname
} catch {
  hostname = null
}

const output = {
  loadedEnvLocal: true,
  hostname,
  administrativeClientContract: {
    module: 'src/lib/supabase-admin.ts',
    urlVariable: 'NEXT_PUBLIC_SUPABASE_URL',
    credentialVariable: 'SUPABASE_SERVICE_ROLE_KEY',
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: envStatus('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: envStatus('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: envStatus('SUPABASE_SERVICE_ROLE_KEY'),
  },
  adminCredentialPresent: serviceRoleKey.length > 0,
  queries: [],
  providerCallsMade: 0,
  productionMutationsMade: 0,
}

if (!supabaseUrl || !serviceRoleKey) {
  console.log(JSON.stringify(output, null, 2))
  process.exit(2)
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

for (const table of tables) {
  try {
    const result = await client
      .from(table)
      .select('*', { count: 'exact', head: true })
      .limit(0)

    output.queries.push({
      table,
      status: result.status,
      count: result.count,
      error: result.error
        ? {
            code: result.error.code ?? null,
            message: redacted(result.error.message),
            details: redacted(result.error.details),
            hint: redacted(result.error.hint),
          }
        : null,
    })
  } catch (error) {
    output.queries.push({
      table,
      status: 'throw',
      count: null,
      error: {
        message: redacted(error instanceof Error ? error.message : error),
      },
    })
  }
}

try {
  const recent = await client
    .from(recentImportsTable)
    .select('id,status,started_at,finished_at,file_count,game_count,raw_record_count,normalized_record_count,error_count,provider_calls_made,remote_mutations_made')
    .eq('source', 'retrosheet')
    .eq('sport_key', 'baseball_mlb')
    .eq('season', '2025')
    .order('started_at', { ascending: false })
    .limit(3)
  output.recentRetrosheetImports = recent.error
    ? {
        error: {
          code: recent.error.code ?? null,
          message: redacted(recent.error.message),
        },
      }
    : recent.data
} catch (error) {
  output.recentRetrosheetImports = {
    error: {
      message: redacted(error instanceof Error ? error.message : error),
    },
  }
}

console.log(JSON.stringify(output, null, 2))
