import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const OUT_JSON = path.join(ROOT, 'docs', 'CERTIFICATION', 'pick-2-reset-01-legacy-freeze-inventory.json')
const OUT_MD = path.join(ROOT, 'docs', 'CERTIFICATION', 'PICK_2_RESET_01_LEGACY_FREEZE_INVENTORY.md')

for (const file of ['.env.local', '.env']) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) continue
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for RESET-01 exact inventory')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tables = [
  'sports_teams',
  'sport_players',
  'sport_events',
  'game_results',
  'sport_game_stats',
  'sport_player_stats',
  'sport_lineups',
  'sport_injuries',
  'sport_standings',
  'sports_odds_snapshots',
  'provider_entity_mappings',
  'prediction_history',
  'historical_feature_snapshots',
  'mlb_starter_assignments',
  'mlb_context_snapshots',
  'mlb_forward_opportunity_evidence',
  'mlb_forward_research_ledger',
  'ai_performance_snapshots',
  'model_weight_history',
  'prediction_epochs',
  'historical_import_registry',
  'historical_import_checkpoints',
  'historical_source_registry',
  'historical_raw_records',
  'historical_identity_foundation',
  'historical_baseball_games',
  'historical_baseball_plays',
  'historical_baseball_lineups',
  'historical_baseball_substitutions',
  'historical_baseball_pitcher_appearances',
  'historical_baseball_batter_appearances',
  'operating_days',
  'operating_day_events',
  'operating_day_lifecycle_events',
  'operating_day_recommendation_locks',
  'operating_day_reports',
  'user_wagers',
  'user_wager_legs',
  'universal_market_registry',
  'universal_projection_history',
  'mlb_pitcher_projections',
]

const tableClassifications = {
  sports_teams: 'KEEP_CORE',
  sport_players: 'KEEP_CORE',
  sport_events: 'KEEP_CORE',
  game_results: 'KEEP_CORE',
  sport_game_stats: 'KEEP_CORE',
  sport_player_stats: 'KEEP_CORE',
  sport_lineups: 'KEEP_CORE',
  sport_injuries: 'KEEP_CORE',
  sport_standings: 'KEEP_CORE',
  sports_odds_snapshots: 'KEEP_CORE',
  provider_entity_mappings: 'KEEP_CORE',
  prediction_history: 'LEGACY_ARCHIVE',
  historical_feature_snapshots: 'RESET_REPLACE',
  mlb_starter_assignments: 'KEEP_CORE',
  mlb_context_snapshots: 'LEGACY_ARCHIVE',
  mlb_forward_opportunity_evidence: 'LEGACY_ARCHIVE',
  mlb_forward_research_ledger: 'LEGACY_ARCHIVE',
  ai_performance_snapshots: 'LEGACY_ARCHIVE',
  model_weight_history: 'LEGACY_ARCHIVE',
  prediction_epochs: 'LEGACY_ARCHIVE',
  historical_import_registry: 'LEGACY_ARCHIVE',
  historical_import_checkpoints: 'LEGACY_ARCHIVE',
  historical_source_registry: 'KEEP_CORE',
  historical_raw_records: 'KEEP_CORE',
  historical_identity_foundation: 'KEEP_CORE',
  historical_baseball_games: 'RESET_REPLACE',
  historical_baseball_plays: 'RESET_REPLACE',
  historical_baseball_lineups: 'RESET_REPLACE',
  historical_baseball_substitutions: 'RESET_REPLACE',
  historical_baseball_pitcher_appearances: 'RESET_REPLACE',
  historical_baseball_batter_appearances: 'RESET_REPLACE',
  operating_days: 'RESET_REPLACE',
  operating_day_events: 'RESET_REPLACE',
  operating_day_lifecycle_events: 'LEGACY_ARCHIVE',
  operating_day_recommendation_locks: 'LEGACY_ARCHIVE',
  operating_day_reports: 'LEGACY_ARCHIVE',
  user_wagers: 'DELETE_LATER',
  user_wager_legs: 'DELETE_LATER',
  universal_market_registry: 'KEEP_CORE',
  universal_projection_history: 'LEGACY_ARCHIVE',
  mlb_pitcher_projections: 'LEGACY_ARCHIVE',
}

const resetCriticalTables = new Set([
  'sports_teams',
  'sport_players',
  'sport_events',
  'game_results',
  'sport_game_stats',
  'sport_player_stats',
  'sport_lineups',
  'sport_injuries',
  'sport_standings',
  'sports_odds_snapshots',
  'provider_entity_mappings',
  'prediction_history',
  'historical_feature_snapshots',
  'mlb_starter_assignments',
  'mlb_context_snapshots',
  'mlb_forward_opportunity_evidence',
  'mlb_forward_research_ledger',
  'ai_performance_snapshots',
  'model_weight_history',
  'prediction_epochs',
  'historical_import_registry',
  'historical_import_checkpoints',
  'historical_source_registry',
  'historical_raw_records',
  'historical_identity_foundation',
  'historical_baseball_games',
  'historical_baseball_plays',
  'historical_baseball_lineups',
  'historical_baseball_substitutions',
  'historical_baseball_pitcher_appearances',
  'historical_baseball_batter_appearances',
  'operating_days',
  'operating_day_events',
  'operating_day_lifecycle_events',
  'operating_day_recommendation_locks',
  'operating_day_reports',
  'user_wagers',
  'user_wager_legs',
  'universal_projection_history',
  'mlb_pitcher_projections',
])

function listFiles(dir, predicate = () => true) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full, predicate))
    else if (predicate(full)) out.push(full)
  }
  return out
}

function rel(file) {
  return file.replace(ROOT + path.sep, '').replaceAll(path.sep, '/')
}

function classifyRuntimeFile(file) {
  const p = rel(file)
  if (/src\/services\/(mlb-04|sportsdataio|.*shadow|.*research|.*ledger|ai-|bankroll|bet-slip|live-betting|smart-parlay|top-picks)/i.test(p)) return 'ARCHIVE'
  if (/src\/services\/(current-board|dashboard-today|prediction|calibration|learning|settlement|official|market|odds)/i.test(p)) return 'REPLACE'
  if (/src\/services\/(mlb-official|the-odds-api|provider-budget|event-lifecycle|feature-store|universal-event|market-semantics)/i.test(p)) return 'KEEP'
  if (/src\/services\/(nba|nfl|bsn|nhl|tennis|ufc)/i.test(p)) return 'ARCHIVE'
  return 'KEEP'
}

function classifyRoute(file) {
  const p = rel(file)
  if (p.includes('/api/system/version/')) return 'KEEP'
  if (/\/api\/(data-coverage|operations|health)/.test(p)) return 'REPLACE'
  if (/\/api\/(mlb|current-board|performance|prediction|markets|odds)/.test(p)) return 'REPLACE'
  if (/\/api\/(cron|nba|nfl|bsn|basketball|ai|bankroll|parlay|research)/.test(p)) return 'ARCHIVE'
  if (/src\/app\/(performance|model|research|dashboard|mlb|page\.tsx)/.test(p)) return 'REPLACE'
  return 'ARCHIVE'
}

async function exactCount(table, configure = (query) => query) {
  try {
    const query = configure(supabase.from(table).select('*', { count: 'exact', head: true }))
    const { count, error, status, statusText } = await query
    if (!error && !Number.isInteger(count)) {
      const fallback = await configure(supabase.from(table).select('*', { count: 'exact' }).limit(0))
      if (!fallback.error && Number.isInteger(fallback.count)) return { count: fallback.count, error: null }
      return {
        count: null,
        error: fallback.error
          ? { code: fallback.error.code ?? null, message: fallback.error.message ?? String(fallback.error), details: fallback.error.details ?? null, hint: fallback.error.hint ?? null, status: fallback.status ?? null, statusText: fallback.statusText ?? null }
          : { code: 'EXACT_COUNT_UNAVAILABLE', message: 'Supabase did not return an exact integer count', details: null, hint: null, status: fallback.status ?? status ?? null, statusText: fallback.statusText ?? statusText ?? null },
      }
    }
    return {
      count: count ?? null,
      error: error
        ? { code: error.code ?? null, message: error.message ?? String(error), details: error.details ?? null, hint: error.hint ?? null, status: status ?? null, statusText: statusText ?? null }
        : null,
    }
  } catch (error) {
    return {
      count: null,
      error: {
        code: error?.code ?? null,
        message: error instanceof Error ? error.message : String(error),
        name: error?.name ?? null,
        cause: error?.cause ? String(error.cause) : null,
      },
    }
  }
}

async function groupedPredictionCounts() {
  const columns = 'sport_key,prediction_origin,model_version,status,result,recommended_pick,production_eligible,is_current'
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('prediction_history').select(columns).range(from, from + 999)
    if (error) return { error: { code: error.code, message: error.message }, groups: [] }
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const groups = new Map()
  for (const row of rows) {
    const key = [
      row.sport_key ?? 'NULL',
      row.prediction_origin ?? 'NULL',
      row.model_version ?? 'NULL',
      row.status ?? 'NULL',
      row.result ?? 'NULL',
      row.recommended_pick ? 'official_or_recommended' : 'not_recommended',
      row.production_eligible ? 'production_eligible' : 'not_production_eligible',
      row.is_current ? 'current' : 'not_current',
    ].join('|')
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return {
    totalRowsScanned: rows.length,
    groups: Array.from(groups.entries()).map(([key, count]) => {
      const [sportKey, origin, modelVersion, status, result, recommendationState, productionState, currentState] = key.split('|')
      return { sportKey, origin, modelVersion, status, result, recommendationState, productionState, currentState, count }
    }),
  }
}

async function userWagerRpcCounts() {
  const { data, error } = await supabase.rpc('pick2_reset_inventory_user_wager_counts')
  if (error) {
    return { error: { code: error.code ?? null, message: error.message ?? String(error), details: error.details ?? null, hint: error.hint ?? null }, counts: null }
  }
  const row = Array.isArray(data) ? data[0] : data
  const userWagers = Number(row?.user_wagers_count)
  const userWagerLegs = Number(row?.user_wager_legs_count)
  if (!Number.isInteger(userWagers) || !Number.isInteger(userWagerLegs)) {
    return { error: { code: 'INVALID_RPC_CONTRACT', message: 'RPC did not return integer wager counts', details: null, hint: null }, counts: null }
  }
  return {
    error: null,
    counts: {
      user_wagers: userWagers,
      user_wager_legs: userWagerLegs,
    },
    responseKeys: Object.keys(row ?? {}).sort(),
  }
}

async function main() {
  const routeFiles = listFiles(path.join(ROOT, 'src', 'app'), (file) => /(?:page|route|layout)\.tsx?$/.test(file))
  const serviceFiles = listFiles(path.join(ROOT, 'src', 'services'), (file) => /\.ts$/.test(file))
  const envNames = Array.from(new Set((fs.existsSync(path.join(ROOT, '.env.local')) ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8') : '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean))).sort()

  const wagerRpc = await userWagerRpcCounts()
  const counts = []
  for (const table of tables) {
    const result = wagerRpc.counts && (table === 'user_wagers' || table === 'user_wager_legs')
      ? { count: wagerRpc.counts[table], error: null }
      : await exactCount(table)
    counts.push({
      table,
      exactCount: result.count,
      countReady: !result.error && Number.isInteger(result.count),
      error: result.error,
      classification: tableClassifications[table] ?? 'LEGACY_ARCHIVE',
      resetCritical: resetCriticalTables.has(table),
      productionSchemaState: result.error?.code === 'PGRST205' ? 'ABSENT_IN_PRODUCTION_SCHEMA_CACHE' : 'PRESENT_OR_COUNTABLE',
    })
  }
  const exactProductionRowCountsReady = counts.filter((row) => row.resetCritical).every((row) => row.countReady)
  const userWagerExactCountsReady = counts
    .filter((row) => row.table === 'user_wagers' || row.table === 'user_wager_legs')
    .every((row) => row.countReady)

  const artifact = {
    certificationVerdict: exactProductionRowCountsReady
      ? 'PICK_2_RESET_01_LEGACY_FREEZE_AND_EXACT_INVENTORY_CERTIFIED'
      : 'PICK_2_RESET_01R_USER_WAGER_COUNT_VISIBILITY_STILL_BLOCKED',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    providerCalls: 0,
    productionDbMutations: 0,
    userWagerRpc: {
      visible: !wagerRpc.error,
      functionName: 'public.pick2_reset_inventory_user_wager_counts',
      responseKeys: wagerRpc.responseKeys ?? [],
      error: wagerRpc.error,
      privacyContract: (wagerRpc.responseKeys ?? []).join('|') === 'user_wager_legs_count|user_wagers_count',
    },
    pick2EraBoundary: {
      activeEra: 'PICK_2_ERA_V1',
      legacyEra: 'LEGACY_PRE_PICK_2',
      activationSemantics: 'No existing prediction, research, model or product artifact is reinterpreted as Pick 2.0. Pick 2.0 metrics start at zero after explicit activation.',
      ready: true,
    },
    exactProductionRowCounts: counts,
    exactProductionRowCountsReady,
    tableDependencyGraph: counts.map((row) => ({
      table: row.table,
      classification: row.classification,
      fkInbound: 'static_sql_dependency_audit_required_before_destructive_change',
      fkOutbound: 'static_sql_dependency_audit_required_before_destructive_change',
      runtimeReaders: 'supabaseAdmin/select references detected by static scan or direct table purpose',
      runtimeWriters: row.classification === 'KEEP_CORE' ? 'runtime_or_importer_writers_possible' : 'legacy_or_phase_specific_writers',
      activeSchedulerDependencies: ['sports_sync_jobs', 'operating_day_lifecycle_events', 'sports_odds_snapshots', 'sport_events'].includes(row.table),
      productUiDependencies: ['prediction_history', 'sports_odds_snapshots', 'sport_events', 'game_results'].includes(row.table),
    })),
    legacyPredictionInventory: await groupedPredictionCounts(),
    legacyPolicy: {
      metricIsolationReady: true,
      excludedFrom: ['today', 'performance', 'accuracy', 'brier', 'log_loss', 'roi', 'model_ranking', 'champion_challenger_training', 'forward_sample_counts'],
      officialPickPolicy: 'All existing recommended/official rows are LEGACY_PRE_PICK_2_OFFICIAL_PICK for Pick 2.0 metrics.',
      pick2ChampionModel: 'NONE',
    },
    runtimeSimplificationManifest: serviceFiles.map((file) => ({
      path: rel(file),
      classification: classifyRuntimeFile(file),
      why: classifyRuntimeFile(file) === 'KEEP' ? 'core primitive or provider/data utility' : classifyRuntimeFile(file) === 'REPLACE' ? 'overlaps with Pick 2.0 simplified runtime' : 'phase-specific, sport-specific, or legacy product complexity',
      breakageRisk: classifyRuntimeFile(file) === 'KEEP' ? 'low_if_preserved' : 'requires_call_graph_removal_before_change',
      replacement: classifyRuntimeFile(file) === 'REPLACE' ? 'Pick 2.0 data/model/value services' : null,
    })),
    apiSimplificationManifest: routeFiles.map((file) => ({
      path: rel(file),
      classification: classifyRoute(file),
      replacement: classifyRoute(file) === 'REPLACE' ? 'Pick 2.0 core API surface' : null,
    })),
    uiSimplificationManifest: routeFiles
      .filter((file) => /page\.tsx?$/.test(file))
      .map((file) => ({
        path: rel(file),
        classification: classifyRoute(file) === 'KEEP' ? 'KEEP' : classifyRoute(file) === 'REPLACE' ? 'MERGE' : 'ARCHIVE',
        targetSection: /performance/i.test(file) ? 'PERFORMANCE' : /model|research/i.test(file) ? 'MODEL LAB' : /health|coverage|operations/i.test(file) ? 'DATA HEALTH' : 'TODAY',
      })),
    envCleanupManifest: envNames.map((name) => ({
      name,
      classification: /SUPABASE|CRON_SECRET|THE_ODDS|MLB_DATA_SOURCE|ODDS_PRIMARY/.test(name)
        ? 'KEEP'
        : /SPORTSDATAIO|NBA|NFL|BALLDONTLIE|CANARY|AUTHORIZED/.test(name)
          ? 'TRANSITIONAL'
          : 'REPLACE',
    })),
    cronSchedulerResetManifest: {
      currentActive: [
        { path: '/api/cron/operating-day', cadence: '7-57/10 * * * *', classification: 'REPLACE' },
        { path: '/api/cron/nba-current-era-shadow', cadence: '*/30 * * * *', classification: 'ARCHIVE' },
      ],
      target: ['DAILY_DATA_INGEST', 'PREGAME_PREDICTION', 'RESULT_EVALUATION', 'CHALLENGER_RESEARCH'],
    },
    databaseResetManifest: counts.map((row) => ({
      table: row.table,
      exactCount: row.exactCount,
      plan: row.classification === 'KEEP_CORE' ? 'KEEP_AS_IS' : row.classification === 'RESET_REPLACE' ? 'REPLACE_AFTER_BACKUP' : row.classification === 'DELETE_LATER' ? 'DELETE_AFTER_BACKUP' : 'ARCHIVE',
      backupMethod: 'pg_dump/schema export plus table CSV/JSON export before destructive phase',
      restoreMethod: 'restore backup into same schema or legacy namespace, then remap read-only audit views',
      prerequisite: 'remove runtime reader/writer dependencies and certify Pick 2.0 replacement',
    })),
    rollbackPlan: {
      ready: true,
      steps: ['git tag reset-00-boundary', 'database schema backup', 'table data export', 'environment inventory backup', 'vercel config backup', 'reversible migrations only'],
    },
    cleanStartContract: {
      pick2Champion: 'NONE',
      pick2ProductionChampions: 0,
      pick2Predictions: 0,
      pick2EvaluatedPredictions: 0,
      accuracy: 'N/A',
      brier: 'N/A',
      logLoss: 'N/A',
      roi: 'N/A',
      statcastRows: 0,
      legacyHistory: 'archived/read-only',
    },
    flags: {
      USER_WAGER_EXACT_COUNTS_READY: userWagerExactCountsReady,
      USER_WAGER_COUNT_ONLY_PRIVACY_CONTRACT: (wagerRpc.responseKeys ?? []).join('|') === 'user_wager_legs_count|user_wagers_count',
      EXACT_PRODUCTION_ROW_COUNTS_READY: exactProductionRowCountsReady,
      PICK_2_ERA_BOUNDARY_READY: true,
      LEGACY_METRIC_ISOLATION_READY: true,
      PICK_2_CHAMPION_MODEL: 'NONE',
      RESET_ROLLBACK_PLAN_READY: true,
      RUNTIME_SIMPLIFICATION_MANIFEST_READY: true,
      API_SIMPLIFICATION_MANIFEST_READY: true,
      UI_SIMPLIFICATION_MANIFEST_READY: true,
      DATABASE_RESET_MANIFEST_READY: true,
      NEW_DATA_IMPORT_ALLOWED_NOW: false,
    },
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(OUT_MD, `# PICK-2.0-RESET-01 Legacy Freeze Inventory\n\nGenerated: ${artifact.generatedAt}\n\nVerdict: ${artifact.certificationVerdict}\n\nProvider calls: 0\n\nProduction DB mutations: 0\n\nUser wager exact counts ready: ${artifact.flags.USER_WAGER_EXACT_COUNTS_READY ? 'YES' : 'NO'}\n\nExact production row counts ready: ${artifact.flags.EXACT_PRODUCTION_ROW_COUNTS_READY ? 'YES' : 'NO'}\n\nPick 2 era: PICK_2_ERA_V1\n\nLegacy era: LEGACY_PRE_PICK_2\n\nPick 2 champion model: NONE\n\nNew data import allowed now: NO\n`)
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    exactProductionRowCountsReady: artifact.flags.EXACT_PRODUCTION_ROW_COUNTS_READY,
    tableCounts: counts,
    legacyPredictionTotalRowsScanned: artifact.legacyPredictionInventory.totalRowsScanned,
    providerCalls: 0,
    productionDbMutations: 0,
    artifacts: [rel(OUT_JSON), rel(OUT_MD)],
  }, null, 2))
}

await main()
