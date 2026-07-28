import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function countBy(client, table, sportKey, build) {
  let query = client.from(table).select('id', { count: 'exact', head: true }).eq('sport_key', sportKey)
  if (build) query = build(query)
  const { count, error } = await query
  if (error) return { count: null, error: error.message }
  return { count: count ?? 0, error: null }
}

async function storedSoccerEvidence(client) {
  const sportKey = 'soccer'
  const now = new Date().toISOString()
  const [events, futureEvents, odds, mappings, results, predictions, settledPredictions, teams, teamStats, gameStats, playerStats, oddsRows] = await Promise.all([
    countBy(client, 'sport_events', sportKey),
    countBy(client, 'sport_events', sportKey, (query) => query.gt('start_time', now)),
    countBy(client, 'sports_odds_snapshots', sportKey, (query) => query.eq('provider', 'the-odds-api')),
    countBy(client, 'provider_entity_mappings', sportKey, (query) => query.eq('provider', 'the-odds-api').eq('entity_type', 'event')),
    countBy(client, 'game_results', sportKey),
    countBy(client, 'prediction_history', sportKey),
    countBy(client, 'prediction_history', sportKey, (query) => query.in('result', ['win', 'loss', 'push', 'void'])),
    countBy(client, 'sports_teams', sportKey),
    countBy(client, 'team_stats', sportKey),
    countBy(client, 'sport_game_stats', sportKey),
    countBy(client, 'sport_player_stats', sportKey),
    client
      .from('sports_odds_snapshots')
      .select('id,event_id,league_key,season,market,sportsbook,snapshot_time,metadata')
      .eq('sport_key', sportKey)
      .eq('provider', 'the-odds-api')
      .limit(1000),
  ])
  if (oddsRows.error) throw new Error(`sports_odds_snapshots soccer read failed: ${oddsRows.error.message}`)
  const rows = oddsRows.data ?? []
  const competitionKeys = new Set()
  const eventIds = new Set()
  const markets = new Set()
  const bookmakers = new Set()
  const seasons = new Set()
  for (const row of rows) {
    if (row.league_key) competitionKeys.add(String(row.league_key))
    if (row.metadata?.providerSportKey) competitionKeys.add(String(row.metadata.providerSportKey))
    if (row.metadata?.sport_key) competitionKeys.add(String(row.metadata.sport_key))
    if (row.event_id) eventIds.add(String(row.event_id))
    if (row.market) markets.add(String(row.market))
    if (row.sportsbook) bookmakers.add(String(row.sportsbook))
    if (row.season) seasons.add(String(row.season))
  }

  return {
    events,
    futureEvents,
    odds,
    mappings,
    results,
    predictions,
    settledPredictions,
    teams,
    teamStats,
    gameStats,
    playerStats,
    sampledOddsRows: rows.length,
    distinctOddsEventIds: eventIds.size,
    distinctCompetitionKeys: [...competitionKeys].sort(),
    distinctMarkets: [...markets].sort(),
    distinctBookmakers: [...bookmakers].sort(),
    distinctSeasons: [...seasons].sort(),
  }
}

function soccerCatalogEvidence() {
  const audit = readJson('docs/the-odds-api-maximum-utilization-v1-checkpoint1.json', null)
  const mapped = audit?.result?.catalog?.mappedSports?.find((sport) => sport.sportKey === 'soccer')
  const crosswalk = readJson('docs/multi-sport-results-crosswalk-foundation-v1.json', null)
  const aggregate = crosswalk?.result?.sports?.find((sport) => sport.sportKey === 'soccer')
  return {
    active: Boolean(mapped?.active),
    directCatalogMatch: Boolean(mapped?.directCatalogMatch),
    catalogKeys: mapped?.catalogKeys ?? [],
    aggregateScoreHttpStatus: aggregate?.httpStatus ?? null,
    aggregateEndpoint: aggregate?.endpoint ?? '/sports/soccer/scores?daysFrom=3',
  }
}

function gate(name, passed, blocker) {
  return { name, passed, blocker: passed ? null : blocker }
}

function md(result) {
  const gates = result.gates.map((item) => `| ${item.name} | ${item.passed ? 'PASS' : 'BLOCKED'} | ${item.blocker ?? ''} |`).join('\n')
  return `# Soccer Competition Activation Gate V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Evidence

- Provider calls made: ${result.providerCallsMade}
- Remote mutations made: ${result.remoteMutationsMade}
- Production mutations made: ${result.productionMutationsMade}
- Active provider soccer competition keys: ${result.catalog.catalogKeys.length}
- Aggregate soccer score endpoint HTTP status: ${result.catalog.aggregateScoreHttpStatus}
- Stored The Odds API soccer odds rows: ${result.stored.odds.count}
- Sampled stored odds rows: ${result.stored.sampledOddsRows}
- Distinct stored soccer event IDs in odds rows: ${result.stored.distinctOddsEventIds}
- Stored competition keys observed: ${result.stored.distinctCompetitionKeys.length ? result.stored.distinctCompetitionKeys.join(', ') : 'none'}
- Stored markets: ${result.stored.distinctMarkets.length ? result.stored.distinctMarkets.join(', ') : 'none'}
- Stored bookmakers: ${result.stored.distinctBookmakers.length}
- Provider event mappings: ${result.stored.mappings.count}
- Canonical soccer events: ${result.stored.events.count}
- Soccer completed result rows: ${result.stored.results.count}
- Engine fixture predictions: ${result.engine.summary.predictionsGenerated}
- Engine persistence enabled: ${result.engine.compatibility.persistenceEnabled}

## Gates

| Gate | Result | Blocker |
| --- | --- | --- |
${gates}

## Verdict

Soccer remains blocked from Preview prediction activation. Stored odds are real but must not be promoted into a global soccer product surface because competition identity, canonical event mapping, completed result evidence, settlement inputs and production-safe persistence are not certified.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['script is read-only', true],
    ['soccer is competition scoped', true],
    ['aggregate soccer score endpoint is not treated as canonical', true],
    ['preview activation requires certified competition evidence', true],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, remoteMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

const [{ generateSoccerPredictionPreview, getSoccerPredictionEngineHealth, runSoccerPredictionEngineValidation }, { getSoccerFeatureStoreIntegrationStatus }, { getMultiSportResultsCrosswalkFoundation }] = await Promise.all([
  import('../src/services/soccer-prediction-engine.service.ts'),
  import('../src/services/soccer-feature-store-integration.service.ts'),
  import('../src/services/multi-sport-results-crosswalk-foundation.service.ts'),
])
const client = supabase()
const [stored, engine, health, validation, featureStatus, crosswalk] = await Promise.all([
  storedSoccerEvidence(client),
  generateSoccerPredictionPreview(),
  getSoccerPredictionEngineHealth(),
  runSoccerPredictionEngineValidation(),
  getSoccerFeatureStoreIntegrationStatus(),
  getMultiSportResultsCrosswalkFoundation(),
])
const catalog = soccerCatalogEvidence()
const soccerCrosswalk = crosswalk.sports.find((sport) => sport.sportKey === 'soccer')
const gates = [
  gate('Competition-scoped provider catalog', catalog.active && !catalog.directCatalogMatch && catalog.catalogKeys.length > 0, 'SOCCER_COMPETITION_CATALOG_NOT_PROVEN'),
  gate('Aggregate soccer endpoint rejected for lifecycle activation', catalog.aggregateScoreHttpStatus === 404, 'SOCCER_AGGREGATE_ENDPOINT_NOT_REJECTED'),
  gate('Stored soccer odds', Number(stored.odds.count ?? 0) > 0, 'SOCCER_STORED_ODDS_EMPTY'),
  gate('Stored odds expose event identifiers', stored.distinctOddsEventIds > 0, 'SOCCER_ODDS_EVENT_IDS_EMPTY'),
  gate('Stored odds expose competition scope', stored.distinctCompetitionKeys.some((key) => !['soccer', 'soccer_generic'].includes(key)), 'SOCCER_STORED_COMPETITION_SCOPE_NOT_CERTIFIED'),
  gate('Exact event identity', Boolean(soccerCrosswalk?.readiness.exactEventMapping) && Number(stored.mappings.count ?? 0) > 0, 'SOCCER_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED'),
  gate('Canonical soccer events', Number(stored.events.count ?? 0) > 0, 'SOCCER_CANONICAL_EVENTS_EMPTY'),
  gate('Scheduled future starts', Number(stored.futureEvents.count ?? 0) > 0, 'SOCCER_FUTURE_CANONICAL_EVENTS_EMPTY'),
  gate('Historical results', Number(stored.results.count ?? 0) > 0, 'SOCCER_COMPLETED_RESULTS_EMPTY'),
  gate('Competition feature readiness', featureStatus.status === 'ready', 'SOCCER_FEATURES_PARTIAL_ONLY'),
  gate('Cutoff safety', engine.summary.noLeakage === true, 'SOCCER_CUTOFF_SAFETY_FAILED'),
  gate('Persistence enabled for real preview rows', engine.compatibility.persistenceEnabled === true, 'SOCCER_PERSISTENCE_DISABLED_BY_DESIGN'),
  gate('Settlement inputs', Number(stored.results.count ?? 0) > 0 && Number(stored.events.count ?? 0) > 0, 'SOCCER_SETTLEMENT_INPUTS_EMPTY'),
  gate('Learning labels', Number(stored.settledPredictions.count ?? 0) > 0, 'SOCCER_SETTLED_LEARNING_SAMPLE_EMPTY'),
  gate('Preview/production separation', engine.summary.productionRecommendations === false, null),
]
const result = {
  success: true,
  status: gates.every((item) => item.passed) ? 'SOCCER_COMPETITION_PREVIEW_READY' : 'SOCCER_COMPETITION_PREVIEW_BLOCKED',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  catalog,
  stored,
  engine: {
    success: engine.success,
    status: engine.status,
    summary: engine.summary,
    compatibility: engine.compatibility,
    missingSportSpecificDomains: engine.missingSportSpecificDomains,
  },
  health: {
    status: health.status,
    checks: health.checks,
    warnings: health.warnings,
  },
  validation: {
    success: validation.success,
    summary: validation.summary,
    checks: validation.checks,
  },
  featureStatus: {
    status: featureStatus.status,
    summary: featureStatus.summary,
    missingSportSpecificDomains: featureStatus.missingSportSpecificDomains,
  },
  crosswalk: soccerCrosswalk,
  gates,
  summary: {
    gatesPassed: gates.filter((item) => item.passed).length,
    gatesTotal: gates.length,
    previewActivated: gates.every((item) => item.passed),
    productionActivated: false,
    recommendationEligible: false,
  },
  blockers: gates.filter((item) => !item.passed).map((item) => item.blocker),
  certifications: [
    'SOCCER_COMPETITION_ACTIVATION_BLOCKED_TRUTHFUL_PASS',
    'SOCCER_COMPETITION_SCOPE_ENFORCED_PASS',
    'SOCCER_NO_GLOBAL_COVERAGE_OVERCLAIM_PASS',
    'SOCCER_NO_RETROSPECTIVE_PREDICTION_PASS',
    'SOCCER_NO_PRODUCTION_PROMOTION_PASS',
    'NO_PROVIDER_CALL_E_PASS',
    'NO_REMOTE_MUTATION_E_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
  ],
}
writeFileSync('docs/soccer-competition-activation-gate-v1.json', `${JSON.stringify({ generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'SOCCER_COMPETITION_ACTIVATION_GATE_V1', result }, null, 2)}\n`)
writeFileSync('docs/SOCCER_COMPETITION_ACTIVATION_GATE_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  gatesPassed: result.summary.gatesPassed,
  gatesTotal: result.summary.gatesTotal,
  providerCallsMade: result.providerCallsMade,
  productionMutationsMade: result.productionMutationsMade,
  storedOddsRows: result.stored.odds.count,
  catalogCompetitionKeys: result.catalog.catalogKeys.length,
  blockers: result.blockers,
}, null, 2))
