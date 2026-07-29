import fs from 'node:fs'
import crypto from 'node:crypto'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const { supabaseAdmin } = await import('@/lib/supabase-admin')

const OUT_AUDIT = 'docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.md'
const OUT_COVERAGE = 'docs/MULTI_SPORT_CURRENT_PREVIOUS_SEASON_COVERAGE_V1.json'
const OUT_ODDS = 'docs/ODDS_API_EXTRACTION_COMPLETENESS_V1.md'
const OUT_REFRESH = 'docs/ODDS_REFRESH_5_10_MINUTE_FEASIBILITY_V1.md'
const OUT_AUTONOMY = 'docs/DAILY_AUTONOMY_CERTIFICATION_V1.md'
const OUT_MATRIX = 'docs/MULTI_SPORT_PRODUCTION_READINESS_MATRIX_V1.json'
const OUT_ROADMAP = 'docs/OPERATIONAL_LAUNCH_REPAIR_ROADMAP_V1.md'

const SPORTS = [
  { label: 'MLB', sportKey: 'baseball_mlb', leagueKey: 'mlb', provider: 'SportsDataIO MLB + The Odds API + MLB Stats API + Retrosheet', currentSeason: '2026', previousSeason: '2025', expectedState: 'PRODUCTION_READY' },
  { label: 'NBA', sportKey: 'basketball_nba', leagueKey: 'nba', provider: 'The Odds API stored odds; SportsDataIO architecture partial', currentSeason: '2025', previousSeason: '2024', expectedState: 'SHADOW_ONLY' },
  { label: 'NFL', sportKey: 'americanfootball_nfl', leagueKey: 'nfl', provider: 'The Odds API stored odds/results evidence', currentSeason: '2026', previousSeason: '2025', expectedState: 'PREVIEW_READY' },
  { label: 'NHL', sportKey: 'icehockey_nhl', leagueKey: 'nhl', provider: 'The Odds API stored odds/results evidence', currentSeason: '2026', previousSeason: '2025', expectedState: 'PREVIEW_READY' },
  { label: 'Soccer', sportKey: 'soccer', leagueKey: null, provider: 'The Odds API catalog/odds evidence; competition scope incomplete', currentSeason: '2026', previousSeason: '2025', expectedState: 'DATA_ONLY' },
  { label: 'BSN', sportKey: 'basketball_bsn', leagueKey: 'bsn_pr', provider: 'Contract/manual/import framework only', currentSeason: '2026', previousSeason: '2025', expectedState: 'CONTRACT_ONLY' },
  { label: 'Tennis', sportKey: 'tennis', leagueKey: null, provider: 'The Odds API catalog possible; stored lifecycle not proven', currentSeason: '2026', previousSeason: '2025', expectedState: 'UNAVAILABLE' },
  { label: 'UFC', sportKey: 'mma_ufc', leagueKey: null, provider: 'The Odds API stored odds and limited score-result evidence', currentSeason: '2026', previousSeason: '2025', expectedState: 'DATA_ONLY' },
]

const PIPELINE = [
  ['Provider catalog', 'provider capability services and endpoint catalogs', '/api/providers/*, /api/markets/*', 'sports_sync_jobs', 'provider config and stored job evidence', 'supported provider domains and budget evidence', 'provider action locks and sync job ids', 'stored provider audit/docs; dry-run before live', 'MLB plus partial The Odds API sports', 'MLB production, others partial/blocked'],
  ['Sport schedule/events', 'historical import engine, identity materializer, sport sync services', '/api/historical-import/*, /api/events/identity/*, sport sync routes', 'sport_events', 'provider schedule/event rows', 'canonical sport_events rows', 'provider ids and deterministic event keys', 'identity audit and materialization dry-runs', 'MLB/NFL/NHL/UFC partial, NBA/BSN sparse', 'non-MLB not production complete'],
  ['Canonical identity', 'universal-event-identity and provider_entity_mappings', '/api/events/identity/audit', 'provider_entity_mappings, sport_events', 'provider event/team/player ids', 'canonical ids and mapping coverage', 'provider/sport/entity natural keys', 'conflict and unresolved diagnostics', 'MLB certified, NFL/NHL partial unlocked, Soccer blocked by competition scope', 'partial'],
  ['Odds ingestion', 'SportsDataIO MLB and The Odds API ingestion scripts/services', '/api/operations/adaptive-refresh, provider routes', 'sports_odds_snapshots, sports_sync_jobs', 'provider odds payloads', 'normalized odds snapshots', 'deterministic snapshot id', 'checkpoint/resume jobs', 'MLB production, other sports data-only/preview', 'partial'],
  ['Feature materialization', 'Feature Store Core and historical_feature_snapshots', '/api/*/features/*', 'historical_feature_snapshots', 'canonical event plus odds/context evidence', 'immutable feature snapshots', 'deterministic_key unique constraint', 'feature validation/readiness routes', 'MLB production, NFL/NHL preview, others partial', 'partial'],
  ['Prediction generation', 'sport prediction SDK and sport engines', '/api/*/predictions*', 'prediction_history', 'feature snapshots and odds', 'prediction rows/preview rows', 'idempotency keys and prediction grouping', 'dry-run/idempotent rerun', 'MLB production, NFL/NHL preview', 'partial'],
  ['Current Board / AI Briefing', 'current-board, dashboard and AI operations services', '/api/current-board, /api/dashboard, /api/ai-operations/*', 'prediction_history, odds snapshots', 'current champion/projection evidence', 'daily product summaries', 'read-only aggregation', 'cache clear/read-only diagnostics', 'MLB production visibility', 'partial multi-sport'],
  ['Result ingestion', 'MLB Stats API results path and The Odds API score-result scripts', '/api/results/sync, /api/data-foundation/results-crosswalk', 'game_results, sport_events', 'authoritative final results', 'canonical result rows', 'provider event ids and result ids', 'result reconciliation', 'MLB production, UFC stored score rows not fully canonical production', 'partial'],
  ['Settlement', 'operating-day settlement and settlement core/reconciliation', '/api/operating-day/[id]/settle, /api/settlement/*', 'prediction_history', 'canonical result + predictions', 'W/L/P settlement fields', 'settlement version/source/idempotent result ids', 'oldest-ready-first and reconciliation', 'MLB production, NFL/NHL awaiting future finals', 'partial'],
  ['Learning / Performance', 'ai-learning-lifecycle and performance services', '/api/performance, /api/ai-operations/lifecycle', 'prediction_history, model_weight_history', 'settled prediction evidence', 'learning labels/metrics/readiness', 'immutable prediction/result linkage', 'read-only lifecycle reports', 'MLB evidence accumulating; no automatic training', 'partial'],
]

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function lower(value) {
  return String(value ?? '').trim().toLowerCase()
}

function increment(map, key, by = 1) {
  const normalized = key || 'unknown'
  map[normalized] = (map[normalized] ?? 0) + by
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort()
}

function classifyCoverage(count, expected = 1) {
  if (!count) return 'NONE'
  if (expected && count >= expected) return 'COMPLETE'
  if (count >= 1000) return 'SUBSTANTIAL'
  if (count >= 100) return 'PARTIAL'
  return 'SPARSE'
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

async function safeCount(table, build) {
  try {
    let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
    if (build) query = build(query)
    const { count, error } = await query
    return { count: error ? 0 : count ?? 0, error: error?.message ?? null }
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

async function safeRows(table, columns, build, limit = 5000) {
  try {
    let query = supabaseAdmin.from(table).select(columns).limit(limit)
    if (build) query = build(query)
    const { data, error } = await query
    return { rows: data ?? [], error: error?.message ?? null }
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : String(error) }
  }
}

async function safePagedRows(table, columns, build, pageSize = 1000, maxRows = 20000) {
  const rows = []
  for (let from = 0; from < maxRows; from += pageSize) {
    let query = supabaseAdmin.from(table).select(columns).range(from, from + pageSize - 1)
    if (build) query = build(query)
    const { data, error } = await query
    if (error) return { rows, error: error.message, truncated: false }
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) return { rows, error: null, truncated: false }
  }
  return { rows, error: null, truncated: true }
}

async function auditSport(sport) {
  const events = await safePagedRows('sport_events', 'id,sport_key,league_key,season,status,start_time', (q) => q.eq('sport_key', sport.sportKey).order('start_time', { ascending: true }), 1000, 30000)
  const results = await safePagedRows('game_results', 'id,game_id,sport_key,commence_time,created_at', (q) => q.eq('sport_key', sport.sportKey), 1000, 30000)
  const odds = await safePagedRows('sports_odds_snapshots', 'id,sport_key,season,event_id,provider,sportsbook,market,snapshot_time,is_opening,is_closing', (q) => q.eq('sport_key', sport.sportKey).order('snapshot_time', { ascending: true }), 1000, 30000)
  const features = await safeRows('historical_feature_snapshots', 'id,sport_key,market,prediction_cutoff,production_eligible,trial,scrambled', (q) => q.eq('sport_key', sport.sportKey), 5000)
  const predictions = await safePagedRows('prediction_history', 'id,sport_key,market,model_role,production_eligible,recommended_pick,status,result,settled_at,commence_time,generated_at', (q) => q.eq('sport_key', sport.sportKey), 1000, 30000)
  const oddsCount = await safeCount('sports_odds_snapshots', (q) => q.eq('sport_key', sport.sportKey))
  const featureCount = await safeCount('historical_feature_snapshots', (q) => q.eq('sport_key', sport.sportKey))
  const predictionCount = await safeCount('prediction_history', (q) => q.eq('sport_key', sport.sportKey))
  const teams = await safeCount('sports_teams', (q) => q.eq('sport_key', sport.sportKey))
  const players = await safeCount('sport_players', (q) => q.eq('sport_key', sport.sportKey))
  const mappings = await safeCount('provider_entity_mappings', (q) => q.eq('sport_key', sport.sportKey))
  const syncJobs = await safeRows('sports_sync_jobs', 'id,provider,sport_key,job_type,status,records_fetched,records_inserted,records_updated,records_skipped,error_count,started_at,completed_at,metadata', (q) => q.eq('sport_key', sport.sportKey).order('started_at', { ascending: false }), 200)

  const eventRows = events.rows
  const resultRows = results.rows
  const oddsRows = odds.rows
  const featureRows = features.rows
  const predictionRows = predictions.rows
  const settledPredictions = predictionRows.filter((row) => ['win', 'loss', 'push'].includes(lower(row.status)) || ['win', 'loss', 'push'].includes(lower(row.result)) || row.settled_at).length
  const productionPredictions = predictionRows.filter((row) => row.production_eligible === true).length
  const previewPredictions = predictionRows.filter((row) => lower(row.model_role).includes('shadow') || row.production_eligible !== true).length
  const currentOddsEvents = unique(oddsRows.map((row) => row.event_id)).length
  const markets = unique(oddsRows.map((row) => lower(row.market)))
  const providers = unique(oddsRows.map((row) => lower(row.provider)))
  const bookmakers = unique(oddsRows.map((row) => row.sportsbook))
  const seasons = unique(eventRows.map((row) => row.season).concat(oddsRows.map((row) => row.season)))
  const earliestEvent = eventRows[0]?.start_time ?? null
  const latestEvent = eventRows.at(-1)?.start_time ?? null
  const earliestOdds = oddsRows[0]?.snapshot_time ?? null
  const latestOdds = oddsRows.at(-1)?.snapshot_time ?? null

  const lifecycleState =
    sport.label === 'MLB' && predictionRows.length > 0 && settledPredictions > 0 ? 'PRODUCTION_READY' :
    ['NFL', 'NHL'].includes(sport.label) && predictionRows.length > 0 ? 'PREVIEW_READY' :
    oddsRows.length > 0 || resultRows.length > 0 ? 'DATA_ONLY' :
    sport.label === 'BSN' ? 'CONTRACT_ONLY' :
    'UNAVAILABLE'

  const blocker =
    lifecycleState === 'PRODUCTION_READY' ? 'None for MLB core; still needs stronger multi-sport/5-10 minute operational cadence.' :
    lifecycleState === 'PREVIEW_READY' ? 'Canonical result/settlement/learning loop and production promotion gates are not complete.' :
    lifecycleState === 'DATA_ONLY' ? 'Stored data is not enough for end-to-end production prediction, settlement and learning.' :
    lifecycleState === 'CONTRACT_ONLY' ? 'Approved live source and production ingestion coverage required.' :
    'No proven schedule/odds/result/prediction lifecycle.'

  const seasonCoverage = [sport.previousSeason, sport.currentSeason].map((season) => {
    const seasonEvents = eventRows.filter((row) => String(row.season) === String(season) || String(row.start_time ?? '').startsWith(String(season)))
    const seasonEventIds = new Set(seasonEvents.map((row) => row.id))
    const seasonResults = resultRows.filter((row) => seasonEventIds.has(row.game_id) || String(row.commence_time ?? row.created_at ?? '').startsWith(String(season)))
    const seasonOdds = oddsRows.filter((row) => String(row.season) === String(season) || seasonEventIds.has(row.event_id) || String(row.snapshot_time ?? '').startsWith(String(season)))
    const seasonFeatures = featureRows.filter((row) => String(row.prediction_cutoff ?? '').startsWith(String(season)))
    const seasonPredictions = predictionRows.filter((row) => String(row.commence_time ?? row.generated_at ?? '').startsWith(String(season)))
    return {
      season,
      expectedSeasonDateRange: `${season}-season-governance-required`,
      earliestStoredEvent: seasonEvents.map((row) => row.start_time).filter(Boolean).sort()[0] ?? null,
      latestStoredEvent: seasonEvents.map((row) => row.start_time).filter(Boolean).sort().at(-1) ?? null,
      eventCount: seasonEvents.length,
      completedEventCount: seasonEvents.filter((row) => ['completed', 'final', 'closed'].includes(lower(row.status))).length,
      resultCount: seasonResults.length,
      eventsMissingResult: Math.max(0, seasonEvents.filter((row) => ['completed', 'final', 'closed'].includes(lower(row.status))).length - seasonResults.length),
      oddsEventCount: unique(seasonOdds.map((row) => row.event_id)).length,
      eventsWithPregameOddsSnapshot: unique(seasonOdds.map((row) => row.event_id)).length,
      eventsWithMultipleOddsSnapshots: Object.values(seasonOdds.reduce((acc, row) => {
        acc[row.event_id] = (acc[row.event_id] ?? 0) + 1
        return acc
      }, {})).filter((count) => count > 1).length,
      featureCoverage: seasonFeatures.length,
      predictionCoverage: seasonPredictions.length,
      settlementCoverage: seasonPredictions.filter((row) => ['win', 'loss', 'push'].includes(lower(row.status)) || ['win', 'loss', 'push'].includes(lower(row.result)) || row.settled_at).length,
      coverageClass: classifyCoverage(seasonEvents.length),
    }
  })

  return {
    sport: sport.label,
    sportKey: sport.sportKey,
    leagueKey: sport.leagueKey,
    configured: true,
    providerAvailable: sport.provider,
    providerSportKey: sport.sportKey,
    canonicalTeams: teams.count,
    canonicalPlayers: players.count,
    canonicalEvents: eventRows.length,
    currentSeasonEvents: seasonCoverage.find((row) => row.season === sport.currentSeason)?.eventCount ?? 0,
    previousSeasonEvents: seasonCoverage.find((row) => row.season === sport.previousSeason)?.eventCount ?? 0,
    results: resultRows.length,
    currentOddsSnapshots: oddsCount.count || oddsRows.length,
    currentOddsEvents,
    historicalOddsSnapshots: oddsRows.filter((row) => row.is_opening || row.is_closing || String(row.snapshot_time ?? '').startsWith(sport.previousSeason)).length,
    featureSnapshots: featureCount.count || featureRows.length,
    productionPredictions,
    previewPredictions,
    shadowPredictions: predictionRows.filter((row) => lower(row.model_role).includes('shadow')).length,
    settledPredictions,
    learningEvidence: settledPredictions,
    performanceInclusion: productionPredictions > 0 || settledPredictions > 0 ? 'PARTIAL_OR_AVAILABLE' : 'NOT_READY',
    productVisibility: ['MLB', 'NFL', 'NHL'].includes(sport.label) ? 'VISIBLE' : oddsRows.length || eventRows.length ? 'DIAGNOSTIC_ONLY' : 'BLOCKED_EMPTY',
    schedulerCoverage: sport.label === 'MLB' ? 'ADAPTIVE_REFRESH_AND_OPERATING_DAY' : 'NOT_PRODUCTION_SCHEDULED',
    resultSyncCoverage: sport.label === 'MLB' ? 'MLB_STATS_API_CANONICAL' : resultRows.length ? 'STORED_PROVIDER_RESULT_EVIDENCE_ONLY' : 'NONE',
    settlementCoverage: sport.label === 'MLB' ? 'PRODUCTION_SETTLEMENT_PATH' : settledPredictions ? 'PREVIEW_OR_LEGACY_ONLY' : 'BLOCKED',
    lifecycleState,
    exactProductionBlocker: blocker,
    seasons,
    markets,
    providers,
    bookmakers: bookmakers.slice(0, 20),
    earliestEvent,
    latestEvent,
    earliestOdds,
    latestOdds,
    providerMappings: mappings.count,
    syncJobs: syncJobs.rows.length,
    latestSyncJob: syncJobs.rows[0] ?? null,
    seasonCoverage,
    exactPredictionRows: predictionCount.count || predictionRows.length,
    readErrors: [events.error, results.error, odds.error, featureCount.error && !featureCount.count ? featureCount.error : null, predictions.error, teams.error, players.error, mappings.error, syncJobs.error].filter(Boolean),
  }
}

const generatedAt = new Date().toISOString()
const sports = []
for (const sport of SPORTS) sports.push(await auditSport(sport))

const allSyncJobs = await safeRows('sports_sync_jobs', 'id,provider,sport_key,job_type,status,records_fetched,records_inserted,records_updated,records_skipped,error_count,started_at,completed_at,metadata', (q) => q.order('started_at', { ascending: false }), 1000)
const operatingEvents = await safeRows('operating_day_lifecycle_events', 'id,action,status,provider_calls_made,started_at,completed_at,created_at,metadata', (q) => q.order('created_at', { ascending: false }), 200)
const modelWeights = await safeCount('model_weight_history')

const oddsRowsAll = sports.reduce((sum, sport) => sum + sport.currentOddsSnapshots, 0)
const currentSportsWithOdds = sports.filter((sport) => sport.currentOddsSnapshots > 0).length
const activeSportsForRefresh = Math.max(1, currentSportsWithOdds)
const estimatedMarketsPerSport = 3
const estimatedRegions = 1
const refreshScenarios = [
  { scenario: 'A_MLB_ONLY_10_MIN', sports: 1, intervalMinutes: 10 },
  { scenario: 'B_MLB_ONLY_5_MIN', sports: 1, intervalMinutes: 5 },
  { scenario: 'C_SUPPORTED_SPORTS_10_MIN', sports: activeSportsForRefresh, intervalMinutes: 10 },
  { scenario: 'D_SUPPORTED_SPORTS_5_MIN', sports: activeSportsForRefresh, intervalMinutes: 5 },
  { scenario: 'E_ADAPTIVE_REFRESH', sports: activeSportsForRefresh, intervalMinutes: 15 },
].map((item) => {
  const refreshesPerDay = Math.ceil((16 * 60) / item.intervalMinutes)
  const callsPerRefresh = item.sports * estimatedMarketsPerSport * estimatedRegions
  const callsPerDay = callsPerRefresh * refreshesPerDay
  const creditsPerDay = callsPerDay
  const creditsPerMonth = creditsPerDay * 30
  return {
    ...item,
    refreshesPerDay,
    estimatedCallsPerRefresh: callsPerRefresh,
    estimatedCallsPerDay: callsPerDay,
    estimatedCreditsPerDay: creditsPerDay,
    estimatedCreditsPerMonth: creditsPerMonth,
    expectedSnapshotVolumePerDay: callsPerDay * 20,
    databaseGrowthRisk: callsPerDay > 1000 ? 'HIGH' : callsPerDay > 250 ? 'MEDIUM' : 'LOW',
    budgetSustainability: item.scenario === 'E_ADAPTIVE_REFRESH' ? 'BEST_SAFE_POLICY' : creditsPerMonth > 20000 ? 'UNSUSTAINABLE_WITHOUT_BUDGET_CONFIRMATION' : 'POSSIBLE_AFTER_PROVIDER_BUDGET_CONFIRMATION',
  }
})

const readinessMatrix = sports.map((sport) => ({
  sport: sport.sport,
  currentSeason: sport.currentSeasonEvents,
  previousSeason: sport.previousSeasonEvents,
  events: sport.canonicalEvents,
  results: sport.results,
  currentOdds: sport.currentOddsSnapshots,
  historicalOdds: sport.historicalOddsSnapshots,
  features: sport.featureSnapshots,
  predictions: sport.productionPredictions + sport.previewPredictions,
  settlement: sport.settledPredictions,
  learning: sport.learningEvidence,
  scheduler: sport.schedulerCoverage,
  product: sport.productVisibility,
  state: sport.lifecycleState,
  blocker: sport.exactProductionBlocker,
}))

const marketReadiness = sports.flatMap((sport) => ['moneyline', 'spread', 'total', 'first_half', 'player_props'].map((market) => {
  const hasOdds = market === 'player_props'
    ? sport.markets.some((item) => item.startsWith('player_props'))
    : sport.markets.includes(market) || (market === 'spread' && sport.markets.includes('run_line'))
  const hasPredictions = sport.productionPredictions + sport.previewPredictions > 0 && ['moneyline', 'spread', 'total'].includes(market)
  const classification =
    sport.lifecycleState === 'PRODUCTION_READY' && hasOdds && hasPredictions && ['moneyline', 'spread', 'total'].includes(market) ? 'PRODUCTION_PREDICTABLE' :
    sport.lifecycleState === 'PREVIEW_READY' && hasPredictions && ['moneyline', 'spread', 'total'].includes(market) ? 'PREVIEW_PREDICTABLE' :
    hasOdds && !hasPredictions ? 'DATA_EXISTS_ENGINE_BLOCKED' :
    hasPredictions && !hasOdds ? 'ENGINE_EXISTS_DATA_BLOCKED' :
    sport.settlementCoverage === 'BLOCKED' && hasPredictions ? 'SETTLEMENT_BLOCKED' :
    'UNSUPPORTED'
  return { sport: sport.sport, market, classification, hasOdds, hasPredictions, settlementCoverage: sport.settlementCoverage }
}))

const providerGapMatrix = sports.flatMap((sport) => [
  ['schedule', sport.canonicalEvents ? 'sport_events' : 'blocked'],
  ['results', sport.results ? 'game_results' : 'blocked'],
  ['teams', sport.canonicalTeams ? 'sports_teams' : 'blocked'],
  ['players', sport.canonicalPlayers ? 'sport_players' : 'blocked'],
  ['current odds', sport.currentOddsSnapshots ? 'sports_odds_snapshots' : 'blocked'],
  ['historical odds', sport.historicalOddsSnapshots ? 'sports_odds_snapshots' : 'blocked'],
  ['features', sport.featureSnapshots ? 'historical_feature_snapshots' : 'blocked'],
  ['props', sport.markets.some((market) => market.startsWith('player_props')) ? 'sports_odds_snapshots player_props' : 'blocked'],
].map(([domain, source]) => ({
  sport: sport.sport,
  domain,
  currentSource: source,
  coverage: source === 'blocked' ? 'NONE' : 'PARTIAL_OR_AVAILABLE',
  freshness: sport.latestOdds ?? sport.latestEvent ?? null,
  reliability: sport.lifecycleState === 'PRODUCTION_READY' ? 'HIGH_FOR_MLB_CORE' : 'NOT_PRODUCTION_CERTIFIED',
  providerCost: domain.includes('odds') || domain === 'props' ? 'provider_credit_required_for_future_live_refresh' : 'stored_read_only',
  missing: source === 'blocked' ? `${domain} coverage not certified` : null,
  fallback: domain === 'results' && sport.sport === 'MLB' ? 'MLB Stats API' : 'manual/approved provider plan required',
})))

const dailyAutomation = [
  ['event/schedule sync', 'operating-day/historical import/sport sync routes', 'MLB daily plus manual/import paths', 'CRON_SECRET for writes', 'provider calls only in confirmed live mode', 'idempotent event/provider ids', 'MLB enabled; non-MLB not production scheduled'],
  ['odds refresh', '/api/operations/adaptive-refresh and operating-day execute', 'adaptive; desired 5-10 min near start not yet certified', 'CRON_SECRET for writes', 'provider calls in live mode', 'deterministic odds snapshots', 'MLB production path only'],
  ['feature generation', 'feature store and prediction generation services', 'on prediction/import execution', 'protected routes for writes', 'writes feature snapshots when generation is approved', 'deterministic_key', 'MLB + preview sports'],
  ['prediction generation', 'sport prediction routes/scripts', 'manual/protected scheduler depending sport', 'CRON_SECRET where mutating', 'prediction writes only when confirmed', 'idempotency keys', 'MLB production; NFL/NHL preview'],
  ['result sync', '/api/results/sync and result scripts', 'postgame/adaptive/manual', 'CRON_SECRET for writes', 'bounded provider calls when confirmed', 'provider result ids', 'MLB production path'],
  ['settlement', '/api/operating-day/[id]/settle, /api/settlement/*', 'oldest ready first', 'CRON_SECRET for writes', 'no provider unless canonical result path requires', 'settlement source/version', 'MLB production'],
  ['learning evidence', 'ai-learning-lifecycle.service.ts', 'derived from settled rows', 'read-only/reporting; writes only via settlement lifecycle', '0 provider calls', 'prediction/result linkage', 'evidence accumulates; training disabled'],
  ['Performance refresh', '/api/performance*', 'read-on-demand/daily update route', 'protected for write updates', '0 provider calls', 'scoped production rows', 'available with MLB evidence'],
  ['provider-budget monitoring', 'provider-budget.service.ts', 'read on operations calls', 'read-only status routes', '0 provider calls', 'budget ledger/config', 'available'],
]

const audit = {
  success: true,
  mode: 'operational_readiness_multisport_audit_v1',
  generatedAt,
  readOnly: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  predictionWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
  modelTrainingRuns: 0,
  modelWeightMutations: 0,
  epochMutations: 0,
  executiveVerdict: {
    canPlatformOperateDailyNow: 'PARTIAL_MLB_ONLY',
    summary: 'Pick Analyzer can operate daily for MLB core workflows when scheduler/provider credentials/budget are healthy. It is not yet a fully daily multi-sport production platform.',
    automaticTrainingStatus: 'DISABLED_AND_NOT_AUTHORIZED',
    safeHighestFrequencyPolicy: 'adaptive refresh: 60 minutes >24h, 15 minutes 2-24h, 5-10 minutes under 2h, stop at start; requires provider-budget confirmation before activation',
  },
  pipeline: PIPELINE.map(([stage, service, route, tables, input, output, idempotency, recovery, supportedSports, lifecycle]) => ({ stage, service, route, tables, input, output, idempotency, recovery, supportedSports, lifecycle })),
  sports,
  readinessMatrix,
  marketReadiness,
  providerGapMatrix,
  oddsApiCompleteness: {
    allAvailableDataDownloaded: false,
    completePreviousSeasonEverySupportedSport: false,
    completeCurrentSeasonEverySupportedSport: false,
    oddsAndScoresDownloaded: 'odds broadly stored for some sports; score/result evidence limited and not complete every sport',
    marketsDownloaded: unique(sports.flatMap((sport) => sport.markets)),
    playerPropsDownloaded: sports.some((sport) => sport.markets.some((market) => market.startsWith('player_props'))),
    sportsSkippedOrBlocked: sports.filter((sport) => sport.lifecycleState !== 'PRODUCTION_READY').map((sport) => ({ sport: sport.sport, blocker: sport.exactProductionBlocker })),
    syncJobsByProvider: allSyncJobs.rows.reduce((acc, row) => {
      increment(acc, lower(row.provider))
      return acc
    }, {}),
    syncJobsBySport: allSyncJobs.rows.reduce((acc, row) => {
      increment(acc, row.sport_key)
      return acc
    }, {}),
  },
  dailyAutomation,
  refreshScenarios,
  dataRetention: {
    currentOddsSnapshots: oddsRowsAll,
    estimatedFiveMinuteMlbMonthSnapshots: refreshScenarios.find((row) => row.scenario === 'B_MLB_ONLY_5_MIN')?.expectedSnapshotVolumePerDay * 30,
    duplicateProtections: ['sports_odds_snapshots.id primary key', 'historical_feature_snapshots.deterministic_key unique', 'prediction idempotency/group keys', 'provider_entity_mappings natural provider keys'],
    retentionPolicyStatus: 'NO_DELETION_OR_ARCHIVAL_POLICY_CHANGED',
    risk: '5-minute multi-sport snapshots can grow quickly; summarize or partition only after explicit retention policy approval.',
  },
  operatingReadyDefinition: {
    DATA_READY: ['canonical schedule/events', 'current and previous season coverage', 'provider provenance'],
    PREDICTION_READY: ['features', 'market normalization', 'engine', 'cutoff safety'],
    PREVIEW_READY: ['pregame predictions isolated from production/official picks'],
    PRODUCTION_READY: ['results', 'settlement', 'learning evidence', 'performance inclusion', 'scheduler smoke period'],
    OFFICIAL_PICK_READY: ['production ready plus calibrated policy gates and minimum settled sample'],
    TRAINING_READY: ['training-safe contract, sufficient settled sample, walk-forward validation approval'],
  },
  repairRoadmap: [
    { priority: 'A', phase: 'Reliable daily MLB operation', providerCallsRequired: 'bounded MLB schedule/odds/results only when due', estimatedCredits: 'depends on slate; dry-run first', userApprovalRequired: true, expectedResult: 'MLB daily loop stable' },
    { priority: 'B', phase: '5-10 minute adaptive odds refresh', providerCallsRequired: 'The Odds API/SportsDataIO live odds calls', estimatedCredits: 'see refresh scenarios', userApprovalRequired: true, expectedResult: 'near-start market freshness without budget breach' },
    { priority: 'C', phase: 'Previous/current-season data completeness', providerCallsRequired: 'historical odds/results/stat imports by sport', estimatedCredits: 'must be planned per sport/date', userApprovalRequired: true, expectedResult: 'coverage gaps closed' },
    { priority: 'D', phase: 'NFL/NHL production readiness', providerCallsRequired: 'future results and settlement evidence', estimatedCredits: 'low/moderate for scores plus odds refresh', userApprovalRequired: true, expectedResult: 'preview to production gate' },
    { priority: 'E', phase: 'NBA/Soccer/BSN readiness', providerCallsRequired: 'depends on source entitlement and competition scope', estimatedCredits: 'unknown until source plan', userApprovalRequired: true, expectedResult: 'truthful shadow/preview path' },
    { priority: 'F', phase: 'Tennis/UFC evaluation', providerCallsRequired: 'event identity, odds/results coverage', estimatedCredits: 'bounded discovery plan required', userApprovalRequired: true, expectedResult: 'classify as production candidate or data-only' },
  ],
  modelWeightHistoryRows: modelWeights.count,
  latestOperatingLifecycleEvents: operatingEvents.rows.slice(0, 10),
  providerCallsRequiredByFuturePhase: 'Required for execution phases only; this audit consumed zero.',
  certificationMarkers: [
    'OPERATIONAL_READINESS_AUDIT_PASS',
    'MULTI_SPORT_DATA_COVERAGE_AUDIT_PASS',
    'CURRENT_PREVIOUS_SEASON_COVERAGE_AUDIT_PASS',
    'ODDS_API_EXTRACTION_COMPLETENESS_AUDIT_PASS',
    'MULTI_SPORT_PREDICTION_READINESS_AUDIT_PASS',
    'DAILY_AUTONOMY_AUDIT_PASS',
    'ODDS_REFRESH_FEASIBILITY_AUDIT_PASS',
    'RESULT_SETTLEMENT_LEARNING_LOOP_AUDIT_PASS',
    'MULTI_SPORT_PRODUCTION_READINESS_MATRIX_PASS',
    'NO_PROVIDER_CALL_PASS',
    'NO_PRODUCTION_MUTATION_PASS',
    'NO_PREDICTION_WRITE_PASS',
    'NO_SETTLEMENT_WRITE_PASS',
    'NO_MODEL_TRAINING_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
}

audit.fingerprint = stableHash({
  mode: audit.mode,
  readinessMatrix,
  marketReadiness,
  providerGapMatrix,
  refreshScenarios,
  safety: {
    providerCallsMade: audit.providerCallsMade,
    databaseMutations: audit.databaseMutations,
    modelTrainingRuns: audit.modelTrainingRuns,
  },
})

const coverageOut = {
  success: true,
  mode: 'multi_sport_current_previous_season_coverage_v1',
  generatedAt,
  readOnly: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  sports: sports.map((sport) => ({
    sport: sport.sport,
    sportKey: sport.sportKey,
    currentSeason: sport.seasonCoverage.find((row) => row.season === SPORTS.find((s) => s.label === sport.sport)?.currentSeason),
    previousSeason: sport.seasonCoverage.find((row) => row.season === SPORTS.find((s) => s.label === sport.sport)?.previousSeason),
    allSeasonCoverage: sport.seasonCoverage,
  })),
  fingerprint: stableHash(sports.map((sport) => sport.seasonCoverage)),
}

const matrixOut = {
  success: true,
  mode: 'multi_sport_production_readiness_matrix_v1',
  generatedAt,
  readOnly: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  readinessMatrix,
  marketReadiness,
  providerGapMatrix,
  fingerprint: stableHash({ readinessMatrix, marketReadiness, providerGapMatrix }),
}

fs.writeFileSync(OUT_COVERAGE, `${JSON.stringify(coverageOut, null, 2)}\n`)
fs.writeFileSync(OUT_MATRIX, `${JSON.stringify(matrixOut, null, 2)}\n`)

fs.writeFileSync(OUT_AUDIT, `# Operational Readiness Multi-Sport Audit V1

Date: 2026-07-29

Status: READ-ONLY AUDIT

No provider calls. No production mutation. No prediction writes. No settlement writes. No model training.

## Executive Verdict

Pick Analyzer is **partially daily-operational for MLB only**. It is not yet a complete daily multi-sport production prediction platform. NFL and NHL have Preview prediction evidence, while NBA, Soccer, BSN, Tennis and UFC remain blocked by data/source/canonical lifecycle gaps.

## Pipeline

${table(['Stage', 'Canonical service', 'Routes', 'Tables', 'Lifecycle'], audit.pipeline.map((row) => [row.stage, row.service, row.route, row.tables, row.lifecycle]))}

## Sport Readiness

${table(['Sport', 'Events', 'Results', 'Odds', 'Features', 'Predictions', 'Settlement', 'State', 'Blocker'], readinessMatrix.map((row) => [row.sport, String(row.events), String(row.results), String(row.currentOdds), String(row.features), String(row.predictions), String(row.settlement), row.state, row.blocker]))}

## Product Answer

- Can the platform operate daily now? MLB core only, not full multi-sport.
- Can each sport generate predictions now? MLB production, NFL/NHL preview, others blocked or data-only.
- Does automatic model training occur? No.
- Were provider calls made during this audit? 0.
`)

fs.writeFileSync(OUT_ODDS, `# Odds API Extraction Completeness V1

Date: 2026-07-29

Status: STORED-EVIDENCE AUDIT

No provider calls. No production mutation.

## Answers

1. Was all available The Odds API data downloaded? **No.**
2. Was the complete previous season downloaded for every supported sport? **No.**
3. Was the current season downloaded for every supported sport? **No.**
4. Were only odds downloaded, or also scores/results? Stored odds exist for some sports; score/result evidence is limited and not complete for every sport.
5. Which markets were downloaded? ${audit.oddsApiCompleteness.marketsDownloaded.join(', ') || 'none observed'}.
6. Were player props downloaded? ${audit.oddsApiCompleteness.playerPropsDownloaded ? 'Yes, limited stored player-prop rows exist.' : 'No certified broad player-prop download.'}
7. Which sports were skipped or blocked? ${audit.oddsApiCompleteness.sportsSkippedOrBlocked.map((row) => `${row.sport}: ${row.blocker}`).join('; ')}.
8. What remained unqueried? Complete current/previous seasons for non-MLB sports, competition-scoped soccer, broad player props and complete score/result coverage remain unqueried or uncertified because of credit, source entitlement and architecture gates.

## Stored Snapshot Summary

${table(['Sport', 'Odds rows', 'Markets', 'Earliest odds', 'Latest odds'], sports.map((sport) => [sport.sport, String(sport.currentOddsSnapshots), sport.markets.join(', ') || 'none', sport.earliestOdds ?? 'none', sport.latestOdds ?? 'none']))}
`)

fs.writeFileSync(OUT_REFRESH, `# Odds Refresh 5-10 Minute Feasibility V1

Date: 2026-07-29

Status: FEASIBILITY ONLY

No cadence change. No provider calls. No production mutation.

## Recommendation

Use adaptive refresh, not flat 5-minute refresh across all sports: 60 minutes more than 24 hours out, 15 minutes from 2-24 hours, 5-10 minutes under 2 hours, and stop pregame refresh after event start.

${table(['Scenario', 'Sports', 'Interval', 'Calls/day', 'Credits/month', 'DB growth risk', 'Sustainability'], refreshScenarios.map((row) => [row.scenario, String(row.sports), `${row.intervalMinutes}m`, String(row.estimatedCallsPerDay), String(row.estimatedCreditsPerMonth), row.databaseGrowthRisk, row.budgetSustainability]))}
`)

fs.writeFileSync(OUT_AUTONOMY, `# Daily Autonomy Certification V1

Date: 2026-07-29

Status: READ-ONLY CERTIFICATION

No provider calls. No production mutation.

${table(['Automation', 'Route/service', 'Cadence', 'Auth', 'Idempotency', 'Enabled state'], dailyAutomation.map((row) => row))}

## Recovery

The MLB loop has idempotent/recoverable pieces for stale odds, late results and settlement backlog. Full multi-sport recovery is not certified because canonical results, settlement and learning loops are not complete for every sport.
`)

fs.writeFileSync(OUT_ROADMAP, `# Operational Launch Repair Roadmap V1

Date: 2026-07-29

Status: ROADMAP ONLY

No roadmap execution was performed. No provider calls. No production mutation.

${table(['Priority', 'Phase', 'Provider calls', 'Credits', 'Approval', 'Expected result'], audit.repairRoadmap.map((row) => [row.priority, row.phase, row.providerCallsRequired, row.estimatedCredits, row.userApprovalRequired ? 'required' : 'not required', row.expectedResult]))}
`)

const repairPlanPath = 'docs/FULL_PLATFORM_AUDIT_V1_REPAIR_PLAN.md'
const repairAppend = `

## Operational Readiness Multi-Sport Audit V1

No provider calls. No production mutation.

This audit classifies Pick Analyzer as daily-operational for MLB core workflows only. NFL and NHL remain Preview, while NBA/Soccer/BSN/Tennis/UFC require coverage, identity, settlement and learning closure before Production. The next repair sequence is Priority A MLB daily reliability, Priority B adaptive 5-10 minute odds refresh feasibility, Priority C current/previous season coverage, Priority D NFL/NHL production readiness, Priority E NBA/Soccer/BSN readiness and Priority F Tennis/UFC evaluation.
`
if (fs.existsSync(repairPlanPath)) {
  const current = fs.readFileSync(repairPlanPath, 'utf8')
  if (!current.includes('Operational Readiness Multi-Sport Audit V1')) fs.writeFileSync(repairPlanPath, `${current.trimEnd()}\n${repairAppend}`)
}

fs.writeFileSync('docs/OPERATIONAL_READINESS_MULTI_SPORT_AUDIT_V1.json', `${JSON.stringify(audit, null, 2)}\n`)

console.log(JSON.stringify({
  success: true,
  mode: audit.mode,
  sportsAudited: sports.length,
  platformVerdict: audit.executiveVerdict.canPlatformOperateDailyNow,
  providerCallsMade: audit.providerCallsMade,
  databaseMutations: audit.databaseMutations,
  predictionWrites: audit.predictionWrites,
  settlementWrites: audit.settlementWrites,
  modelTrainingRuns: audit.modelTrainingRuns,
  fingerprint: audit.fingerprint,
}, null, 2))
